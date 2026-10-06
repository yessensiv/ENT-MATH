import{test}from'node:test';import assert from'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';import{spawnSync}from'node:child_process';import{resolve}from'node:path';
import{localDatabase}from'./local-state-fixture.mjs';import{verifyBackup}from'../lib/full-backup.ts';
const base='http://127.0.0.1:5173';
test('CMS-02 and ARCH-04: live draft continuity and full restore into a blank database',async t=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 assert.equal((await call('/api/state')).data.isAdmin,true);
 await t.test('full export denies anonymous access and restores all local tables',async()=>{
  assert.equal((await call('/api/admin/backup',undefined,false)).status,401);
  const result=await call('/api/admin/backup');assert.equal(result.status,200);const backup=await verifyBackup(result.data);
  const dir=resolve('.sites-runtime/tests/full-backup');mkdirSync(dir,{recursive:true});const file=resolve(dir,`${Date.now()}.json`);writeFileSync(file,JSON.stringify(backup));
  const restored=spawnSync(process.execPath,['--experimental-strip-types','scripts/restore-backup.mjs',file,file+'.sqlite'],{encoding:'utf8'});assert.equal(restored.status,0,restored.stderr);const report=JSON.parse(restored.stdout);assert.equal(report.integrity,'ok');for(const table of backup.tables)assert.equal(report.tables.find(t=>t.name===table.name).count,table.rows.length);
  const duplicate=spawnSync(process.execPath,['--experimental-strip-types','scripts/restore-backup.mjs',file,file+'.sqlite'],{encoding:'utf8'});assert.notEqual(duplicate.status,0);
  const corrupt=structuredClone(backup);corrupt.tables[0].rows.push({});await assert.rejects(()=>verifyBackup(corrupt));
 });
 await t.test('editing a published topic keeps the student publication',async()=>{
  const db=localDatabase(),id='linear',prior=db.prepare('SELECT * FROM content_overrides WHERE id=?').get(id);
  try{const published={title:{ru:'Линейные уравнения — опубликованная правка',kk:'Сызықтық теңдеулер'}};
   db.prepare('INSERT INTO content_overrides(id,kind,status,data,history,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,status=excluded.status,data=excluded.data,history=excluded.history,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(id,'topic','published',JSON.stringify(published),'[]','local-test-editor',new Date().toISOString());
   const version=(await call('/api/admin?kind=topic&id=linear')).data.editVersion;
   const edited=await call('/api/admin',{id,kind:'topic',status:'draft',editVersion:version,data:{title:{ru:'Новый незавершённый черновик',kk:'Жоба'}}});assert.equal(edited.status,200);
   const stale=await call('/api/admin',{id,kind:'topic',status:'draft',editVersion:version,data:{title:{ru:'Устаревшая вкладка',kk:'Ескі қойынды'}}});assert.equal(stale.status,409);assert.equal(stale.data.code,'CONTENT_CONFLICT');
   const visible=(await call('/api/content?topic=linear')).data.topics[0];assert.equal(visible.title.ru,published.title.ru);
   assert.equal((await call('/api/admin?kind=topic&id=linear')).data.material.title.ru,'Новый незавершённый черновик');
  }finally{if(prior)db.prepare('UPDATE content_overrides SET kind=?,status=?,data=?,history=?,updated_by=?,updated_at=? WHERE id=?').run(prior.kind,prior.status,prior.data,prior.history,prior.updated_by,prior.updated_at,id);else db.prepare('DELETE FROM content_overrides WHERE id=?').run(id);db.close();}
 });
});
