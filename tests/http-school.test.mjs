import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasks } from '../lib/content.ts';
import { schoolTasks } from '../lib/school-content.ts';
import { schoolTopicIds } from '../lib/school-curriculum.ts';
const base=process.env.ENT_TEST_BASE_URL||'http://127.0.0.1:5173';
let cookie='';
async function call(path,body){const r=await fetch(base+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
test('grades 5–11 and the school goal survive re-login without erasing progress',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});cookie=sign.headers.get('set-cookie').split(';')[0];
 const initial=(await call('/api/state')).data;assert.equal(initial.user.id,'local_seedy');assert.equal(initial.schoolFixture,true,'Use the isolated school flow runner');
 try{
  for(const grade of ['5','6','7','8','9','10','11']){
   const earlierStamp=Date.now();
   const saved=await call('/api/state',{action:'profile',profile:{...initial.profile,grade,learningMode:'school',track:'base'}});assert.equal(saved.status,200);assert.equal(saved.data.profile.learningMode,'school');
   const diag=await call('/api/diagnostic?track=base');assert.equal(diag.status,200);assert.ok(diag.data.tasks.every(t=>schoolTopicIds(grade).includes(t.topicId)));assert.ok(diag.data.tasks.every(t=>!('answer' in t)));
   const late=await call('/api/state',{action:'save-draft',kind:'diagnostic',track:'base',taskId:diag.data.tasks[0].id,answers:[],answer:'',updatedAt:earlierStamp});assert.equal(late.status,200);assert.equal(late.data.staleSnapshot,true);assert.ok(!late.data.diagnosticDraft);
   const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});cookie=login.headers.get('set-cookie').split(';')[0];
   const restored=(await call('/api/state')).data;assert.equal(restored.profile.grade,grade);assert.deepEqual(restored.progress,initial.progress);assert.equal(restored.xp,initial.xp);assert.equal(restored.attempts.length,initial.attempts.length);assert.ok(restored.plan.length);
  }
  assert.equal((await call('/api/state',{action:'profile',grade:'5',learningMode:'school',track:'base'})).status,200);
  const questions=(await call('/api/diagnostic?track=base')).data.tasks,bank=[...tasks,...schoolTasks];
  const checked=await call('/api/state',{action:'diagnostic',track:'base',answers:questions.map((q,i)=>({taskId:q.id,answer:i===0?'999999':bank.find(t=>t.id===q.id).answer}))});assert.equal(checked.status,200);assert.equal(checked.data.diagnostic.schoolGrade,'5');assert.equal(checked.data.diagnostic.gaps.length,1);
  assert.equal((await call('/api/state',{action:'resume',topicId:'school-decimals',stage:1})).status,200);
  const practice=(await call('/api/tasks?topic=school-decimals')).data.tasks,first=practice.find(t=>t.practiceEligible&&!t.reviewReserved&&!t.modelExample);assert.ok(first);
  const wrong=await call('/api/state',{action:'attempt',taskId:first.id,answer:'-999999'});assert.equal(wrong.status,200);assert.equal(wrong.data.feedback.correct,false);assert.equal(wrong.data.errors.at(-1).topicId,'school-decimals');
  const help=await call('/api/tutor',{taskId:first.id,topicId:'school-decimals',message:'Объясни первый шаг',steps:''});assert.equal(help.status,200);assert.equal(help.data.topicId,'school-decimals');assert.ok(help.data.reply);
  const corrected=await call('/api/state',{action:'attempt',taskId:first.id,answer:bank.find(t=>t.id===first.id).answer});assert.equal(corrected.status,200);assert.equal(corrected.data.feedback.correct,true);assert.equal(corrected.data.feedback.independentEligible,false);
  const fresh=practice.find(t=>t.id!==first.id&&t.practiceEligible&&!t.reviewReserved&&!t.modelExample);assert.ok(fresh);
  const independent=await call('/api/state',{action:'attempt',taskId:fresh.id,answer:bank.find(t=>t.id===fresh.id).answer});assert.equal(independent.status,200);assert.equal(independent.data.feedback.independentEligible,true);assert.equal(independent.data.progress['school-decimals'].mastered,false);
  const translated=await call('/api/state',{action:'profile',language:'kk'});assert.equal(translated.status,200);assert.deepEqual(translated.data.progress,independent.data.progress);
  const loaded=(await call('/api/state')).data;assert.equal(loaded.profile.grade,'5');assert.equal(loaded.profile.language,'kk');assert.equal(loaded.attempts.length,initial.attempts.length+3);assert.equal(loaded.lessonResume.topicId,'school-decimals');assert.ok(loaded.reviews.some(r=>r.topicId==='school-decimals'));
  assert.equal((await call('/api/state',{action:'profile',grade:'4',learningMode:'school'})).status,400);
  assert.equal((await call('/api/state',{action:'profile',grade:'graduate',learningMode:'school'})).status,400);
 }finally{await call('/api/state',{action:'profile',profile:{...initial.profile,learningMode:initial.profile.learningMode??'ent'}});}
});
