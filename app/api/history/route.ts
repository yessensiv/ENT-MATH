import{authenticate,loadCurrentState,response,failure,ApiError,assertStudyAllowed}from'@/lib/server-store';
export async function GET(request:Request){try{
 const user=await authenticate(),{state}=await loadCurrentState(user);assertStudyAllowed(state);const params=new URL(request.url).searchParams,kind=params.get('kind')||'attempts';
 if(!['attempts','exams'].includes(kind))throw new ApiError('Выберите попытки или экзамены.');const before=params.get('before'),all=kind==='exams'?state.exams:state.attempts;
 const end=before?all.findIndex(item=>item.id===before):all.length;if(end<0)throw new ApiError('Курсор истории больше не доступен. Откройте первую страницу.',409,'HISTORY_CURSOR');
 const begin=Math.max(0,end-40),items=all.slice(begin,end);return response({kind,items,total:all.length,before:begin>0?items[0].id:null});
 }catch(e){return failure(e);}}
