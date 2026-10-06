// @ts-expect-error Native Node tests.
import{seenTaskIds,isModelExample,diagnosticTasks as legacyDiagnosticTasks,type LearnerState,type Task,type Topic,type Track}from'./engine.ts';
// @ts-expect-error Native Node tests.
import{schoolTopicIds}from'./school-curriculum.ts';
export type DiagnosticSession={version:2;track:Track;scope:string;taskIds:string[];startedAt:string};
export function diagnosticScope(state:LearnerState,track:Track){return[state.profile?.learningMode??'ent',state.profile?.grade??'',state.profile?.schoolPathway??'',track].join(':');}
export function assignedDiagnostic(state:LearnerState,track:Track,topics:Topic[],tasks:Task[]){
 const session=state.diagnosticSession as DiagnosticSession|undefined;
 if(session?.scope===diagnosticScope(state,track))return session.taskIds.map(id=>tasks.find(t=>t.id===id)).filter((t):t is Task=>!!t);
 const draft=state.diagnosticDraft as {track?:Track}|undefined;
 if(draft?.track===track)return legacyDiagnosticTasks(track,topics,tasks,state.profile?.learningMode==='school'?state.profile.grade:undefined,state.profile?.schoolPathway);
 return null;
}
export function beginDiagnostic(state:LearnerState,track:Track,topics:Topic[],tasks:Task[]):Task[]{
 const assigned=assignedDiagnostic(state,track,topics,tasks);if(assigned)return assigned;
 const school=state.profile?.learningMode==='school'?new Set(schoolTopicIds(state.profile.grade,state.profile.schoolPathway)):null;
 const relevant=topics.filter(t=>school?school.has(t.id):!t.schoolOnly&&(t.track===track||(track==='profile'&&t.track==='base')));
 const seen=seenTaskIds(state),byTopic=new Map(relevant.map(t=>[t.id,t]));
 const pool=tasks.filter(t=>byTopic.has(t.topicId)&&!seen.has(t.id)&&!isModelExample(t,byTopic.get(t.topicId))&&!t.reviewReserved);
 const desired=track==='base'?14:18,questions:Task[]=[];
 // Spread the first round across the course; subsequent rounds refine the same
 // broad areas. Atomic-skill confidence still requires the reviewed curriculum.
 const ids=relevant.map(t=>t.id),stride=Math.max(1,Math.floor(ids.length/desired));
 const ordered=[...ids.filter((_,i)=>i%stride===0),...ids.filter((_,i)=>i%stride!==0)];
 for(let round=0;round<3&&questions.length<desired;round++)for(const id of ordered){if(questions.length>=desired)break;const level=round===0&&questions.length%3!==2?1:2;const next=pool.filter(t=>t.topicId===id&&!questions.some(q=>q.id===t.id)).sort((a,b)=>Math.abs(a.difficulty-level)-Math.abs(b.difficulty-level))[0];if(next)questions.push(next);}
 if(questions.length<12)throw Error('DIAGNOSTIC_POOL_EXHAUSTED');
 state.diagnosticSession={version:2,track,scope:diagnosticScope(state,track),taskIds:questions.map(t=>t.id),startedAt:new Date().toISOString()} satisfies DiagnosticSession;
 state.diagnosticExposures=[...new Set([...(Array.isArray(state.diagnosticExposures)?state.diagnosticExposures as string[]:[]),...questions.map(t=>t.id)])];
 return questions;
}
