export async function boundedText(request:Pick<Request,'headers'|'body'>,maxBytes:number):Promise<string>{
 const length=Number(request.headers.get('content-length'));if(Number.isFinite(length)&&length>maxBytes)throw Error('BODY_TOO_LARGE');
 if(!request.body)return'';const reader=request.body.getReader(),decoder=new TextDecoder();let bytes=0,result='';
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw Error('BODY_TOO_LARGE');}result+=decoder.decode(value,{stream:true});}return result+decoder.decode();}finally{reader.releaseLock();}
}
