// Consent is checked on every report and assignment, including after revocation.
export type SupportRole = 'teacher'|'parent';
export type SupportIdentity = {userId:string;displayName:string};
export type SupportLink = {id:string;learner_id:string;observer_id:string;observer_name:string;role:SupportRole;accepted_at:string;revoked_at:string|null};
export function mayView(link:SupportLink,userId:string){return !link.revoked_at&&link.observer_id===userId;}
export function mayAssign(link:SupportLink,userId:string){return mayView(link,userId)&&link.role==='teacher';}
export function mayRevoke(link:SupportLink,userId:string){return link.learner_id===userId||link.observer_id===userId;}
export function roleValue(value:unknown):SupportRole {if(value!=='teacher'&&value!=='parent')throw new SupportError('Выберите учителя или родителя.');return value;}
export class SupportError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export async function tokenDigest(token:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function inviteCode(){return [...crypto.getRandomValues(new Uint8Array(12))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export type SqlDatabase={prepare:(sql:string)=>{bind:(...params:(string|number|null)[])=>{first:<T>()=>Promise<T|null>;all:<T>()=>Promise<{results:T[]}>;run:()=>Promise<unknown>}};batch:(statements:unknown[])=>Promise<{results?:unknown[];meta?:{changes?:number}}[]>};
export async function acceptInvite(db:SqlDatabase,userId:string,token:string,now=new Date()){
 if(!/^[a-f0-9]{24}$/i.test(token))throw new SupportError('Код приглашения неверный.');
 const hash=await tokenDigest(token.toLowerCase());
 const invite=await db.prepare('SELECT * FROM support_invites WHERE token_hash=?').bind(hash).first<{id:string;owner_id:string;owner_name:string;role:SupportRole;expires_at:string;used_by:string|null}>();
 if(!invite||invite.used_by||Date.parse(invite.expires_at)<=now.getTime())throw new SupportError('Код использован или срок истёк.',410);
 if(invite.owner_id===userId)throw new SupportError('Нельзя подключить собственный аккаунт.');
 const active=await db.prepare('SELECT id FROM support_links WHERE learner_id=? AND observer_id=? AND role=? AND revoked_at IS NULL').bind(userId,invite.owner_id,invite.role).first();
 if(active)throw new SupportError('Этот доступ уже подключён.');
 const count=await db.prepare('SELECT count(*) n FROM support_links WHERE (learner_id=? OR observer_id=?) AND revoked_at IS NULL').bind(userId,invite.owner_id).first<{n:number}>();
 if((count?.n||0)>=10)throw new SupportError('Лимит: 10 активных подключений.',429);
 const id=crypto.randomUUID(),at=now.toISOString(),claim=`${userId}:${id}`;
 let results;try{results=await db.batch([
  db.prepare('UPDATE support_invites SET used_by=? WHERE id=? AND used_by IS NULL AND expires_at>? AND (SELECT count(*) FROM support_links WHERE (learner_id=? OR observer_id=?) AND revoked_at IS NULL)<10 RETURNING id').bind(claim,invite.id,at,userId,invite.owner_id),
  db.prepare('INSERT INTO support_links(id,learner_id,observer_id,observer_name,role,accepted_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM support_invites WHERE id=? AND used_by=?)').bind(id,userId,invite.owner_id,invite.owner_name,invite.role,at,invite.id,claim),
 ]);}catch(e){if(e instanceof Error&&/UNIQUE constraint failed: support_links|support_links_active_pair/.test(e.message))throw new SupportError('Этот доступ уже подключён в другой вкладке.',409);throw e;}
 if(!results[0].results?.length)throw new SupportError('Код уже принят в другой вкладке.',409);
 return {id,observerName:invite.owner_name,role:invite.role};
}
export function skillReport(state:{profile?:{name:string;grade:string}|null;progress:Record<string,{mastered?:boolean;independent?:number}>;attempts:{topicId:string;correct:boolean;assisted:boolean;at:string}[];errors:{topicId:string;category:string;resolved:boolean}[]},topics:{id:string;title:{ru:string;kk:string}}[]){
 const since=new Date(Date.now()-7*86400000).toISOString(),recent=state.attempts.filter(a=>a.at>=since);
 return {name:state.profile?.name||'Ученик',grade:state.profile?.grade||'',weeklyPractice:recent.length,weeklyIndependent:recent.filter(a=>a.correct&&!a.assisted).length,
  skills:topics.filter(t=>state.progress[t.id]||state.attempts.some(a=>a.topicId===t.id)).map(t=>({id:t.id,title:t.title,mastered:Boolean(state.progress[t.id]?.mastered),independent:state.progress[t.id]?.independent||0,errors:state.errors.filter(e=>e.topicId===t.id&&!e.resolved).length})),
  errorCategories:Object.fromEntries(['understanding','calculation','sign','method','reading','unknown','unconfirmed'].map(c=>[c,state.errors.filter(e=>!e.resolved&&e.category===c).length]))};
}
