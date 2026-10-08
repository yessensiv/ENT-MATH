import {makePracticeVariant,validatePracticeVariant,variantTopics} from '@/lib/practice-variants';
import {taskFingerprint,seenTaskIds} from '@/lib/engine';
import {authenticate,loadCurrentState,saveState,publishedContent,response,failure,parseBody,textValue,answerValue,assertStudyAllowed,updatePlan,ApiError,clientState} from '@/lib/server-store';
import {sessions,createPractice,practiceItem,savePracticeDraft,submitPractice,publicPractice,PracticeError,repairTopicSelection} from '@/lib/practice-session';
import {fillFreshTasks} from '@/lib/fresh-tasks';
import {reviewGenerator} from '@/lib/review-generator';
import type {Task} from '@/lib/engine';

export async function GET(request:Request){try{const user=await authenticate(),{state}=await loadCurrentState(user);assertStudyAllowed(state);const id=new URL(request.url).searchParams.get('id')??state.activePracticeId;const session=sessions(state).find(s=>s.id===id);if(session?.topicId==='numbers'){const content=await publishedContent();if(repairTopicSelection(session,state,[...content.tasks,...(state.generatedTasks as Task[]||[])]))await saveState(user,state);}return response({session:session?publicPractice(session,state):null,history:sessions(state).filter(s=>s.finishedAt).slice(-30).reverse().map(s=>({id:s.id,topicId:s.topicId,finishedAt:s.finishedAt,total:s.main.length,correct:s.main.filter(i=>i.feedback?.correct).length}))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request),content=await publishedContent();
 const requestId=textValue(input.requestId,80);if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw new ApiError('Неверный идентификатор запроса.');
 const payload=JSON.stringify(input);
 for(let retry=0;retry<3;retry++){
  const {state}=await loadCurrentState(user);assertStudyAllowed(state);
  let session=sessions(state).find(s=>s.id===input.id);
  if(input.action==='start'){
   const topicId=textValue(input.topicId,120);if(!content.topics.some(t=>t.id===topicId))throw new ApiError('Тема не найдена.',404);
   session=sessions(state).find(s=>s.id===requestId)??sessions(state).find(s=>s.topicId===topicId&&!s.finishedAt);
   if(session){if(repairTopicSelection(session,state,[...content.tasks,...(state.generatedTasks as Task[]||[])]))await saveState(user,state);return response({session:publicPractice(session,state),state:clientState(user,state),resumed:true});}
   const size=Number(input.size??15);if(![10,15,20].includes(size))throw new ApiError('Выберите 10, 15 или 20 задач.');
   if(topicId!=='numbers'&&variantTopics.includes(topicId as typeof variantTopics[number])){
    const generated=(state.generatedTasks||[]) as Task[],seen=seenTaskIds(state),fingerprints=new Set([...content.tasks,...generated].map(taskFingerprint));
    let count=generated.filter(t=>t.topicId===topicId&&t.variant&&!t.reviewReserved&&!seen.has(t.id)).length;
    for(let seed=1;count<size&&seed<=10000;seed++){const task=makePracticeVariant(topicId,(seed*137)%10000+1,(1+seed%3) as 1|2|3);if(task&&validatePracticeVariant(task)&&!fingerprints.has(taskFingerprint(task))){generated.push(task);fingerprints.add(taskFingerprint(task));count++;}}
    state.generatedTasks=generated;
   }
   fillFreshTasks(state,topicId,content.tasks,reviewGenerator,false,1,size);
   session=createPractice(state,topicId,[...content.tasks,...(state.generatedTasks as Task[]||[])],size,requestId);
  }else{
   if(!session)throw new ApiError('Сессия не найдена.',404);
   if(session.receipts[requestId]){if(session.receipts[requestId]!==payload)throw new ApiError('Запрос уже использован.',409);return response({session:publicPractice(session,state),state:clientState(user,state),replayed:true});}
   if(session.finishedAt)throw new ApiError('Практика завершена. Откройте сохранённый отчёт.',409);
   if(input.version!==session.version)return response({error:'Практика изменена в другой вкладке. Обновите её; введённый ответ остаётся в поле.',code:'PRACTICE_CONFLICT',session:publicPractice(session,state)},409);
   const taskId=textValue(input.taskId??session.cursor,160);
   if(input.answer!==undefined)savePracticeDraft(session,taskId,answerValue(input.answer),textValue(input.steps??'',4000));
   switch(input.action){
    case 'save':break;
    case 'navigate':{const target=textValue(input.target,160);practiceItem(session,target);session.cursor=target;break;}
    case 'submit':{
     if((state.diagnosticSession as {taskIds?:string[]})?.taskIds?.includes(taskId))throw new ApiError('Завершите диагностику перед проверкой этой задачи.',409,'DIAGNOSTIC_ACTIVE');
     const topic=content.topics.find(t=>t.id===session!.topicId)!;
     const feedback=submitPractice(state,session,taskId,topic,[...content.tasks,...(state.generatedTasks as Task[]||[]),...session.main.map(i=>i.task)],reviewGenerator);
     if(feedback.status==='review')return response({error:feedback.explanation.ru,code:'ANSWER_REVIEW',review:feedback},422);
     break;
    }
    case 'skip':practiceItem(session,taskId).skipped=true;break;
    case 'finish':session.finishedAt=new Date().toISOString();if(state.activePracticeId===session.id)state.activePracticeId=null;state.practiceDraft=null;break;
    default:throw new ApiError('Неизвестное действие.');
   }
   session.version++;
  }
  session.receipts[requestId]=payload;
  // Only retry receipts are bounded; answers, reports and chat remain available in history.
  const keys=Object.keys(session.receipts);for(const key of keys.slice(0,Math.max(0,keys.length-100)))delete session.receipts[key];
  updatePlan(state,content.topics);
  try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({session:publicPractice(session,state),state:clientState(user,state)});
 }
 throw new ApiError('Повторите сохранение.',409,'STATE_CONFLICT');
}catch(e){return failure(e instanceof PracticeError?new ApiError(e.message,e.status):e);}}
