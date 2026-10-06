/** Exact rational-polynomial identities. Bounded parser; no evaluation of code.
 * An unproved identity is "review", never evidence of a learner's mistake. */
export type Verdict = 'correct' | 'incorrect' | 'review';
type Q = {n:bigint;d:bigint};
type P = Q[];
type R = {n:P;d:P;excluded:P};
const abs=(n:bigint)=>n<0n?-n:n;
function gcd(a:bigint,b:bigint):bigint {while(b){[a,b]=[b,a%b];}return abs(a);}
function q(n:bigint,d=1n):Q {if(!d)throw Error('undefined');if(n.toString(2).length+d.toString(2).length>8192)throw Error('limit');const g=gcd(n,d);return {n:(d<0n?-n:n)/g,d:abs(d)/g};}
const zero=q(0n),one=q(1n),add=(a:Q,b:Q)=>q(a.n*b.d+b.n*a.d,a.d*b.d),neg=(a:Q)=>q(-a.n,a.d),mul=(a:Q,b:Q)=>q(a.n*b.n,a.d*b.d),div=(a:Q,b:Q)=>q(a.n*b.d,a.d*b.n);
function trim(p:P):P {while(p.length>1&&!p.at(-1)!.n)p.pop();return p;}
const isZero=(p:P)=>p.length===1&&!p[0].n;
function sum(a:P,b:P,minus=false):P{return trim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>add(a[i]||zero,minus?neg(b[i]||zero):b[i]||zero)));}
function product(a:P,b:P):P {if(a.length+b.length>66)throw Error('degree limit');const p=Array.from({length:a.length+b.length-1},()=>zero);a.forEach((v,i)=>b.forEach((w,j)=>p[i+j]=add(p[i+j],mul(v,w))));return trim(p);}
function remainder(a:P,b:P):P {if(isZero(b))throw Error('undefined');let p=[...a];while(p.length>=b.length&&!isZero(p)){const offset=p.length-b.length,c=div(p.at(-1)!,b.at(-1)!);p=sum(p,[...Array.from({length:offset},()=>zero),...b.map(v=>mul(v,c))],true);}return p;}
const monic=(p:P)=>p.map(v=>div(v,p.at(-1)!));
function pgcd(a:P,b:P):P {while(!isZero(b)){[a,b]=[b,remainder(a,b)];}return monic(a);}
function quotient(a:P,b:P):P {let p=[...a];const result=Array.from({length:Math.max(1,a.length-b.length+1)},()=>zero);while(p.length>=b.length&&!isZero(p)){const i=p.length-b.length,c=div(p.at(-1)!,b.at(-1)!);result[i]=c;p=sum(p,[...Array.from({length:i},()=>zero),...b.map(v=>mul(v,c))],true);}if(!isZero(p))throw Error('not divisible');return trim(result);}
function squareFree(p:P):P {if(p.length===1){if(!p[0].n)throw Error('empty domain');return[one];}const derivative=p.slice(1).map((v,i)=>mul(v,q(BigInt(i+1))));return monic(quotient(p,pgcd(p,derivative)));}
function decimal(source:string):Q {const [mantissa,exp='0']=source.split('e'),e=Number(exp);if(Math.abs(e)>100)throw Error('limit');const parts=mantissa.split('.'),digits=parts.join(''),scale=(parts[1]?.length||0)-e;return scale>=0?q(BigInt(digits),10n**BigInt(scale)):q(BigInt(digits)*10n**BigInt(-scale));}
function parse(source:string):R {
 const input=source.toLowerCase().replace(/\s+/g,'').replace(/−/g,'-').replace(/х/g,'x').replace(/²/g,'^2').replace(/³/g,'^3').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/,/g,'.');
 if(!input.length||input.length>300)throw Error('limit');
 const raw=input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|x|[+\-*/^()]/g)||[];
 if(raw.join('')!==input||raw.length>150)throw Error('unsupported');
 const number=/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/;
 const tokens:string[]=[];raw.forEach((v,i)=>{const prev=raw[i-1];if(prev&&(number.test(prev)||prev==='x'||prev===')')&&(v==='x'||v==='('))tokens.push('*');tokens.push(v);});
 let pos=0,depth=0;
 const constant=(v:Q):R=>({n:[v],d:[one],excluded:[one]});
 function combine(a:R,b:R,op:string):R {
  const excluded=product(a.excluded,b.excluded);
  if(op==='*')return{n:product(a.n,b.n),d:product(a.d,b.d),excluded};
  if(op==='/')return{n:product(a.n,b.d),d:product(a.d,b.n),excluded:product(excluded,b.n)};
  return{n:sum(product(a.n,b.d),product(b.n,a.d),op==='-'),d:product(a.d,b.d),excluded};
 }
 function atom():R {if(++depth>30)throw Error('limit');const t=tokens[pos++];let v:R;if(t==='('){v=addition();if(tokens[pos++]!==')')throw Error('bracket');}else if(t==='x')v={n:[zero,one],d:[one],excluded:[one]};else if(number.test(t||''))v=constant(decimal(t));else throw Error('unsupported');depth--;return v;}
 function power():R {const a=atom();if(tokens[pos]!=='^')return a;pos++;const b=unary();if(b.n.length!==1||b.d.length!==1||b.excluded.length!==1)throw Error('unsupported power');const exponent=div(b.n[0],b.d[0]);if(exponent.d!==1n||abs(exponent.n)>32n)throw Error('unsupported power');let result=constant(one);for(let i=0n;i<abs(exponent.n);i++)result=combine(result,a,'*');if(exponent.n<0n)result=combine(constant(one),result,'/');result.excluded=product(result.excluded,a.excluded);return result;}
 function unary():R {if(tokens[pos]==='+'){pos++;return unary();}if(tokens[pos]==='-'){pos++;const a=unary();return{...a,n:a.n.map(neg)};}return power();}
 function multiplication():R {let a=unary();while(['*','/'].includes(tokens[pos])){const op=tokens[pos++];a=combine(a,unary(),op);}return a;}
 function addition():R {let a=multiplication();while(['+','-'].includes(tokens[pos])){const op=tokens[pos++];a=combine(a,multiplication(),op);}return a;}
 const result=addition();if(pos!==tokens.length||isZero(result.d)||isZero(result.excluded))throw Error('undefined');return result;
}
/** Equality includes holes in the original rational expressions, before cancellation. */
export function exactRationalNumber(source:string):{n:bigint;d:bigint}{
 if(/[xх]/i.test(source))throw Error('not a number');const value=parse(source);
 if(value.n.length!==1||value.d.length!==1||value.excluded.length!==1)throw Error('unsupported number');
 return div(value.n[0],value.d[0]);
}
/** Exact solution sets for affine equations with constant, nonzero denominators.
 * Variable denominators and nonlinear equations deliberately require review. */
