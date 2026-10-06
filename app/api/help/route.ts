import {authenticate,adminAuthenticate,configuration,response,failure,parseBody,ApiError,loadState,publishedContent} from '@/lib/server-store';
import {ticketInput,ticketMatches,ticketView,replyTicket,type TicketRow,type TicketData} from '@/lib/help-tickets';
import {contentDigest} from '@/lib/material-review';
import type {Task} from '@/lib/engine';
function database(){const db=configuration().DB;if(!db)throw new ApiError('Хранилище недоступно.',503);return db;}
function helpFailure(e:unknown){const code=e instanceof Error?e.message:'';return failure(/^TICKET_CONFLICT$/.test(code)?new ApiError('Обращение уже изменено. Обновите список.',409,code):/^(INVALID_TICKET|MATERIAL_REQUIRED|INVALID_REPLY)$/.test(code)?new ApiError('Проверьте категорию, материал и текст сообщения.',400,code):code==='TICKET_CAPACITY'?new ApiError('В обращении достигнут предел ответов. Создайте новое.',429,code):e);}
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams,admin=params.get('queue')==='editor',user=admin?await adminAuthenticate():await authenticate(),db=database(),before=params.get('before')||'9999',category=params.get('category');
 if(category&&!['material','service','account'].includes(category))throw new ApiError('Неизвестная категория.');
 const rows=await db.prepare(`SELECT * FROM help_tickets WHERE (?=1 OR user_id=?) AND (? IS NULL OR category=?) AND (created_at || ':' || id)<? ORDER BY created_at DESC,id DESC LIMIT 41`).bind(admin?1:0,user.userId,category,category,before).all<TicketRow>();
 const page=rows.results.slice(0,40),legacy=await db.prepare('SELECT id,task_id,message,status,created_at FROM content_reports WHERE (?=1 OR user_id=?) AND NOT EXISTS(SELECT 1 FROM help_tickets t WHERE t.id=content_reports.id) ORDER BY created_at DESC LIMIT 40').bind(admin?1:0,user.userId).all();
 return response({tickets:page.map(r=>ticketView(r,admin)),nextCursor:rows.results.length>40?`${page.at(-1)!.created_at}:${page.at(-1)!.id}`:null,legacy:before==='9999'&&(!category||category==='material')?legacy.results:[]});
 }catch(e){return helpFailure(e);}}
export async function POST(request:Request){try{
 const user=await authenticate(),input=await parseBody(request),db=database();
 if(input.action==='reply'){
  await adminAuthenticate();if(typeof input.id!=='string')throw new ApiError('Укажите обращение.');
  let row=await db.prepare('SELECT * FROM help_tickets WHERE id=?').bind(input.id).first<TicketRow>();
  if(!row){
   const legacy=await db.prepare('SELECT * FROM content_reports WHERE id=?').bind(input.id).first<{id:string;user_id:string;task_id:string;message:string;created_at:string}>();if(!legacy)throw new ApiError('Обращение не найдено.',404);
   const data:TicketData={schema:1,message:legacy.message,taskId:legacy.task_id,language:'ru',events:[]};
   // Legacy reports never stored a material version. Do not fabricate one.
   row={id:legacy.id,user_id:legacy.user_id,category:'material',status:'new',data:JSON.stringify(data),revision:0,created_at:legacy.created_at,updated_at:legacy.created_at};
   replyTicket(row,input);await db.prepare('INSERT INTO help_tickets VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(row.id,row.user_id,row.category,row.status,row.data,0,row.created_at,row.updated_at).run();row=await db.prepare('SELECT * FROM help_tickets WHERE id=?').bind(input.id).first<TicketRow>();
  }
  const result=replyTicket(row!,input);if(result.replayed)return response({ticket:ticketView(row!,true),replayed:true});
  const at=new Date().toISOString(),saved=await db.prepare('UPDATE help_tickets SET data=?,status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING *').bind(JSON.stringify(result.data),String(input.status),at,row!.id,row!.revision).first<TicketRow>();
  if(!saved)throw Error('TICKET_CONFLICT');return response({ticket:ticketView(saved,true)});
 }
 if(input.action!=='create')throw new ApiError('Неизвестное действие.');
 const value=ticketInput(input),prior=await db.prepare('SELECT * FROM help_tickets WHERE id=?').bind(value.id).first<TicketRow>();
 if(prior){if(prior.user_id!==user.userId||!ticketMatches(prior,value))throw Error('TICKET_CONFLICT');return response({ticket:ticketView(prior),replayed:true});}
 const data:TicketData={schema:1,message:value.message,taskId:value.taskId,language:value.language,events:[]};
 if(value.category==='material'){
  const {topics,tasks}=await publishedContent(),state=await loadState(user);
  const attempt=state.attempts.findLast(a=>a.taskId===value.taskId&&a.taskSnapshot);
  const material=tasks.find(t=>t.id===value.taskId)??(state.generatedTasks as Task[]||[]).find(t=>t.id===value.taskId)??state.exams.flatMap(e=>e.questions).find(t=>t.id===value.taskId)??topics.find(t=>t.id===value.taskId)??(attempt?{id:attempt.taskId,topicId:attempt.topicId,...attempt.taskSnapshot,taskVersion:attempt.taskVersion,checkingVersion:attempt.checkingVersion}:undefined);
  if(!material)throw new ApiError('Материал не найден. Откройте обращение из задачи или выберите тему.',404);
  const snapshot='lesson' in material?{id:material.id,title:material.title,lesson:material.lesson}:material;
  const clean=JSON.parse(JSON.stringify(snapshot));
  data.context={id:value.taskId,version:await contentDigest(clean),prompt:clean.prompt??clean.title,material:clean};
 }
 const at=new Date().toISOString(),since=new Date(Date.now()-86400000).toISOString();
 const inserted=await db.prepare('INSERT INTO help_tickets SELECT ?,?,?,?,?,0,?,? WHERE (SELECT count(*) FROM help_tickets WHERE user_id=? AND created_at>?)<10 ON CONFLICT(id) DO NOTHING RETURNING *').bind(value.id,user.userId,value.category,'new',JSON.stringify(data),at,at,user.userId,since).first<TicketRow>();
 if(inserted)return response({ticket:ticketView(inserted)});
 const duplicate=await db.prepare('SELECT * FROM help_tickets WHERE id=?').bind(value.id).first<TicketRow>();
 if(duplicate){if(duplicate.user_id!==user.userId||!ticketMatches(duplicate,value))throw Error('TICKET_CONFLICT');return response({ticket:ticketView(duplicate),replayed:true});}
 throw new ApiError('Можно создать до 10 обращений в сутки. Уже отправленные сохранены.',429);
 }catch(e){return helpFailure(e);}}
