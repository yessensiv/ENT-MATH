import {fillFreshTasks} from '@/lib/fresh-tasks';
import {reviewGenerator} from '@/lib/review-generator';
import {seenTaskIds,type Task} from '@/lib/engine';
import {authenticate,loadState,publishedContent,configuration,response,failure,parseBody,textValue,ApiError} from '@/lib/server-store';
import {acceptInvite,inviteCode,tokenDigest,roleValue,mayAssign,mayRevoke,skillReport,SupportError,type SupportLink,type SqlDatabase} from '@/lib/support-policy';
const db=()=>{const value=configuration().DB;if(!value)throw new ApiError('Хранилище недоступно.',503);return value;};
export async function GET(){try{
 const user=await authenticate(),sql=db(),content=await publishedContent();
 const links=(await sql.prepare('SELECT * FROM support_links WHERE (learner_id=? OR observer_id=?) AND revoked_at IS NULL ORDER BY accepted_at DESC LIMIT 10').bind(user.userId,user.userId).all<SupportLink>()).results;
 const learners=[];
 for(const link of links.filter(l=>l.observer_id===user.userId)){
  const state=await loadState({userId:link.learner_id,email:'',displayName:'',fullName:null});
  const assignments=(await sql.prepare('SELECT * FROM study_assignments WHERE link_id=? ORDER BY created_at DESC LIMIT 50').bind(link.id).all<{topic_id:string;created_at:string;count:number}>()).results;
  learners.push({linkId:link.id,role:link.role,report:skillReport(state,content.topics),assignments:assignments.map(a=>({...a,completed:Math.min(a.count,new Set(state.attempts.filter(t=>t.topicId===a.topic_id&&t.correct&&!t.assisted&&t.at>=a.created_at).map(t=>t.taskId)).size)}))});
 }
 const consent=links.filter(l=>l.learner_id===user.userId).map(l=>({id:l.id,name:l.observer_name,role:l.role,acceptedAt:l.accepted_at}));
 const own=await loadState(user);const assignments=(await sql.prepare('SELECT a.*,l.observer_name FROM study_assignments a JOIN support_links l ON l.id=a.link_id WHERE l.learner_id=? AND l.revoked_at IS NULL ORDER BY a.created_at DESC LIMIT 50').bind(user.userId).all<{topic_id:string;count:number;created_at:string}>()).results.map(a=>({...a,completed:Math.min(a.count,new Set(own.attempts.filter(t=>t.topicId===a.topic_id&&t.correct&&!t.assisted&&t.at>=a.created_at).map(t=>t.taskId)).size)}));
 return response({consent,learners,assignments});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request),sql=db(),now=new Date().toISOString();
 switch(input.action){
  case 'invite':{
   const role=roleValue(input.role),code=inviteCode();
   const recent=await sql.prepare('SELECT count(*) n FROM support_invites WHERE owner_id=? AND created_at>?').bind(user.userId,new Date(Date.now()-86400000).toISOString()).first<{n:number}>();
   if((recent?.n||0)>=10)throw new ApiError('Лимит: 10 приглашений в сутки.',429);
   const inserted=await sql.prepare('INSERT INTO support_invites(id,owner_id,owner_name,role,token_hash,expires_at,created_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM support_invites WHERE owner_id=? AND created_at>?)<10 RETURNING id').bind(crypto.randomUUID(),user.userId,user.displayName.slice(0,80),role,await tokenDigest(code),new Date(Date.now()+86400000).toISOString(),now,user.userId,new Date(Date.now()-86400000).toISOString()).all();if(!inserted.results.length)throw new ApiError('Лимит: 10 приглашений в сутки.',429);
   return response({code,role,expiresAt:new Date(Date.now()+86400000).toISOString()});
  }
  case 'preview':{
   const code=textValue(input.code,24).trim().toLowerCase();
   const invite=await sql.prepare('SELECT owner_name,role,expires_at FROM support_invites WHERE token_hash=? AND used_by IS NULL AND expires_at>?').bind(await tokenDigest(code),now).first();
   if(!invite)throw new ApiError('Код использован или срок истёк.',410);return response({invite});
  }
  case 'accept':{
   if(input.consent!==true)throw new ApiError('Нужно явное согласие на передачу отчёта.');
   if(!(await loadState(user)).profile)throw new ApiError('Сначала создайте учебный профиль.');
   return response(await acceptInvite(sql as unknown as SqlDatabase,user.userId,textValue(input.code,24).trim()));
  }
  case 'revoke':{
   const id=textValue(input.linkId,80),link=await sql.prepare('SELECT * FROM support_links WHERE id=?').bind(id).first<SupportLink>();
   if(!link||!mayRevoke(link,user.userId))throw new ApiError('Доступ не найден.',404);
   await sql.prepare('UPDATE support_links SET revoked_at=? WHERE id=? AND (learner_id=? OR observer_id=?)').bind(now,id,user.userId,user.userId).run();return response({revoked:true});
  }
  case 'assign':{
   const id=textValue(input.linkId,80),link=await sql.prepare('SELECT * FROM support_links WHERE id=?').bind(id).first<SupportLink>();
   if(!link||!mayAssign(link,user.userId))throw new ApiError('Назначать занятия может подключённый учитель.',403);
   const topicId=textValue(input.topicId,100),title=textValue(input.title,120).trim(),count=Number(input.count),due=textValue(input.due,10);
   if(!(await publishedContent()).topics.some(t=>t.id===topicId)||!title||!Number.isInteger(count)||count<1||count>10||!/^\d{4}-\d{2}-\d{2}$/.test(due)||!Number.isFinite(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due)throw new ApiError('Проверьте тему, количество задач и дату.');
   const content=await publishedContent(),learner=await loadState({userId:link.learner_id,email:'',displayName:'',fullName:null}),preview={...learner,generatedTasks:[...(learner.generatedTasks as Task[]||[])]};
   const supply=fillFreshTasks(preview,topicId,content.tasks,reviewGenerator,false,1,count);
   if(supply.exhausted){const seen=seenTaskIds(preview),remaining=[...content.tasks,...(preview.generatedTasks as Task[]||[])].filter(t=>t.topicId===topicId&&!t.modelExample&&!t.reviewReserved&&!seen.has(t.id)).length;throw new ApiError(`Новых проверенных задач осталось ${remaining}. Уменьшите назначение или выберите другой навык.`);}
   const result=await sql.prepare("INSERT INTO study_assignments(id,link_id,topic_id,title,count,due,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM support_links WHERE id=? AND observer_id=? AND role='teacher' AND revoked_at IS NULL) RETURNING id").bind(crypto.randomUUID(),id,topicId,title,count,due,now,id,user.userId).all();
   if(!result.results.length)throw new ApiError('Ученик отозвал доступ.',403);return response({assigned:true});
  }
  default:throw new ApiError('Неизвестное действие.');
 }
 }catch(e){return failure(e instanceof SupportError?new ApiError(e.message,e.status):e);}}