export function proveLinearEquationStep(before:string,after:string):Verdict{
 const solve=(line:string):{kind:'all'|'none'|'one';root?:Q}=>{
  const sides=line.split('=');if(sides.length!==2||!/[xх]/i.test(line))throw Error('not a linear equation');
  const a=parse(sides[0]),b=parse(sides[1]);
  if(a.d.length!==1||b.d.length!==1||a.excluded.length!==1||b.excluded.length!==1)throw Error('domain requires review');
  const difference=sum(product(a.n,b.d),product(b.n,a.d),true);
  if(difference.length>2)throw Error('nonlinear');
  if(difference.length===1)return{kind:difference[0].n?'none':'all'};
  return{kind:'one',root:div(neg(difference[0]),difference[1])};
 };
 try{const a=solve(before),b=solve(after);if(a.kind!==b.kind)return'incorrect';if(a.kind!=='one')return'correct';return a.root!.n===b.root!.n&&a.root!.d===b.root!.d?'correct':'incorrect';}catch{return'review';}
}
export function proveRationalIdentity(a:string,b:string,domain?:string):Verdict {
 try {
  const x=parse(a),y=parse(b);let domainExcluded:P=[one];
  if(domain){for(const restriction of domain.toLowerCase().replace(/\s/g,'').split(/;|и|and/)){const match=restriction.match(/^[xх](?:≠|!=)(-?\d+(?:[.,]\d+)?)$/);if(!match)return'review';domainExcluded=product(domainExcluded,parse(`x-(${match[1]})`).n);}}
  if(!isZero(sum(product(x.n,y.d),product(y.n,x.d),true)))return'incorrect';
  const xd=squareFree(product(domainExcluded,product(x.excluded,x.d))),yd=squareFree(product(domainExcluded,product(y.excluded,y.d)));
  if(isZero(sum(xd,yd,true)))return'correct';
  // Different excluded polynomials need real-root analysis. A rational witness
  // proves a mismatch; absence of a witness does not prove equal domains.
  const value=(p:P,n:Q)=>p.reduceRight((s,c)=>add(mul(s,n),c),zero);
  for(const n of [-10,-3,-2,-1,0,1,2,3,10])if(Boolean(value(xd,q(BigInt(n))).n)!==Boolean(value(yd,q(BigInt(n))).n))return'incorrect';
  return'review';
 }catch{return'review';}
}
