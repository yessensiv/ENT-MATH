export function supportedImage(bytes:Uint8Array,type:string){
 if(bytes.length<16||bytes.length>2*1024*1024)return false;
 if(type==='image/png')return [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
 if(type==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(type==='image/webp')return new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 return false;
}
export function toBase64(bytes:Uint8Array){let output='';for(let i=0;i<bytes.length;i+=32768)output+=String.fromCharCode(...bytes.slice(i,i+32768));return btoa(output);}
