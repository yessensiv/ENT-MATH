// @ts-expect-error Native tests.
import{dayKey,shiftDay,type LearnerState,type Track}from'./engine.ts';
type Count={total:number;correct:number};
const count=():Count=>({total:0,correct:0});
const add=(c:Count,correct:boolean)=>{c.total++;c.correct+=Number(correct);};
export function evidenceAnalytics(state:LearnerState,now=new Date()){
 const end=dayKey(now),start=shiftDay(end,-6),previousStart=shiftDay(start,-7),previousEnd=shiftDay(start,-1);
 const tracks=Object.fromEntries((['base','profile','literacy'] as Track[]).map(track=>[track,{
  independent:count(),current:count(),previous:count(),excluded:{help:0,repeat:0,example:0,legacy:0},
  levels:{'1':count(),'2':count(),'3':count()},
  comparisons:[] as {topicId:string;skillIds:string[];difficulty:number;method:string;current:Count;previous:Count}[],
  exams:[] as {id:string;variant:number;at:string;score:number;maxScore:number;familiar:number|null;bankVersion?:string;ruleVersion?:string}[],
 }]));
 const ids=new Set<string>(),conditions=new Set<string>();
 const buckets=new Map<string,{track:Track;topicId:string;skillIds:string[];difficulty:number;method:string;current:Count;previous:Count}>();
 for(const a of state.attempts.slice().sort((a,b)=>a.at.localeCompare(b.at))){
  const out=tracks[a.track];if(!out||!Number.isFinite(Date.parse(a.at))||Date.parse(a.at)>now.getTime())continue;
  const e=a.evidence;
  // Old attempts remain in history/activity; no invented independence evidence.
  if(!e||e.schema!==1){out.excluded.legacy++;ids.add(a.taskId);continue;}
  const duplicate=ids.has(a.taskId)||conditions.has(e.condition);ids.add(a.taskId);conditions.add(e.condition);
  if(!e.independent||a.assisted||duplicate){
   const reason=duplicate?'repeat':e.reason==='help'?'help':e.reason==='worked-example'?'example':'repeat';out.excluded[reason]++;continue;
  }
  add(out.independent,a.correct);if([1,2,3].includes(e.difficulty))add(out.levels[String(e.difficulty) as '1'|'2'|'3'],a.correct);
  const day=dayKey(new Date(a.at)),period=day>=start&&day<=end?'current':day>=previousStart&&day<=previousEnd?'previous':null;
  if(!period)continue;add(out[period],a.correct);
  // Compare only the same subject, method, marked skills, difficulty and checker.
  // Missing skill/method mapping cannot be promoted into a skill-growth claim.
  if(!e.methodFamily||!e.skillIds.length)continue;
  const skillIds=[...e.skillIds].sort(),key=JSON.stringify([a.track,a.topicId,skillIds,e.methodFamily,e.difficulty,a.taskVersion,a.checkingVersion]);
  const bucket=buckets.get(key)||{track:a.track,topicId:a.topicId,skillIds,difficulty:e.difficulty,method:e.methodFamily,current:count(),previous:count()};
  add(bucket[period],a.correct);buckets.set(key,bucket);
 }
 for(const b of buckets.values())if(b.current.total&&b.previous.total){const{track,...row}=b;tracks[track].comparisons.push(row);}
 for(const out of Object.values(tracks))out.comparisons.sort((a,b)=>a.topicId.localeCompare(b.topicId)||a.difficulty-b.difficulty);
 for(const e of state.exams){const out=tracks[e.track];if(!out||!e.finishedAt)continue;out.exams.push({id:e.id,variant:e.variant,at:e.finishedAt,score:e.score??0,maxScore:e.maxScore??0,familiar:e.bankVersion&&Array.isArray(e.familiarQuestionIds)?e.familiarQuestionIds.length:null,bankVersion:e.bankVersion,ruleVersion:e.rules.scoring?.id});}
 for(const out of Object.values(tracks))out.exams=out.exams.slice(-10);
 const reviews={completed:state.reviews.filter(r=>r.completed).length,due:state.reviews.filter(r=>!r.completed&&Date.parse(r.due)<=now.getTime()).length,planned:state.reviews.filter(r=>!r.completed&&Date.parse(r.due)>now.getTime()).length};
 return{version:1,periods:{current:{start,end},previous:{start:previousStart,end:previousEnd}},tracks,reviews};
}
export type EvidenceAnalytics=ReturnType<typeof evidenceAnalytics>;
