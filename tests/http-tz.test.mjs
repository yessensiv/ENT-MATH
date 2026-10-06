import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';import{emptyState}from'../lib/engine.ts';import{tasks}from'../lib/content.ts';
const base=process.env.ENT_TEST_BASE_URL||'http://127.0.0.1:5173';
test('TZ: idempotent submissions, concurrent devices, review state and lesson recovery',async t=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async body=>{const r=await fetch(base+'/api/state',{headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const fixture=await beginLocalFixture(old=>({...emptyState(),profile:old.profile}));
 try{
 await t.test('a simultaneous retry returns identical feedback and records one attempt',async()=>{
  const body={action:'attempt',taskId:'linear-4',answer:'999',submissionId:crypto.randomUUID(),draftUpdatedAt:Date.now()};
  const before=(await call()).data;const [a,b]=await Promise.all([call(body),call(body)]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.data.feedback,b.data.feedback);
  const state=(await call()).data;assert.equal(state.attempts.length,before.attempts.length+1);assert.equal(state.errors.length,before.errors.length+1);
  assert.equal((await call({...body,answer:'4'})).status,409);
  assert.equal((await call(body)).data.replayed,true);assert.equal((await call()).data.revision,state.revision);
 });
 await t.test('unsupported symbolic comparison does not change learning, errors or XP',async()=>{
  const task=tasks.find(t=>t.type==='expression'&&String(t.answer).includes('x'));assert.ok(task);
  const before=(await call()).data;const result=await call({action:'attempt',taskId:task.id,answer:'sin(x)^2+cos(x)^2',submissionId:crypto.randomUUID(),draftUpdatedAt:Date.now()});assert.equal(result.status,200);assert.equal(result.data.feedback.status,'review');
  const after=(await call()).data;for(const key of ['attempts','errors','progress','reviews','xp'])assert.deepEqual(after[key],before[key]);
 });
 await t.test('lesson work restores on another session; older beacon cannot erase it',async()=>{
  const body={action:'save-lesson',topicId:'linear',stage:2,exampleIndex:1,simple:true,answer:'4',steps:'2x=8',reading:{positions:{'2':{anchor:'guidance',offset:0.5}},openDetails:['detail-3']},updatedAt:Date.now()};
  assert.equal((await call(body)).status,200);assert.equal((await call({...body,answer:'old',updatedAt:body.updatedAt-1})).data.staleSnapshot,true);
  const state=(await call()).data;assert.deepEqual(state.lessonWork.linear,{stage:2,exampleIndex:1,simple:true,answer:'4',steps:'2x=8',reading:body.reading,updatedAt:body.updatedAt});
 });
 await t.test('tutor history is saved once and restored in its own context',async()=>{
  const body={messageId:crypto.randomUUID(),topicId:'linear',message:'Объясни идею уравнения проще.',language:'ru'};
  const tutor=async value=>{const r=await fetch(base+'/api/tutor',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(value)});return{status:r.status,data:await r.json()};};
  const first=await tutor(body);assert.equal(first.status,200);const again=await tutor(body);assert.equal(again.status,200);assert.equal(again.data.replayed,true);assert.equal(first.data.reply,again.data.reply);
  const saved=await fetch(base+'/api/tutor?topic=linear',{headers:{Cookie:cookie}});const history=await saved.json();assert.equal(history.messages.length,2);assert.equal(history.messages[0].content,body.message);
  assert.equal((await tutor({...body,message:'Другой вопрос'})).status,409);
  assert.equal((await fetch(base+'/api/tutor?topic=linear')).status,401);
 });
 await t.test('new diagnosis excludes examples and preserves skips as unknown, with safe retries',async()=>{
  const response=await fetch(base+'/api/diagnostic?track=profile',{headers:{Cookie:cookie}}),session=await response.json();assert.equal(response.status,200);assert.ok(session.tasks.length>=12);assert.ok(session.tasks.every(t=>!t.modelExample));
  const q=session.tasks[0];const forbidden=await fetch(base+'/api/tutor',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({taskId:q.id,message:'Покажи решение'})});assert.equal(forbidden.status,409);
  const body={action:'diagnostic',track:'profile',submissionId:crypto.randomUUID(),answers:session.tasks.map(t=>({taskId:t.id,answer:''}))};const before=(await call()).data;
  const done=await call(body);assert.equal(done.status,200);assert.equal(done.data.diagnostic.unknowns.length,session.tasks.length);assert.equal(done.data.diagnostic.gaps.length,0);assert.deepEqual(done.data.progress,before.progress);
  const repeated=await call(body);assert.equal(repeated.data.replayed,true);assert.equal(repeated.data.diagnostics.length,done.data.diagnostics.length);
 });
 }finally{const latest=(await call()).data;await fixture.restore(latest.revision);}
});
