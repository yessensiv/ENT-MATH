import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{boundedText}from'../lib/bounded-body.ts';
test('SEC-01: chunked input stops at the byte budget before JSON allocation',async()=>{
 let sent=0,cancelled=false;const body=new ReadableStream({pull(controller){sent++;controller.enqueue(new Uint8Array(50));},cancel(){cancelled=true;}});
 const request=new Request('http://localhost',{method:'POST',body,duplex:'half'} as RequestInit);
 await assert.rejects(()=>boundedText(request,100),/BODY_TOO_LARGE/);assert.ok(cancelled);assert.ok(sent<6);
 assert.equal(await boundedText(new Request('http://localhost',{method:'POST',body:'Ә математика'}),100),'Ә математика');
});
