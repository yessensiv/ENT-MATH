import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{saveLessonWork,validateLessonWork,completeLesson}from'../lib/lesson-work.ts';
test('LESS-04: independent lessons and newer device work survive old beacons',()=>{
 const work:Record<string,ReturnType<typeof validateLessonWork>>={};const a=validateLessonWork({stage:2,exampleIndex:1,simple:false,answer:'4',steps:'2x=8',updatedAt:100});
 assert.equal(saveLessonWork(work,'linear',a),true);assert.equal(saveLessonWork(work,'linear',{...a,answer:'lost',updatedAt:99}),false);
 saveLessonWork(work,'fractions',{...a,answer:'1/2',updatedAt:101});assert.equal(work['linear'].answer,'4');assert.equal(work['fractions'].answer,'1/2');
 assert.throws(()=>validateLessonWork({...a,steps:'x'.repeat(4001)}));assert.throws(()=>validateLessonWork({...a,stage:10}));
 const hints=validateLessonWork({...a,guidedHints:2,guidedReveal:true,checkpoint:false});assert.equal(hints.guidedHints,2);assert.equal(hints.guidedReveal,true);assert.throws(()=>validateLessonWork({...a,guidedHints:-1}));
});

test('lesson completion survives reopening, older devices and language changes without granting mastery',()=>{
 const completions:Record<string,{at:string}>={},work:Record<string,ReturnType<typeof validateLessonWork>>={};
 const draft=validateLessonWork({stage:3,exampleIndex:2,simple:false,answer:'4',steps:'',updatedAt:100});
 assert.throws(()=>completeLesson(completions,'integral',{...draft,stage:2}));
 assert.equal(completeLesson(completions,'integral',draft,new Date('2026-10-09T00:00:00Z')),true);
 assert.equal(completeLesson(completions,'integral',draft,new Date('2026-10-10T00:00:00Z')),false);
 saveLessonWork(work,'integral',draft);saveLessonWork(work,'integral',{...draft,stage:0,updatedAt:200});
 const restored=JSON.parse(JSON.stringify({lessonWork:work,lessonCompletions:completions,progress:{},xp:0,profile:{language:'kk'}}));
 assert.equal(restored.lessonCompletions.integral.at,'2026-10-09T00:00:00.000Z');
 assert.deepEqual(restored.progress,{});assert.equal(restored.xp,0);assert.equal(restored.lessonWork.integral.stage,0);
 assert.equal(completions.fractions,undefined);
});
