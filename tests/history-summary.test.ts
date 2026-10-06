import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node imports.
import{historySummary}from'../lib/history-summary.ts';
// @ts-expect-error Native Node imports.
import{emptyState,type Attempt}from'../lib/engine.ts';
test('statistics use complete history across tracks, assistance, calendar weeks and challenges',()=>{const s=emptyState();s.attempts=Array.from({length:150},(_,i)=>({id:String(i),topicId:'x',track:'profile',correct:i>1,assisted:i===2,at:'2026-10-05T09:00:00Z'} as Attempt));s.attempts.push({id:'old',topicId:'y',track:'base',correct:true,assisted:false,at:'2026-09-28T09:00:00Z'} as Attempt);const stats=historySummary(s,new Date('2026-10-06T10:00:00Z'));assert.equal(stats.tracks.profile.attempts,150);assert.equal(stats.weekly.attempts,150);assert.equal(stats.weekly.independentCorrect,147);assert.equal(stats.returnedToChallenge,true);assert.equal(stats.tracks.base.attempts,1);assert.equal(stats.needsRest.x,false);});
