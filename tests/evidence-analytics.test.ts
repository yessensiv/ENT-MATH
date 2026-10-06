import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native tests.
import{emptyState,recordAttempt,type Task,type Attempt,type Topic}from'../lib/engine.ts';
// @ts-expect-error Native tests.
import{evidenceAnalytics}from'../lib/evidence-analytics.ts';
const topic:Topic={id:'linear',track:'profile',title:{ru:'Уравнения',kk:'Теңдеулер'}};
function task(id:string,n=1):Task{return{id,version:'reviewed-method-v1',topicId:'linear',type:'number',difficulty:1,prompt:{ru:`x+${n}=${n+4}`,kk:`x+${n}=${n+4}`},answer:'4',hints:{ru:[],kk:[]},solution:{ru:['x=4'],kk:['x=4']},skillIds:['linear:method-1'],methodFamily:'linear:method-1'};}
test('copying a condition under a new ID does not add independent mastery or XP',()=>{
 const s=emptyState(),a=task('first'),b=task('renamed'),c=task('new-condition',2);
 recordAttempt(s,a,topic,{answer:'4'},[a,b,c]);const xp=s.xp;
 assert.equal(recordAttempt(s,b,topic,{answer:'4'},[a,b,c]).independentEligible,false);
 assert.equal(s.xp,xp);assert.equal(s.attempts[1].evidence?.reason,'repeat');
 assert.equal(recordAttempt(s,c,topic,{answer:'4'},[a,b,c]).independentEligible,true);
 assert.equal(s.progress.linear.independent,2);
});
test('evidence keeps assistance, familiar tasks, worked examples and incomplete archives outside accuracy',()=>{
 const s=emptyState(),date=new Date('2026-10-06T10:00:00Z');
 for(let n=1;n<=4;n++){const q=task('q'+n,n);if(n===3)q.modelExample=true;recordAttempt(s,q,topic,{answer:n===4?'8':'4',assisted:n===2},[q],date);}
 const duplicate=task('copy',1);recordAttempt(s,duplicate,topic,{answer:'4'},[duplicate],date);
 s.attempts.push({id:'old',taskId:'archive',topicId:'linear',track:'profile',correct:true,assisted:false,at:date.toISOString()} as Attempt);
 const stats=evidenceAnalytics(s,date).tracks.profile;
 assert.deepEqual(stats.independent,{total:2,correct:1});assert.deepEqual(stats.current,{total:2,correct:1});
 assert.deepEqual(stats.excluded,{help:1,repeat:1,example:1,legacy:1});assert.equal(s.attempts.length,6);
});
test('comparison separates checker, method, difficulty and periods, using Kazakhstan date boundaries',()=>{
 const s=emptyState(),dates=['2026-09-25T10:00:00Z','2026-09-30T10:00:00Z'];let n=0;
 for(const date of dates)for(let i=0;i<5;i++){const q=task('new-'+(++n),n);recordAttempt(s,q,topic,{answer:i<2||date===dates[1]?'4':'0'},[q],new Date(date));}
 const changed=task('other-method',90);changed.methodFamily='linear:method-2';recordAttempt(s,changed,topic,{answer:'4'},[changed],new Date('2026-10-06T18:59:59Z'));
 const future=task('next-day',91);recordAttempt(s,future,topic,{answer:'4'},[future],new Date('2026-10-06T19:00:00Z'));
 const stats=evidenceAnalytics(s,new Date('2026-10-06T18:59:59Z'));
 assert.deepEqual(stats.periods,{current:{start:'2026-09-30',end:'2026-10-06'},previous:{start:'2026-09-23',end:'2026-09-29'}});
 assert.equal(stats.tracks.profile.current.total,6);assert.equal(stats.tracks.profile.comparisons.length,1);
 const c=stats.tracks.profile.comparisons[0];assert.deepEqual(c.previous,{total:5,correct:2});assert.deepEqual(c.current,{total:5,correct:5});
 s.attempts[5].checkingVersion='another-checker';assert.equal(evidenceAnalytics(s,new Date('2026-10-06T18:59:59Z')).tracks.profile.comparisons[0].current.total,4);
});
