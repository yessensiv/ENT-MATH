import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {curriculumPracticeTasks as bank} from '../lib/curriculum-practice.ts';
import {practiceTopics,makeCurriculumPractice,validateCurriculumPractice} from '../lib/curriculum-practice-generator.ts';
import {checkAnswer,taskFingerprint,sanitizeTask,emptyState,isModelExample} from '../lib/engine.ts';
import {createPractice,savePracticeDraft,submitPractice,publicPractice,practiceSummary} from '../lib/practice-session.ts';
const report=JSON.parse(readFileSync(new URL('../content/curriculum-practice/report.json',import.meta.url)));
const noGenerator={reviewCapacity:()=>0,generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false,errors:['Disabled']})};
function wrongAnswer(task){
 if(task.type==='single')return task.options.find(value=>value!==task.answer);
 if(task.type==='multiple'){
  const extra=task.options.find(value=>!task.answer.includes(value));
  return extra?[...task.answer,extra]:task.answer.slice(1);
 }
 if(task.type==='matching')return task.answer.map((_,index)=>task.answer[(index+1)%task.answer.length]);
 return '987654321';
}

test('every one of 121 topics has fifteen fresh questions, five per level, and separate method-specific reserves',()=>{
 assert.equal(practiceTopics.length,121);assert.equal(report.coveredTopics,121);
 assert.equal(new Set(bank.map(t=>t.id)).size,bank.length);
 assert.equal(createHash('sha256').update(JSON.stringify(bank)).digest('hex'),report.tasksDigest);
 for(const topic of practiceTopics){
  const tasks=bank.filter(t=>t.topicId===topic.id),main=tasks.filter(t=>!t.reviewReserved),reserve=tasks.filter(t=>t.reviewReserved);
  assert.equal(main.length,15,topic.id);assert.ok(reserve.length>=6,topic.id);
  const previous=new Set(topic.tasks.map(taskFingerprint));
  assert.equal(new Set(tasks.map(taskFingerprint)).size,tasks.length,topic.id);
  for(const level of [1,2,3])assert.equal(main.filter(t=>t.difficulty===level).length,5,topic.id);
  for(const t of tasks){
   assert.ok(!previous.has(taskFingerprint(t)),t.id);assert.equal(isModelExample(t,topic),false,t.id);
   assert.equal(t.purpose,'practice');assert.equal(t.practiceOrigin.kind,'authored');assert.equal(t.source,undefined);
   assert.deepEqual(t.skillIds,[t.methodFamily]);assert.equal(t.subtopic.id,t.methodFamily);
   assert.equal(t.reviewStatus,'math-checked-translation-pending');
   for(const lang of ['ru','kk']){assert.ok(t.prompt[lang]);assert.ok(t.hints[lang].length>=3);assert.ok(t.solution[lang].length>=3);}
  }
  for(const t of main)assert.ok(reserve.filter(r=>r.methodFamily===t.methodFamily&&r.type===t.type&&r.difficulty===t.difficulty).length>=2,t.id);
 }
});

test('each authored condition is rechecked independently; correct keys work and altered data fails closed',()=>{
 for(const task of bank){
  assert.deepEqual(validateCurriculumPractice(task),{valid:true,errors:[]},task.id);
  assert.equal(checkAnswer(task,task.answer).status,'correct',task.id);
  assert.notEqual(checkAnswer(task,Array.isArray(task.answer)?['not-an-answer']:'987654321').status,'correct',task.id);
  const publicTask=sanitizeTask(task);
  for(const key of ['answer','solution','hints','curriculumPractice','generation'])assert.equal(publicTask[key],undefined,task.id+' leaks '+key);
  assert.deepEqual(publicTask.practiceOrigin,task.practiceOrigin);
  assert.deepEqual(publicTask.subtopic.title,task.skill,'Public title must not use solution steps');
 }
 for(const topicId of ['powers','school-combinatorics','school-repeating-decimals','school-inverse-trig','school-truncated-solids']){
  const original=bank.find(t=>t.topicId===topicId&&!t.reviewReserved);
  for(const change of [t=>t.answer='999',t=>t.prompt.kk+=' changed',t=>t.methodFamily='different-method',t=>t.solution.ru[0]='changed']){
   const damaged=structuredClone(original);change(damaged);assert.equal(validateCurriculumPractice(damaged).valid,false,topicId);
  }
 }
 assert.equal(makeCurriculumPractice('missing',6,1),null);
 assert.equal(makeCurriculumPractice('linear',0,1),null);
 assert.equal(makeCurriculumPractice('school-combinatorics',17,2),null);
});

