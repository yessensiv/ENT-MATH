import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishedContent, response, failure, trackValue, loadCurrentState,saveState,ApiError,assertStudyAllowed } from "@/lib/server-store";
import { diagnosticTasks, sanitizeTask } from "@/lib/engine";
import{beginDiagnostic}from'@/lib/diagnostic-session';
export async function GET(request:Request){try{
 const track=trackValue(new URL(request.url).searchParams.get('track')||'profile'),{topics,tasks}=await publishedContent(),user=await getChatGPTUser();
 if(!user)return response({track,demo:true,notice:'Для независимой диагностики войдите в аккаунт.',tasks:diagnosticTasks(track,topics,tasks).map(sanitizeTask)});
 for(let retry=0;retry<3;retry++){const {state}=await loadCurrentState(user);assertStudyAllowed(state);const before=JSON.stringify(state.diagnosticSession);let questions;
  try{questions=beginDiagnostic(state,track,topics,tasks);}catch{throw new ApiError('Для новой диагностики недостаточно ещё не встречавшихся заданий. Практика доступна; редактору нужно расширить контрольный банк.',409,'DIAGNOSTIC_POOL_EXHAUSTED');}
  if(before!==JSON.stringify(state.diagnosticSession))try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}
  return response({track,version:state.diagnosticSession?2:1,tasks:questions.map(sanitizeTask),evidenceScope:'topic',notice:'Результат предварительный: подробная оценка по отдельным навыкам требует дополнительного контроля.'});
 }throw new ApiError('Повторите запрос диагностики.',409,'STATE_CONFLICT');
 }catch(e){return failure(e);}}
