import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './local-state-fixture.mjs';
const base='http://127.0.0.1:5173';let cookie='';
async function call(path,body){const r=await fetch(base+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
test('local editor verifies exact versions, collects minimal issue data and limits invites atomically',async t=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});cookie=sign.headers.get('set-cookie').split(';')[0];assert.equal((await call('/api/state')).data.isAdmin,true);
 const db=localDatabase(),id='school-divisibility-3',previous=db.prepare('SELECT * FROM content_overrides WHERE id=?').get(id),reviewIds=new Set(db.prepare('SELECT id FROM editorial_reviews WHERE material_id=?').all(id).map(r=>r.id)),issueIds=new Set(db.prepare("SELECT id FROM service_issues WHERE user_id='local_seedy'").all().map(r=>r.id)),inviteIds=new Set(db.prepare("SELECT id FROM support_invites WHERE owner_id='local_seedy'").all().map(r=>r.id));
 try{
  await t.test('three reviews apply to one saved draft; editing invalidates all and stale review is rejected',async()=>{
   const source=(await call(`/api/admin?kind=task&id=${id}`)).data.material;
   const material={...source,prompt:{ru:source.prompt.ru+' Проверка редакторского механизма.',kk:source.prompt.kk+' Редактор механизмін тексеру.'}};
   assert.equal((await call('/api/admin',{id,kind:'task',status:'draft',data:material})).status,200);
   const review=(await call(`/api/reviews?kind=task&id=${id}`)).data;assert.ok(Object.values(review.coverage).every(v=>!v));
   assert.equal((await call('/api/admin',{id,kind:'task',status:'published',data:material,reviewNote:'Only local mechanism test'})).status,400);
   for(const discipline of ['math','methodology','kazakh'])assert.equal((await call('/api/reviews',{id,kind:'task',discipline,verdict:'approved',note:'LOCAL TEST ONLY: проверяем механизм, не реальная экспертная рецензия.',expectedHash:review.hash})).status,200);
   assert.ok(Object.values((await call(`/api/reviews?kind=task&id=${id}`)).data.coverage).every(Boolean));
   assert.equal((await call('/api/admin',{id,kind:'task',status:'published',data:material,reviewNote:'LOCAL TEST ONLY'})).status,200);
   assert.equal((await call('/api/tasks?topic=school-divisibility')).data.tasks.find(q=>q.id===id).prompt.ru,material.prompt.ru);
   const changed={...material,prompt:{...material.prompt,kk:material.prompt.kk+' Өзгертілді.'}};
   assert.equal((await call('/api/admin',{id,kind:'task',status:'draft',data:changed})).status,200);
   const current=(await call(`/api/reviews?kind=task&id=${id}`)).data;assert.notEqual(current.hash,review.hash);assert.ok(Object.values(current.coverage).every(v=>!v));
   assert.equal((await call('/api/reviews',{id,kind:'task',discipline:'math',verdict:'approved',note:'LOCAL TEST ONLY: outdated hash',expectedHash:review.hash})).status,409);
   assert.equal((await call('/api/admin',{id,kind:'task',status:'published',data:changed,reviewNote:'LOCAL TEST ONLY'})).status,400);
  });
  await t.test('issue collector accepts only bounded codes and excludes supplied private text',async()=>{
   assert.equal((await call('/api/issues',{code:'raw-error-message',page:'practice'})).status,400);
   assert.equal((await call('/api/issues',{code:'CLIENT_ACTION_FAILED',page:'/answers/secret'})).status,400);
   const results=await Promise.all(Array.from({length:12},()=>call('/api/issues',{code:'CLIENT_RUNTIME_ERROR',page:'practice',answer:'PRIVATE_PAYLOAD',message:'PRIVATE_PAYLOAD',photo:'PRIVATE_PAYLOAD'})));
   assert.ok(results.every(r=>r.status===200||r.status===429));const rows=db.prepare("SELECT * FROM service_issues WHERE user_id='local_seedy' AND created_at>?").all(new Date(Date.now()-3600000).toISOString());assert.ok(rows.length<=10);assert.equal(JSON.stringify(rows).includes('PRIVATE_PAYLOAD'),false);
   const report=await call('/api/issues');assert.equal(report.status,200);assert.equal(report.data.privateTextCollected,false);assert.equal(JSON.stringify(report.data).includes('local_seedy'),false);
  });
  await t.test('lesson publication rejects an incomplete bilingual life supplement before changing editorial history',async()=>{
   const loaded=await call('/api/admin?kind=topic&id=fractions');assert.equal(loaded.status,200);
   const material=loaded.data.material;assert.ok(material.lesson.enrichment);const prior=db.prepare("SELECT * FROM content_overrides WHERE id='fractions'").get();
   const invalid={...material,lesson:{...material.lesson,enrichment:{...material.lesson.enrichment,hacks:[]}}};
   const result=await call('/api/admin',{id:'fractions',kind:'topic',status:'published',data:invalid,reviewNote:'LOCAL TEST ONLY: verify structural rejection'});
   assert.equal(result.status,400);assert.match(result.data.error,/полезный приём/);assert.deepEqual(db.prepare("SELECT * FROM content_overrides WHERE id='fractions'").get(),prior);
  });
  await t.test('the largest expanded lesson saves as an editable draft without truncating examples or task data',async()=>{
   const topicId='school-triangle-congruence',old=db.prepare('SELECT * FROM content_overrides WHERE id=?').get(topicId);
   try{
    const loaded=await call(`/api/admin?kind=topic&id=${topicId}`);assert.equal(loaded.status,200);const material=loaded.data.material;assert.ok(JSON.stringify(material).length>30000);
    assert.equal((await call('/api/admin',{id:topicId,kind:'topic',status:'draft',data:material,reviewNote:'LOCAL TEST ONLY: expanded bilingual lesson round trip'})).status,200);
    const saved=await call(`/api/admin?kind=topic&id=${topicId}`);assert.equal(saved.data.status,'draft');assert.deepEqual(saved.data.material,material);
   }finally{db.prepare('DELETE FROM content_overrides WHERE id=?').run(topicId);if(old)db.prepare('INSERT INTO content_overrides VALUES(?,?,?,?,?,?,?)').run(old.id,old.kind,old.status,old.data,old.history,old.updated_by,old.updated_at);}
  });
  await t.test('concurrent invitations have single-use codes, a daily cap, and cannot grant self-access',async()=>{
   const count=db.prepare("SELECT count(*) n FROM support_invites WHERE owner_id='local_seedy' AND created_at>?").get(new Date(Date.now()-86400000).toISOString()).n;
   const results=await Promise.all(Array.from({length:12},()=>call('/api/support',{action:'invite',role:'teacher'})));assert.ok(results.every(r=>r.status===200||r.status===429));assert.equal(results.filter(r=>r.status===200).length,Math.max(0,10-count));
   const created=results.find(r=>r.status===200);if(created){assert.match(created.data.code,/^[a-f0-9]{24}$/);assert.equal((await call('/api/support',{action:'preview',code:created.data.code})).status,200);assert.equal((await call('/api/support',{action:'accept',code:created.data.code,consent:false})).status,400);assert.equal((await call('/api/support',{action:'accept',code:created.data.code,consent:true})).status,400);}
  });
 }finally{
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('DELETE FROM content_overrides WHERE id=?').run(id);if(previous)db.prepare('INSERT INTO content_overrides VALUES(?,?,?,?,?,?,?)').run(previous.id,previous.kind,previous.status,previous.data,previous.history,previous.updated_by,previous.updated_at);
   for(const r of db.prepare('SELECT id FROM editorial_reviews WHERE material_id=?').all(id))if(!reviewIds.has(r.id))db.prepare('DELETE FROM editorial_reviews WHERE id=?').run(r.id);
   for(const r of db.prepare("SELECT id FROM service_issues WHERE user_id='local_seedy'").all())if(!issueIds.has(r.id))db.prepare('DELETE FROM service_issues WHERE id=?').run(r.id);
   for(const r of db.prepare("SELECT id FROM support_invites WHERE owner_id='local_seedy'").all())if(!inviteIds.has(r.id))db.prepare('DELETE FROM support_invites WHERE id=?').run(r.id);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
 }
});
