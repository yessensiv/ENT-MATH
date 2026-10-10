import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.ENT_TEST_BASE_URL||'http://127.0.0.1:5188';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local test accounts only');
const headers={'Content-Type':'application/json','oai-authenticated-user-id':'lesson_completion_test_'+Date.now(),'oai-authenticated-user-email':'lesson-completion@example.invalid'};
const call=async(body)=>{const response=await fetch(base+'/api/state',{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
test('completion persists across requests, repeat clicks, reopened drafts and language changes',async()=>{
 const first=await call();assert.equal(first.status,200);
 const initialXp=first.data.xp,progress=first.data.progress;
 const draft={topicId:'integral',stage:3,exampleIndex:0,simple:false,answer:'',steps:'',updatedAt:Date.now()};
 const invalid=await call({...draft,stage:2,action:'complete-lesson'});assert.equal(invalid.status,400);
 const done=await call({...draft,action:'complete-lesson'});assert.equal(done.status,200,JSON.stringify(done.data));
 assert.ok(done.data.lessonCompletions.integral.at);const at=done.data.lessonCompletions.integral.at;
 const repeat=await call({...draft,action:'complete-lesson'});assert.equal(repeat.data.lessonCompletions.integral.at,at);
 const reopened=await call({...draft,stage:0,updatedAt:Date.now()+1,action:'save-lesson'});assert.equal(reopened.status,200);
 const changed=await call({action:'profile',name:'Lesson completion test',grade:'11',language:'kk',track:'profile',examDate:'2027-06-01',dailyMinutes:20,target:40});assert.equal(changed.status,200);
 const reload=await call();assert.equal(reload.data.lessonCompletions.integral.at,at);
 assert.equal(reload.data.lessonWork.integral.stage,0);assert.deepEqual(reload.data.progress,progress);assert.equal(reload.data.xp,initialXp);
});
