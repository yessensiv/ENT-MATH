import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {emptyState} from '../lib/engine.ts';
import {beginLocalFixture} from './local-state-fixture.mjs';
const base='http://127.0.0.1:5173';let cookie='';
async function request(path,body){const r=await fetch(base+path,{headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});cookie=sign.headers.get('set-cookie')?.split(';')[0]||'';assert.ok(cookie);
const fixture=await beginLocalFixture(()=>({...emptyState(),profile:{name:'Проверка новых функций',grade:'5',learningMode:'school',schoolPathway:'natural-math',track:'base',language:'ru',target:40,examDate:'2027-06-01',dailyMinutes:20}}));
const db=fixture.db,tag=`fixture-${crypto.randomUUID()}`,student=`${tag}-student`,at=new Date().toISOString(),ids=[];
try{
 await test('offline download, server verification, idempotence, snapshots, consent roles and concurrent persistence',async t=>{
  await t.test('offline pack contains usable lesson, five tasks and solutions; results import once',async()=>{
   const pack=await request('/api/offline',{action:'download',topicId:'fractions'});assert.equal(pack.status,200);assert.ok(pack.data.html.includes('connect-src'));
   const data=JSON.parse(pack.data.html.match(/const pack=(\{[^\n]+\});const lang=/)[1]);assert.equal(data.tasks.length,5);
   mkdirSync('outputs',{recursive:true});writeFileSync('outputs/offline-lesson-qa.html',pack.data.html);
   const answers=data.tasks.slice(0,2).map((q,i)=>({taskId:q.id,answer:i===0?'999999999':q.answer,steps:'Самостоятельная запись в скачанном уроке',assisted:false}));
   const result={version:1,packId:data.id,submissionId:crypto.randomUUID(),answers};const imported=await request('/api/offline',{action:'import',result});assert.equal(imported.status,200);assert.equal(imported.data.feedback[0].correct,false);assert.equal(imported.data.feedback[1].correct,true);assert.equal(imported.data.state.attempts.length,2);assert.equal(imported.data.state.errors.length,1);assert.equal(imported.data.state.xp,0);
   const again=await request('/api/offline',{action:'import',result});assert.equal(again.data.alreadyImported,true);assert.equal(again.data.state.attempts.length,2);
   assert.equal((await request('/api/offline',{action:'import',result:{...result,packId:'foreign'}})).status,404);
   const remaining=data.tasks.slice(2).map(q=>({taskId:q.id,answer:q.answer,steps:'Оставшиеся ответы'}));const later=await request('/api/offline',{action:'import',result:{...result,answers:remaining}});assert.equal(later.status,200);assert.equal(later.data.state.attempts.length,5);assert.equal(later.data.feedback.length,3);assert.equal((await request('/api/offline',{action:'import',result:{...result,answers:remaining}})).data.alreadyImported,true);
  });
  await t.test('real D1 snapshot restores selected progress and preserves current state in a new copy',async()=>{
   const before=(await request('/api/state')).data;const copy=await request('/api/backups',{action:'create'});assert.equal(copy.status,200);
   const profile=await request('/api/state',{action:'profile',name:'Изменённое имя'});assert.equal(profile.status,200);
   const stale=await request('/api/backups',{action:'restore',id:copy.data.id,confirm:true,expectedRevision:before.revision});assert.equal(stale.status,409);
   const restored=await request('/api/backups',{action:'restore',id:copy.data.id,confirm:true,expectedRevision:profile.data.revision});assert.equal(restored.status,200);assert.equal(restored.data.state.profile.name,before.profile.name);assert.equal(restored.data.state.attempts.length,5);
   const copies=await request('/api/backups');assert.ok(copies.data.backups.length>=2);
   assert.equal((await request('/api/backups',{action:'restore',id:'other-user',confirm:true,expectedRevision:restored.data.state.revision})).status,404);
  });
  await t.test('a large multilingual backup survives chunk replacement and restores without truncation',async()=>{
   const history='Қазақша русский 😀'.repeat(125000),nested=await beginLocalFixture(original=>({...original,backupTestHistory:history}));
   try{const copy=await request('/api/backups',{action:'create'});assert.equal(copy.status,200);assert.ok(nested.db.prepare('SELECT count(*) n FROM learner_backup_chunks WHERE backup_id=?').get(copy.data.id).n>1);const change=await request('/api/state',{action:'profile',name:'После большой копии'});assert.equal(change.status,200);const restored=await request('/api/backups',{action:'restore',id:copy.data.id,confirm:true,expectedRevision:change.data.revision});assert.equal(restored.status,200);assert.equal(restored.data.state.backupTestHistory,history);assert.equal(restored.data.state.attempts.length,5);}finally{await nested.restore((await request('/api/state')).data.revision);}
  });
  await t.test('observers see aggregates only; parent cannot assign; revoked teacher loses access',async()=>{
   const s={...emptyState(),profile:{name:'Ученик проверки',grade:'7',track:'base',language:'ru',target:40,examDate:'2027-06-01',dailyMinutes:20},progress:{fractions:{attempts:3,correct:2,independent:2,mastered:false,independentTaskIds:['a','b']}},attempts:[{id:'a',taskId:'a',topicId:'fractions',track:'base',answer:'PRIVATE',steps:'PRIVATE',correct:true,assisted:false,at}],errors:[]};
   db.prepare('INSERT INTO learner_states VALUES(?,?,?,?,?)').run(student,'fixture@sites.test',JSON.stringify(s),0,at);
   for(const role of ['parent','teacher']){const id=`${tag}-${role}`;ids.push(id);db.prepare('INSERT INTO support_links VALUES(?,?,?,?,?,?,?)').run(id,student,'local_seedy',`Проверка ${role}`,role,at,null);}
   const report=await request('/api/support');assert.equal(report.status,200);assert.equal(report.data.learners.find(l=>l.linkId===ids[0]).report.skills[0].independent,2);assert.equal(JSON.stringify(report.data).includes('PRIVATE'),false);assert.equal(JSON.stringify(report.data).includes('fixture@sites.test'),false);
   const input={action:'assign',topicId:'fractions',title:'Закрепить дроби',count:3,due:'2026-10-15'};
   assert.equal((await request('/api/support',{...input,linkId:ids[0]})).status,403);
   assert.equal((await request('/api/support',{...input,linkId:ids[1]})).status,200);
   assert.equal((await request('/api/support',{...input,linkId:ids[1],topicId:'school-complex-numbers',count:10})).status,400);
   assert.equal((await request('/api/support',{action:'revoke',linkId:ids[1]})).status,200);
   assert.equal((await request('/api/support',{...input,linkId:ids[1]})).status,403);
   assert.equal((await request('/api/support')).data.learners.some(l=>l.linkId===ids[1]),false);
   assert.equal((await request('/api/support',{action:'revoke',linkId:'stranger'})).status,404);
  });
  await t.test('20 concurrent state updates retain progress with no missing revisions',async()=>{
   const before=(await request('/api/state')).data;
   const updates=await Promise.all(Array.from({length:20},(_,i)=>request('/api/state',{action:'resume',topicId:'fractions',stage:i%4})));
   assert.ok(updates.every(r=>r.status===200||r.status===409));const successes=updates.filter(r=>r.status===200).length;const after=(await request('/api/state')).data;
   assert.equal(after.revision,before.revision+successes);assert.equal(after.attempts.length,before.attempts.length);assert.equal(after.errors.length,before.errors.length);assert.ok(successes>0);
   console.log(`Concurrent local check: ${successes}/20 saved; ${20-successes} explicit retry conflicts; no lost results.`);
  });
  await t.test('photo recognition gives honest configuration error and administration stays closed',async()=>{assert.equal((await request('/api/reviews?kind=topic&id=fractions')).status,403);const form=new FormData();form.set('photo',new Blob(['invalid'],{type:'image/png'}),'photo.png');const r=await fetch(base+'/api/tutor/photo',{method:'POST',headers:{Cookie:cookie},body:form});assert.equal(r.status,503);assert.equal((await r.json()).code,'AI_NOT_CONFIGURED');});
 });
}finally{
 for(const id of ids){db.prepare('DELETE FROM study_assignments WHERE link_id=?').run(id);db.prepare('DELETE FROM support_links WHERE id=?').run(id);}
 db.prepare('DELETE FROM learner_states WHERE user_id=?').run(student);
 const current=(await request('/api/state')).data;await fixture.restore(current.revision);
 console.log('Original profile, results and backup history restored.');
}
