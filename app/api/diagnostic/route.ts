import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishedContent, response, failure, trackValue, loadCurrentState,saveState,ApiError,assertStudyAllowed } from "@/lib/server-store";
import { diagnosticTasks, sanitizeTask, type Task } from "@/lib/engine";
import{beginClarification}from'@/lib/diagnostic-clarification';
import{reviewGenerator}from'@/lib/review-generator';
import{beginDiagnostic}from'@/lib/diagnostic-session';
export async function GET(request:Request){try{
 const params=new URL(request.url).searchParams,skillId=params.get('skill'),track=trackValue(params.get('track')||'profile'),{topics,tasks}=await publishedContent(),user=await getChatGPTUser();
 if(!user)return response({track,demo:true,notice:'Для независимой диагностики войдите в аккаунт.',tasks:diagnosticTasks(track,topics,tasks).map(sanitizeTask)});
 for(let retry=0;retry<3;retry++){const {state}=await loadCurrentState(user);assertStudyAllowed(state);const before=JSON.stringify(state.diagnosticSession);let questions;
  try{questions=skillId?beginClarification(state,track,skillId,topics,tasks,reviewGenerator):beginDiagnostic(state,track,topics,[...tasks,...(state.generatedTasks as Task[]??[])]);}catch(e){const code=e instanceof Error?e.message:'';if(code==='DIAGNOSTIC_IN_PROGRESS')throw new ApiError('Сначала завершите начатую диагностику.',409,code);if(code==='DIAGNOSTIC_SKILL_NOT_OFFERED')throw new ApiError('Этот навык ещё не был проверен во входной диагностике.',400,code);if(code==='DIAGNOSTIC_MATERIAL_MISSING')throw new ApiError('Материал начатой диагностики недоступен. Сообщите редактору; сохранённые ответы остаются в аккаунте.',409,code);throw new ApiError('Для новой диагностики недостаточно ещё не встречавшихся заданий. Практика доступна; редактору нужно расширить контрольный банк.',409,'DIAGNOSTIC_POOL_EXHAUSTED');}
  if(before!==JSON.stringify(state.diagnosticSession))try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({track,draft:state.diagnosticDraft??null,version:(state.diagnosticSession as {version?:number})?.version??1,tasks:questions.map(sanitizeTask),evidenceScope:'topic',notice:'Результат предварительный: подробная оценка по отдельным навыкам требует дополнительного контроля.'});
 }throw new ApiError('Повторите запрос диагностики.',409,'STATE_CONFLICT');
 }catch(e){return failure(e);}}
