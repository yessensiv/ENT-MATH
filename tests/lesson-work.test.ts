import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{saveLessonWork,validateLessonWork}from'../lib/lesson-work.ts';
test('LESS-04: independent lessons and newer device work survive old beacons',()=>{
 const work:Record<string,ReturnType<typeof validateLessonWork>>={};const a=validateLessonWork({stage:2,exampleIndex:1,simple:false,answer:'4',steps:'2x=8',updatedAt:100});
 assert.equal(saveLessonWork(work,'linear',a),true);assert.equal(saveLessonWork(work,'linear',{...a,answer:'lost',updatedAt:99}),false);
 saveLessonWork(work,'fractions',{...a,answer:'1/2',updatedAt:101});assert.equal(work['linear'].answer,'4');assert.equal(work['fractions'].answer,'1/2');
 assert.throws(()=>validateLessonWork({...a,steps:'x'.repeat(4001)}));assert.throws(()=>validateLessonWork({...a,stage:10}));
});
