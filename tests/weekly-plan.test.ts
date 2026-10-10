import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native tests.
import{emptyState,makePlan}from'../lib/engine.ts';
const topics=[{id:'fractions',track:'base' as const,title:{ru:'Дроби',kk:'Бөлшектер'},minutes:12},{id:'linear',track:'profile' as const,title:{ru:'Уравнения',kk:'Теңдеулер'},prerequisites:['fractions'],minutes:12}];

test('completed reading schedules independent practice without granting mastery',()=>{
 const s=emptyState();s.profile={name:'Test',grade:'11',track:'base',examDate:'2027-06-01',target:40,dailyMinutes:20,language:'ru'};
 s.lessonCompletions={fractions:{at:'2026-10-09T00:00:00Z'}};
 const plan=makePlan(s,topics,new Date('2026-10-09T08:00:00Z'));
 assert.equal(plan.find(item=>item.topicId==='fractions')?.type,'practice');
 assert.match(plan.find(item=>item.topicId==='fractions')?.reason.ru??'',/Урок завершён/);
 assert.deepEqual(s.progress,{});assert.equal(s.xp,0);
});
test('PLAN-01: each day fits 5–240 minute budgets within 20%, with short separate practice',()=>{
 for(const dailyMinutes of [5,7,10,15,20,30,45,60,120,240]){
  const s=emptyState();s.profile={name:'Local test',grade:'11',track:'profile',examDate:'2027-06-01',target:40,dailyMinutes,language:'ru'};
  const plan=makePlan(s,topics,new Date('2026-10-06T08:00:00Z'));
  assert.equal(plan[0].topicId,'fractions');for(let day=1;day<=7;day++){const daily=plan.filter(p=>p.day===day),total=daily.reduce((n,p)=>n+p.minutes,0);assert.ok(total>=dailyMinutes*.8&&total<=dailyMinutes,`${dailyMinutes} min, day ${day}: ${total}`);assert.ok(daily.every(p=>p.minutes>=5&&p.minutes<=15));}
  assert.ok(plan.some(p=>p.type==='practice')||dailyMinutes<=12);
 }
});
test('PLAN-01: missing a week rebuilds seven days without accumulating overdue workload or modifying results',()=>{
 const s=emptyState();s.profile={name:'Local test',grade:'11',track:'profile',examDate:'2027-06-01',target:40,dailyMinutes:30,language:'ru'};
 for(let i=0;i<15;i++)s.reviews.push({id:'r'+i,topicId:'fractions',due:'2026-09-01T00:00:00Z',interval:1,completed:false});
 const before=JSON.stringify(s),a=makePlan(s,topics,new Date('2026-10-06T08:00:00Z')),b=makePlan(s,topics,new Date('2026-10-13T08:00:00Z'));
 assert.equal(a[0].type,'review');assert.equal(b[0].type,'review');assert.ok(b.every(p=>p.day<=7));assert.ok(b.filter(p=>p.day===1).reduce((n,p)=>n+p.minutes,0)<=30);assert.equal(JSON.stringify(s),before);
});
