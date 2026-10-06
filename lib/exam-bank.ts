// Server module: never import this reserve into a client component.
import reserve from'./exam-reserve-data.json' with {type:'json'};
// @ts-expect-error Native tests.
import{EXAM_RULES,taskFingerprint,type Exam,type LearnerState,type Task,type Track}from'./engine.ts';
export const examBankVersion=reserve.version;
export function reservedExam(track:Track,variant:number,state?:LearnerState,now=new Date()):Exam{
 if(track==='base'||!Number.isInteger(variant)||variant<1||variant>10)throw Error('Выберите профильную математику или грамотность и вариант 1–10.');
 const bank=reserve.variants[track].find(v=>v.variant===variant);if(!bank)throw Error('EXAM_RESERVE_MISSING');
 const questions=structuredClone(bank.questions) as unknown as Task[],familiar=new Set<string>();
 if(state){
  for(const exam of state.exams)for(const t of exam.questions)familiar.add(taskFingerprint(t));
  // Conservative: a previously generated practice condition may have appeared
  // before this reserve was introduced, even without a submitted answer.
  for(const t of (state.generatedTasks||[]) as Task[])familiar.add(taskFingerprint(t));
  for(const a of state.attempts)if(a.taskSnapshot)familiar.add(taskFingerprint({...a.taskSnapshot,id:a.taskId,topicId:a.topicId} as Task));
 }
 return{id:crypto.randomUUID(),track,variant,startedAt:now.toISOString(),durationMinutes:track==='profile'?80:20,questions,answers:{},flagged:[],rules:structuredClone(EXAM_RULES),bankVersion:examBankVersion,familiarQuestionIds:questions.filter(t=>familiar.has(taskFingerprint(t))).map(t=>t.id)};
}
