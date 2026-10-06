import{test}from'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
// @ts-expect-error Native test imports.
import{reservedExam,examBankVersion}from'../lib/exam-bank.ts';
// @ts-expect-error Native test imports.
import{emptyState,finishExam,grade,officialSection,taskFingerprint,sanitizeExam,type Task,type Topic}from'../lib/engine.ts';
// @ts-expect-error Native test imports.
import{topics,generateReviewTask,validateGeneratedTask}from'../lib/content.ts';
// @ts-expect-error Native test imports.
import{examContext,basicMatchingReserve}from'../lib/exam-contexts.ts';
// @ts-expect-error Native test imports.
import{examReservations}from'../lib/exam-reservations.ts';
// @ts-expect-error Native test imports.
import{contentDigest}from'../lib/material-review.ts';

test('twenty disjoint exam variants retain formats, official coverage, quotas and immutable keys',async()=>{
 const ids=new Set<string>(),conditions=new Set<string>();let generated=0;
 for(const track of ['profile','literacy'] as const)for(let v=1;v<=10;v++){
  const e=reservedExam(track,v),q=e.questions,isProfile=track==='profile';
  assert.equal(e.bankVersion,examBankVersion);assert.equal(q.length,isProfile?40:10);
  assert.deepEqual([1,2,3].map(d=>q.filter(t=>t.difficulty===d).length),isProfile?[20,12,8]:[5,3,2]);
  if(isProfile){
   assert.ok(q.slice(0,25).every(t=>t.type==='single'&&!t.context));
   assert.ok(q.slice(25,30).every(t=>t.type==='single'&&t.context));
   assert.ok(q.slice(30,35).every(t=>t.type==='multiple'));
   assert.ok(q.slice(35,40).every(t=>t.type==='matching'));
   assert.equal(new Set(q.map(t=>t.curriculumSection||officialSection(topics.find(p=>p.id===t.topicId) as unknown as Topic))).size,10);
  }else{assert.ok(q.every(t=>t.type==='single'));assert.equal(new Set(q.map(t=>t.topicId)).size,10);}
  for(const t of q){
   assert.ok(!ids.has(t.id),t.id);ids.add(t.id);const fp=taskFingerprint(t);assert.ok(!conditions.has(fp),t.id);conditions.add(fp);
   assert.ok(grade(t,t.answer),t.id);assert.ok(t.solution.ru.length&&t.solution.kk.length);
   assert.equal(new Set(t.options).size,t.options?.length,t.id);
   if(t.type==='single')assert.equal(t.options?.filter(o=>grade(t,o)).length,1,`${t.id}: equivalent distractor`);
   if(t.generation){
    const id=String(t.sourceTaskId),match=id.match(/^review-(.+)-([123])-(\d+)$/);assert.ok(match,id);
    const source=generateReviewTask(match[1],Number(match[3]),Number(match[2]) as 1|2|3);assert.ok(source);
    assert.equal(validateGeneratedTask(source).valid,true);assert.deepEqual(t.answer,source.answer);assert.equal(taskFingerprint(t),taskFingerprint(source as unknown as Task));assert.ok(examReservations.has(id));generated++;
   }
  }
  const safe=sanitizeExam(e)!;for(const t of safe.questions){assert.equal('answer'in t,false);assert.equal('solution'in t,false);assert.ok(t.pairs?.every(p=>p.right==='')??true);}
  e.answers=Object.fromEntries(q.map((t,i)=>[String(i),t.answer]));const state=emptyState();state.activeExam=e;
  const finished=finishExam(e,state);assert.equal(finished.score,isProfile?50:10);assert.equal(finished.maxScore,isProfile?50:10);
  assert.equal(finishExam(e,state),finished);assert.equal(state.exams.length,1);
  e.questions[0].prompt.ru='modified';assert.notEqual(reservedExam(track,v).questions[0].prompt.ru,'modified');
 }
 assert.equal(ids.size,500);assert.equal(conditions.size,500);assert.equal(generated,430);assert.equal(examReservations.size,430);
 const data=JSON.parse(readFileSync('lib/exam-reserve-data.json','utf8')),report=JSON.parse(readFileSync('docs/reviews/EXAM-RESERVE-2026-10-06.json','utf8'));
 assert.equal(await contentDigest(data),report.sha256,'Exam release changed after recorded review');
});

test('all authored context keys follow their independent real-life models and rounding',()=>{
 const families=new Set();
 for(let v=1;v<=10;v++){
  const q=examContext(v);families.add(q[0].contextFamily);let expected:number[];
  switch((v-1)%3){
   case 0:{const price=300+20*v,n=12+v,before=price*n,after=before*85/100,final=after+500+10*v;expected=[before,before-after,after,final,Number((final/n).toFixed(2))];break;}
   case 1:{const long=v+14,short=v+10,inside=(long-4)*(short-4),path=long*short-inside;expected=[long*short,long-4,inside,path,Math.ceil(path/7)*600];assert.notEqual(path%7,0,'Rounding up must matter');break;}
   default:{const first=(v+10)*2,second=(v+6)*3;expected=[first,second,6,first+second,Number(((first+second)/6).toFixed(2))];}
  }
  assert.deepEqual(q.map(t=>Number(t.answer)),expected,`context ${v}`);
  assert.equal(new Set(q.map(t=>t.context?.ru)).size,1);
  if(v%3===1)assert.ok(q.every(t=>t.topicId!=='motion'));
 }
 assert.equal(families.size,3);
 for(const t of basicMatchingReserve())assert.deepEqual(t.answer,t.pairs!.map(p=>String(Number(p.left.replace('²',''))**2)));
});

test('familiarity follows saved exposure and persists across retry without contaminating a new variant',()=>{
 const state=emptyState(),e=reservedExam('profile',1);state.exams.push(e);
 assert.equal(reservedExam('profile',1,state).familiarQuestionIds?.length,40);
 assert.deepEqual(reservedExam('profile',2,state).familiarQuestionIds,[]);
 const t=reservedExam('literacy',10).questions[0];state.generatedTasks=[{...t,id:t.sourceTaskId}];
 assert.deepEqual(reservedExam('literacy',10,state).familiarQuestionIds,[t.id]);
 for(const v of [0,11,1.5,NaN])assert.throws(()=>reservedExam('profile',v));assert.throws(()=>reservedExam('base',1));
});
