export type TutorProviderSettings={TUTOR_PROVIDER?:string;TUTOR_BASE_URL?:string;TUTOR_MODEL?:string;TUTOR_VISION_MODEL?:string};
/** Gemini uses Google's documented OpenAI-compatible endpoint. No key belongs here. */
export function tutorProvider(settings:TutorProviderSettings,vision=false){
 const provider=settings.TUTOR_PROVIDER||'compatible';
 if(!['compatible','gemini'].includes(provider))throw Error('INVALID_TUTOR_PROVIDER');
 const base=(provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai':settings.TUTOR_BASE_URL||'https://api.openai.com/v1').replace(/\/+$/,'');
 const url=new URL(`${base}/chat/completions`);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('INVALID_TUTOR_URL');
 const model=(vision?settings.TUTOR_VISION_MODEL:undefined)||settings.TUTOR_MODEL||(provider==='gemini'?'':'gpt-4.1-mini');
 if(!model.trim()||model.length>150||provider==='gemini'&&!/^gemini-[a-zA-Z0-9_.-]+$/.test(model))throw Error('INVALID_TUTOR_MODEL');
 return{url,model,provider};
}
