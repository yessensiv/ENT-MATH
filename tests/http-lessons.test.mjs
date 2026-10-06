import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.ENT_TEST_BASE_URL||'http://127.0.0.1:5173';
test('published content serves complete supplements for every available lesson without task bank keys',async()=>{
  const response=await fetch(base+'/api/content');assert.equal(response.status,200);const {topics}=await response.json();assert.equal(topics.length,121);
  for(const topic of topics){assert.equal(topic.tasks,undefined);const e=topic.lesson.enrichment;assert.ok(e,topic.id);assert.ok(e.details.length>=2);assert.ok(e.hacks.length>=1);assert.ok(e.life.steps.ru.length>=3);assert.ok(e.life.steps.kk.length>=3);}
});
test('a selected school lesson exposes its own life model and bilingual explanations',async()=>{
  const response=await fetch(base+'/api/content?topic=school-complex-numbers');assert.equal(response.status,200);const {topics}=await response.json();assert.equal(topics.length,1);assert.equal(topics[0].id,'school-complex-numbers');
  const e=topics[0].lesson.enrichment;assert.ok(e.intuition.ru.length>35);assert.ok(e.intuition.kk.length>35);assert.ok(e.life.problem.ru!==e.life.problem.kk);assert.ok(e.hacks[0].caution.ru);
});
