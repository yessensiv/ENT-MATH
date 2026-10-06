import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{coverageReport}from'../lib/coverage-report.ts';
test('editor coverage names missing skill evidence and dependency cycles without claiming acceptance',()=>{
 const result=coverageReport([{id:'a',title:{ru:'A',kk:'A'},track:'base',prerequisites:['b']},{id:'b',title:{ru:'B',kk:'B'},track:'base',prerequisites:['a','missing']}],[]);
 assert.equal(result.readiness,'requires-expert-review');assert.equal(result.cycles.length,1);assert.deepEqual(result.missingDependencies,['missing']);assert.ok(result.topics.every(t=>t.missing.some(m=>m.startsWith('CUR-01'))&&t.missing.some(m=>m.startsWith('TASK-02'))));
});
