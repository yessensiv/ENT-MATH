import{test}from'node:test';import assert from'node:assert/strict';import{beginLocalFixture}from'./local-state-fixture.mjs';import{EXAM_RULES}from'../lib/engine.ts';
const base='http://127.0.0.1:5173';
test('paginated history, full export, complete statistics and exam isolation',async()=>{
 const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'}),cookie=sign.headers.get('set-cookie').split(';')[0];
 const call=async(path,body,auth=true)=>{const r=await fetch(base+path,{headers:{...(auth?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 assert.equal((await call('/api/history',undefined,false)).status,401);assert.equal((await call('/api/history/export',undefined,false)).status,401);
 const attempts=Array.from({length:151},(_,i)=>({id:'local-pagination-'+i,taskId:'linear-1',topicId:'linear',track:'profile',answer:'4',steps:'fixture',correct:true,assisted:i<10,at:new Date().toISOString(),category:'none',taskSnapshot:{prompt:{ru:'Локальный тест',kk:'Жергілікті тест'},answer:'4',solution:{ru:['x=4'],kk:['x=4']},type:'number',difficulty:1}}));
 const exams=Array.from({length:12},(_,i)=>({id:'local-exam-'+i,track:'profile',variant:1,finishedAt:new Date().toISOString(),questions:[],results:[],score:0,maxScore:0}));
 const f=await beginLocalFixture(o=>({...o,attempts,exams,activeExam:null}));try{
  const first=await call('/api/state');assert.equal(first.status,200);assert.equal(first.data.attempts.length,100);assert.equal(first.data.exams.length,10);assert.equal(first.data.history.attempts,151);assert.equal(first.data.statistics.tracks.profile.independentCorrect,141);
  const saved=await call('/api/state',{action:'preferences',leaderboard:false});assert.equal(saved.status,200);assert.ok(JSON.parse(f.db.prepare('SELECT data FROM learner_states WHERE user_id=?').get('local_seedy').data)._entEvents);
  let before=null,received=[];do{const r=await call('/api/history?kind=attempts'+(before?'&before='+before:''));assert.equal(r.status,200);assert.ok(r.data.items.length<=40);received.unshift(...r.data.items);before=r.data.before;}while(before);assert.deepEqual(received,attempts);
  assert.equal((await call('/api/history?kind=exams')).data.items.length,12);const exported=await call('/api/history/export');assert.deepEqual(exported.data.attempts,attempts);assert.deepEqual(exported.data.exams,exams);
  assert.equal((await call('/api/history?before=missing')).status,409);
 }finally{await f.restore(f.revision+1);}
 const exam=await beginLocalFixture(o=>({...o,attempts,exams,activeExam:{id:'local-active',track:'profile',variant:1,startedAt:new Date().toISOString(),durationMinutes:80,questions:[],answers:{},flagged:[],rules:EXAM_RULES}}));try{for(const url of ['/api/history','/api/history/export'])assert.equal((await call(url)).status,409);const s=(await call('/api/state')).data;assert.deepEqual(s.attempts,[]);assert.deepEqual(s.exams,[]);assert.deepEqual(s.errors,[]);}finally{await exam.restore(exam.revision);}
});
