import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native tests.
import{scoreExamTask,finishExam,emptyState,type Task}from'../lib/engine.ts';
// @ts-expect-error Native tests.
import{EXAM_RULES,resolveExamScoring}from'../lib/exam-rules.ts';
// @ts-expect-error Native tests.
import{reservedExam}from'../lib/exam-bank.ts';
const task=(n:number,type:'matching'|'multiple'):Task=>({id:'reference',topicId:'numbers',difficulty:1,type,answer:['a','b','c'].slice(0,n),options:['a','b','c','d','e'],prompt:{ru:'test',kk:'test'},hints:{ru:[],kk:[]},solution:{ru:[],kk:[]}});
// Literal reference tables read from paragraph 18: row=correct choices,
// column=incorrect choices. These are not derived by the production algorithm.
const reference:Record<number,number[][]>={1:[[0,0,0,0,0,0],[2,1,0,0,0,0]],2:[[0,0,0,0,0,0],[1,1,0,0,0,0],[2,1,0,0,0,0]],3:[[0,0,0,0,0,0],[0,0,0,0,0,0],[1,1,0,0,0,0],[2,1,0,0,0,0]]};
test('p18 reference tables cover every multiple subset and matching combination, including blanks',()=>{
 let checked=0;
 for(const n of [1,2,3]){
  const t=task(n,'multiple'),expected=t.answer as string[];
  for(let mask=0;mask<32;mask++){
   const values=t.options!.filter((_,i)=>mask&(1<<i)),hits=values.filter(v=>expected.includes(v)).length,wrong=values.length-hits;
   const result=scoreExamTask(t,values);assert.equal(result.points,reference[n][hits][wrong]);assert.ok(result.explanation.ru&&result.explanation.kk);checked++;
  }
  const m=task(n,'matching'),options=['','a','b','c','d'];
  for(let index=0;index<options.length**n;index++){
   let value=index;const values=Array.from({length:n},()=>{const v=options[value%options.length];value=Math.floor(value/options.length);return v;});
   const hits=values.filter((v,i)=>v===expected[i]).length,wrong=values.filter((v,i)=>v&&v!==expected[i]).length;
   assert.equal(scoreExamTask(m,values).points,reference[n][hits][wrong],JSON.stringify({n,values}));checked++;
  }
 }
 assert.equal(checked,251);assert.equal(scoreExamTask(task(2,'multiple'),['a','a']).points,0);
 assert.equal(scoreExamTask(task(2,'matching'),[' A ','x']).points,0,'Invalid option is rejected before scoring');
 assert.equal(scoreExamTask(task(2,'matching'),[' A ','d']).points,1,'Valid whitespace/case normalization is consistent for partial credit');
});

test('saved rule snapshot controls completion; unknown versions fail before mutation; history never regrades',()=>{
 const legacy=structuredClone(EXAM_RULES);delete legacy.scoring;assert.equal(resolveExamScoring(legacy).id,'ent-p18-2024-02-28.v1');
 const state=emptyState(),exam=reservedExam('literacy',1);state.activeExam=exam;
 exam.answers=Object.fromEntries(exam.questions.map((t,i)=>[String(i),t.answer]));
 const snapshot=structuredClone(exam.rules),current=structuredClone(EXAM_RULES);
 try{
  // A later current default cannot alter the rule captured at exam start.
  EXAM_RULES.version='Future rule';EXAM_RULES.scoring={...EXAM_RULES.scoring!,id:'future' as never};
  assert.equal(finishExam(exam,state).score,10);assert.deepEqual(exam.rules,snapshot);
  const result=JSON.stringify(exam);exam.rules=legacy;exam.rules.version='unknown historical label';
  const before=JSON.stringify(exam);finishExam(exam,state);assert.equal(JSON.stringify(exam),before);assert.ok(result.includes('gradingRuleId'));
 }finally{Object.assign(EXAM_RULES,current);}
 const bad=reservedExam('profile',2),s=emptyState();s.activeExam=bad;bad.rules.scoring={...bad.rules.scoring!,singleMax:99 as never};
 const original=JSON.stringify(s);assert.throws(()=>finishExam(bad,s),/VERSION_UNSUPPORTED/);assert.equal(JSON.stringify(s),original);
});
