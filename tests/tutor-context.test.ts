import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests use explicit extensions.
import {topics} from '../lib/content.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import {withLessonEnrichment} from '../lib/lesson-enrichment.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import {lessonTutorExample,lessonTutorReply} from '../lib/tutor-context.ts';
const topic=withLessonEnrichment(topics.find(t=>t.id==='fractions')!);
test('lesson help resolves the actual selected published example and step',()=>{
  const selected=lessonTutorExample(topic,{kind:'example',index:2,stepIndex:1})!;
  assert.equal(selected.example,topic.lesson.examples[2]);
  const reply=lessonTutorReply(topic,selected,'ru',false);
  assert.ok(reply.includes(selected.example.steps.ru[1]));assert.ok(reply.includes(topic.lesson.formula.ru));
  assert.ok(!reply.includes('Что ты уже попробовал'));
});
test('real life and guided help use their own solutions in either language',()=>{
  for(const kind of ['life','guided'])for(const language of ['ru','kk'] as const){
    const selected=lessonTutorExample(topic,{kind})!;
    const reply=lessonTutorReply(topic,selected,language,true);
    assert.ok(reply.includes(selected.example.problem[language]));
    for(const step of selected.example.steps[language])assert.ok(reply.includes(step));
    assert.ok(reply.includes(selected.example.answerText?.[language]??selected.example.answer));
  }
});
test('forged, missing and out of range lesson references never become trusted explanations',()=>{
  for(const selection of [null,[],{}, {kind:'example',index:-1},{kind:'example',index:99},{kind:'example',index:0,stepIndex:99},{kind:'life',stepIndex:0.5},{kind:'made-up',solution:'forged'}])assert.throws(()=>lessonTutorExample(topic,selection));
  assert.equal(lessonTutorExample(topic,undefined),null);
});
