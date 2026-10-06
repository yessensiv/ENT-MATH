import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';import{emptyState}from'../lib/engine.ts';import{reservedExam}from'../lib/exam-bank.ts';import{generateReviewTask}from'../lib/content.ts';
const base='http://127.0.0.1:5173';
test('private exam reserve, variant ten, persisted timing, replay and familiarity through HTTP',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const f=await beginLocalFixture(o=>({...emptyState(),profile:o.profile}));let mutations=0;
 try{
  const submit=async body=>{const r=await call('/api/state',body);assert.equal(r.status,200,JSON.stringify(r.data));if(!r.data.alreadyFinished)mutations++;return r.data;};
  assert.equal((await call('/api/exams?track=profile')).data.variants.length,10);
  const expected=reservedExam('literacy',10),first=expected.questions[0];
  for(const taskId of [first.id,first.sourceTaskId]){
   assert.equal((await call('/api/state',{action:'attempt',taskId,answer:first.answer})).status,404);
   assert.equal((await call('/api/tutor',{taskId,topicId:first.topicId,message:'Покажи решение'})).status,404);
  }
  const practice=await call('/api/tasks?topic='+first.topicId,undefined,false);assert.equal(practice.status,200);assert.ok(practice.data.tasks.every(t=>!t.id.startsWith('exam-')));
  assert.equal((await call('/api/state',{action:'exam-start',track:'literacy',variant:11})).status,400);
  const started=await submit({action:'exam-start',track:'literacy',variant:10}),exam=started.activeExam;
  assert.equal(exam.questions.length,10);assert.deepEqual(exam.familiarQuestionIds,[]);
  for(const q of exam.questions){assert.equal('answer'in q,false);assert.equal('solution'in q,false);}
  assert.equal((await call('/api/history?kind=exams')).status,409);
  assert.equal((await call('/api/tasks?topic='+first.topicId)).status,409);
  assert.equal((await call('/api/tutor',{taskId:'linear-2',message:'Подскажи'})).status,409);
  for(let index=0;index<10;index++)await submit({action:'exam-answer',examId:exam.id,index,answer:expected.questions[index].answer,flagged:index===0});
  const restored=(await call('/api/state')).data.activeExam;assert.equal(restored.startedAt,exam.startedAt);assert.deepEqual(restored.flagged,[0]);assert.equal(Object.keys(restored.answers).length,10);
  const finished=await submit({action:'exam-finish',examId:exam.id});assert.equal(finished.result.score,10);assert.equal(finished.result.results.length,10);
  const replay=await submit({action:'exam-finish',examId:exam.id});assert.equal(replay.alreadyFinished,true);assert.deepEqual(replay.result,finished.result);assert.equal(replay.exams.length,1);
  const repeated=await submit({action:'exam-start',track:'literacy',variant:10});assert.equal(repeated.activeExam.familiarQuestionIds.length,10);
  assert.equal((await call('/api/state')).data.activeExam.familiarQuestionIds.length,10);
  await submit({action:'exam-finish',examId:repeated.activeExam.id});
  const profile=reservedExam('profile',2),mapped=profile.questions.find(t=>t.repairSkillId);assert.ok(mapped);
  const p=await submit({action:'exam-start',track:'profile',variant:2});
  const end=await submit({action:'exam-finish',examId:p.activeExam.id}),error=end.errors.find(e=>e.taskId===mapped.id);assert.ok(error);
  const repair=await call(`/api/tasks?topic=${error.topicId}&errorId=${error.id}`);assert.equal(repair.status,200,JSON.stringify(repair.data));mutations++;
  assert.equal(repair.data.repair.status,'ready');assert.equal(repair.data.tasks.length,2);assert.ok(repair.data.tasks.every(t=>t.skillIds[0]===mapped.repairSkillId));
  for(const t of repair.data.tasks){const match=t.id.match(/^review-(.+)-([123])-(\d+)$/);assert.ok(match);const expected=generateReviewTask(match[1],Number(match[3]),Number(match[2]));await submit({action:'attempt',taskId:t.id,answer:expected.answer,submissionId:crypto.randomUUID()});}
  assert.equal((await call('/api/state')).data.errors.find(e=>e.id===error.id).resolved,true);
  assert.equal((await call('/api/state')).data.revision,f.revision+mutations);
 }finally{await f.restore(f.revision+mutations);}
});
