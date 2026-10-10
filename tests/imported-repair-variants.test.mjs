import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promotedExercises as bank} from '../lib/promoted-exercises.ts';
import {makeImportedRepair} from '../lib/imported-repair-variants.ts';
import {assignErrorRepairs} from '../lib/error-repair.ts';
import {emptyState,checkAnswer,taskFingerprint,calculate} from '../lib/engine.ts';
import {readFileSync} from 'node:fs';
import {createPractice,savePracticeDraft,submitPractice} from '../lib/practice-session.ts';
import {topics} from '../lib/content.ts';
const generator={reviewCapacity:()=>0,generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false})};
test('translated equation roots and inequality regions agree with the original independently evaluated conditions',()=>{
 const proofs=JSON.parse(readFileSync(new URL('../content/promoted/verification.json',import.meta.url),'utf8'));
 for(const p of proofs.filter(p=>p.equation||p.inequality)){
  const original=bank.find(t=>t.id===p.id),t=makeImportedRepair(original,7);assert.ok(t);
  if(p.equation){const sides=t.prompt.ru.replace(/^[^:]+: /,'').slice(0,-1).split(' = ');for(const root of t.answer.slice(1,-1).split(';').filter(Boolean)){const x=calculate(root);assert.ok(Math.abs(calculate(sides[0],x)-calculate(sides[1],x))<1e-7,p.id);}}
  else for(const x of p.probes.map(calculate)){const before=calculate(p.inequality.expression,x),after=calculate(p.inequality.expression.replace(/x/g,'(x-7)'),x+7);assert.ok(Math.abs(before-after)<1e-7,p.id);}
 }
});
test('every promoted template supplies two distinct verified repair conditions when its entire bank is occupied',()=>{
 for(const original of bank){
  const state=emptyState();state.practiceSessions=[{main:bank.filter(t=>t.methodFamily===original.methodFamily).map(task=>({task})),extra:[]}];
  const error={id:'test-'+original.id,taskId:original.id,topicId:original.topicId,prompt:original.prompt,correctAnswer:original.answer,solution:original.solution,exerciseIds:[],resolved:false};
  const result=assignErrorRepairs(state,error,bank,generator);
  assert.equal(result.status,'ready',original.id);assert.equal(result.tasks.length,2);
  assert.equal(new Set(result.tasks.map(taskFingerprint)).size,2);
  for(const task of result.tasks){
   assert.equal(task.source,undefined);assert.equal(task.reviewReserved,true);
   assert.equal(task.methodFamily,original.methodFamily);assert.equal(task.type,original.type);assert.equal(task.difficulty,original.difficulty);
   assert.equal(checkAnswer(task,task.answer).status,'correct',task.id);
   assert.notEqual(taskFingerprint(task),taskFingerprint(original));
  }
  assert.equal(assignErrorRepairs(state,error,bank,generator).changed,false);
  assert.equal(state.generatedTasks.length,2);
 }
});
test('positive and negative square root repairs retain the sign and do not reuse the original condition',()=>{
 for(const original of bank.filter(t=>t.topicId==='radicals'&&/sqrt\((16|225)\)/.test(t.prompt.ru))){
  const task=makeImportedRepair(original,1);assert.ok(task);
  assert.equal(Math.sign(Number(task.answer)),Math.sign(Number(original.answer)));
  assert.notEqual(taskFingerprint(task),taskFingerprint(original));
 }
});
test('wrong imported root, two extras, reload and replay retain a resolved repair separately from main practice',()=>{
 const bankRoot=bank.filter(t=>t.topicId==='radicals'),state=emptyState(),topic=topics.find(t=>t.id==='radicals');
 const session=createPractice(state,topic.id,bankRoot,15),item=session.main[0];
 savePracticeDraft(session,item.task.id,'999999','');submitPractice(state,session,item.task.id,topic,bankRoot,generator);
 assert.equal(session.extra.length,2);assert.equal(session.main.length,15);
 submitPractice(state,session,item.task.id,topic,bankRoot,generator);assert.equal(state.attempts.length,1);
 const restored=JSON.parse(JSON.stringify(state)),s=restored.practiceSessions[0];
 for(const extra of s.extra){savePracticeDraft(s,extra.task.id,extra.task.answer,'');submitPractice(restored,s,extra.task.id,topic,[...bankRoot,...restored.generatedTasks],generator);}
 assert.equal(restored.errors[0].resolved,true);assert.equal(restored.errors[0].repairPassedTaskIds.length,2);assert.equal(restored.attempts.length,3);
 assert.equal(s.main.filter(t=>t.feedback).length,1);
});

