import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native tests.
import{topics,tasks,generateReviewTask,reviewCapacity,validateGeneratedTask}from'../lib/content.ts';
// @ts-expect-error Native tests.
import{emptyState,recordAttempt,isModelExample,type Task,type Topic}from'../lib/engine.ts';
// @ts-expect-error Native tests.
import{assignErrorRepairs}from'../lib/error-repair.ts';
const bank=tasks.map(t=>({...t,difficulty:t.level,units:t.unit,modelExample:isModelExample({...t,difficulty:t.level},{...topics.find(p=>p.id===t.topicId)!})})) as Task[];
const generator={generateReviewTask,reviewCapacity,validateGeneratedTask:(t:unknown)=>validateGeneratedTask(t as Parameters<typeof validateGeneratedTask>[0])};
test('ERR-01: wrong fraction division gets two NEW division tasks; addition does not close it',()=>{
 const state=emptyState(),topic=topics.find(t=>t.id==='fractions')! as unknown as Topic,original=bank.find(t=>t.id==='fractions-8')!;
 recordAttempt(state,original,topic,{answer:'99'},bank);const error=state.errors[0];
 const repair=assignErrorRepairs(state,error,bank,generator);assert.equal(repair.status,'ready');assert.equal(repair.tasks.length,2);assert.ok(repair.tasks.every(t=>t.repairSkillId==='fractions:method-2'&&t.id!==original.id));
 assert.equal(assignErrorRepairs(state,error,bank,generator).changed,false);
 const unrelated=bank.find(t=>t.id==='fractions-4')!;recordAttempt(state,unrelated,topic,{answer:unrelated.answer},bank);assert.equal(error.resolved,false);
 for(const [i,t]of repair.tasks.entries()){recordAttempt(state,t,topic,{answer:t.answer,submissionId:'repair-'+i},[...bank,...repair.tasks]);assert.equal(error.resolved,i===1);}
 assert.equal(error.repairPassedTaskIds?.length,2);const xp=state.xp;
 recordAttempt(state,repair.tasks[1],topic,{answer:repair.tasks[1].answer,submissionId:'repair-1'},[...bank,...repair.tasks]);assert.equal(state.xp,xp);
 assert.equal(state.progress.fractions.mastered,false);assert.ok(state.reviews.some(r=>!r.completed));
});
test('ERR-01: hints require a replacement; changed published condition and unmapped method fail closed',()=>{
 const state=emptyState(),topic=topics.find(t=>t.id==='linear')! as unknown as Topic,original=bank.find(t=>t.id==='linear-4')!;
 recordAttempt(state,original,topic,{answer:'0'},bank);const e=state.errors[0],r=assignErrorRepairs(state,e,bank,generator);
 recordAttempt(state,r.tasks[0],topic,{answer:r.tasks[0].answer,assisted:true},[...bank,...r.tasks]);assert.equal(e.repairPassedTaskIds,undefined);
 const next=assignErrorRepairs(state,e,bank,generator);assert.equal(next.tasks.length,2);assert.ok(next.tasks.every(t=>t.id!==r.tasks[0].id));
 const altered=bank.map(t=>t.id===original.id?{...t,prompt:{ru:'changed',kk:'changed'}}:t);assert.equal(assignErrorRepairs(state,e,altered,generator).status,'unmapped');
 const other={...e,taskId:'quadratic-8',topicId:'quadratic'};assert.equal(assignErrorRepairs(state,other,bank,generator).status,'unmapped');
});
test('ERR-01: reviewed templates across ten topics generate valid exact-skill repairs',()=>{
 for(const topic of topics.filter(t=>t.skillIds?.length))for(const index of [3,7,12]){
  const state=emptyState(),original=bank.find(t=>t.id===topic.tasks[index].id)!;
  recordAttempt(state,original,{...topic},{answer:original.type==='expression'?'123*x':'-99999'},bank);
  assert.equal(state.errors.length,1,original.id);const r=assignErrorRepairs(state,state.errors[0],bank,generator);
  assert.equal(r.status,'ready',original.id);assert.ok(r.tasks.every(t=>t.repairSkillId===original.repairSkillId));
 }
});
