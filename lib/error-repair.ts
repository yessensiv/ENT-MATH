// @ts-expect-error Native Node tests.
import {makePracticeVariant,validatePracticeVariant} from './practice-variants.ts';
// @ts-expect-error Native Node tests.
import{isModelExample,seenTaskIds,taskFingerprint,type LearnerState,type Task,type ErrorEntry}from'./engine.ts';
// @ts-expect-error Native Node tests.
import{repairSkillTitle,repairCatalogVersion}from'./repair-catalog.ts';
import type{ReviewGenerator}from'./fresh-tasks.ts';

/** Assign new verified conditions of an explicitly reviewed method. A task
 * match checks the skill; it does not diagnose why the learner was wrong. */
export function assignErrorRepairs(state:LearnerState,error:ErrorEntry,bank:Task[],generator:ReviewGenerator){
 const completedReserve=state.exams.filter(e=>e.finishedAt&&e.bankVersion).flatMap(e=>e.questions.filter(t=>t.purpose==='exam'));
 const generated=(state.generatedTasks||[]) as Task[],all=[...bank,...generated,...completedReserve];
 const original=all.find(t=>t.id===error.taskId),skillId=original?.repairSkillId;
 if(original?.variant&&validatePracticeVariant(original)&&JSON.stringify(error.prompt)===JSON.stringify(original.prompt)&&JSON.stringify(error.correctAnswer)===JSON.stringify(original.answer)){
  if(error.resolved)return{changed:false,tasks:[] as Task[],status:'complete' as const};
  const spec=original.variant as {seed:number;level:1|2|3},seen=seenTaskIds(state),fingerprints=new Set(all.map(taskFingerprint));
  const selected=generated.filter(t=>t.repairForErrorId===error.id&&!seen.has(t.id));
  const needed=Math.max(0,2-(error.repairPassedTaskIds?.length||0));let changed=false;
  for(let offset=1;selected.length<needed&&offset<=10000;offset++){
   const task=makePracticeVariant(original.topicId,(spec.seed+offset*137-1)%10000+1,spec.level);
   if(!task||task.answer===original.answer||selected.some(t=>t.answer===task.answer)||fingerprints.has(taskFingerprint(task))||!validatePracticeVariant(task))continue;
   task.repairForErrorId=error.id;task.repairsTaskIds=[original.id];task.reviewReserved=true;
   generated.push(task);selected.push(task);fingerprints.add(taskFingerprint(task));changed=true;
  }
  error.exerciseIds=[...new Set([...error.exerciseIds,...selected.map(t=>t.id)])];error.repairRequired=2;error.repairVersion='variant-formulas-v1';error.repairSkill=typeof original.skill==='object'?original.skill:undefined;state.generatedTasks=generated;
  return{changed,tasks:selected.slice(0,needed),status:selected.length>=needed?'ready' as const:'exhausted' as const};
 }

 if(!original||!repairSkillTitle(skillId)||!error.prompt||JSON.stringify(error.prompt)!==JSON.stringify(original.prompt)||JSON.stringify(error.correctAnswer)!==JSON.stringify(original.answer)||JSON.stringify(error.solution)!==JSON.stringify(original.solution))return{changed:false,tasks:[] as Task[],status:'unmapped' as const};
 const seen=seenTaskIds(state),passed=new Set(error.repairPassedTaskIds||[]),needed=Math.max(0,2-passed.size);
 const selected=generated.filter(t=>error.exerciseIds.includes(t.id)&&t.repairSkillId===skillId&&Array.isArray(t.repairsTaskIds)&&t.repairsTaskIds.includes(error.taskId)&&!seen.has(t.id)&&!isModelExample(t));
 if(error.resolved||needed===0)return{changed:false,tasks:[],status:'complete' as const};
 let changed=false;
 const serials={...(state.reviewSerials as Record<string,number>||{})},level=original.difficulty as 1|2|3,key=`${original.topicId}:${level}`;
 const fingerprints=new Set([...all,...state.exams.flatMap(e=>e.questions)].map(taskFingerprint));
 let serial=serials[key]||0;
 while(selected.length<needed&&serial<generator.reviewCapacity(original.topicId,level)){
  serial++;serials[key]=serial;changed=true;
  const raw=generator.generateReviewTask(original.topicId,serial,level);if(!raw||!generator.validateGeneratedTask(raw).valid)continue;
  const t=raw as Task&{unit?:string};
  if(t.repairSkillId!==skillId||seen.has(t.id)||fingerprints.has(taskFingerprint(t)))continue;
  const task:Task={...t,difficulty:level,units:t.unit||t.units,modelExample:false,reviewReserved:true,repairsTaskIds:[error.taskId],repairForErrorId:error.id};
  generated.push(task);selected.push(task);fingerprints.add(taskFingerprint(task));
 }
 const ids=[...new Set([...(error.exerciseIds||[]),...selected.map(t=>t.id)])];
 if(error.repairRequired!==2||JSON.stringify(ids)!==JSON.stringify(error.exerciseIds)){error.exerciseIds=ids;error.repairRequired=2;error.repairVersion=repairCatalogVersion;error.repairSkill=repairSkillTitle(skillId);changed=true;}
 if(changed){state.generatedTasks=generated;state.reviewSerials=serials;}
 return{changed,tasks:selected.slice(0,needed),status:selected.length>=needed?'ready' as const:'exhausted' as const};
}
