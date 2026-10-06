// @ts-expect-error Native Node tests.
import{exactRationalNumber,type Verdict}from'./algebra-proof.ts';
export type AnswerFormat='interval'|'root-set'|'pair';
type NumberValue={n:bigint;d:bigint};type Endpoint=NumberValue|'-inf'|'+inf';
type Interval={lo:Endpoint;hi:Endpoint;left:boolean;right:boolean};
const comparison=(a:Endpoint,b:Endpoint):number=>{if(typeof a==='string'||typeof b==='string'){if(a===b)return 0;if(a==='-inf'||b==='+inf')return -1;return 1;}const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;};
const clean=(v:string)=>v.trim().replace(/−/g,'-').replace(/\s+/g,'');
function endpoint(v:string):Endpoint{const s=clean(v).toLowerCase();if(['-∞','-inf','-infinity'].includes(s))return'-inf';if(['∞','+∞','inf','+inf','infinity','+infinity'].includes(s))return'+inf';return exactRationalNumber(s);}
function finite(v:string):NumberValue{const n=endpoint(v);if(typeof n==='string')throw Error('infinite member');return n;}
function intervalSet(source:string):Interval[]{
 const text=clean(source);if(text==='∅'||text==='{}')return[];if(text.length>300)throw Error('limit');
 const result:Interval[]=[];
 for(const part of text.split(/∪|U/)){
  if(part.startsWith('{')&&part.endsWith('}')){for(const item of part.slice(1,-1).split(';')){const n=finite(item);result.push({lo:n,hi:n,left:true,right:true});}continue;}
  const m=part.match(/^([\[(])(.+);(.+)([\])])$/);if(!m)throw Error('unsupported interval');
  const lo=endpoint(m[2]),hi=endpoint(m[3]),left=m[1]==='[',right=m[4]===']',order=comparison(lo,hi);
  if(lo==='+inf'||hi==='-inf'||typeof lo==='string'&&left||typeof hi==='string'&&right||order>0)throw Error('invalid interval');
  if(order===0&&!(left&&right))continue;
  result.push({lo,hi,left,right});
 }
 result.sort((a,b)=>comparison(a.lo,b.lo)||Number(b.left)-Number(a.left));
 const merged:Interval[]=[];for(const current of result){const prior=merged.at(-1),touch=prior?comparison(current.lo,prior.hi):1;
  if(!prior||touch>0||touch===0&&!prior.right&&!current.left){merged.push({...current});continue;}
  const end=comparison(current.hi,prior.hi);if(end>0){prior.hi=current.hi;prior.right=current.right;}else if(end===0)prior.right ||= current.right;
 }return merged;
}
function rootSet(source:string):NumberValue[]{const s=clean(source);if(s==='∅'||s==='{}')return[];if(!s.startsWith('{')||!s.endsWith('}')||s.length>300)throw Error('use braces and semicolons');const sorted=s.slice(1,-1).split(';').map(finite).sort(comparison);return sorted.filter((n,i)=>i===0||comparison(n,sorted[i-1])!==0);}
function pair(source:string):NumberValue[]{const s=clean(source);if(!s.startsWith('(')||!s.endsWith(')')||s.length>300)throw Error('use parentheses');const items=s.slice(1,-1).split(';');if(items.length!==2)throw Error('pair length');return items.map(finite);}
export function checkStructuredAnswer(format:AnswerFormat,provided:string,expected:string):Verdict{
 try{if(format==='interval'){const a=intervalSet(provided),b=intervalSet(expected);return a.length===b.length&&a.every((v,i)=>comparison(v.lo,b[i].lo)===0&&comparison(v.hi,b[i].hi)===0&&v.left===b[i].left&&v.right===b[i].right)?'correct':'incorrect';}
  const parse=format==='pair'?pair:rootSet,a=parse(provided),b=parse(expected);return a.length===b.length&&a.every((n,i)=>comparison(n,b[i])===0)?'correct':'incorrect';
 }catch{return'review';}
}
