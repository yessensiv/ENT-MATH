import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
// @ts-expect-error Explicit extension for native tests.
import {offlineHtml,type OfflinePack} from '../lib/offline-pack.ts';
// @ts-expect-error Explicit extension for native tests.
import {contentDigest,reviewCoverage} from '../lib/material-review.ts';
// @ts-expect-error Explicit extension for native tests.
import {supportedImage} from '../lib/image-input.ts';
test('downloaded lesson escapes executable conditions and contains no network calls',()=>{const b={ru:'</script><img src=x onerror=alert(1)>',kk:'Қазақша'},pack={id:'p',topic:{id:'t',title:b,lesson:{goal:b,explanation:b,formula:b,terms:b,examples:[{problem:b,steps:{ru:[b.ru],kk:[b.kk]},answer:'1'}],mistakes:{ru:['Error'],kk:['Қате']},recap:{ru:['Recap'],kk:['Жаднама']}}},tasks:[{id:'t1',type:'number',prompt:b,answer:'1',solution:{ru:['One'],kk:['Бір']}}],language:'ru',createdAt:'now'} as OfflinePack;const html=offlineHtml(pack);assert.ok(html.includes('&lt;/script&gt;'));assert.equal((html.match(/<script>/g)||[]).length,1);assert.equal(html.includes('const pack={"id":"p"'),true);assert.equal(html.includes('fetch('),false);assert.ok(html.includes("connect-src 'none'"));assert.ok(html.includes('submissionId'));new Script(html.match(/<script>([\s\S]+)<\/script>/)![1]);});
test('editorial approval applies only to the exact content and a later rejection supersedes it',async()=>{const a=await contentDigest({ru:'A',kk:'B'}),same=await contentDigest({kk:'B',ru:'A'}),changed=await contentDigest({ru:'C',kk:'B'});assert.equal(a,same);assert.notEqual(a,changed);const reviews=['math','methodology','kazakh'].map(d=>({discipline:d,verdict:'approved',note:JSON.stringify({hash:a,comment:'review'}),createdAt:'2026-10-06T01:00:00Z'}));assert.ok(Object.values(reviewCoverage(reviews,a)).every(Boolean));assert.ok(Object.values(reviewCoverage(reviews,changed)).every(v=>!v));assert.equal(reviewCoverage([...reviews,{...reviews[0],verdict:'changes-needed',createdAt:'2026-10-06T02:00:00Z'}],a).math,false);});
test('photo recognition rejects forged types, arbitrary files and oversized images',()=>{assert.equal(supportedImage(new Uint8Array(30),'image/png'),false);const png=new Uint8Array(30);png.set([137,80,78,71,13,10,26,10]);assert.equal(supportedImage(png,'image/png'),true);assert.equal(supportedImage(png,'image/jpeg'),false);assert.equal(supportedImage(new Uint8Array(3*1024*1024),'image/png'),false);assert.equal(supportedImage(png,'image/svg+xml'),false);});

test('standalone script renders matching without explicit options and captures unsaved inputs for export',async()=>{
 const b={ru:'Lesson',kk:'Сабақ'},pack={id:'script-test',topic:{id:'t',title:b,lesson:{goal:b,explanation:b,formula:b,terms:b,examples:[],mistakes:{ru:[],kk:[]},recap:{ru:[],kk:[]}}},tasks:[{id:'match',type:'matching',prompt:b,answer:['2','3'],pairs:[{left:'A',right:'2'},{left:'B',right:'3'}],solution:{ru:['A → 2','B → 3'],kk:['A → 2','B → 3']}},{id:'number',type:'number',prompt:b,answer:'1.5',solution:{ru:['1.5'],kk:['1.5']}}],language:'ru',createdAt:'now'} as OfflinePack;
 const nodes:{tag:string;value:string;checked:boolean;children:unknown[];textContent:string;onclick?:()=>void;append:(...args:unknown[])=>void;click:()=>void}[]=[];
 const create=(tag:string)=>{const node={tag,value:'',checked:false,children:[] as unknown[],textContent:'',append(...args:unknown[]){this.children.push(...args);},click(){}};nodes.push(node);return node;};
 const root=create('root'),button=create('download'),status=create('status'),store=new Map<string,string>(),blobs:Blob[]=[];
 const context={document:{createElement:create,createTextNode:(text:string)=>text,getElementById:(id:string)=>({tasks:root,download:button,status}[id])},localStorage:{getItem:(key:string)=>store.get(key),setItem:(key:string,value:string)=>store.set(key,value)},crypto,Blob,URL:{createObjectURL:(blob:Blob)=>{blobs.push(blob);return 'blob:test';},revokeObjectURL:()=>{}},setTimeout:()=>0};
 const html=offlineHtml(pack);new Script(html.match(/<script>([\s\S]+)<\/script>/)![1]).runInNewContext(context);
 const selects=nodes.filter(n=>n.tag==='select');assert.equal(selects.length,2);selects[0].value='2';selects[1].value='3';nodes.find(n=>n.tag==='input')!.value='1.5';
 (button as typeof nodes[number]).onclick!();const exported=JSON.parse(await blobs[0].text());assert.deepEqual(exported.answers.map((a:{answer:unknown})=>a.answer),[['2','3'],'1.5']);assert.ok(store.get('ent-pack-script-test'));assert.match(status.textContent,/сохранён/);
});
