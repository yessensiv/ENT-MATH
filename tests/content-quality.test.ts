import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's native TS runner requires the explicit extension.
import { topics, getTask, validateContent, generateReviewTask, validateGeneratedTask, reviewCapacity } from '../lib/content.ts';

test('introductory functions are preparatory, with no fabricated official topic reference',()=>{
 for(const id of ['functions','transformations']) assert.equal(topics.find(t=>t.id===id)?.spec,null);
});

test('all advertised short lessons have an estimated duration of 10–15 minutes',()=>{
 assert.equal(topics.length,82);
 for(const topic of topics){
  assert.ok(Number.isFinite(topic.minutes)&&topic.minutes>=10&&topic.minutes<=15,`${topic.id}: ${topic.minutes} minutes`);
 }
});

test('all advertised review variants validate, remain fresh, and stop at their exact finite boundary',()=>{
 let checked=0;
 for(const topic of topics){
  const seen=new Set(topic.tasks.map(t=>JSON.stringify(t.prompt)));
  for(const level of [1,2,3] as const){
   const capacity=reviewCapacity(topic.id,level);
   for(let serial=1;serial<=capacity;serial++){
    const task=generateReviewTask(topic.id,serial,level);assert.ok(task,`${topic.id}/${level}/${serial}`);
    const condition=JSON.stringify(task.prompt);
    assert.equal(seen.has(condition),false,task.id);seen.add(condition);checked++;
   }
   assert.equal(generateReviewTask(topic.id,capacity+1,level),null);
   assert.equal(generateReviewTask(topic.id,0,level),null);
  }
 }
 assert.equal(checked,20342);
 assert.equal(generateReviewTask('missing-topic',1),null);
});

test('changing a condition without changing its key fails content validation',()=>{
 const t=getTask('numbers-1')!;const before=t.prompt;
 try{t.prompt={ru:'Вычисли 100 + 100.',kk:'100 + 100 мәнін есепте.'};assert.equal(validateContent().valid,false);}
 finally{t.prompt=before;}
 assert.equal(validateContent().valid,true);
});

test('each lesson teaches a method and why it works in both languages',()=>{
 for(const t of topics)for(const language of ['ru','kk'] as const){
  assert.ok(t.lesson.blocks.length>=3,t.id);
  assert.ok(t.lesson.blocks.every(block=>block.body[language].length>=30),t.id);
  assert.ok(t.lesson.checkpoint.question[language]&&t.lesson.checkpoint.answer[language]&&t.lesson.checkpoint.why[language],t.id);
 }
});

test('deterministic reviews are new, independently checked, and reject edited conditions and keys',()=>{
 for(const topic of topics){
  const originalPrompts=new Set(topic.tasks.map(t=>t.prompt.ru));const fingerprints=new Set<string>();
  for(const level of [1,2,3] as const)for(const serial of [1,2,3]){
   const t=generateReviewTask(topic.id,serial,level);assert.ok(t,`${topic.id}/${level}/${serial}`);
   assert.equal(validateGeneratedTask(t).valid,true,`${topic.id}/${level}/${serial}`);
   assert.equal(originalPrompts.has(t.prompt.ru),false,t.id);
   assert.equal(fingerprints.has(t.prompt.ru),false,t.id);fingerprints.add(t.prompt.ru);
   assert.equal(validateGeneratedTask({...t,answer:'99999999'}).valid,false,t.id);
   assert.equal(validateGeneratedTask({...t,prompt:{ru:'100+100?',kk:'100+100?'}}).valid,false,t.id);
  }
 }
});
