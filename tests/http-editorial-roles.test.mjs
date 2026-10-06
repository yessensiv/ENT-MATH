import{test}from'node:test';import assert from'node:assert/strict';import{localDatabase}from'./local-state-fixture.mjs';
const role=process.env.ENT_TEST_EDITOR_ROLE||'author',base='http://127.0.0.1:5173';
test(`editorial HTTP boundaries for ${role}`,async()=>{
 const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=login.headers.get('set-cookie').split(';')[0];
 const call=async(path,body)=>{const r=await fetch(base+path,{headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const state=(await call('/api/state')).data;assert.equal(state.isAdmin,false);assert.equal(state.editorial.access,true);
 const list=await call('/api/admin');assert.equal(list.status,200);assert.deepEqual(list.data.reports,[]);
 assert.equal((await call('/api/admin/backup')).status,403);assert.equal((await call('/api/help?queue=editor')).status,403);
 const id='linear-4',loaded=(await call('/api/admin?kind=task&id='+id)).data,db=localDatabase(),prior=db.prepare('SELECT * FROM content_overrides WHERE id=?').get(id);
 try{
  const changed={...loaded.material,prompt:{...loaded.material.prompt,ru:loaded.material.prompt.ru+' LOCAL ROLE TEST'}};
  assert.equal((await call('/api/admin',{id,kind:'task',status:'draft',data:changed})).status,role==='author'?200:403);
  assert.equal((await call('/api/admin',{id,kind:'task',status:'published',data:changed,reviewNote:'LOCAL ROLE TEST'})).status,403);
  const history=(await call('/api/admin?kind=task&id='+id)).data;
  const restoration={action:'restore-version',id,kind:'task',index:history.versions?.length?history.versions.length-1:0,editVersion:history.editVersion};
  const restored=await call('/api/admin',restoration);assert.equal(restored.status,role==='author'?200:403);
  if(role==='author'){assert.equal(restored.data.status,'draft');assert.equal((await call('/api/admin',restoration)).status,409);assert.deepEqual((await call('/api/admin?kind=task&id='+id)).data.material,loaded.material);}
  const review=(await call('/api/reviews?kind=task&id='+id)).data;
  assert.equal((await call('/api/reviews',{id,kind:'task',discipline:'kazakh',verdict:'approved',note:'LOCAL ROLE TEST: forbidden language approval',expectedHash:review.hash})).status,403);
  if(role==='publisher'){
   db.prepare('INSERT INTO content_overrides VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,status=excluded.status,data=excluded.data,history=excluded.history,updated_by=excluded.updated_by,updated_at=excluded.updated_at').run(id,'task','review',JSON.stringify(loaded.material),'[]','local-role-fixture-author',new Date().toISOString());
   const check=(await call('/api/reviews?kind=task&id='+id)).data;
   // Local mechanism fixtures only, never production expert approval.
   for(const discipline of ['math','methodology','kazakh'])db.prepare('INSERT INTO editorial_reviews VALUES(?,?,?,?,?,?,?)').run(crypto.randomUUID(),id,discipline,'approved',JSON.stringify({hash:check.hash,comment:'LOCAL PUBLISH ROLE FIXTURE'}),discipline==='math'?'fixture-reviewer-one':'fixture-reviewer-two',new Date().toISOString());
   const published=await call('/api/admin',{id,kind:'task',status:'published',data:loaded.material,reviewNote:'LOCAL ROLE TEST: unchanged approved draft'});assert.equal(published.status,200,JSON.stringify(published.data));
   assert.equal(db.prepare('SELECT updated_by FROM content_overrides WHERE id=?').get(id).updated_by,'local-role-fixture-author');
  }
  if(role==='math'){
   const r=await call('/api/reviews',{id,kind:'task',discipline:'math',verdict:'changes-needed',note:'LOCAL ROLE TEST: mechanism only, not a real review',expectedHash:review.hash});assert.equal(r.status,200);
  }
 }finally{
  if(prior)db.prepare('UPDATE content_overrides SET kind=?,status=?,data=?,history=?,updated_by=?,updated_at=? WHERE id=?').run(prior.kind,prior.status,prior.data,prior.history,prior.updated_by,prior.updated_at,id);else db.prepare('DELETE FROM content_overrides WHERE id=?').run(id);
  db.prepare("DELETE FROM editorial_reviews WHERE material_id=? AND reviewer_id='local_seedy' AND note LIKE ?").run(id,'%LOCAL ROLE TEST: mechanism only%');db.prepare("DELETE FROM editorial_reviews WHERE material_id=? AND note LIKE ?").run(id,'%LOCAL PUBLISH ROLE FIXTURE%');db.close();
 }
});
