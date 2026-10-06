import {test} from 'node:test';
import assert from 'node:assert/strict';
import {topics} from '../lib/content.ts';
import {withLessonEnrichment} from '../lib/lesson-enrichment.ts';
const base='http://127.0.0.1:5173';
const topic=withLessonEnrichment(topics.find(t=>t.id==='fractions'));
test('server mentor explains the selected lesson and rejects invalid references without changing results',async()=>{
  const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
  const call=async(path,body)=>{const response=await fetch(base+path,{headers:{Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  const before=await call('/api/state');assert.equal(before.data.isAdmin,false);assert.equal(before.data.activeExam,null);
  for(const kind of ['example','life','guided']){
    const selection={kind,...(kind==='example'?{index:2}:{}),stepIndex:1};
    const reply=await call('/api/tutor',{message:'Почему этот шаг верный?',topicId:'fractions',lessonExample:selection});
    assert.equal(reply.status,200);assert.equal(reply.data.mode,'study-helper');
    const ex=kind==='example'?topic.lesson.examples[2]:kind==='life'?topic.lesson.enrichment.life:topic.lesson.guided;
    assert.ok(reply.data.reply.includes(ex.steps.ru[1]));
    const full=await call('/api/tutor',{message:'Покажи полное решение',topicId:'fractions',lessonExample:selection,fullSolution:true});
    assert.equal(full.status,200);for(const step of ex.steps.ru)assert.ok(full.data.reply.includes(step));
  }
  const invalid=await call('/api/tutor',{message:'Вопрос',topicId:'fractions',lessonExample:{kind:'example',index:999}});assert.equal(invalid.status,400);
  const ambiguous=await call('/api/tutor',{message:'Вопрос',topicId:'fractions',taskId:'numbers-1',lessonExample:{kind:'life'}});assert.equal(ambiguous.status,400);
  const after=await call('/api/state');for(const key of ['attempts','progress','errors','xp','revision'])assert.deepEqual(after.data[key],before.data[key]);
});
