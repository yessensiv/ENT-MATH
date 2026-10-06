import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';
import{emptyState}from'../lib/engine.ts';
import{tasks,generateReviewTask}from'../lib/content.ts';
const base='http://127.0.0.1:5173';
test('DIAG HTTP: clarification, reload, hidden keys, draft, replay and unchanged mastery',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body)=>{const r=await fetch(base+path,{headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const f=await beginLocalFixture(o=>({...emptyState(),profile:{...o.profile,track:'base',learningMode:'ent'}}));let writes=0;
 const mutate=async(path,body)=>{const r=await call(path,body);assert.equal(r.status,200,JSON.stringify(r.data));writes++;return r.data;};
 try{
  const broad=await mutate('/api/diagnostic?track=base');assert.ok(broad.tasks.length>=12);
  const answers=broad.tasks.map(t=>({taskId:t.id,answer:''}));
  const result=await mutate('/api/state',{action:'diagnostic',track:'base',answers,submissionId:crypto.randomUUID()});
  assert.equal(result.diagnostic.score,0);assert.equal(result.diagnostic.gaps.length,0);assert.equal(result.xp,0);
  const skill=result.diagnostic.evidence.find(e=>e.skillId)?.skillId;assert.ok(skill);
  const q=await mutate('/api/diagnostic?track=base&skill='+encodeURIComponent(skill));assert.ok(q.tasks.length>=3&&q.tasks.length<=5);
  for(const t of q.tasks){assert.equal('answer'in t,false);assert.equal('solution'in t,false);assert.equal((await call('/api/state',{action:'attempt',taskId:t.id,answer:'1'})).status,409);}
  assert.equal((await call('/api/tutor',{taskId:q.tasks[0].id,topicId:q.tasks[0].topicId,message:'Покажи решение'})).status,409);
  const resumed=await call('/api/diagnostic?track=base');assert.deepEqual(resumed.data.tasks,q.tasks);
  const answerFor=t=>{const direct=tasks.find(s=>s.id===t.id);if(direct)return direct.answer;const m=t.id.match(/^review-(.+)-([123])-(\d+)$/);assert.ok(m);return generateReviewTask(m[1],Number(m[3]),Number(m[2])).answer;};
  const all=q.tasks.map(t=>({taskId:t.id,answer:answerFor(t)})),stamp=Date.now();
  await mutate('/api/state',{action:'save-draft',kind:'diagnostic',track:'base',answers:all.slice(0,1),taskId:q.tasks[1].id,answer:'',updatedAt:stamp});
  assert.equal((await call('/api/state')).data.diagnosticDraft.answers.length,1);
  assert.deepEqual((await call('/api/diagnostic?track=base')).data.draft.answers,all.slice(0,1));
  const submission={action:'diagnostic',track:'base',answers:all,submissionId:crypto.randomUUID(),draftUpdatedAt:stamp+1};
  const done=await mutate('/api/state',submission);assert.equal(done.diagnostic.evidence[0].status,'supported');assert.equal(done.diagnostic.clarificationSkillId,skill);assert.equal(done.xp,0);assert.ok(Object.values(done.progress).every(p=>!p.mastered&&p.independent===0));
  const replay=await call('/api/state',submission);assert.equal(replay.data.replayed,true);assert.equal(replay.data.diagnostics.length,2);assert.deepEqual(replay.data.diagnostic,done.diagnostic);
  assert.equal((await call('/api/state')).data.revision,f.revision+writes);
 }finally{await f.restore(f.revision+writes);}
});
