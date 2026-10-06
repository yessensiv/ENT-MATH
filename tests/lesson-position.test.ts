import {test} from 'node:test';import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests.
import {captureReadingPosition,readingScrollTarget,validateLessonReading,lessonViewKey} from '../lib/lesson-position.ts';
// @ts-expect-error Native Node tests.
import {validateLessonWork,saveLessonWork} from '../lib/lesson-work.ts';
test('LESS-04: reading resumes within the same explanation at a different width/language',()=>{
 const position=captureReadingPosition([{id:'top',top:-2000,height:200},{id:'life',top:-300,height:800},{id:'hacks',top:520,height:300}],2100);
 assert.deepEqual(position,{anchor:'life',offset:0.5});
 assert.deepEqual(captureReadingPosition([{id:'life',top:-300,height:800},{id:'aside',top:-1800,height:4000}],2100),position);
 assert.equal(readingScrollTarget(position,[{id:'life',top:900,height:400}],0,5000),1000);
 assert.equal(readingScrollTarget(position,[{id:'life',top:-300,height:800}],2100,5000),2100);
 assert.equal(readingScrollTarget(position,[],0,5000),0);
 assert.equal(readingScrollTarget(position,[{id:'life',top:900,height:400}],0,600),600);
 assert.deepEqual(captureReadingPosition([],0),{anchor:'top',offset:0});
 assert.equal(lessonViewKey(1,3),'1:3');assert.equal(lessonViewKey(2,3),'2');
});
test('LESS-04: bounded reading state is additive and protected against old-device writes',()=>{
 const old={stage:0,exampleIndex:0,simple:false,answer:'',steps:'',updatedAt:100};
 assert.deepEqual(validateLessonWork(old),old);
 const reading={positions:{'0':{anchor:'life',offset:0.25},'1:3':{anchor:'example',offset:0.5}},openDetails:['detail-3']};
 const draft=validateLessonWork({...old,reading}),work={linear:draft};
 assert.deepEqual(draft.reading,reading);assert.equal(saveLessonWork(work,'linear',{...draft,reading:{positions:{},openDetails:[]},updatedAt:99}),false);
 assert.deepEqual(work.linear.reading,reading);
 for(const bad of [null,[],{...reading,positions:{'1:4':{anchor:'life',offset:0}}},{...reading,positions:{'0':{anchor:'life',offset:Infinity}}},{...reading,positions:{'0':{anchor:'life',offset:-1}}},{...reading,openDetails:['x','x']},{...reading,openDetails:['<script>']}])assert.throws(()=>validateLessonReading(bad));
});
