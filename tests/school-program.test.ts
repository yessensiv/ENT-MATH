import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests use explicit extensions.
import { schoolCourses, schoolTopicIds } from '../lib/school-curriculum.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import { schoolTopics, schoolTasks, validateSchoolContent } from '../lib/school-content.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import { topics, tasks } from '../lib/content.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import { emptyState, makePlan, diagnosticTasks, makeExam, grade, type Topic, type Task } from '../lib/engine.ts';
const combined=[...topics,...schoolTopics.map(t=>({...t,schoolOnly:true}))] as unknown as Topic[];
const bank=[...tasks,...schoolTasks].map(t=>({...t,difficulty:t.level})) as unknown as Task[];
test('school curriculum covers all seven grades with real bilingual lessons and valid dependencies',()=>{
 assert.deepEqual(schoolCourses.map(c=>c.grade),[5,6,7,8,9,10,11]);
 for(const c of schoolCourses){const ids=schoolTopicIds(c.grade);assert.ok(ids.length>=8);assert.equal(ids.length,new Set(ids).size);for(const id of ids){const topic=combined.find(t=>t.id===id);assert.ok(topic,`${c.grade}: ${id}`);for(const p of topic.prerequisites??[])assert.ok(combined.some(t=>t.id===p),p);}}
 assert.equal(validateSchoolContent().valid,true);
 for(const t of schoolTopics){assert.equal(t.spec,null);assert.equal(t.tasks.length,15);for(const level of [1,2,3])assert.equal(t.tasks.filter(q=>q.level===level).length,5);}
});
test('school answer keys are accepted and every lesson has bilingual methods and three examples',()=>{
 for(const task of schoolTasks)assert.equal(grade({...task,difficulty:task.level} as unknown as Task,task.answer),true,task.id);
 for(const topic of schoolTopics){assert.equal(topic.lesson.examples.length,3);assert.ok(topic.lesson.blocks.length>=3);for(const language of ['ru','kk'] as const){assert.ok(topic.lesson.explanation[language].length>=80,topic.id);assert.ok(topic.lesson.terms[language].length>=30,topic.id);assert.ok(topic.lesson.blocks.every(b=>b.body[language].length>=30),topic.id);assert.ok(topic.lesson.checkpoint.why[language],topic.id);}}
});
test('school plan and diagnosis depend on the chosen grade; ENT remains separate',()=>{
 const state=emptyState();state.profile={name:'School test',grade:'5',learningMode:'school',track:'base',examDate:'2027-06-01',target:40,dailyMinutes:20,language:'ru'};
 const first=makePlan(state,combined);assert.ok(first.length);assert.ok(first.every(p=>!p.reason.ru.includes('До экзамена')));
 for(const c of schoolCourses){state.profile.grade=String(c.grade);const diag=diagnosticTasks('base',combined,bank,state.profile.grade);assert.ok(diag.length>=5);assert.ok(diag.every(t=>schoolTopicIds(c.grade).includes(t.topicId)));assert.ok(makePlan(state,combined).length);}
 state.profile.learningMode='ent';assert.ok(makePlan(state,combined).every(p=>!p.topicId.startsWith('school-')));
 for(let variant=1;variant<=5;variant++){const exam=makeExam('profile',variant,combined,bank);assert.equal(exam.questions.length,40);assert.ok(exam.questions.every(t=>!t.topicId.startsWith('school-')));}
});
