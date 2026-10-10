import {test} from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5188';
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'qa_flow_'+Date.now(),'oai-authenticated-user-email':'qa@example.invalid'};
async function call(path,body,auth=headers){const r=await fetch(base+path,{headers:auth,...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
test('isolated account: tutor context, disabled provider, exam lock, reload, flags, result and access separation',async()=>{
 let r=await call('/api/state');assert.equal(r.status,200);assert.equal(r.data.aiConfigured,false,'Refuse to run with a real provider key');
 r=await call('/api/state',{action:'onboard',profile:{name:'QA isolated',grade:'11',language:'ru',track:'profile',target:40,dailyMinutes:20,examDate:'2027-06-01'}});assert.equal(r.status,200);
 const mentor=await call('/api/tutor',{topicId:'linear',taskId:'linear-3',message:'Покажи полное решение текущей задачи.',fullSolution:true,messageId:crypto.randomUUID()});assert.equal(mentor.status,200,JSON.stringify(mentor.data));
 const history=await call('/api/tutor?topic=linear&task=linear-3');assert.equal(history.status,200);
 const other=await call('/api/tutor?topic=fractions&task=fractions-1');assert.equal(other.status,200);assert.notDeepEqual(other.data,history.data);
 assert.equal((await call('/api/admin')).status,403);
 assert.equal((await call('/api/state',undefined,{})).status,401);
 for(const [track,count] of [['profile',40],['literacy',10]]){
  r=await call('/api/state',{action:'exam-start',track,variant:1});assert.equal(r.status,200,JSON.stringify(r.data));const exam=r.data.activeExam;
  assert.equal(exam.questions.length,count);assert.ok(exam.questions.every(q=>q.answer===undefined&&q.solution===undefined));
  assert.equal((await call('/api/tutor',{topicId:'linear',message:'Помоги',messageId:crypto.randomUUID()})).status,409);
  r=await call('/api/state',{action:'exam-answer',examId:exam.id,index:0,flagged:true,updatedAt:Date.now()});assert.equal(r.status,200);
  const reload=await call('/api/state');assert.equal(reload.data.activeExam.id,exam.id);
  r=await call('/api/state',{action:'exam-finish',examId:exam.id});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.activeExam,null);assert.equal(r.data.result.score,0);
  assert.equal((await call('/api/state')).data.exams.at(-1).score,0);
 }
 const stranger=await call('/api/state',undefined,{...headers,'oai-authenticated-user-id':'qa_other_'+Date.now()});assert.equal(stranger.status,200);assert.equal(stranger.data.exams.length,0);
});
test('new learner diagnostic: unknowns, persisted plan, repeat submit and no artificial mastery',async()=>{
 const identity={...headers,'oai-authenticated-user-id':'qa_diagnostic_'+Date.now()};
 const callAs=(path,body)=>call(path,body,identity);
 assert.equal((await callAs('/api/state',{action:'onboard',profile:{name:'Diagnostic QA',grade:'9',language:'kk',track:'base',target:40,dailyMinutes:15,examDate:'2027-06-01'}})).status,200);
 const questions=await callAs('/api/diagnostic?track=base');assert.equal(questions.status,200);assert.ok(questions.data.tasks.length>=12);
 assert.equal((await callAs('/api/tutor',{taskId:questions.data.tasks[0].id,message:'Полное решение',messageId:crypto.randomUUID()})).status,409);
 assert.deepEqual((await callAs('/api/diagnostic?track=base')).data.tasks,questions.data.tasks);
 const submission={action:'diagnostic',track:'base',answers:questions.data.tasks.map(t=>({taskId:t.id,answer:''})),submissionId:crypto.randomUUID()};
 const done=await callAs('/api/state',submission);assert.equal(done.status,200,JSON.stringify(done.data));assert.equal(done.data.diagnostic.score,0);assert.equal(done.data.xp,0);assert.ok(done.data.plan.length>0);
 const replay=await callAs('/api/state',submission);assert.equal(replay.data.replayed,true);assert.deepEqual(replay.data.diagnostic,done.data.diagnostic);
 const reload=await callAs('/api/state');assert.equal(reload.data.diagnostics.length,1);assert.ok(Object.values(reload.data.progress).every(p=>!p.mastered));
});
