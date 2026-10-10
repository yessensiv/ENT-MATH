import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests.
import {courseProgress} from '../lib/course-progress.ts';

test('completed lessons count immediately without claiming mathematical mastery',()=>{
 const done={a:{at:'2026-10-09'},b:{at:'2026-10-09'}};
 const ids=Array.from({length:18},(_,i)=>i===0?'a':i===1?'b':String(i));
 const result=courseProgress(ids,done,{a:{mastered:false}});
 assert.equal(result.completed,2);assert.equal(result.completionPercent,11);
 assert.equal(result.mastered,0);assert.equal(result.nextId,'2');assert.equal(result.nextAction,'lesson');
 assert.deepEqual(courseProgress(ids,JSON.parse(JSON.stringify(done)),{}),result);
});
test('filters and duplicate topics do not inflate route progress or count other grades',()=>{
 const result=courseProgress(['a','a','b'],{a:{at:'today'},other:{at:'today'}},{b:{mastered:true}});
 assert.equal(result.total,2);assert.equal(result.completed,1);assert.equal(result.mastered,1);
 assert.equal(result.nextAction,'practice');assert.equal(result.nextId,'a');
 assert.equal(courseProgress([],{},{}).completionPercent,0);
 assert.equal(courseProgress(['a'],{a:{at:'today'}},{a:{mastered:true}}).nextAction,null);
});
