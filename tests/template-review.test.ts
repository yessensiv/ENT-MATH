import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
// @ts-expect-error Native tests.
import{topics}from'../lib/content.ts';
// @ts-expect-error Native tests.
import{contentDigest}from'../lib/material-review.ts';
// @ts-expect-error Native tests.
import{isModelExample}from'../lib/engine.ts';
test('AI template review is pinned to exact materials; it cannot claim human or whole-course acceptance',async()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/reviews/AI-TEMPLATE-REVIEW-2026-10-06.json',import.meta.url),'utf8'));
 assert.equal(report.reviewer.type,'ai');assert.equal(report.status,'partial-ai-review');assert.equal(report.records.length,30);
 for(const record of report.records){const topic=topics.find(t=>t.id===record.topicId)!;assert.equal(await contentDigest(topic.tasks.filter(t=>record.taskIds.includes(t.id))),record.sha256,`Review stale: ${record.skillId}`);}
});
test('algebra fractions guided work practices cancellation; domain checkpoint explains the removable hole',()=>{
 const topic=topics.find(t=>t.id==='algebra-fractions')!,guided=topic.tasks[6];assert.equal(topic.lesson.guided.problem.ru,guided.prompt.ru);assert.match(topic.lesson.guided.answerText!.ru,/x≠2/);
 assert.equal(isModelExample({...guided,difficulty:guided.level},{...topic}),true);assert.match(topic.lesson.checkpoint.answer.ru,/Нет/);assert.match(topic.lesson.checkpoint.why.ru,/исходной ОДЗ/);
});
