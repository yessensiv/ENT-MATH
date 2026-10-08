import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceExercises as bank,sourceVerifications as checks} from '../lib/source-exercises.ts';
import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
import {calculate,checkAnswer,sanitizeTask,emptyState,diagnosticTasks} from '../lib/engine.ts';
import {proveRationalIdentity} from '../lib/algebra-proof.ts';
import {createPractice,savePracticeDraft,publicPractice,submitPractice} from '../lib/practice-session.ts';
import {assignErrorRepairs} from '../lib/error-repair.ts';
const allTopics=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
const byId=new Map(bank.map(t=>[t.id,t]));
const close=(a,b,id)=>assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),`${id}: ${a} != ${b}`);
const gcd=(a,b)=>b?gcd(b,a%b):a;
const relation=(n,r)=>r==='>'?n>0:r==='<'?n<0:r==='>='?n>=-1e-9:n<=1e-9;
function intervals(answer){return answer==='∅'?[]:answer.split('U').map(s=>{const [a,b]=s.slice(1,-1).split(';');return {a:a==='-inf'?-Infinity:calculate(a),b:b==='+inf'?Infinity:calculate(b),left:s[0]==='[',right:s.at(-1)===']'};});}
const contains=(set,x)=>set.some(i=>(x>i.a||i.left&&Math.abs(x-i.a)<1e-10)&&(x<i.b||i.right&&Math.abs(x-i.b)<1e-10));

