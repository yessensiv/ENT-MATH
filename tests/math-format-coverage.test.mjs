import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
import {withLessonEnrichment} from '../lib/lesson-enrichment.ts';
import {curriculumPracticeTasks} from '../lib/curriculum-practice.ts';
import {promotedExercises} from '../lib/promoted-exercises.ts';
import {sourceExercises} from '../lib/source-exercises.ts';
import {mathSegments} from '../lib/math-format.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const all=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
const nodeText=n=>'value' in n?n.value:n.children.map(nodeText).join('');
function verify(value,path,counter){
 if(typeof value==='string'&&/[\/^]/.test(value)&&!/^https?:/.test(value)){
   counter.fields++;
   const visible=mathSegments(value).map(s=>s.math?nodeText(s.math):s.text).join('');
   assert.doesNotMatch(visible,/[\/^]/,path+': '+visible);
 }else if(Array.isArray(value))value.forEach((item,index)=>verify(item,path+'.'+index,counter));
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value))if(!['source','practiceOrigin','reviewProof','id','url'].includes(key))verify(item,path+'.'+key,counter);
}
test('all 121 topics and all static exercise banks display no raw division or caret powers',()=>{
 const counter={fields:0};assert.equal(all.length,121);
 for(const topic of all){verify(withLessonEnrichment(topic).lesson,topic.id+'.lesson',counter);verify(topic.tasks,topic.id+'.tasks',counter);}
 verify(curriculumPracticeTasks,'curriculum',counter);verify(promotedExercises,'promoted',counter);verify(sourceExercises,'sources',counter);
 assert.ok(counter.fields>19000);
});
