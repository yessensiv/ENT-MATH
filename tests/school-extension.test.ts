import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Explicit extension for native Node tests.
import {schoolExtensionTopics,schoolExtensionTasks,schoolExtensionMetadata,validateSchoolExtensionContent} from '../lib/school-extension-content.ts';
// @ts-expect-error Explicit extension for native Node tests.
import {topics} from '../lib/content.ts';
// @ts-expect-error Explicit extension for native Node tests.
import {schoolTopics} from '../lib/school-content.ts';
// @ts-expect-error Explicit extension for native Node tests.
import {schoolTopicIds,schoolRoute} from '../lib/school-curriculum.ts';
// @ts-expect-error Explicit extension for native Node tests.
import {grade,type Task} from '../lib/engine.ts';
test('14 expanded school lessons and all 210 keys pass independent validation and the actual server grader',()=>{const check=validateSchoolExtensionContent();assert.equal(check.valid,true,check.errors.join('\n'));assert.equal(check.taskCount,210);assert.equal(check.mathematicalChecks,210);for(const t of schoolExtensionTasks)assert.equal(grade({...t,difficulty:t.level,units:t.unit} as Task,t.answer),true,t.id);});
test('new school dependencies and routes are valid; natural-only lessons do not enter the humanitarian route',()=>{const all=[...topics,...schoolTopics,...schoolExtensionTopics],ids=new Set(all.map(t=>t.id));for(const topic of schoolExtensionTopics)for(const id of topic.prerequisites)assert.ok(ids.has(id),`${topic.id}: ${id}`);for(const m of schoolExtensionMetadata){assert.ok(schoolTopicIds(m.grade).includes(m.topicId),m.topicId);if(m.pathway==='natural-math')assert.equal(schoolTopicIds(m.grade,'humanitarian').includes(m.topicId),false);}for(const grade of [5,6,7,8,9,10,11])for(const pathway of ['natural-math','humanitarian'] as const)for(const m of schoolRoute(grade,pathway)!.modules)assert.ok(m.quarter>=1&&m.quarter<=4);});
test('each changed school extension key is rejected instead of silently publishing wrong mathematics',()=>{for(const t of schoolExtensionTasks){const original=t.answer;try{t.answer=Array.isArray(original)?['WRONG']:t.type==='number'?'99999999':'WRONG';assert.equal(validateSchoolExtensionContent().valid,false,t.id);}finally{t.answer=original;}}assert.equal(validateSchoolExtensionContent().valid,true);});
