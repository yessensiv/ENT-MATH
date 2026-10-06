export const TUTOR_PROMPT_VERSION='ent-tutor-2026-10-06.2';
export type TutorGeneration={id:string;fingerprint:string;context:string;startedAt:string;status:'pending'|'completed';result?:Record<string,unknown>;model?:string;promptVersion:string;inputTokens?:number;outputTokens?:number;latencyMs?:number;selection?:{kind:string;index?:number;stepIndex?:number};materialVersion?:string};
export type TutorMessage={id:string;generationId:string;context:string;role:'user'|'assistant';content:string;at:string};
export type TutorHistoryState={tutorGenerations?:Record<string,TutorGeneration>;tutorMessages?:TutorMessage[]};
export function claimTutorMessage(state:TutorHistoryState,id:string,fingerprint:string,context:string,message:string,now=new Date()){
 const existing=state.tutorGenerations?.[id];if(existing){if(existing.fingerprint!==fingerprint)throw Error('TUTOR_MESSAGE_CONFLICT');return existing;}
 const generation:TutorGeneration={id,fingerprint,context,startedAt:now.toISOString(),status:'pending',promptVersion:TUTOR_PROMPT_VERSION};
 (state.tutorGenerations||={})[id]=generation;(state.tutorMessages||=[]).push({id:`${id}:user`,generationId:id,context,role:'user',content:message,at:now.toISOString()});return generation;
}
export function completeTutorMessage(state:TutorHistoryState,id:string,result:Record<string,unknown>,usage?:{model:string;inputTokens?:number;outputTokens?:number},now=new Date()){
 const generation=state.tutorGenerations?.[id];if(!generation)throw Error('TUTOR_MESSAGE_MISSING');if(generation.status==='completed')return generation.result!;
 generation.status='completed';generation.result=result;generation.latencyMs=now.getTime()-Date.parse(generation.startedAt);if(usage)Object.assign(generation,usage);
 (state.tutorMessages||=[]).push({id:`${id}:assistant`,generationId:id,context:generation.context,role:'assistant',content:String(result.reply||''),at:now.toISOString()});return result;
}
export function tutorHistory(state:TutorHistoryState,context:string,before?:string){const messages=(state.tutorMessages||[]).filter(m=>m.context===context);const index=before?messages.findIndex(m=>m.id===before):messages.length;const end=index<0?0:index,start=Math.max(0,end-40);return{messages:messages.slice(start,end),before:start?messages[start].id:null};}
