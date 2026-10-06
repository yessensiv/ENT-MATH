import {authenticate,loadCurrentState,saveState,publishedContent,response,failure,parseBody,ApiError,textValue,answerValue,assertStudyAllowed,updatePlan,clientState} from '@/lib/server-store';
import {recordAttempt,seenTaskIds,type Task,answerFitsTask} from '@/lib/engine';
import {offlineHtml,type OfflinePack} from '@/lib/offline-pack';
import {fillFreshTasks} from '@/lib/fresh-tasks';
import {reviewGenerator} from '@/lib/review-generator';
type PackRecord={id:string;topicId:string;taskIds:string[];createdAt:string;imported?:boolean;importedTaskIds?:string[]};
export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request),content=await publishedContent();
 for(let retry=0;retry<3;retry++){
 const state=(await loadCurrentState(user)).state;assertStudyAllowed(state);const packs=(Array.isArray(state.offlinePacks)?state.offlinePacks:[]) as PackRecord[];
 if(input.action==='download'){
  const topic=content.topics.find(t=>t.id===input.topicId);if(!topic)throw new ApiError('Тема не найдена.',404);
  fillFreshTasks(state,topic.id,content.tasks,reviewGenerator,false,1,5);
  const seen=seenTaskIds(state),tasks=[...content.tasks,...(state.generatedTasks as Task[]||[])].filter(t=>t.topicId===topic.id&&!t.modelExample&&!t.reviewReserved&&!seen.has(t.id)).slice(0,5);
  if(!tasks.length)throw new ApiError('Новые задачи этой темы пока закончились. Для повторения откройте тренажёр.');
  const pack={id:crypto.randomUUID(),topic,tasks,language:state.profile?.language||'ru',createdAt:new Date().toISOString()} as unknown as OfflinePack;
  state.offlinePacks=[...packs.slice(-9),{id:pack.id,topicId:topic.id,taskIds:tasks.map(t=>t.id),createdAt:pack.createdAt}];
  // Downloaded packs contain solutions. These tasks cannot later count as unseen.
  state.assistedTaskIds=[...new Set([...(state.assistedTaskIds as string[]||[]),...tasks.map(t=>t.id)])];
  try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({html:offlineHtml(pack),name:`ent-math-${topic.id}.html`,packId:pack.id,state:clientState(user,state)});
 }
 if(input.action==='import'){
  const result=input.result as {version?:number;packId?:string;submissionId?:string;answers?:{taskId:string;answer:unknown;steps?:string}[]};
  if(!result||result.version!==1||!Array.isArray(result.answers)||result.answers.length>5)throw new ApiError('Некорректный файл ответов.');
  const pack=packs.find(p=>p.id===result.packId);if(!pack)throw new ApiError('Урок скачан в другом аккаунте или истёк срок хранения последних 10 загрузок.',404);
  const imported=new Set(pack.importedTaskIds||(pack.imported?pack.taskIds:[]));
  if(!result.answers.length||new Set(result.answers.map(a=>a.taskId)).size!==result.answers.length)throw new ApiError('Ответы пустые или повторяются.');
  const feedback=[];
  const bank=[...content.tasks,...(state.generatedTasks as Task[]||[])];
  for(const a of result.answers){const task=bank.find(t=>t.id===a.taskId&&pack.taskIds.includes(t.id));if(!task)throw new ApiError('Задание не входит в скачанный урок.');if(imported.has(task.id))continue;const answer=answerValue(a.answer);if(!answerFitsTask(task,answer))throw new ApiError('Проверьте формат ответа.');const topic=content.topics.find(t=>t.id===task.topicId)!;feedback.push({taskId:task.id,...recordAttempt(state,task,topic,{answer,steps:textValue(a.steps||'',4000),assisted:true},bank)});imported.add(task.id);}
  if(!feedback.length)return response({state:clientState(user,state),alreadyImported:true});
  pack.importedTaskIds=[...imported];pack.imported=imported.size===pack.taskIds.length;state.offlinePacks=packs;updatePlan(state,content.topics);
  try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({state:clientState(user,state),feedback,notice:'Ответы проверены и сохранены. Для подтверждения самостоятельного освоения решите новые задачи на сайте.'});
 }
 throw new ApiError('Неизвестное действие.');
 }throw new ApiError('Повторите загрузку.',409);
 }catch(e){return failure(e);}}
