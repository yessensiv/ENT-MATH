import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';import{emptyState}from'../lib/engine.ts';import{generateReviewTask}from'../lib/content.ts';
const base='http://127.0.0.1:5173';
test('error → exact skill → reload → two independent answers → persisted repair; replay and access checks',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const f=await beginLocalFixture(o=>({...emptyState(),profile:o.profile}));let mutations=0;
 try{
  const submit=async body=>{const r=await call('/api/state',body);assert.equal(r.status,200,JSON.stringify(r.data));if(!r.data.replayed&&!r.data.staleSnapshot)mutations++;return r.data;};
  let s=await submit({action:'attempt',taskId:'fractions-8',answer:'99',submissionId:crypto.randomUUID()});const errorId=s.errors[0].id,url='/api/tasks?topic=fractions&errorId='+errorId;
  assert.equal((await call(url,undefined,false)).status,401);assert.equal((await call('/api/tasks?topic=fractions&errorId=someone-else')).status,404);
  const r=await call(url);assert.equal(r.status,200,JSON.stringify(r.data));mutations++;assert.equal(r.data.tasks.length,2);const assigned=r.data.tasks;
  assert.ok(assigned.every(t=>t.skillIds[0]==='fractions:method-2'&&t.answer===undefined&&t.solution===undefined));
  s=await submit({action:'save-draft',kind:'practice',taskId:assigned[0].id,answer:'4',steps:'Делим на дробь',updatedAt:Date.now()});
  const reload=(await call('/api/state')).data;assert.equal(reload.practiceDraft.errorId,errorId);assert.equal(reload.practiceDraft.answer,'4');
  assert.deepEqual((await call(url)).data.tasks.map(t=>t.id),assigned.map(t=>t.id));
  for(const [i,t]of assigned.entries()){
   const match=t.id.match(/^review-fractions-(\d+)-(\d+)$/);assert.ok(match);const expected=generateReviewTask('fractions',Number(match[2]),Number(match[1]));
   const body={action:'attempt',taskId:t.id,answer:expected.answer,submissionId:crypto.randomUUID()};
   s=await submit(body);assert.equal(s.errors[0].resolved,i===1);assert.equal(s.errors[0].repairPassedTaskIds.length,i+1);
   const repeated=await submit(body);assert.equal(repeated.replayed,true);assert.equal(repeated.xp,s.xp);assert.equal(repeated.attempts.length,s.attempts.length);
  }
  const reload2=(await call('/api/state')).data;assert.equal(reload2.errors[0].resolved,true);assert.equal(reload2.progress.fractions.mastered,false);assert.ok(reload2.reviews.length);
  assert.equal((await call(url)).data.repair.status,'complete');assert.equal(reload2.revision,f.revision+mutations);
 }finally{await f.restore(f.revision+mutations);}
});
