// @ts-expect-error Native Node tests.
import{evidenceAnalytics}from'./evidence-analytics.ts';
// Aggregates are computed from complete history before the browser receives a page.
// @ts-expect-error Native Node regression tests require explicit extensions.
import{dayKey,weekStart,type LearnerState}from'./engine.ts';
// @ts-expect-error Native Node regression tests require explicit extensions.
import{returnedToChallenge}from'./client-flow.ts';
export function historySummary(state:LearnerState,now=new Date()){
 const tracks=Object.fromEntries(['base','profile','literacy'].map(t=>[t,{attempts:0,independentCorrect:0}]));
 const week=weekStart(dayKey(now)),weekly={attempts:0,independentCorrect:0},recentByTopic:Record<string,boolean[]>={};
 for(const a of state.attempts){const s=tracks[a.track];if(s){s.attempts++;if(a.correct&&!a.assisted)s.independentCorrect++;}
  if(Number.isFinite(Date.parse(a.at))&&dayKey(new Date(a.at))>=week&&Date.parse(a.at)<=now.getTime()){weekly.attempts++;if(a.correct&&!a.assisted)weekly.independentCorrect++;}
  const recent=recentByTopic[a.topicId]||[];recent.push(a.correct);recentByTopic[a.topicId]=recent.slice(-3);
 }
 return{version:2,evidence:evidenceAnalytics(state,now),tracks,weekly,needsRest:Object.fromEntries(Object.entries(recentByTopic).map(([id,list])=>[id,list.length===3&&list.every(v=>!v)])),returnedToChallenge:returnedToChallenge(state.attempts)};
}