test('new practice, mistake, two independent repairs, reload and analysis work for every topic without a provider',()=>{
 for(const topic of practiceTopics){
  const state=emptyState(),session=createPractice(state,topic.id,bank,15);
  assert.equal(session.main.length,15,topic.id);assert.ok(session.main.every(i=>!i.task.reviewReserved));
  // Use a harder item when present; this also covers decimal precision and matching.
  const item=session.main.find(i=>i.task.difficulty===3)??session.main[0];
  const wrong=wrongAnswer(item.task);
  savePracticeDraft(session,item.task.id,wrong,'Первый самостоятельный шаг');
  const snapshot=JSON.parse(JSON.stringify(session));assert.deepEqual(snapshot.main.find(i=>i.task.id===item.task.id).answer,wrong);
  const feedback=submitPractice(state,session,item.task.id,topic,bank,noGenerator);
  assert.equal(feedback.correct,false,topic.id);assert.equal(session.extra.length,2,topic.id);
  const error=state.errors.find(e=>e.id===item.errorId);assert.ok(error);assert.equal(error.resolved,false);
  for(const [index,extra]of session.extra.entries()){
   assert.ok(!session.main.some(m=>taskFingerprint(m.task)===taskFingerprint(extra.task)),topic.id);
   assert.equal(extra.task.methodFamily,item.task.methodFamily);assert.equal(extra.task.type,item.task.type);
   savePracticeDraft(session,extra.task.id,extra.task.answer,'');
   assert.equal(submitPractice(state,session,extra.task.id,topic,[...bank,...state.generatedTasks],noGenerator).correct,true,topic.id);
   assert.equal(error.resolved,index===1,topic.id);
  }
  const before=state.attempts.length;
  submitPractice(state,session,item.task.id,topic,bank,noGenerator);assert.equal(state.attempts.length,before);
  session.finishedAt=new Date().toISOString();const restored=JSON.parse(JSON.stringify(session));
  assert.deepEqual(practiceSummary(restored),practiceSummary(session));
  const view=publicPractice(restored,state);assert.equal(view.summary.main.incorrect,1);assert.equal(view.summary.extra.correct,2);
  assert.equal(view.report.length,17);assert.equal(view.current.task.answer,undefined);
 }
});

test('periodic decimals include whole and nonrepeating parts; inverse angles use principal ranges',()=>{
 for(const task of bank.filter(t=>t.topicId==='school-repeating-decimals')){
  const [,whole,pre,repeat]=task.prompt.ru.match(/Представь (\d+),(\d*)\((\d+)\)/);
  const multiplier=10**pre.length*(10**repeat.length-1);
  const numerator=Number(whole)*multiplier+Number(pre)*(10**repeat.length-1)+Number(repeat);
  const gcd=(a,b)=>b?gcd(b,a%b):a,divisor=gcd(numerator,multiplier);
  assert.equal(Number(task.answer),task.difficulty===1?multiplier/divisor:numerator/divisor,task.id);
 }
 for(const task of bank.filter(t=>t.topicId==='school-inverse-trig')){
  const angle=Number(task.prompt.ru.match(/(?:sin|cos) (\d+)°/)[1])*Math.PI/180;
  const expected=(task.difficulty===2?Math.acos(Math.cos(angle)):Math.asin(Math.sin(angle)))*180/Math.PI;
  assert.ok(Math.abs(Number(task.answer)-expected)<1e-7,task.id);
 }
 assert.ok(bank.filter(t=>t.topicId==='numbers').every(t=>!t.prompt.ru.includes('тетрад')&&!t.prompt.ru.includes('скидк')));
});

test('adding the new bank preserves existing lesson conditions and saved practice snapshots',()=>{
 const topic=practiceTopics.find(t=>t.id==='linear'),state=emptyState();
 const old=topic.tasks.map(t=>({...t,difficulty:t.level}));
 const session=createPractice(state,topic.id,old,3);savePracticeDraft(session,session.cursor,'17','Сохранённый переход');
 const previous=JSON.stringify(session),lessonIds=topic.tasks.map(t=>t.id);
 createPractice(state,topic.id,[...old,...bank],15);
 assert.equal(JSON.stringify(session),previous);assert.deepEqual(topic.tasks.map(t=>t.id),lessonIds);
});
