import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{diagnosticEvidence,currentDiagnosticEvidence}from'../lib/diagnostic-evidence.ts';
// @ts-expect-error Native Node tests.
import{beginClarification}from'../lib/diagnostic-clarification.ts';
// @ts-expect-error Native Node tests.
import{beginDiagnostic}from'../lib/diagnostic-session.ts';
// @ts-expect-error Native Node tests.
import{emptyState,makePlan,taskFingerprint,reservedReviewIds,type Task}from'../lib/engine.ts';
// @ts-expect-error Native Node tests.
import{topics,tasks,generateReviewTask,validateGeneratedTask,reviewCapacity}from'../lib/content.ts';
const bank=tasks.map(t=>({...t,difficulty:t.level,reviewReserved:reservedReviewIds(topics.find(p=>p.id===t.topicId) as never).includes(t.id)})) as Task[];
const generator={generateReviewTask,validateGeneratedTask,reviewCapacity};
const sample=bank.filter(t=>t.topicId==='linear'&&t.repairSkillId==='linear:method-1').slice(0,3);
test('DIAG: contradictory answers produce one mixed method, no contradictory topic labels',()=>{
 const r=diagnosticEvidence(sample,new Map(sample.map((t,i)=>[t.id,i?'987654':t.answer])));
 assert.equal(r.score,1);assert.deepEqual(r.strengths,[]);assert.deepEqual(r.gaps,['linear']);assert.equal(r.evidence[0].status,'mixed');
 const skipped=diagnosticEvidence(sample,new Map());assert.equal(skipped.evidence[0].unknown,3);assert.deepEqual(skipped.gaps,[]);assert.deepEqual(skipped.unknowns,['linear']);
});
test('DIAG: aliases of the same condition do not inflate confidence',()=>{
 const list=[sample[0],{...sample[0],id:'alias-a'},{...sample[0],id:'alias-b'}];
 const r=diagnosticEvidence(list,new Map(list.map(t=>[t.id,t.answer])));assert.equal(r.score,1);assert.equal(r.evidence[0].unknown,2);assert.notEqual(r.evidence[0].status,'supported');
});
function learner(){const s=emptyState();s.profile={name:'test',grade:'11',learningMode:'ent',track:'profile',language:'ru',dailyMinutes:20,target:40,examDate:'2027-06-01'};s.diagnostics.push({id:'broad',track:'profile',at:new Date().toISOString(),score:0,total:1,strengths:[],gaps:['linear'],taskIds:[sample[0].id],evidence:diagnosticEvidence([sample[0]],new Map([[sample[0].id,'987654']])).evidence});return s;}
test('DIAG: targeted clarification is fresh, resumes exactly, and does not change mastery',()=>{
 const s=learner(),before=JSON.stringify(s.progress),q=beginClarification(s,'profile','linear:method-1',topics as never,bank,generator as never);
 assert.equal(q.length,5);assert.equal(new Set(q.map(taskFingerprint)).size,5);assert.ok(q.every(t=>t.repairSkillId==='linear:method-1'&&t.id!==sample[0].id));
 assert.deepEqual(beginClarification(s,'profile','linear:method-1',topics as never,bank,generator as never),q);
 assert.deepEqual(beginDiagnostic(s,'profile',topics as never,[...bank,...s.generatedTasks as Task[]]),q);
 assert.equal(JSON.stringify(s.progress),before);assert.equal(s.xp,0);
 assert.throws(()=>beginClarification(s,'profile','fractions:method-1',topics as never,bank,generator as never),/IN_PROGRESS/);
 const r=diagnosticEvidence(q,new Map(q.map(t=>[t.id,t.answer])));assert.equal(r.evidence[0].status,'supported');
 s.diagnostics.push({id:'clarify',track:'profile',at:new Date().toISOString(),total:q.length,...r,taskIds:q.map(t=>t.id),clarificationSkillId:'linear:method-1'});
 assert.equal(currentDiagnosticEvidence(s)[0].status,'supported');
 s.profile!.track='base';assert.deepEqual(currentDiagnosticEvidence(s),[]);
});
test('DIAG: a missing assigned item is an error, never a shorter test',()=>{const s=learner();s.diagnosticSession={version:2,scope:'ent:11::profile',track:'profile',taskIds:['deleted-id']};assert.throws(()=>beginDiagnostic(s,'profile',topics as never,bank),/MATERIAL_MISSING/);});
test('DIAG: unfamiliar skill and exhausted generator leave state unchanged',()=>{
 const s=learner();assert.throws(()=>beginClarification(s,'profile','fractions:method-1',topics as never,bank,generator as never),/NOT_OFFERED/);
 const before=JSON.stringify(s);assert.throws(()=>beginClarification(s,'profile','linear:method-1',topics as never,[],{generateReviewTask:()=>null,validateGeneratedTask:()=>({valid:false,errors:[]}),reviewCapacity:()=>0}),/POOL_EXHAUSTED/);assert.equal(JSON.stringify(s),before);
});

test('DIAG: every catalogued method can receive 3–5 mathematically checked fresh conditions',()=>{
 const ids=[...new Set(bank.map(t=>t.repairSkillId).filter((id):id is string=>typeof id==='string'))];assert.equal(ids.length,30);
 for(const id of ids){const s=learner(),t=bank.find(t=>t.repairSkillId===id)!;s.diagnostics[0].evidence=diagnosticEvidence([t],new Map()).evidence;s.diagnostics[0].taskIds=[t.id];const q=beginClarification(s,'profile',id,topics as never,bank,generator as never);assert.ok(q.length>=3&&q.length<=5,id);assert.equal(diagnosticEvidence(q,new Map(q.map(t=>[t.id,t.answer]))).score,q.length,id);}
});

test('PLAN: successful clarification removes its stale diagnostic gap without claiming mastery',()=>{
 const s=learner();s.profile!.track='base';s.diagnostics[0].track='base';const t=bank.find(t=>t.repairSkillId==='numbers:method-1')!;
 s.diagnostics[0].evidence=diagnosticEvidence([t],new Map([[t.id,'987654']])).evidence;s.diagnostics[0].gaps=['numbers'];s.progress.numbers={attempts:1,correct:0,independent:0,mastered:false,independentTaskIds:[]};
 assert.equal(makePlan(s,topics as never).find(p=>p.topicId==='numbers')?.type,'repair');
 s.diagnostics.push({id:'clarify',track:'base',at:new Date().toISOString(),score:5,total:5,strengths:['numbers'],gaps:[],clarificationSkillId:'numbers:method-1',evidence:[{topicId:'numbers',skillId:'numbers:method-1',correct:5,incorrect:0,unknown:0,total:5,status:'supported'}]});
 const plan=makePlan(s,topics as never);assert.equal(plan.find(p=>p.topicId==='numbers')?.type,'lesson');assert.equal(s.progress.numbers.mastered,false);
});
