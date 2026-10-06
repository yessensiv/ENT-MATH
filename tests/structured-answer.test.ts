import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{checkStructuredAnswer}from'../lib/structured-answer.ts';
test('intervals normalize unions and preserve holes, endpoint inclusion and exact rational bounds',()=>{
 assert.equal(checkStructuredAnswer('interval','(-∞;0] ∪ (0;1/2]','(-inf;0,5]'),'correct');
 assert.equal(checkStructuredAnswer('interval','(-∞;0)∪(0;1]','(-∞;1]'),'incorrect');
 assert.equal(checkStructuredAnswer('interval','[0;1]∪{2}','[0;1]∪[2;2]'),'correct');
 assert.equal(checkStructuredAnswer('interval','[0;1)','[0;1]'),'incorrect');
 assert.equal(checkStructuredAnswer('interval','[0;sqrt(2)]','[0;1]'),'review');
 assert.equal(checkStructuredAnswer('interval','[1;0]','∅'),'review');
});
test('root sets ignore order and duplicate members; ordered pairs retain order',()=>{
 assert.equal(checkStructuredAnswer('root-set','{1/2;2;2}','{2;0,5}'),'correct');
 assert.equal(checkStructuredAnswer('root-set','{1;2}','{1;3}'),'incorrect');
 assert.equal(checkStructuredAnswer('pair','(2;1/2)','(2;0.5)'),'correct');
 assert.equal(checkStructuredAnswer('pair','(1;2)','(2;1)'),'incorrect');
 assert.equal(checkStructuredAnswer('pair','(1;2;3)','(1;2)'),'review');
});
