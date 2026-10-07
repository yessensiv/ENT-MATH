import {authenticate,loadCurrentState,saveState,response,failure,parseBody,textValue,assertStudyAllowed,ApiError,configuration,consumeTutorBudget,releaseFailedTutorBudget,settleTutorTokens} from '@/lib/server-store';
import {sessions,practiceItem,publicPractice} from '@/lib/practice-session';
import {makePracticeVariant,validatePracticeVariant} from '@/lib/practice-variants';
import {taskFingerprint,type Task} from '@/lib/engine';
import {tutorProvider} from '@/lib/tutor-provider';
import {boundedText} from '@/lib/bounded-body';

export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request),id=textValue(input.id,80),taskId=textValue(input.taskId,160),requestId=textValue(input.requestId,80),payload=JSON.stringify(input);
 if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw new ApiError('Неверный запрос.');
 const initial=(await loadCurrentState(user)).state;assertStudyAllowed(initial);const originalSession=sessions(initial).find(s=>s.id===id);
 if(!originalSession)throw new ApiError('Практика не найдена.',404);
 if(originalSession.receipts[requestId]){if(originalSession.receipts[requestId]!==payload)throw new ApiError('Идентификатор уже использован для другого запроса.',409);return response({session:publicPractice(originalSession,initial),replayed:true});}
 const original=practiceItem(originalSession,taskId),spec=original.task.variant as {seed:number;level:1|2|3}|undefined;
 if(originalSession.finishedAt||!original.feedback||!spec||!validatePracticeVariant(original.task))throw new ApiError('Новое условие доступно после проверки задачи поддерживаемого шаблона.');
 const parentId=original.parentId??original.task.id;
 if(originalSession.extra.filter(i=>i.parentId===parentId).length>=4)throw new ApiError('На эту задачу уже назначены четыре упражнения. Сделайте паузу или продолжите основную практику.');
 let seed=1+crypto.getRandomValues(new Uint32Array(1))[0]%10000,mode='verified-template';
 const settings=configuration();
 if(settings.TUTOR_API_KEY){let budget:Awaited<ReturnType<typeof consumeTutorBudget>>|undefined,answered=false;
  try{budget=await consumeTutorBudget(user);const provider=tutorProvider(settings);const r=await fetch(provider.url,{method:'POST',signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${settings.TUTOR_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,max_tokens:80,temperature:.8,messages:[{role:'system',content:'Select a seed for a new math practice condition. Reply only JSON {"seed":integer} with seed 1..10000. Do not supply answers or task text.'},{role:'user',content:JSON.stringify({topic:original.task.topicId,previousSeed:spec.seed,suggestion:seed})}]})});
   if(!r.ok)throw Error('PROVIDER');const data=JSON.parse(await boundedText(r,20000));answered=true;await settleTutorTokens(budget.reservationId,data.usage?.prompt_tokens,data.usage?.completion_tokens);
   const proposal=JSON.parse(String(data.choices?.[0]?.message?.content??'').replace(/^```(?:json)?\s*|\s*```$/g,''));if(!Number.isSafeInteger(proposal.seed)||proposal.seed<1||proposal.seed>10000)throw Error('INVALID_SEED');seed=proposal.seed;mode='ai-parameters-verified-template';
  }catch{if(budget&&!answered)await releaseFailedTutorBudget(user,8000,budget.reservationId);}
 }
 for(let retry=0;retry<3;retry++){
  const {state}=await loadCurrentState(user);assertStudyAllowed(state);const session=sessions(state).find(s=>s.id===id);if(!session||session.finishedAt)throw new ApiError('Практика уже завершена.',409);
  if(session.receipts[requestId]){if(session.receipts[requestId]!==payload)throw new ApiError('Идентификатор уже использован для другого запроса.',409);return response({session:publicPractice(session,state),replayed:true});}
  if(session.extra.filter(i=>i.parentId===parentId).length>=4)throw new ApiError('Упражнения уже добавлены в другой вкладке.',409);
  const generated=(state.generatedTasks||[]) as Task[],fingerprints=new Set([...generated,...session.main.map(i=>i.task),...state.exams.flatMap(e=>e.questions)].map(taskFingerprint));
  let task:Task|null=null;
  for(let offset=0;offset<10000;offset++){const candidate=makePracticeVariant(original.task.topicId,(seed+offset-1)%10000+1,spec.level);if(candidate&&validatePracticeVariant(candidate)&&!fingerprints.has(taskFingerprint(candidate))){task=candidate;break;}}
  if(!task)throw new ApiError('Новые условия этого шаблона закончились.',409);
  const parent=practiceItem(session,parentId);task.generationMode=mode;task.reviewReserved=true;
  if(parent.errorId){task.repairForErrorId=parent.errorId;task.repairsTaskIds=[parentId];const error=state.errors.find(e=>e.id===parent.errorId);if(error){error.exerciseIds.push(task.id);error.repairRequired=2;}}
  state.generatedTasks=[...generated,task];session.extra.push({task,answer:'',steps:'',assisted:false,parentId});session.cursor=task.id;session.version++;session.receipts[requestId]=payload;
  try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({session:publicPractice(session,state),mode,notice:mode==='ai-parameters-verified-template'?'ИИ подобрал параметры. Условие и ответ построены и проверены вычислительным шаблоном.':'Использован проверяемый шаблон без ответа ИИ. Можно продолжать обучение.'});
 }
 throw new ApiError('Повторите запрос.',409);
}catch(e){return failure(e);}}
