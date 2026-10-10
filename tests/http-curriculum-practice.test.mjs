/** Separate loopback database only. Never run this against production. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curriculumPracticeTasks as bank} from '../lib/curriculum-practice.ts';
import {practiceTopics} from '../lib/curriculum-practice-generator.ts';
const base='http://127.0.0.1:5188';
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'curriculum_practice_test_'+Date.now(),
 'oai-authenticated-user-email':'curriculum-practice@example.invalid'};

test('HTTP all 121 topics expose the new bilingual bank and keep keys private',async()=>{
 for(const topic of practiceTopics){
  const response=await fetch(base+'/api/tasks?topic='+encodeURIComponent(topic.id));
  assert.equal(response.status,200,topic.id);const data=await response.json();
  const added=data.tasks.filter(t=>t.id.startsWith('practice-v1-'));
  assert.equal(added.filter(t=>!t.reviewReserved).length,15,topic.id);
  assert.ok(added.filter(t=>t.reviewReserved).length>=6,topic.id);
  for(const task of added){
   assert.equal(task.topicId,topic.id);assert.ok(task.prompt.ru&&task.prompt.kk);
   assert.equal(task.practiceOrigin.kind,'authored');
   const expected=bank.find(item=>item.id===task.id);
   assert.ok(expected,task.id);
   assert.equal(task.practiceOrigin.version,expected.practiceOrigin.version);
   assert.deepEqual(task.prompt,expected.prompt,'Server must expose the revised condition: '+task.id);
   for(const field of ['answer','solution','hints','generation','curriculumPractice'])assert.equal(task[field],undefined,topic.id+' leaks '+field);
  }
 }
});

test('HTTP author practice: saved draft, conflict, separate repairs, replay and persisted report',async()=>{
 const call=async(path,body)=>{const response=await fetch(base+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
 const onboard=await call('/api/state',{action:'onboard',profile:{name:'Изолированная проверка школьной практики',grade:'6',learningMode:'school',schoolPathway:'natural-math',language:'kk',track:'base',target:40,dailyMinutes:20,examDate:'2027-06-01'}});
 assert.equal(onboard.status,200,JSON.stringify(onboard.data));
 const started=await call('/api/practice',{action:'start',topicId:'school-repeating-decimals',size:15,requestId:crypto.randomUUID()});
 assert.equal(started.status,200,JSON.stringify(started.data));let session=started.data.session;
 assert.equal(session.main.length,15);
 const action=async(action,extra={})=>{const body={action,id:session.id,version:session.version,taskId:session.cursor,requestId:crypto.randomUUID(),...extra};const result=await call('/api/practice',body);assert.equal(result.status,200,JSON.stringify(result.data));session=result.data.session;return{body,result};};
 const main=session.main.find(t=>t.id.startsWith('practice-v1-'));assert.ok(main);
 await action('navigate',{target:main.id});const oldVersion=session.version;
 await action('save',{answer:'999999',steps:'Период пен бүтін бөлікті бөлемін'});
 const stale=await call('/api/practice',{action:'save',id:session.id,version:oldVersion,taskId:session.cursor,answer:'1',requestId:crypto.randomUUID()});assert.equal(stale.status,409);
 const restored=await call('/api/practice?id='+session.id);assert.equal(restored.status,200);session=restored.data.session;
 assert.equal(session.current.answer,'999999');assert.equal(session.current.steps,'Период пен бүтін бөлікті бөлемін');
 const submitted=await action('submit');assert.equal(session.current.feedback.correct,false);assert.equal(session.extra.length,2);
 const replay=await call('/api/practice',submitted.body);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);
 for(const extra of session.extra){
  const task=bank.find(t=>extra.id.endsWith(t.id));assert.ok(task);assert.ok(task.reviewReserved);
  assert.ok(!session.main.some(m=>m.id===task.id));
  await action('navigate',{target:extra.id});await action('submit',{answer:task.answer,steps:''});assert.equal(session.current.feedback.correct,true);
 }
 await action('finish');assert.equal(session.summary.main.incorrect,1);assert.equal(session.summary.extra.correct,2);
 const saved=await call('/api/practice?id='+session.id);assert.equal(saved.status,200);assert.deepEqual(saved.data.session.summary,session.summary);
 assert.equal(saved.data.session.report.length,17);assert.ok(saved.data.session.finishedAt);
});
