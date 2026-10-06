import {authenticate,loadCurrentState,saveState,configuration,response,failure,parseBody,textValue,ApiError,assertStudyAllowed,clientState,updatePlan,publishedContent} from '@/lib/server-store';
import {decodeState} from '@/lib/state-codec';
import{readEvents}from'@/lib/event-storage';
import type {LearnerState} from '@/lib/engine';
const db=()=>{const value=configuration().DB;if(!value)throw new ApiError('Хранилище недоступно.',503);return value;};
export async function GET(){try{const user=await authenticate();const backups=(await db().prepare('SELECT id,created_at,revision,head FROM learner_backups WHERE user_id=? AND created_at>? ORDER BY created_at DESC LIMIT 7').bind(user.userId,new Date(Date.now()-7*86400000).toISOString()).all<{id:string;created_at:string;revision:number;head:string}>()).results.map(b=>{const s=JSON.parse(b.head);return {id:b.id,at:b.created_at,revision:b.revision,name:s.profile?.name,xp:s.xp||0,mastered:Object.values(s.progress||{}).filter(p=>(p as {mastered?:boolean}).mastered).length};});return response({backups});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request);
 const checkpoint=async(revision:number)=>{const existing=await db().prepare('SELECT id FROM learner_backups WHERE user_id=? AND revision=? AND created_at>? ORDER BY created_at DESC LIMIT 1').bind(user.userId,revision,new Date(Date.now()-7*86400000).toISOString()).first<{id:string}>();if(existing)return existing.id;const id=crypto.randomUUID();const result=await db().batch([
  db().prepare('INSERT INTO learner_backups(id,user_id,head,revision,created_at) SELECT ?,user_id,data,revision,? FROM learner_states WHERE user_id=? AND revision=? RETURNING id').bind(id,new Date().toISOString(),user.userId,revision),
  db().prepare("INSERT INTO learner_backup_chunks(backup_id,chunk_index,data) SELECT ?,chunk_index,data FROM learner_state_chunks WHERE user_id=? AND token=(SELECT json_extract(head,'$._entStorage.token') FROM learner_backups WHERE id=?)").bind(id,user.userId,id),
 ]);if(!result[0].results?.length)throw new ApiError('Данные изменились, обновите кабинет.',409,'STATE_CONFLICT');return id;};
 if(input.action==='create'){const current=(await loadCurrentState(user)).state;assertStudyAllowed(current);return response({id:await checkpoint(current.revision),created:true});}
 if(input.action!=='restore'||input.confirm!==true)throw new ApiError('Подтвердите восстановление выбранной копии.');
 const id=textValue(input.id,200),saved=await db().prepare('SELECT * FROM learner_backups WHERE id=? AND user_id=? AND created_at>?').bind(id,user.userId,new Date(Date.now()-7*86400000).toISOString()).first<{head:string;revision:number}>();if(!saved)throw new ApiError('Копия не найдена.',404);
 const parts=(await db().prepare('SELECT chunk_index,data FROM learner_backup_chunks WHERE backup_id=? ORDER BY chunk_index').bind(id).all<{chunk_index:number;data:string}>()).results;
 const restored=await decodeState(saved.head,parts.map(p=>({chunkIndex:p.chunk_index,data:p.data}))) as LearnerState;
 await readEvents(db(),user.userId,restored);
 const current=(await loadCurrentState(user)).state;assertStudyAllowed(current);
 if(Number(input.expectedRevision)!==current.revision)throw new ApiError('Сначала обновите результаты. Другая вкладка сохранила новое занятие.',409,'STATE_CONFLICT');
 await checkpoint(current.revision);
 restored.revision=current.revision;restored.activeExam=null;restored.practiceDraft=null;restored.diagnosticDraft=null;const prior=current.draftUpdatedAt as {practice?:number;diagnostic?:number}|undefined;restored.draftUpdatedAt={practice:Math.max(Date.now(),prior?.practice||0),diagnostic:Math.max(Date.now(),prior?.diagnostic||0)};
 updatePlan(restored,(await publishedContent()).topics);await saveState(user,restored);return response({state:clientState(user,restored),restored:true});
 }catch(e){return failure(e);}}
