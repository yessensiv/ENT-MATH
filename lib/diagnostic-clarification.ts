import type{LearnerState,Task,Topic,Track}from'./engine.ts';
import type{ReviewGenerator}from'./fresh-tasks.ts';
// @ts-expect-error Native Node tests.
import{taskFingerprint,seenTaskIds,isModelExample}from'./engine.ts';
// @ts-expect-error Native Node tests.
import{repairSkillTitle,reviewedTaskMetadata}from'./repair-catalog.ts';
// @ts-expect-error Native Node tests.
import{diagnosticScope,assignedDiagnostic,type DiagnosticSession}from'./diagnostic-session.ts';

/** Five independent conditions for the same narrowly catalogued method.
 * Stages remain separate from mastery and the delayed review schedule. */
export function beginClarification(state:LearnerState,track:Track,skillId:string,topics:Topic[],bank:Task[],generator:ReviewGenerator){
 const generated=(state.generatedTasks??[]) as Task[],all=[...bank,...generated];
 const existing=assignedDiagnostic(state,track,topics,all);
 if(existing){if((state.diagnosticSession as DiagnosticSession)?.skillId!==skillId)throw Error('DIAGNOSTIC_IN_PROGRESS');return existing;}
 const grade=state.profile?.learningMode==='school'?state.profile.grade:undefined;
 const offered=state.diagnostics.some(d=>d.track===track&&d.schoolGrade===grade&&(!grade||Number(grade)<10||(d.schoolPathway??'natural-math')===(state.profile?.schoolPathway??'natural-math'))&&d.evidence?.some(e=>e.skillId===skillId));
 if(!repairSkillTitle(skillId)||!offered)throw Error('DIAGNOSTIC_SKILL_NOT_OFFERED');
 const [topicId,method]=skillId.split(':method-'),level=Number(method) as 1|2|3,topic=topics.find(t=>t.id===topicId);
 if(!topic)throw Error('DIAGNOSTIC_MATERIAL_MISSING');
 const seen=seenTaskIds(state),conditions=new Set([...all.filter(t=>seen.has(t.id)||isModelExample(t,topic)),...state.exams.flatMap(e=>e.questions)].map(taskFingerprint));
 for(const a of state.attempts)if(a.evidence?.condition)conditions.add(a.evidence.condition);
 const questions:Task[]=[];
 for(const t of all){if(t.topicId!==topicId||t.repairSkillId!==skillId||t.reviewReserved||conditions.has(taskFingerprint(t)))continue;questions.push(t);conditions.add(taskFingerprint(t));if(questions.length===5)break;}
 // Avoid collisions with every authored/reserved condition, not only exposed ones.
 const allConditions=new Set([...all,...questions].map(taskFingerprint)),additions:Task[]=[];
 const serials={...(state.reviewSerials as Record<string,number>??{})},key=`${topicId}:${level}`;
 let serial=serials[key]??0;
 while(questions.length<5&&serial<generator.reviewCapacity(topicId,level)){
  const raw=generator.generateReviewTask(topicId,++serial,level);
  if(!raw||!generator.validateGeneratedTask(raw).valid)continue;
  const candidate=raw as Task,condition=taskFingerprint(candidate);
  if(conditions.has(condition)||allConditions.has(condition)||all.some(t=>t.id===candidate.id))continue;
  const task={...candidate,...reviewedTaskMetadata(topicId,level),difficulty:level,units:candidate.unit as string|undefined??candidate.units,modelExample:false,reviewReserved:false};
  conditions.add(condition);allConditions.add(condition);questions.push(task);additions.push(task);
 }
 if(questions.length<3)throw Error('DIAGNOSTIC_POOL_EXHAUSTED');
 serials[key]=serial;state.reviewSerials=serials;state.generatedTasks=[...generated,...additions];
 state.diagnosticSession={version:3,skillId,track,scope:diagnosticScope(state,track),taskIds:questions.map(t=>t.id),startedAt:new Date().toISOString()} satisfies DiagnosticSession;
 state.diagnosticExposures=[...new Set([...(state.diagnosticExposures as string[]??[]),...questions.map(t=>t.id)])];
 return questions;
}
