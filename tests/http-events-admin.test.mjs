import{test}from'node:test';import assert from'node:assert/strict';import{beginLocalFixture}from'./local-state-fixture.mjs';
import{mkdirSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';
const base='http://127.0.0.1:5173';
test('admin migration is idempotent, CAS protected and reversible without changing learning',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 assert.equal((await call('/api/state')).data.isAdmin,true);assert.equal((await call('/api/admin/migration',undefined,false)).status,401);const f=await beginLocalFixture(o=>({...o,activeExam:null}));try{
  const first=await call('/api/admin/migration',{userId:'local_seedy',expectedRevision:f.revision,storage:'events'});assert.equal(first.status,200);assert.equal(first.data.migrated,true);
  assert.equal((await call('/api/admin/migration',{userId:'local_seedy',expectedRevision:f.revision,storage:'events'})).status,409);
  const duplicate=await call('/api/admin/migration',{userId:'local_seedy',expectedRevision:f.revision+1,storage:'events'});assert.equal(duplicate.data.already,true);assert.equal(duplicate.data.revision,f.revision+1);
  const backup=await call('/api/admin/backup');assert.equal(backup.data.format,'ent-math-full-v2');assert.ok(backup.data.tables.find(t=>t.name==='learner_event_versions').rows.length);
  mkdirSync('.sites-runtime/tests/full-backup',{recursive:true});const file='.sites-runtime/tests/full-backup/events-'+crypto.randomUUID()+'.json';writeFileSync(file,JSON.stringify(backup.data));const restore=spawnSync(process.execPath,['--experimental-strip-types','scripts/restore-backup.mjs',file,file+'.sqlite'],{encoding:'utf8'});assert.equal(restore.status,0,restore.stderr);assert.equal(JSON.parse(restore.stdout).integrity,'ok');
  const rollback=await call('/api/admin/migration',{userId:'local_seedy',expectedRevision:f.revision+1,storage:'legacy'});assert.equal(rollback.status,200);assert.deepEqual(rollback.data.counts,first.data.counts);
  const exported=(await call('/api/history/export')).data;for(const k of ['profile','attempts','errors','exams','progress','reviews'])assert.deepEqual(exported[k],f.original[k]);
 }finally{await f.restore(f.revision+2);}
});