test('import provenance, bilingual skill mapping and verification coverage are complete',()=>{
 assert.ok(bank.length>=230);assert.equal(byId.size,bank.length);assert.equal(new Set(checks.map(v=>v.id)).size,bank.length);
 for(const t of bank){assert.ok(allTopics.some(p=>p.id===t.topicId),t.id);assert.deepEqual(t.skillIds,[t.subtopic.id]);assert.ok(t.subtopic.id.startsWith(t.topicId+':'));assert.equal(t.source.license,'CC BY 4.0');assert.equal(new URL(t.source.url).host,'math.libretexts.org');assert.match(t.source.sha256,/^[a-f0-9]{64}$/);assert.equal(t.purpose,'practice');
  for(const lang of ['ru','kk']){assert.ok(t.prompt[lang]&&t.subtopic.title[lang]);assert.ok(t.hints[lang].length>=2&&t.solution[lang].length>=3&&t.errors[lang].length);}
  assert.equal(checkAnswer(t,t.answer).status,'correct',t.id);assert.notEqual(checkAnswer(t,t.type==='multiple'?['999']:t.answerFormat==='root-set'?'{999}':t.answerFormat==='interval'?'[998;999]':'999').status,'correct',t.id);
 }
});
test('numeric conditions, polynomial identities, rounding, divisibility and LCM independently agree with keys',()=>{
 for(const v of checks){const t=byId.get(v.id);
  if(v.expression)close(calculate(v.expression),calculate(t.answer),v.id);
  if(v.identity)assert.equal(proveRationalIdentity(...v.identity,t.domain),'correct',v.id);
  if(v.divisibility)assert.deepEqual(t.answer,t.options.filter(x=>v.divisibility%Number(x)===0),v.id);
  if(v.lcm)assert.equal(Number(t.answer),v.lcm[0]*v.lcm[1]/gcd(...v.lcm),v.id);
  if(v.round)assert.equal(Number(t.answer),Number(v.round[0].toFixed(v.round[1])),v.id);
 }
});
test('all equation roots satisfy original expressions and rational probes find no omitted roots',()=>{
 for(const v of checks.filter(v=>v.equation)){const t=byId.get(v.id),roots=v.roots.map(r=>calculate(r));
  for(const x of roots)close(calculate(v.equation[0],x),calculate(v.equation[1],x),v.id);
  // Probe non-roots, including denominator zeros and roots introduced by squaring.
  for(let p=-120;p<=120;p++)for(const q of [1,2,3,4,5,6,8,16,21]){const x=p/q;let satisfies=false;try{const a=calculate(v.equation[0],x),b=calculate(v.equation[1],x);satisfies=Math.abs(a-b)<1e-9;}catch{/* Undefined expressions cannot be roots. */}
   assert.equal(satisfies,roots.some(r=>Math.abs(r-x)<1e-9),`${v.id} at x=${x}`);
  }
  if(t.answerFormat==='root-set'&&roots.length>1)assert.equal(checkAnswer(t,`{${v.roots[0]}}`).status,'incorrect',v.id);
 }
});
test('inequality solutions agree on boundaries, forbidden points and every sampled interval',()=>{
 for(const v of checks.filter(v=>v.inequality)){const t=byId.get(v.id),set=intervals(t.answer),probes=new Set(Array.from({length:401},(_,i)=>(i-200)/4));for(const i of set)for(const x of [i.a,i.b])if(Number.isFinite(x))for(const d of [-0.001,0,0.001])probes.add(x+d);
  for(const x of probes){let expected=false;try{let n=calculate(v.inequality.expression,x);if(Math.abs(n)<1e-10)n=0;expected=relation(n,v.inequality.relation);}catch{/* denominator zero */}assert.equal(contains(set,x),expected,`${t.id}: x=${x}`);}
 }
});
test('known wrong source keys are corrected; tiny nonzero values cannot be accepted as zero',()=>{
 const corrected=bank.find(t=>t.topicId==='quadratic'&&t.source.exercise==='3');assert.equal(checkAnswer(corrected,'{1/2;3}').status,'correct');assert.equal(checkAnswer(corrected,'{1/3;2}').status,'incorrect');
 const corrected2=bank.find(t=>t.topicId==='quadratic'&&t.source.exercise==='15');assert.equal(checkAnswer(corrected2,'{-2;1/3}').status,'correct');assert.equal(checkAnswer(corrected2,'{-2/3;-1}').status,'incorrect');
 const small=bank.find(t=>t.topicId==='geometric'&&t.source.exercise==='24-6');assert.equal(checkAnswer(small,'0').status,'incorrect');assert.equal(checkAnswer(small,'1/100000000').status,'correct');
 const extraneous=bank.find(t=>t.topicId==='irrational'&&t.source.exercise==='20-7');assert.equal(checkAnswer(extraneous,'{0;5}').status,'incorrect');
});
test('new practice uses sourced skill-specific tasks, preserves snapshots and hides answer keys',()=>{
 const state=emptyState(),old=structuredClone(bank.find(t=>t.topicId==='numbers'));old.id='old-order';old.source=undefined;
 const oldSession=createPractice(state,'numbers',[old],10);savePracticeDraft(oldSession,old.id,'17','Сначала скобки');const saved=structuredClone(oldSession);
 const current=createPractice(state,'numbers',[old,...bank],15);assert.ok(current.main[0].task.source);assert.ok(current.main.every(i=>i.task.topicId==='numbers'));assert.deepEqual(oldSession,saved);
 const exposed=publicPractice(current,state).current.task;assert.ok(exposed.source&&exposed.subtopic);for(const field of ['answer','solution','hints','commonError'])assert.equal(exposed[field],undefined);
 for(const t of bank)assert.equal(sanitizeTask(t).answer,undefined);
 for(const track of ['base','profile','literacy'])assert.deepEqual(diagnosticTasks(track,allTopics,bank),[]);
});
test('source mistakes receive unseen same-skill exercises outside the main set and close only after two independent answers',()=>{
 const state=emptyState(),topic=allTopics.find(t=>t.id==='negatives'),session=createPractice(state,'negatives',bank,2),original=session.main[0];
 const generator={reviewCapacity:()=>0,generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false,errors:[]})};
 savePracticeDraft(session,original.task.id,'999','');submitPractice(state,session,original.task.id,topic,bank,generator);
 const error=state.errors.find(e=>e.id===original.errorId);assert.ok(error.source);assert.equal(session.extra.length,2);assert.equal(error.resolved,false);
 const count=state.generatedTasks.length;
 assert.equal(assignErrorRepairs(state,error,bank,generator).tasks.length,2);assert.equal(state.generatedTasks.length,count);
 for(const [i,item] of session.extra.entries()){
  assert.ok(item.task.source);assert.equal(item.task.methodFamily,original.task.methodFamily);assert.equal(item.task.difficulty,original.task.difficulty);
  assert.ok(!session.main.some(m=>m.task.prompt.ru===item.task.prompt.ru));
  savePracticeDraft(session,item.task.id,item.task.answer,'');submitPractice(state,session,item.task.id,topic,[...bank,...state.generatedTasks],generator);assert.equal(error.resolved,i===1);
 }
 assert.equal(assignErrorRepairs(state,error,bank,generator).status,'complete');
});
