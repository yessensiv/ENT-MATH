import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
// @ts-expect-error Explicit extension for native Node tests.
import {acceptInvite,tokenDigest,mayView,mayAssign,mayRevoke,skillReport,type SqlDatabase,type SupportLink} from '../lib/support-policy.ts';
function memory(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0002_worried_warbird.sql',import.meta.url),'utf8').split('ALTER TABLE')[0]);db.exec('CREATE UNIQUE INDEX active_pair ON support_links(learner_id,observer_id,role) WHERE revoked_at IS NULL');const adapter={prepare(sql:string){return {bind(...params:(string|number|null)[]){return {async first<T>(){return db.prepare(sql).get(...params) as T??null;},async all<T>(){return {results:db.prepare(sql).all(...params) as T[]};},async run(){return db.prepare(sql).run(...params);},_sql:sql,_params:params};}};},async batch(statements:{_sql:string;_params:(string|number|null)[]}[]){db.exec('BEGIN IMMEDIATE');try{const result=statements.map(s=>/RETURNING/.test(s._sql)?{results:db.prepare(s._sql).all(...s._params)}:{meta:{changes:Number(db.prepare(s._sql).run(...s._params).changes)}});db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};return {db,adapter:adapter as unknown as SqlDatabase};}
test('consent invitation is single use, expires and cannot link a person to themselves',async()=>{
 const {db,adapter}=memory(),code='a'.repeat(24),hash=await tokenDigest(code),now=new Date('2026-10-06T08:00:00Z');
 db.prepare('INSERT INTO support_invites VALUES(?,?,?,?,?,?,?,?)').run('invite','teacher','Teacher','teacher',hash,'2026-10-07T08:00:00Z',null,now.toISOString());
 await assert.rejects(()=>acceptInvite(adapter,'teacher',code,now),/собственный/);
 const accepted=await acceptInvite(adapter,'student',code,now);assert.equal(accepted.role,'teacher');
 await assert.rejects(()=>acceptInvite(adapter,'other',code,now),/использован/);
 assert.equal(db.prepare('SELECT count(*) n FROM support_links').get()!.n,1);
 db.prepare('UPDATE support_invites SET used_by=NULL,expires_at=?').run('2026-10-05T08:00:00Z');
 await assert.rejects(()=>acceptInvite(adapter,'other',code,now),/истёк/);db.close();
});
test('revocation, strangers and parent read-only access are enforced',()=>{const link:SupportLink={id:'l',learner_id:'student',observer_id:'parent',observer_name:'Parent',role:'parent',accepted_at:'now',revoked_at:null};assert.equal(mayView(link,'stranger'),false);assert.equal(mayView(link,'parent'),true);assert.equal(mayAssign(link,'parent'),false);assert.equal(mayAssign({...link,role:'teacher'},'parent'),true);assert.equal(mayView({...link,revoked_at:'now'},'parent'),false);assert.equal(mayRevoke(link,'student'),true);assert.equal(mayRevoke(link,'stranger'),false);});
test('support report contains real aggregate results and excludes private answer, chat, photo and email',()=>{const result=skillReport({profile:{name:'Student',grade:'7'},progress:{fractions:{mastered:false,independent:2}},attempts:[{topicId:'fractions',correct:true,assisted:false,at:new Date().toISOString()}],errors:[{topicId:'fractions',category:'sign',resolved:false}]},[{id:'fractions',title:{ru:'Дроби',kk:'Бөлшектер'}}]);assert.equal(result.weeklyIndependent,1);assert.equal(result.skills[0].independent,2);assert.equal(result.errorCategories.sign,1);for(const word of ['email','answer','steps','chat','photo'])assert.equal(JSON.stringify(result).includes(`"${word}"`),false);});

test('concurrent acceptance creates one connection and rolls back a duplicate invite claim',async()=>{
 const {db,adapter}=memory(),now=new Date('2026-10-06T08:00:00Z'),code='b'.repeat(24);
 const insert=async(id:string,c:string)=>db.prepare('INSERT INTO support_invites VALUES(?,?,?,?,?,?,?,?)').run(id,'teacher','Teacher','teacher',await tokenDigest(c),'2026-10-07T08:00:00Z',null,now.toISOString());
 await insert('same',code);const results=await Promise.allSettled([acceptInvite(adapter,'student',code,now),acceptInvite(adapter,'student',code,now)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.prepare('SELECT count(*) n FROM support_links').get()!.n,1);
 db.prepare('UPDATE support_links SET revoked_at=?').run(now.toISOString());await insert('left','c'.repeat(24));await insert('right','d'.repeat(24));
 const duplicate=await Promise.allSettled([acceptInvite(adapter,'student','c'.repeat(24),now),acceptInvite(adapter,'student','d'.repeat(24),now)]);assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);assert.equal(db.prepare('SELECT count(*) n FROM support_links WHERE revoked_at IS NULL').get()!.n,1);assert.equal(db.prepare('SELECT count(*) n FROM support_invites WHERE id IN (?,?) AND used_by IS NULL').get('left','right')!.n,1);db.close();
});
