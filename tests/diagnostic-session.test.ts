import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{beginDiagnostic,assignedDiagnostic}from'../lib/diagnostic-session.ts';
// @ts-expect-error Native Node tests.
import{emptyState,isModelExample,reservedReviewIds}from'../lib/engine.ts';
// @ts-expect-error Native Node tests.
import{topics,tasks}from'../lib/content.ts';
const bank=tasks.map(t=>({...t,difficulty:t.level,reviewReserved:reservedReviewIds(topics.find(p=>p.id===t.topicId) as never).includes(t.id)}));
test('DIAG-01: new diagnosis has 12–18 independent tasks, no worked examples or review reserve',()=>{
 for(const track of ['base','profile','literacy'] as const){const state=emptyState(),questions=beginDiagnostic(state,track,topics as never,bank as never);assert.ok(questions.length>=12&&questions.length<=18);assert.equal(new Set(questions.map(t=>t.id)).size,questions.length);assert.ok(questions.every(t=>!isModelExample(t,topics.find(p=>p.id===t.topicId) as never)&&!t.reviewReserved));assert.deepEqual(beginDiagnostic(state,track,topics as never,bank as never),questions);assert.ok(questions.some(t=>t.difficulty===2));}
});
test('DIAG-01: an unfinished legacy diagnosis keeps its assigned questions',()=>{const state=emptyState();state.diagnosticDraft={track:'profile',answers:[]};const assigned=assignedDiagnostic(state,'profile',topics as never,bank as never);assert.equal(assigned?.length,10);assert.equal(beginDiagnostic(state,'profile',topics as never,bank as never).length,10);});
