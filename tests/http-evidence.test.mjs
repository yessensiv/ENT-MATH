import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';import{emptyState}from'../lib/engine.ts';import{tasks}from'../lib/content.ts';
const base='http://127.0.0.1:5173';
test('independence evidence persists in events, repeat is excluded, and read-only analytics do not mutate learning',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body)=>{const r=await fetch(base+path,{headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const f=await beginLocalFixture(o=>({...emptyState(),profile:o.profile}));let mutations=0;
 try{
  const a=tasks.find(t=>t.id==='linear-4'),b=tasks.find(t=>t.id==='linear-7');assert.ok(a&&b);
  for(const t of [a,a,b]){const r=await call('/api/state',{action:'attempt',taskId:t.id,answer:t===b?'999':t.answer,submissionId:crypto.randomUUID()});assert.equal(r.status,200,JSON.stringify(r.data));mutations++;}
  const first=(await call('/api/state')).data,again=(await call('/api/state')).data,stats=again.statistics.evidence.tracks.profile;
  assert.equal(again.revision,f.revision+mutations);assert.equal(first.revision,again.revision);assert.deepEqual(first.statistics,again.statistics);
  assert.deepEqual(stats.current,{total:2,correct:1});assert.equal(stats.excluded.repeat,1);
  assert.equal(again.attempts[0].evidence.independent,true);assert.equal(again.attempts[1].evidence.independent,false);
  const history=(await call('/api/history?kind=attempts')).data;assert.equal(history.items.length,3);assert.ok(history.items.every(a=>a.evidence.schema===1));
 }finally{await f.restore(f.revision+mutations);}
});
