import{adminAuthenticate,configuration,loadState,saveState,response,failure,parseBody,ApiError}from'@/lib/server-store';
export async function GET(){try{await adminAuthenticate();const rows=await configuration().DB!.prepare("SELECT user_id,revision,json_extract(data,'$._entEvents.version') AS event_version FROM learner_states ORDER BY user_id").all();return response({rows:rows.results,defaultMode:configuration().EVENT_STORAGE_MODE==='legacy'?'legacy':'events'});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const admin=await adminAuthenticate(),input=await parseBody(request);if(!['events','legacy'].includes(String(input.storage)))throw new ApiError('Выберите проверенный режим хранения.');
 // One account per CAS operation. Never accept a client-supplied profile/history.
 if(typeof input.userId!=='string'||input.userId.length>200)throw new ApiError('Укажите существующего ученика.');
 const row=await configuration().DB!.prepare('SELECT user_id,email,revision FROM learner_states WHERE user_id=?').bind(input.userId).first<{user_id:string;email:string;revision:number}>();if(!row)throw new ApiError('Ученик не найден.',404);
 if(input.expectedRevision!==row.revision)throw new ApiError('История обновилась. Повторите после чтения новой версии.',409,'STATE_CONFLICT');
 const user={...admin,userId:row.user_id,email:row.email},state=await loadState(user);if(state.revision!==row.revision)throw new ApiError('История обновилась.',409,'STATE_CONFLICT');
 const count={attempts:state.attempts.length,exams:state.exams.length,errors:state.errors.length};
 const already=input.storage==='events'?Boolean(state._entEvents):!state._entEvents;
 if(!already)await saveState(user,state,{storage:input.storage as 'events'|'legacy'});
 return response({migrated:!already,already,storage:input.storage,revision:state.revision,counts:count});
 }catch(e){return failure(e);}}
