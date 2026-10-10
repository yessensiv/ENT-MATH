import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native tests.
import {createPractice,savePracticeDraft,submitPractice,practiceSummary,publicPractice,repairTopicSelection} from '../lib/practice-session.ts';
// @ts-expect-error Native tests.
import {makePracticeVariant,validatePracticeVariant,variantTopics} from '../lib/practice-variants.ts';
// @ts-expect-error Native tests.
import {emptyState,checkAnswer,recordAttempt,type Task} from '../lib/engine.ts';
// @ts-expect-error Native tests.
import {practiceOptions} from '../lib/practice-options.ts';
const generator={reviewCapacity:()=>0,generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false,errors:[]})};
const topic={id:'linear',title:{ru:'Уравнения',kk:'Теңдеулер'},track:'profile' as const};
const bank=Array.from({length:30},(_,i)=>makePracticeVariant('linear',i+1,(i%3+1) as 1|2|3)!);

test('operation order excludes reverse-price and budget variants; unfinished migration preserves entered work and checked history',()=>{
 const state=emptyState(),wrong=makePracticeVariant('numbers',138,1)!;
 const correct:Task={...wrong,id:'order-direct',variant:undefined,prompt:{ru:'Вычисли 2+3·4.',kk:'2+3·4 мәнін есепте.'},answer:'14',units:undefined,methodFamily:'order',solution:{ru:['3·4=12; 2+12=14.'],kk:['3·4=12; 2+12=14.']}};
 const s=createPractice(state,'numbers',[wrong,correct],10);assert.equal(s.main.length,1);assert.equal(s.main[0].task.id,correct.id);
 s.main=[{task:wrong,answer:'',steps:'',assisted:false}];s.cursor=wrong.id;const before=s.version;
 assert.equal(repairTopicSelection(s,state,[correct]),true);assert.equal(s.cursor,correct.id);assert.equal(s.version,before+1);assert.equal(repairTopicSelection(s,state,[correct]),false);
 s.main=[{task:wrong,answer:'130',steps:'',assisted:false}];s.cursor=wrong.id;assert.equal(repairTopicSelection(s,state,[correct]),false);assert.equal(s.main[0].answer,'130');
 s.main[0].answer='';s.finishedAt=new Date().toISOString();assert.equal(repairTopicSelection(s,state,[correct]),false);assert.equal(s.main[0].task.id,wrong.id);
});
test('fixed session, drafts, first mistake, separate repair, replay, report, delayed review',()=>{
 const state=emptyState();state.generatedTasks=structuredClone(bank);const session=createPractice(state,'linear',bank,15),item=session.main[0];assert.equal(session.main.length,15);
 savePracticeDraft(session,item.task.id,'999','Пробую модель');session.cursor=session.main[2].task.id;session.cursor=item.task.id;assert.equal(publicPractice(session,state).current.steps,'Пробую модель');
 const feedback=submitPractice(state,session,item.task.id,topic,bank,generator);assert.equal(feedback.correct,false);assert.equal(session.extra.length,2);assert.equal(practiceSummary(session).main.incorrect,1);
 const id=item.errorId;for(const repair of session.extra){savePracticeDraft(session,repair.task.id,repair.task.answer,'');submitPractice(state,session,repair.task.id,topic,[...bank,...state.generatedTasks as Task[]],generator);}
 assert.equal(state.errors.find(e=>e.id===id)?.resolved,true);assert.equal(practiceSummary(session).extra.independent,2);assert.equal(practiceSummary(session).main.correct,0);
 const xp=state.xp,attempts=state.attempts.length;submitPractice(state,session,item.task.id,topic,bank,generator);assert.equal(state.xp,xp);assert.equal(state.attempts.length,attempts);
 assert.ok(state.reviews.length);assert.equal(state.progress.linear.mastered,false);
 const publicBefore=publicPractice(session,state);assert.equal('answer' in publicBefore.main[1],false);assert.equal(publicBefore.report,undefined);
 session.finishedAt=new Date().toISOString();assert.equal(publicPractice(session,state).report?.length,17);assert.throws(()=>submitPractice(state,session,item.task.id,topic,bank,generator));
});
test('server assistance never becomes independent credit; fresh session does not inherit drafts from another session',()=>{
 const state=emptyState(),s=createPractice(state,'linear',bank,10),item=s.main[0];state.assistedTaskIds=[item.task.id];savePracticeDraft(s,item.task.id,item.task.answer,'');submitPractice(state,s,item.task.id,topic,bank,generator);assert.equal(practiceSummary(s).main.independent,0);assert.equal(practiceSummary(s).main.helped,1);
 const next=createPractice(state,'linear',bank,10);assert.notEqual(next.id,s.id);assert.ok(next.main.every(i=>!i.feedback&&i.answer===''));
});
test('bilingual variants reject altered answers and invalid seeds; independent problem constraints hold',()=>{
 for(const topic of variantTopics)for(let seed=1;seed<=10000;seed+=17)for(const level of [1,2,3] as const){const t=makePracticeVariant(topic,seed,level)!;assert.ok(validatePracticeVariant(t));assert.equal(checkAnswer(t,t.answer).status,'correct');assert.ok(t.prompt.ru&&t.prompt.kk&&t.solution.ru.length>=2&&t.solution.kk.length>=2);assert.ok(!validatePracticeVariant({...t,answer:'-99999'}));
  const a=2+seed%8,c=3+Math.floor(seed/8)%12,n=4+Math.floor(seed/96)%15,v=Number(t.answer);
  if(topic==='linear'){if(level===1)assert.equal(c*10+a*10*v,(a*n+c)*10);if(level===2)assert.equal(a*(v-c),(a-1)*v+n);if(level===3)assert.ok(Math.abs(v/a+v/c-n*(a+c))<1e-6);}
  if(topic==='quadratic'){if(level===1)assert.equal(v*v,n*n);if(level===2)assert.equal(v*(v+a),n*(n+a));if(level===3)assert.ok(Math.abs(v-(1/n-1/(n+a)))<1e-6);}
  if(topic==='fractions'){if(level===1)assert.equal(v+a*c*n/a+a*c*n/c,a*c*n);if(level===2)assert.equal(v+(a-1)*n,(a-1)*c*n);if(level===3)assert.ok(Math.abs(v-v/a-(v-v/a)/c-(a-1)*(c-1)*n)<1e-6);}
  if(topic==='powers'){if(level===1)assert.equal(c+v,c+n);if(level===2)assert.equal(2*v-c,2*n-c);if(level===3)assert.equal(v+n+c,2*n);}
  if(topic==='percentages'){if(level===1)assert.equal(v,50*a*n);if(level===2)assert.ok(Math.abs(v/(100+5*a)*100/(100-5*a)*100-1000*n)<1e-6);if(level===3)assert.equal(v,1000*n);}
  if(topic==='school-sampling'){if(level===1)assert.equal(v,(n+a+c)-n);if(level===2)assert.equal(v,[a+c+n+1,a,a+c+n+3,a+c,a+c+n].sort((x,y)=>x-y)[2]);if(level===3)assert.equal(v/((c+5)*a),c/(c+5));}
  if(topic==='numbers'&&level===1)assert.equal(a*v-2*n,a*(50+10*c)-2*n);
  if(topic==='numbers'&&level===2){const price=50+10*c,budget=(a+2)*price-1;assert.ok(v*price<=budget&&(v+1)*price>budget);}
  if(topic==='numbers'&&level===3){assert.ok(n*10+a*10*v<(a+2)*10*v);assert.ok(n*10+a*10*(v-1)>=(a+2)*10*(v-1));}
 }
 assert.equal(makePracticeVariant('linear',0),null);assert.equal(makePracticeVariant('linear',1.5),null);assert.equal(makePracticeVariant('other',3),null);
});
test('letter options have readable labels without changing submitted values',()=>{
 const p=practiceOptions('Как выбрать? A: случайно;B: первые;C: рядом.', ['A','B','C']);assert.equal(p.prompt,'Как выбрать?');assert.deepEqual(p.options.map(o=>o.label),['случайно','первые','рядом.']);assert.deepEqual(p.options.map(o=>o.value),['A','B','C']);assert.equal(practiceOptions('2+2?', ['3','4']).options[1].label,'4');
});
test('unfinished matching answers and incomplete expressions can be saved without being graded',()=>{
 const task={...bank[0],id:'matching-draft',type:'matching' as const,pairs:[{left:'1+1',right:'2'},{left:'1+2',right:'3'}],options:['2','3'],answer:['2','3']};
 const state=emptyState(),session=createPractice(state,'linear',[task],10);
 savePracticeDraft(session,task.id,['2'],'Первое соответствие');assert.deepEqual(session.main[0].answer,['2']);assert.equal(state.attempts.length,0);
 const expression={...bank[0],id:'expression-draft',type:'expression' as const,answer:'2*x'},other=createPractice(state,'linear',[expression],10);
 savePracticeDraft(other,expression.id,'2*(','');assert.equal(other.main[0].answer,'2*(');assert.equal(state.attempts.length,0);
});
test('delayed repetition stays on the exact variant method and rejects another method in the same topic',()=>{
 const state=emptyState(),original=makePracticeVariant('linear',138,3)!,other=makePracticeVariant('linear',275,1)!,fresh=makePracticeVariant('linear',412,3)!;
 const now=new Date('2026-10-06T12:00:00Z');recordAttempt(state,original,topic,{answer:'-1'},[original],now);const review=state.reviews[0];assert.equal(review.methodFamily,'linear:variant-3');
 assert.throws(()=>recordAttempt(state,fresh,topic,{answer:fresh.answer,reviewId:review.id},[original,fresh],now));
 const later=new Date('2026-10-08T12:00:00Z');assert.throws(()=>recordAttempt(state,other,topic,{answer:other.answer,reviewId:review.id},[original,other],later));assert.equal(state.attempts.length,1);
 recordAttempt(state,fresh,topic,{answer:fresh.answer,reviewId:review.id},[original,fresh],later);assert.equal(review.completed,true);assert.equal(state.reviews[1].methodFamily,'linear:variant-3');assert.equal(state.reviews[1].interval,3);assert.equal(state.progress.linear.mastered,false);
});
test('a beginner receives more foundations and a recovery session does not assume old successes are current mastery',()=>{
 const novice=emptyState(),first=createPractice(novice,'linear',bank,10);assert.equal(first.main.filter(i=>i.task.difficulty===1).length,6);assert.ok(first.selectionReason?.ru.includes('основ'));
 const experienced=emptyState();experienced.progress.linear={attempts:8,correct:8,independent:8,mastered:false,independentTaskIds:[],confirmationTaskIds:['a','b','c','d']};const advanced=createPractice(experienced,'linear',bank,10);assert.equal(advanced.main.filter(i=>i.task.difficulty===3).length,2);
 experienced.progress.linear.needsRecovery=true;const recovery=createPractice(experienced,'linear',bank,10);assert.equal(recovery.main.filter(i=>i.task.difficulty===1).length,6);
});


test('practice report replaces internal skill identifiers with bilingual display labels',()=>{
 const state=emptyState(),task={...bank[0],skill:'radicals',skillIds:['unmapped-internal-method'],subtopic:undefined};
 const session=createPractice(state,task.topicId,[task],10);
 assert.deepEqual(practiceSummary(session).skills[0].title,{ru:'Навык текущей темы',kk:'Ағымдағы тақырып дағдысы'});
});
