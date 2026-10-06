import{loadCurrentState,saveState,ApiError}from'@/lib/server-store';
import type{ChatGPTUser}from'@/app/chatgpt-auth';import type{LearnerState}from'@/lib/engine';import type{TutorHistoryState}from'@/lib/tutor-history';
export async function changeTutorState<T>(user:ChatGPTUser,change:(state:LearnerState&TutorHistoryState)=>{changed:boolean;value:T}){
 for(let retry=0;retry<3;retry++){const {state}=await loadCurrentState(user);const result=change(state as LearnerState&TutorHistoryState);if(!result.changed)return result.value;try{await saveState(user,state);return result.value;}catch(e){if(!(e instanceof ApiError&&e.code==='STATE_CONFLICT')||retry===2)throw e;}}
 throw new ApiError('Повторите запрос наставнику.',409,'STATE_CONFLICT');
}
