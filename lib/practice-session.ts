// @ts-expect-error Native Node tests use explicit extensions.
import {deliverTask, seenTaskIds, taskFingerprint, recordAttempt, answerFitsTask, type LearnerState, type Task, type Topic, type Answer} from './engine.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import {assignErrorRepairs} from './error-repair.ts';
import type {ReviewGenerator} from './fresh-tasks.ts';

export type PracticeResult = ReturnType<typeof recordAttempt>;
export type PracticeItem = {task:Task; answer:Answer; steps:string; assisted:boolean; feedback?:PracticeResult; errorId?:string; parentId?:string; skipped?:boolean};
export type PracticeSession = {id:string; version:number; topicId:string; startedAt:string; finishedAt?:string; cursor:string; main:PracticeItem[]; extra:PracticeItem[]; repairNotices:Record<string,string>; receipts:Record<string,string>; migrated?:boolean;selectionReason?:{ru:string;kk:string}};
export class PracticeError extends Error {constructor(message:string,public status=400){super(message);}}
export function sessions(state:LearnerState):PracticeSession[]{return (state.practiceSessions ||= []) as PracticeSession[];}
export function practiceItem(s:PracticeSession,id=s.cursor){const item=[...s.main,...s.extra].find(i=>i.task.id===id);if(!item)throw new PracticeError('Задание этой практики не найдено.',404);return item;}
export function createPractice(state:LearnerState,topicId:string,bank:Task[],size=15,id=crypto.randomUUID()):PracticeSession{
 const seen=seenTaskIds(state),fingerprints=new Set<string>();
 const available=bank.filter(t=>t.topicId===topicId&&!t.reviewReserved&&!t.modelExample&&!(state.diagnosticSession as {taskIds?:string[]})?.taskIds?.includes(t.id));
 const sorted=available.sort((a,b)=>Number(seen.has(a.id))-Number(seen.has(b.id)));
 const pool=sorted.filter(t=>{const f=taskFingerprint(t);if(fingerprints.has(f))return false;fingerprints.add(f);return true;});
 const progress=state.progress[topicId],beginner=!progress||progress.needsRecovery||(progress.confirmationTaskIds?.length??progress.independent)<4;
 const pattern=beginner?[1,1,2,1,2,1,1,2,1,3]:[1,2,1,3,1,2,1,3,1,2];
 const selected:Task[]=[];const used=new Set<string>();
 for(let slot=0;slot<size;slot++){
  const level=pattern[slot%pattern.length],remaining=pool.filter(t=>!used.has(t.id));if(!remaining.length)break;
  let candidates=remaining.filter(t=>t.difficulty===level);if(!candidates.length)candidates=remaining.sort((a,b)=>Math.abs(a.difficulty-level)-Math.abs(b.difficulty-level));
  const fresh=candidates.filter(t=>!seen.has(t.id));if(fresh.length)candidates=fresh;
  const previous=selected.at(-1),task=candidates.find(t=>Boolean(t.variant)!==Boolean(previous?.variant))??candidates.find(t=>t.type!==previous?.type)??candidates[0];
  selected.push(task);used.add(task.id);
 }
 if(!selected.length)throw new PracticeError('Нет доступных проверенных задач. Откройте урок или другую тему.',409);
 const selectionReason=beginner?{ru:'Начинаем преимущественно с основ: пока мало подтверждённых самостоятельных решений или требуется восстановление навыка. Затем попробуем более сложные условия.',kk:'Негіздерден бастаймыз: расталған өздік шешімдер әзірге аз немесе дағдыны қалпына келтіру керек. Кейін күрделірек есептерді байқап көреміз.'}:{ru:'Есть самостоятельные решения: добавили больше задач на применение и несколько более сложных условий.',kk:'Өздік шешімдер бар: білімді қолдануға және бірнеше күрделірек есепке көбірек орын берілді.'};
 const session:PracticeSession={id,version:1,topicId,selectionReason,startedAt:new Date().toISOString(),cursor:selected[0].id,main:selected.map(task=>({task:structuredClone(task),answer:task.type==='multiple'||task.type==='matching'?[]:'',steps:'',assisted:false})),extra:[],repairNotices:{},receipts:{}};
 const draft=state.practiceDraft as {taskId?:string;answer?:Answer;steps?:string;assisted?:boolean}|undefined;
 const saved=session.main.find(i=>i.task.id===draft?.taskId);
 if(saved&&draft){saved.answer=draft.answer??'';saved.steps=draft.steps??'';saved.assisted=!!draft.assisted;session.cursor=saved.task.id;session.migrated=true;}
 sessions(state).push(session);state.activePracticeId=id;return session;
}
export function savePracticeDraft(s:PracticeSession,id:string,answer:Answer,steps:string){const item=practiceItem(s,id);if(item.feedback||s.finishedAt)return;if(['multiple','matching'].includes(item.task.type)?!Array.isArray(answer):typeof answer!=='string')throw new PracticeError('Проверьте формат ответа.');item.answer=answer;item.steps=steps;}
export function submitPractice(state:LearnerState,s:PracticeSession,id:string,topic:Topic,bank:Task[],generator:ReviewGenerator){
 if(s.finishedAt)throw new PracticeError('Практика завершена. Результат сохранён.',409);
 const item=practiceItem(s,id);if(item.feedback&&item.feedback.status!=='review')return item.feedback;
 if(!answerFitsTask(item.task,item.answer)||(typeof item.answer==='string'&&!item.answer.trim())||(Array.isArray(item.answer)&&!item.answer.length))throw new PracticeError('Сначала запишите ответ.');
 const before=state.attempts.length;
 const assisted=item.assisted||((state.assistedTaskIds||[]) as string[]).includes(id);
 const feedback=recordAttempt(state,item.task,topic,{answer:item.answer,steps:item.steps,assisted},bank);
 if(feedback.status==='review'){return feedback;}
 item.feedback=feedback;item.assisted=assisted;
 const attempt=state.attempts[before];
 if(!feedback.correct&&attempt){item.errorId=attempt.id;const error=state.errors.find(e=>e.id===attempt.id)!;const repair=assignErrorRepairs(state,error,bank,generator);s.repairNotices[id]=repair.status;
 // At most two supplementary items per main question. Repeated failure never grows an endless queue.
 if(!item.parentId)for(const task of repair.tasks.slice(0,2))s.extra.push({task:structuredClone(task),answer:['multiple','matching'].includes(task.type)?[]:'',steps:'',assisted:false,parentId:id});
 }
 return feedback;
}
export function practiceSummary(s:PracticeSession){
 const count=(items:PracticeItem[])=>({total:items.length,answered:items.filter(i=>i.feedback).length,correct:items.filter(i=>i.feedback?.correct).length,independent:items.filter(i=>i.feedback?.correct&&i.feedback.independentEligible).length,helped:items.filter(i=>i.feedback?.correct&&!i.feedback.independentEligible).length,incorrect:items.filter(i=>i.feedback&&!i.feedback.correct).length,skipped:items.filter(i=>!i.feedback).length});
 const skills=new Map<string,{id:string;title:Task['skill'];attempts:number;correct:number;independent:number;extraCorrect:number}>();
 for(const item of [...s.main,...s.extra]){const ids=Array.isArray(item.task.skillIds)&&item.task.skillIds.length?item.task.skillIds:[item.task.topicId];for(const id of ids){if(typeof id!=='string')continue;const row=skills.get(id)??{id,title:item.task.skill||item.task.prompt,attempts:0,correct:0,independent:0,extraCorrect:0};if(item.parentId){row.extraCorrect+=Number(item.feedback?.correct&&item.feedback.independentEligible);}else if(item.feedback){row.attempts++;row.correct+=Number(item.feedback.correct);row.independent+=Number(item.feedback.correct&&item.feedback.independentEligible);}skills.set(id,row);}}
 return{main:count(s.main),extra:count(s.extra),skills:[...skills.values()],repairs:s.main.filter(i=>i.errorId).map(i=>({taskId:i.task.id,errorId:i.errorId,status:s.repairNotices[i.task.id],...count(s.extra.filter(e=>e.parentId===i.task.id))}))};
}
export function publicPractice(s:PracticeSession,state:LearnerState){
 const current=practiceItem(s);
 const status=(i:PracticeItem)=>i.feedback?i.feedback.correct?(i.feedback.independentEligible?'correct':'helped'):'incorrect':i.skipped?'skipped':(Array.isArray(i.answer)?i.answer.length:!!i.answer)?'draft':'new';
 const expose=(i:PracticeItem)=>({task:{...deliverTask(i.task,state),canVary:!!i.task.variant,generationMode:i.task.generationMode},answer:i.answer,steps:i.steps,assisted:i.assisted,feedback:i.feedback,errorId:i.errorId,parentId:i.parentId,status:status(i)});
 return{id:s.id,version:s.version,topicId:s.topicId,selectionReason:s.selectionReason,startedAt:s.startedAt,finishedAt:s.finishedAt,cursor:s.cursor,main:s.main.map(i=>({id:i.task.id,status:status(i)})),extra:s.extra.map(i=>({id:i.task.id,parentId:i.parentId,status:status(i)})),current:expose(current),repairNotice:s.repairNotices[current.task.id],summary:practiceSummary(s),report:s.finishedAt?[...s.main,...s.extra].map(expose):undefined,review:state.reviews.find(r=>r.topicId===s.topicId&&!r.completed),plan:state.plan};
}
