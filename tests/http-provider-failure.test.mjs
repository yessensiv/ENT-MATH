// Local-only drill: set TUTOR_API_KEY=LOCAL_TEST_NOT_A_SECRET and
// TUTOR_BASE_URL=https://ent-tz-provider.invalid in ignored .dev.vars; restart.
import{test}from'node:test';import assert from'node:assert/strict';import{beginLocalFixture}from'./local-state-fixture.mjs';
const base='http://127.0.0.1:5173';
test('provider connection failure keeps lessons usable and persists one labelled fallback',async()=>{
 const signed=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=signed.headers.get('set-cookie').split(';')[0];
 const call=async(path,body)=>{const r=await fetch(base+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const fixture=await beginLocalFixture(old=>({...old,activeExam:null,tutorGenerations:{},tutorMessages:[]}));
 const oldUsage=fixture.db.prepare("SELECT * FROM tutor_usage WHERE user_id='local_seedy'").all();
 try{
  const initial=(await call('/api/state')).data;assert.equal(initial.aiConfigured,true,'Run with the explicitly labelled failing local provider fixture');
  const body={messageId:crypto.randomUUID(),topicId:'linear',message:'Объясни, как решать уравнение.'};
  const result=await call('/api/tutor',body);assert.equal(result.status,200);assert.equal(result.data.mode,'study-helper');assert.match(result.data.notice,/временно недоступен|уақытша қолжетімсіз/);
  const usage=fixture.db.prepare("SELECT SUM(requests) AS n FROM tutor_usage WHERE user_id='local_seedy'").get().n;
  const repeat=await call('/api/tutor',body);assert.equal(repeat.data.replayed,true);assert.equal(repeat.data.reply,result.data.reply);assert.equal(fixture.db.prepare("SELECT SUM(requests) AS n FROM tutor_usage WHERE user_id='local_seedy'").get().n,usage);
  assert.equal((await call('/api/content?topic=linear')).status,200);const after=(await call('/api/state')).data;for(const key of ['attempts','progress','xp','errors'])assert.deepEqual(after[key],initial[key]);
 }finally{
  fixture.db.exec('BEGIN IMMEDIATE');try{fixture.db.prepare("DELETE FROM tutor_usage WHERE user_id='local_seedy'").run();for(const row of oldUsage)fixture.db.prepare('INSERT INTO tutor_usage(id,user_id,day,requests,reserved_tokens) VALUES(?,?,?,?,?)').run(row.id,row.user_id,row.day,row.requests,row.reserved_tokens);fixture.db.exec('COMMIT');}catch(e){fixture.db.exec('ROLLBACK');throw e;}
  await fixture.restore((await call('/api/state')).data.revision);
 }
});
