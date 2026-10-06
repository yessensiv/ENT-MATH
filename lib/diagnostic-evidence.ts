import type {Answer,LearnerState,Task} from './engine.ts';
// @ts-expect-error Native Node tests.
import {checkAnswer,taskFingerprint} from './engine.ts';
// @ts-expect-error Native Node tests.
import {repairSkillTitle} from './repair-catalog.ts';

export type DiagnosticEvidence={topicId:string;skillId?:string;correct:number;incorrect:number;unknown:number;total:number;status:'supported'|'mixed'|'gap'|'unknown'|'preliminary'};
/** Counts describe the tested method only. They never award mastery or XP. */
export function diagnosticEvidence(tasks:Task[],answers:Map<string,Answer>){
 const groups=new Map<string,DiagnosticEvidence>(),conditions=new Set<string>();let score=0;
 for(const task of tasks){
  const skillId=typeof task.repairSkillId==='string'&&repairSkillTitle(task.repairSkillId)?task.repairSkillId:undefined;
  const key=skillId??task.topicId,row=groups.get(key)??{topicId:task.topicId,skillId,correct:0,incorrect:0,unknown:0,total:0,status:'unknown' as const};
  const answer=answers.get(task.id),condition=taskFingerprint(task);
  const verdict=answer===undefined||(Array.isArray(answer)?!answer.length:!answer.trim())||conditions.has(condition)?'review':checkAnswer(task,answer).status;
  conditions.add(condition);row.total++;
  if(verdict==='correct'){row.correct++;score++;}else if(verdict==='incorrect')row.incorrect++;else row.unknown++;
  groups.set(key,row);
 }
 const evidence=[...groups.values()].map(row=>({...row,status:(row.incorrect?(row.correct?'mixed':'gap'):row.unknown?'unknown':row.correct>=3?'supported':'preliminary') as DiagnosticEvidence['status']}));
 const topicIds=[...new Set(tasks.map(t=>t.topicId))];
 const gaps=topicIds.filter(id=>evidence.some(e=>e.topicId===id&&e.incorrect>0));
 const unknowns=topicIds.filter(id=>!gaps.includes(id)&&evidence.some(e=>e.topicId===id&&e.unknown>0));
 const strengths=topicIds.filter(id=>!gaps.includes(id)&&!unknowns.includes(id)&&evidence.some(e=>e.topicId===id&&e.correct>0));
 return{score,evidence,strengths,gaps,unknowns};
}

/** Latest evidence per method in the current route; historical courses stay separate. */
export function currentDiagnosticEvidence(state:LearnerState){
 const grade=state.profile?.learningMode==='school'?state.profile.grade:undefined,latest=new Map<string,DiagnosticEvidence>();
 for(const d of state.diagnostics){
  if(d.track!==(state.profile?.track??'profile')||d.schoolGrade!==grade||(grade&&Number(grade)>=10&&(d.schoolPathway??'natural-math')!==(state.profile?.schoolPathway??'natural-math')))continue;
  for(const e of d.evidence??[])if(e.skillId)latest.set(e.skillId,e);
 }
 return [...latest.values()];
}
