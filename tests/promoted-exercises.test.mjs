import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {promotedExercises as bank} from '../lib/promoted-exercises.ts';
import {sourceExercises} from '../lib/source-exercises.ts';
import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
import {calculate,checkAnswer,sanitizeTask,emptyState,diagnosticTasks} from '../lib/engine.ts';
import {createPractice,savePracticeDraft,submitPractice,publicPractice} from '../lib/practice-session.ts';
const proofs=JSON.parse(readFileSync(new URL('../content/promoted/verification.json',import.meta.url),'utf8'));
const byId=new Map(bank.map(t=>[t.id,t]));
const allTopics=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
const close=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),label);

test('promoted tasks have exact provenance, bilingual solutions and supported skills',()=>{
 assert.ok(bank.length>1000);assert.equal(byId.size,bank.length);assert.equal(new Set([...bank,...sourceExercises].map(t=>t.id)).size,bank.length+sourceExercises.length);
 assert.equal(proofs.length,bank.length);
 for(const t of bank){
  assert.ok(allTopics.some(p=>p.id===t.topicId),t.topicId);assert.equal(t.source.license,'CC BY 4.0');assert.equal(t.purpose,'practice');assert.equal(t.reviewStatus,'math-checked-translation-pending');
  assert.match(t.source.sha256,/^[a-f0-9]{64}$/);assert.equal(t.skillIds[0],t.subtopic.id);assert.equal(t.methodFamily,t.subtopic.id);
  for(const lang of ['ru','kk']){assert.ok(t.prompt[lang]);assert.ok(t.solution[lang].length>=3);assert.ok(t.hints[lang].length>=2);assert.ok(t.errors[lang].length);}
  assert.equal(checkAnswer(t,t.answer).status,'correct',t.id+' key');assert.notEqual(checkAnswer(t,t.answerFormat==='root-set'?'{999999}':t.answerFormat==='interval'?'[999998;999999]':'999999').status,'correct',t.id+' wrong answer');
 }
});
test('every promoted exercise still resolves to the exact archived source block',()=>{
 const pages=new Map();
 for(const t of bank){const id=t.source.archivePageId;if(!pages.has(id))pages.set(id,JSON.parse(readFileSync(new URL('../content/source-library/'+id+'.json',import.meta.url),'utf8')));
  const page=pages.get(id),block=page.exercises[t.source.archiveOrdinal-1];assert.ok(block,t.id);assert.equal(block.sourceNumber,t.source.exercise,t.id);assert.equal(page.sha256,t.source.sha256,t.id);assert.equal(page.url,t.source.url,t.id);
  const suffix=createHash('sha256').update(block.prompt.replace(/\s+/g,' ').trim()).digest('hex').slice(0,12);assert.equal(t.id,`source-auto-${id}-${suffix}`);
 }
});
test('an independent JS evaluator verifies every numerical answer and equation substitution',()=>{
 for(const proof of proofs){const t=byId.get(proof.id);
  if(proof.expression)close(calculate(proof.expression),calculate(t.answer),t.id);
  if(proof.lcm||proof.gcd){const [a,b]=proof.lcm??proof.gcd;const gcd=(x,y)=>y?gcd(y,x%y):x;assert.equal(Number(t.answer),proof.lcm?a*b/gcd(a,b):gcd(a,b),t.id);}
  if(proof.equation){
   for(const root of proof.roots){const x=calculate(root);close(calculate(proof.equation[0],x),calculate(proof.equation[1],x),t.id);}
   for(let x=-12;x<=12;x+=0.5){let valid=false;try{const l=calculate(proof.equation[0],x),r=calculate(proof.equation[1],x);valid=Math.abs(l-r)<=1e-10;}catch{/* undefined points are not roots */}
    assert.equal(valid,proof.roots.some(r=>Math.abs(calculate(r)-x)<1e-10),t.id+' at '+x);
   }
  }
 }
});
test('exact numerical tasks accept equivalent fractions without accepting approximate guesses',()=>{
 const task={...bank.find(t=>t.type==='number'),answer:'3/10',answerFormat:'exact-number'};
 for(const answer of ['0.3','3/10','0.1+0.2','6/20'])assert.equal(checkAnswer(task,answer).status,'correct',answer);
 assert.equal(checkAnswer(task,'0.3000000000001').status,'incorrect');
 assert.equal(checkAnswer({...task,answer:'1/10000000000000'},'0').status,'incorrect');
 assert.equal(checkAnswer(task,'1/0').status,'review');
});
test('all interval boundaries and every sign region are verified independently',()=>{
 const relation=(v,op)=>op==='>'?v>0:op==='<'?v<0:op==='>='?v>=0:v<=0;
 const endpoint=v=>v==='-inf'?-Infinity:v==='+inf'?Infinity:calculate(v);
 for(const p of proofs.filter(v=>v.inequality)){
  const answer=byId.get(p.id).answer;
  const set=answer==='∅'?[]:answer.split('U').map(v=>v.startsWith('{')?{point:calculate(v.slice(1,-1))}:{lo:endpoint(v.slice(1,-1).split(';')[0]),hi:endpoint(v.slice(1,-1).split(';')[1]),left:v[0]==='[',right:v.at(-1)===']'});
  const probes=new Set(p.probes.map(calculate));for(const v of p.boundaries){const x=calculate(v);for(const delta of [-0.001,0,0.001])probes.add(x+delta);}
  for(const x of probes){let expected=false;try{let n=calculate(p.inequality.expression,x);if(Math.abs(n)<1e-10)n=0;expected=relation(n,p.inequality.relation);}catch{/* denominator zero */}
   const actual=set.some(i=>'point'in i?Math.abs(i.point-x)<1e-10:(x>i.lo||i.left&&Math.abs(x-i.lo)<1e-10)&&(x<i.hi||i.right&&Math.abs(x-i.hi)<1e-10));assert.equal(actual,expected,p.id+' at '+x);
  }
 }
});
test('practice integration preserves snapshots, rejects repeats and assigns separate same-skill repairs',()=>{
 const state=emptyState(),topic=allTopics.find(t=>t.id==='fractions'),s=createPractice(state,topic.id,bank,2),item=s.main[0];
 const old=structuredClone(item.task);assert.ok(item.task.source.archivePageId);
 assert.equal(sanitizeTask(item.task).answer,undefined);assert.equal(publicPractice(s,state).current.task.solution,undefined);
 const generator={reviewCapacity:()=>0,generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false,errors:[]})};
 savePracticeDraft(s,item.task.id,'999999','');submitPractice(state,s,item.task.id,topic,bank,generator);assert.equal(s.extra.length,2);
 submitPractice(state,s,item.task.id,topic,bank,generator);assert.equal(state.attempts.length,1);
 for(const extra of s.extra){assert.equal(extra.task.methodFamily,item.task.methodFamily);assert.ok(!s.main.some(i=>i.task.id===extra.task.id));savePracticeDraft(s,extra.task.id,extra.task.answer,'');submitPractice(state,s,extra.task.id,topic,[...bank,...state.generatedTasks],generator);}
 assert.equal(state.errors[0].resolved,true);assert.deepEqual(s.main[0].task,old);
 const restored=JSON.parse(JSON.stringify(state));assert.equal(restored.practiceSessions[0].extra.length,2);
 for(const track of ['base','profile','literacy'])assert.deepEqual(diagnosticTasks(track,allTopics,bank),[]);
});
