import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{recordAttempt,emptyState,makePlan,type Task}from'../lib/engine.ts';
test('ERR-01: simple successes never close an unrelated complex mistake',()=>{
 const state=emptyState(),topic={id:'fractions',track:'base' as const,title:{ru:'Дроби',kk:'Бөлшектер'}};
 const condition=(id:string)=>{const n=id.charCodeAt(0);return{ru:`${n}/${n}`,kk:`${n}/${n}`};};
 const task=(id:string,difficulty:number):Task=>({id,topicId:topic.id,type:'number',difficulty,answer:'1',prompt:condition(id),hints:{ru:[],kk:[]},solution:{ru:[],kk:[]}});
 const hard=task('hard',3),easy=[task('a',1),task('b',1),task('c',1)];recordAttempt(state,hard,topic,{answer:'0'},[hard,...easy]);
 for(const t of easy)recordAttempt(state,t,topic,{answer:'1'},[hard,...easy]);assert.equal(state.errors[0].resolved,false);
});
test('MAST-02: one mistake keeps previous mastery evidence and schedules a focused check',()=>{
 const state=emptyState(),now=new Date('2026-10-06T09:00:00Z'),topic={id:'linear',track:'profile' as const,title:{ru:'Линейные уравнения',kk:'Сызықтық теңдеулер'}};
 const known=['old-a','old-b','old-c','old-d'];state.progress.linear={attempts:8,correct:8,independent:4,independentTaskIds:[...known],confirmationTaskIds:[...known],mastered:true,reviewPassed:true,masteryRewarded:true};state.xp=100;
 const task:Task={id:'sign-check',topicId:'linear',type:'number',difficulty:2,answer:'4',prompt:{ru:'2x + 3 = 11',kk:'2x + 3 = 11'},hints:{ru:[],kk:[]},solution:{ru:['x=4'],kk:['x=4']}};
 recordAttempt(state,task,topic,{answer:'7',steps:'2x + 3 = 11\n2x = 14'},[task],now);
 assert.equal(state.progress.linear.mastered,true);assert.deepEqual(state.progress.linear.confirmationTaskIds,known);assert.equal(state.progress.linear.needsRecovery,true);assert.equal(state.xp,100);
 const plan=makePlan(state,[topic],now);assert.equal(plan[0].topicId,'linear');assert.equal(plan[0].type,'repair');assert.match(plan[0].reason.ru,/подтверждение.*сохранено/);
});
test('MAST-02: unrelated review cannot clear recovery; an assigned exact repair preserves the one-time mastery reward',()=>{
 const state=emptyState(),topic={id:'linear',track:'profile' as const,title:{ru:'Уравнения',kk:'Теңдеулер'}};
 state.progress.linear={attempts:8,correct:8,independent:4,independentTaskIds:['a','b','c','d'],confirmationTaskIds:['a','b','c','d'],mastered:true,reviewPassed:true,masteryRewarded:true};
 const condition=(id:string)=>{const n=id.charCodeAt(0);return{ru:`x+${n}=${n+4}`,kk:`x+${n}=${n+4}`};};
 const task=(id:string):Task=>({id,topicId:'linear',prompt:condition(id),type:'number',difficulty:2,answer:'4',hints:{ru:[],kk:[]},solution:{ru:[],kk:[]}}),bad=task('bad'),repair={...task('repair'),repairsTaskIds:['bad']},unrelated=task('unrelated'),now=new Date('2026-10-06T09:00:00Z');
 recordAttempt(state,bad,topic,{answer:'0'},[bad,repair,unrelated],now);state.errors[0].exerciseIds=['repair'];
 recordAttempt(state,unrelated,topic,{answer:'4',reviewId:state.reviews[0].id},[bad,repair,unrelated],new Date('2026-10-07T10:00:00Z'));assert.equal(state.progress.linear.needsRecovery,true);assert.equal(state.errors[0].resolved,false);
 recordAttempt(state,repair,topic,{answer:'4'},[bad,repair,unrelated],new Date('2026-10-07T11:00:00Z'));assert.equal(state.progress.linear.needsRecovery,false);assert.equal(state.errors[0].resolved,true);assert.equal(state.progress.linear.mastered,true);assert.equal(state.xp,25);assert.equal(state.progress.linear.masteryRewarded,true);
});
