// Uses only the isolated loopback database on 5188, never the learner's server.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promotedExercises as bank} from '../lib/promoted-exercises.ts';
const base='http://127.0.0.1:5188';
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'source_practice_test_'+Date.now(),'oai-authenticated-user-email':'practice-check@example.invalid'};
test('HTTP imported practice: save, conflict, reload, mistake, separate repairs, replay, final report',async()=>{
 const call=async(path,body)=>{const r=await fetch(base+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const onboard=await call('/api/state',{action:'onboard',profile:{name:'Проверка импортированных задач',grade:'11',language:'ru',track:'profile',target:40,dailyMinutes:20,examDate:'2027-06-01'}});assert.equal(onboard.status,200,JSON.stringify(onboard.data));
 const started=await call('/api/practice',{action:'start',topicId:'linear-inequalities',size:10,requestId:crypto.randomUUID()});assert.equal(started.status,200,JSON.stringify(started.data));let session=started.data.session;
 const action=async(action,extra={})=>{const body={action,id:session.id,version:session.version,taskId:session.cursor,requestId:crypto.randomUUID(),...extra};const r=await call('/api/practice',body);assert.equal(r.status,200,JSON.stringify(r.data));session=r.data.session;return{body,result:r.data};};
 const imported=session.main.find(i=>i.id.startsWith('source-auto-'));assert.ok(imported);await action('navigate',{target:imported.id});
 assert.ok(session.current.task.source.archivePageId);assert.equal(session.current.task.answer,undefined);assert.equal(session.current.task.solution,undefined);
 const staleVersion=session.version;
 await action('save',{answer:'[999998;999999]',steps:'Проверка сохранения шагов'});
 const conflict=await call('/api/practice',{action:'save',id:session.id,version:staleVersion,taskId:session.cursor,answer:'[1;2]',requestId:crypto.randomUUID()});assert.equal(conflict.status,409);
 const restored=await call('/api/practice?id='+session.id);assert.equal(restored.status,200);assert.equal(restored.data.session.current.answer,'[999998;999999]');assert.equal(restored.data.session.current.steps,'Проверка сохранения шагов');session=restored.data.session;
 const submitted=await action('submit');assert.equal(session.current.feedback.correct,false);assert.equal(session.extra.length,2);
 const repeated=await call('/api/practice',submitted.body);assert.equal(repeated.status,200);assert.equal(repeated.data.replayed,true);assert.equal(repeated.data.session.summary.main.answered,1);
 for(const extra of session.extra){const task=bank.find(t=>extra.id.endsWith(t.id));assert.ok(task);assert.ok(!session.main.some(i=>i.id===task.id));await action('navigate',{target:extra.id});await action('submit',{answer:task.answer,steps:''});assert.equal(session.current.feedback.correct,true);}
 await action('finish');assert.equal(session.summary.main.answered,1);assert.equal(session.summary.main.incorrect,1);assert.equal(session.summary.extra.correct,2);assert.equal(session.report.length,12);
 const saved=await call('/api/practice?id='+session.id);assert.deepEqual(saved.data.session.summary,session.summary);assert.ok(saved.data.session.finishedAt);assert.equal(saved.data.session.report.length,12);
});
