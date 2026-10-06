import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native tests require explicit extensions.
import {schoolAdvancedTopics,schoolAdvancedTasks,schoolAdvancedMetadata,validateSchoolAdvancedContent} from '../lib/school-advanced-content.ts';
// @ts-expect-error Native tests require explicit extensions.
import {schoolTopicIds,schoolRoute} from '../lib/school-curriculum.ts';
// @ts-expect-error Native tests require explicit extensions.
import {grade,type Task} from '../lib/engine.ts';
test('17 advanced lessons and 255 tasks are independently checked and accepted by the server grader',()=>{
 const result=validateSchoolAdvancedContent();assert.deepEqual(result.errors,[]);assert.equal(result.mathematicalChecks,255);assert.equal(schoolAdvancedTopics.length,17);
 for(const task of schoolAdvancedTasks){assert.equal(grade({...task,difficulty:task.level,units:task.unit} as Task,task.answer),true,task.id);}
});
test('all added lessons are reachable in their grade and natural-only content is excluded from OGN',()=>{
 for(const m of schoolAdvancedMetadata){assert.ok(schoolTopicIds(m.grade).includes(m.topicId),m.topicId);if(m.grade>=10&&m.pathway==='natural-math')assert.equal(schoolTopicIds(m.grade,'humanitarian').includes(m.topicId),false,m.topicId);if(m.grade>=10&&m.pathway==='common')assert.ok(schoolTopicIds(m.grade,'humanitarian').includes(m.topicId),m.topicId);}
 for(const grade of [5,6,7,8,9,10,11])for(const path of ['natural-math','humanitarian'] as const){const route=schoolRoute(grade,path)!;assert.ok(route.modules.every(m=>m.topicIds.length&&m.quarter>=1&&m.quarter<=4));}
});
test('changing any one advanced answer is rejected before publication',()=>{
 for(const task of schoolAdvancedTasks){const answer=task.answer;try{task.answer=Array.isArray(answer)?['incorrect']:answer==='999999'?'888888':'999999';assert.equal(validateSchoolAdvancedContent().valid,false,task.id);}finally{task.answer=answer;}}
});
