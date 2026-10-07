import {test} from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {beginLocalFixture} from './local-state-fixture.mjs';
import {emptyState} from '../lib/engine.ts';
import {makePracticeVariant} from '../lib/practice-variants.ts';
const base=process.env.ENT_TEST_URL||'http://127.0.0.1:5174';
test('HTTP session: resume, two devices, incorrect → repair → main → finish → report; replay and no leaked keys',async()=>{
 const cookie='__sites_local_auth=1',f=await beginLocalFixture(o=>({...emptyState(),profile:{...o.profile,name:'Проверка практики (тест)',language:'ru',track:'profile'},reviews:[{id:'targeted-review-fixture',topicId:'percentages',due:'2020-01-01T00:00:00Z',interval:1,completed:false,methodFamily:'percentages:variant-3',variant:{seed:138,level:3}}]}));let revision=f.revision;
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},...(body?{method:'POST',body:JSON.stringify(body)}:{})}),data=await r.json();if(data.state)revision=data.state.revision;return{status:r.status,data};};
 let s;
 const action=async(action,extra={})=>{const r=await call('/api/practice',{action,id:s.id,version:s.version,taskId:s.cursor,requestId:crypto.randomUUID(),...extra});assert.equal(r.status,200,JSON.stringify(r.data));s=r.data.session;return r.data;};
 try{
  assert.equal((await call('/api/practice',undefined,false)).status,401);
  const start={action:'start',topicId:'linear',size:15,requestId:crypto.randomUUID()};let r=await call('/api/practice',start);assert.equal(r.status,200,JSON.stringify(r.data));s=r.data.session;assert.equal(s.main.length,15);assert.equal(s.current.task.answer,undefined);assert.equal(s.current.task.solution,undefined);assert.ok(s.current.task.canVary);
  const id=s.id,first=s.cursor;
  assert.equal((await call('/api/practice',start)).data.session.id,id);
  await action('save',{answer:'9999',steps:'Составляю модель'});const old=s.version;
  assert.equal((await call('/api/practice?id='+id)).data.session.current.answer,'9999');
  await action('navigate',{target:s.main[1].id});
  const stale=await call('/api/practice',{action:'save',id,version:old,taskId:first,answer:'777',steps:'',requestId:crypto.randomUUID()});assert.equal(stale.status,409);
  await action('navigate',{target:first});assert.equal(s.current.answer,'9999');
  const submission={action:'submit',id,version:s.version,taskId:first,answer:'9999',steps:'Составляю модель',requestId:crypto.randomUUID()};r=await call('/api/practice',submission);assert.equal(r.status,200,JSON.stringify(r.data));s=r.data.session;const xp=r.data.state.xp;assert.equal(s.summary.main.incorrect,1);assert.equal(s.extra.length,2);
  const errorId=s.current.errorId,extra=[...s.extra];const replay=await call('/api/practice',submission);assert.equal(replay.data.replayed,true);assert.equal(replay.data.state.xp,xp);
  for(const repair of extra){await action('navigate',{target:repair.id});const match=repair.id.match(/^variant-linear-(\d)-(\d+)$/);assert.ok(match);const key=makePracticeVariant('linear',Number(match[2]),Number(match[1]));await action('submit',{answer:key.answer,steps:'Вычитаю постоянную плату и делю на цену километра.'});}
  assert.equal(s.summary.extra.independent,2);assert.equal(s.summary.main.incorrect,1);let state=(await call('/api/state')).data;assert.equal(state.errors.find(e=>e.id===errorId).resolved,true);assert.equal(state.practiceSessions,undefined);assert.ok(state.reviews.length);assert.equal(state.progress.linear.mastered,false);
  await action('navigate',{target:first});assert.equal(s.current.feedback.correct,false);
  await action('navigate',{target:s.main[1].id});const finish={action:'finish',id,version:s.version,taskId:s.cursor,requestId:crypto.randomUUID()};r=await call('/api/practice',finish);assert.equal(r.status,200,JSON.stringify(r.data));s=r.data.session;assert.ok(s.finishedAt);assert.equal(s.report.length,17);assert.equal(s.summary.main.skipped,14);assert.equal((await call('/api/practice',finish)).data.replayed,true);
  const reload=(await call('/api/practice?id='+id)).data.session;assert.deepEqual(reload.summary,s.summary);assert.equal((await call('/api/practice')).data.session,null);
  r=await call('/api/practice',{action:'start',topicId:'linear',size:10,requestId:crypto.randomUUID()});assert.equal(r.status,200);assert.notEqual(r.data.session.id,id);assert.equal(r.data.session.main.length,10);assert.ok(r.data.session.main.every(i=>i.status==='new'));
  const school=await call('/api/practice',{action:'start',topicId:'school-sampling',size:20,requestId:crypto.randomUUID()});assert.equal(school.status,200,JSON.stringify(school.data));assert.equal(school.data.session.main.length,20);
  const due=await call('/api/tasks?topic=percentages&reviewId=targeted-review-fixture');revision=(await call('/api/state')).data.revision;assert.equal(due.status,200,JSON.stringify(due.data));assert.equal(due.data.tasks.length,1);assert.equal(due.data.tasks[0].skillIds[0],'percentages:variant-3');const parsed=due.data.tasks[0].id.match(/^variant-percentages-(\d)-(\d+)$/);assert.ok(parsed);const key=makePracticeVariant('percentages',Number(parsed[2]),Number(parsed[1]));const reviewed=await call('/api/state',{action:'review',reviewId:'targeted-review-fixture',taskId:key.id,answer:key.answer,submissionId:crypto.randomUUID()});revision=reviewed.data.revision;assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));assert.ok(reviewed.data.reviews.some(r=>r.methodFamily==='percentages:variant-3'&&r.interval===3&&!r.completed));
  if(process.env.ENT_BROWSER_HOLD==='1'){
   const marker='.sites-runtime/tests/practice-browser-done';if(existsSync(marker))unlinkSync(marker);
   writeFileSync('.sites-runtime/tests/practice-browser-session.json',JSON.stringify({report:id,active:r.data.session.id,revision}));console.log('BROWSER_FIXTURE_READY');
   const deadline=Date.now()+600000;while(!existsSync(marker)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,500));
   // Browser checks can save drafts/attempts; track its final revision, but refuse if profile ownership changed.
   state=(await call('/api/state')).data;assert.equal(state.profile.name,'Проверка практики (тест)');revision=state.revision;
  }
 }finally{await f.restore(revision);console.log('Original local learner state, events, chunks and backups restored.');}
});
