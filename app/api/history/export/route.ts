import{authenticate,loadCurrentState,failure,assertStudyAllowed}from'@/lib/server-store';
export async function GET(){try{const user=await authenticate(),{state}=await loadCurrentState(user);assertStudyAllowed(state);
 return new Response(JSON.stringify({format:'ent-math-progress-v2',createdAt:new Date().toISOString(),profile:state.profile,progress:state.progress,attempts:state.attempts,exams:state.exams,errors:state.errors,reviews:state.reviews},null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="ent-math-progress.json"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return failure(e);}}
