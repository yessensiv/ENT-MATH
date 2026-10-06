import{test}from'node:test';import assert from'node:assert/strict';
import{beginLocalFixture}from'./local-state-fixture.mjs';import{emptyState}from'../lib/engine.ts';
const base='http://127.0.0.1:5173';
test('RU/KK tutor uses exact task transitions, accepts an alternative, and does not grade mastery',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body)=>{const r=await fetch(base+path,{headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 assert.equal((await call('/api/state')).data.aiConfigured,false,'Use the unconfigured local provider; do not incur cost');
 for(const language of ['ru','kk']){
  const f=await beginLocalFixture(o=>({...emptyState(),profile:{...o.profile,language}}));let expected=f.revision;
  try{
   const good={topicId:'linear',taskId:'linear-4',message:language==='ru'?'Так можно решить?':'Осылай шешуге бола ма?',steps:'x+3/2=15/2\nx=6',messageId:crypto.randomUUID()};
   const a=await call('/api/tutor',good);assert.equal(a.status,200,JSON.stringify(a.data));expected+=3;assert.equal(a.data.mode,'study-helper');assert.match(a.data.reply,language==='ru'?/способ допустим/:/тәсілді қолдануға болады/);
   const again=await call('/api/tutor',good);assert.equal(again.data.replayed,true);assert.equal(again.data.reply,a.data.reply);
   const b=await call('/api/tutor',{...good,steps:'2x=18\nx=9',messageId:crypto.randomUUID()});assert.equal(b.status,200);expected+=2;assert.match(b.data.reply,language==='ru'?/изменил решения/:/шешімдерін өзгертті/);assert.match(b.data.reply,/2x\+3=15/);
   const c=await call('/api/tutor',{...good,message:'x=9',steps:'',messageId:crypto.randomUUID()});assert.equal(c.status,200);expected+=2;assert.match(c.data.reply,language==='ru'?/первый шаг/:/алғашқы қадамыңды/);
   const state=(await call('/api/state')).data;assert.equal(state.revision,expected);assert.equal(state.attempts.length,0);assert.deepEqual(state.progress,{});assert.equal(state.xp,0);
   const history=(await call('/api/tutor?topic=linear&task=linear-4')).data;assert.equal(history.messages.length,6);
  }finally{await f.restore(expected);}
 }
});
