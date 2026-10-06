import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginLocalFixture} from './local-state-fixture.mjs';
import {emptyState} from '../lib/engine.ts';
import {tasks} from '../lib/content.ts';
import {schoolTasks} from '../lib/school-content.ts';
import {schoolExtensionTasks} from '../lib/school-extension-content.ts';
import {schoolAdvancedTasks} from '../lib/school-advanced-content.ts';
import {generateSchoolReviewTask} from '../lib/school-review-content.ts';
const bank=[...tasks,...schoolTasks,...schoolExtensionTasks,...schoolAdvancedTasks],base='http://127.0.0.1:5173';let cookie='';
async function call(path,body){const r=await fetch(base+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
test('school review generation, offline import and separate EMN/OGN diagnostics use real server results',async t=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});cookie=sign.headers.get('set-cookie').split(';')[0];
 const fixture=await beginLocalFixture(()=>({...emptyState(),profile:{name:'Школьная проверка',grade:'5',learningMode:'school',schoolPathway:'natural-math',track:'base',language:'ru',target:40,examDate:'2027-06-01',dailyMinutes:20},assistedTaskIds:schoolTasks.filter(t=>t.topicId==='school-divisibility').map(t=>t.id)}));
 try{
  await t.test('an exhausted static school topic receives fresh validated tasks and keys stay private',async()=>{
   const delivered=await call('/api/tasks?topic=school-divisibility');assert.equal(delivered.status,200);const fresh=delivered.data.tasks.filter(t=>t.practiceEligible&&!t.reviewReserved);assert.equal(fresh.length,3);assert.equal(delivered.data.exhausted,false);
   for(const q of fresh)for(const key of ['answer','hints','solution','generation'])assert.equal(key in q,false);
   const q=fresh[0],match=/^school-review-divisibility-(\d)-(\d+)$/.exec(q.id),checked=generateSchoolReviewTask('school-divisibility',Number(match[2]),Number(match[1]));
   const attempted=await call('/api/state',{action:'attempt',taskId:q.id,answer:checked.answer});assert.equal(attempted.status,200);assert.equal(attempted.data.feedback.correct,true);assert.equal(attempted.data.feedback.independentEligible,true);
  });
  await t.test('offline downloads generate further fresh school tasks and import them as assisted practice',async()=>{
   const result=await call('/api/offline',{action:'download',topicId:'school-divisibility'});assert.equal(result.status,200);const pack=JSON.parse(result.data.html.match(/const pack=(\{[^\n]+\});const lang=/)[1]);assert.equal(pack.tasks.length,5);assert.ok(pack.tasks.every(t=>t.id.startsWith('school-review-')));
   const imported=await call('/api/offline',{action:'import',result:{version:1,packId:pack.id,answers:pack.tasks.map(q=>({taskId:q.id,answer:q.answer}))}});assert.equal(imported.status,200);assert.ok(imported.data.feedback.every(f=>f.correct&&!f.independentEligible));assert.equal(imported.data.state.progress['school-divisibility'].independent,1);
  });
  await t.test('changing pathway retains progress and stores each diagnosis against its own direction',async()=>{
   const before=(await call('/api/state')).data;
   let naturalIds;
   for(const pathway of ['natural-math','humanitarian']){
    const prior=(await call('/api/state')).data;const profile=await call('/api/state',{action:'profile',grade:'10',learningMode:'school',schoolPathway:pathway,track:'base'});assert.equal(profile.status,200);assert.deepEqual(profile.data.progress,prior.progress);assert.deepEqual(profile.data.progress['school-divisibility'],before.progress['school-divisibility']);
    const diag=(await call('/api/diagnostic?track=base')).data.tasks;assert.ok(diag.length>=5);
    if(pathway==='natural-math')naturalIds=diag.map(q=>q.id);else assert.notDeepEqual(diag.map(q=>q.id),naturalIds);
    const complete=await call('/api/state',{action:'diagnostic',track:'base',answers:diag.map(q=>({taskId:q.id,answer:bank.find(t=>t.id===q.id).answer}))});assert.equal(complete.status,200);assert.equal(complete.data.diagnostic.schoolGrade,'10');assert.equal(complete.data.diagnostic.schoolPathway,pathway);assert.equal(complete.data.diagnostic.score,diag.length);
   }
   const saved=(await call('/api/state')).data;assert.deepEqual(saved.diagnostics.map(d=>d.schoolPathway),['natural-math','humanitarian']);assert.equal(saved.profile.schoolPathway,'humanitarian');
  });
 }finally{await fixture.restore((await call('/api/state')).data.revision);}
});
