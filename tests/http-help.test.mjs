import {test} from 'node:test';import assert from 'node:assert/strict';import {localDatabase} from './local-state-fixture.mjs';import {verifyBackup} from '../lib/full-backup.ts';
const base='http://127.0.0.1:5173',admin=process.env.ENT_HELP_ADMIN==='1';
test('HELP-01: scoped support, immutable context, idempotent creation and editorial replies',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const identity=(await call('/api/state')).data;assert.equal(identity.isAdmin,admin);const before=identity.revision,db=localDatabase(),ids=[];
 const create=async(category='material')=>{const id=crypto.randomUUID();ids.push(id);const body={action:'create',id,category,taskId:'linear-4',message:'Локальная проверка обращения',language:'ru'};return {body,...await call('/api/help',body)};};
 try{
  assert.equal((await call('/api/help',undefined,false)).status,401);
  const own=await create();assert.equal(own.status,200);assert.equal(own.data.ticket.category,'material');assert.equal(own.data.ticket.context.version.length,64);assert.ok(!('material' in own.data.ticket.context));
  const [r1,r2]=await Promise.all([call('/api/help',own.body),call('/api/help',own.body)]);assert.equal(r1.data.replayed,true);assert.equal(r2.data.replayed,true);assert.equal((await call('/api/help',{...own.body,message:'Другой текст'})).status,409);
  const simultaneousId=crypto.randomUUID();ids.push(simultaneousId);const simultaneous=await Promise.all([call('/api/help',{...own.body,id:simultaneousId}),call('/api/help',{...own.body,id:simultaneousId})]);assert.ok(simultaneous.every(r=>r.status===200));assert.equal(db.prepare('SELECT count(*) n FROM help_tickets WHERE id=?').get(simultaneousId).n,1);
  const foreign=crypto.randomUUID();ids.push(foreign);const original=db.prepare('SELECT * FROM help_tickets WHERE id=?').get(own.body.id);db.prepare('INSERT INTO help_tickets VALUES(?,?,?,?,?,?,?,?)').run(foreign,'another-test-learner','material','new',original.data,0,original.created_at,original.updated_at);
  const list=await call('/api/help');assert.ok(list.data.tickets.some(t=>t.id===own.body.id));assert.ok(!list.data.tickets.some(t=>t.id===foreign));assert.equal((await call('/api/help',{...own.body,id:foreign})).status,409);
  assert.equal((await create('service')).status,200);assert.equal((await create('account')).status,200);
  const filtered=await call('/api/help?category=service');assert.ok(filtered.data.tickets.every(t=>t.category==='service'));
  const reply={action:'reply',id:own.body.id,eventId:crypto.randomUUID(),revision:0,message:'Тестовый ответ: проверим условие.',status:'working'};
  if(!admin){assert.equal((await call('/api/help?queue=editor')).status,403);assert.equal((await call('/api/help',reply)).status,403);}
  else{
   const queue=await call('/api/help?queue=editor');assert.equal(queue.status,200);assert.ok(queue.data.tickets.find(t=>t.id===own.body.id).context.material);
   assert.equal((await call('/api/help',reply)).status,200);assert.equal((await call('/api/help',reply)).data.replayed,true);assert.equal((await call('/api/help',{...reply,eventId:crypto.randomUUID(),message:'Устаревший ответ'})).status,409);
   assert.equal((await call('/api/help')).data.tickets.find(t=>t.id===own.body.id).events.length,1);
   const archive=await call('/api/admin/backup');assert.equal((await verifyBackup(archive.data)).format,'ent-math-full-v3');assert.ok(archive.data.tables.find(t=>t.name==='help_tickets').rows.some(r=>r.id===own.body.id));
  }
  for(let n=0;n<43;n++){const id=crypto.randomUUID();ids.push(id);db.prepare('INSERT INTO help_tickets VALUES(?,?,?,?,?,?,?,?)').run(id,'local_seedy','account','new',original.data,0,original.created_at,original.updated_at);}
  const page1=await call('/api/help?category=account');assert.equal(page1.data.tickets.length,40);assert.ok(page1.data.nextCursor);
  const page2=await call('/api/help?category=account&before='+encodeURIComponent(page1.data.nextCursor));assert.ok(page2.data.tickets.length>=4);assert.ok(page2.data.tickets.every(t=>!page1.data.tickets.some(a=>a.id===t.id)));
  assert.equal((await create('account')).status,429);
  assert.equal((await call('/api/state')).data.revision,before,'Support never changes learner history');
 }finally{for(const id of ids)db.prepare('DELETE FROM help_tickets WHERE id=?').run(id);db.close();}
});
