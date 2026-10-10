import proofs from '../content/promoted/verification.json' with {type:'json'};
// @ts-expect-error Native Node tests.
import {exactRationalNumber} from './algebra-proof.ts';
// @ts-expect-error Native Node tests.
import {calculate,type Task} from './engine.ts';

const byId=new Map(proofs.map(p=>[p.id,p]));
const exact=(s:string)=>{const q=exactRationalNumber(s);return q.d===1n?String(q.n):`${q.n}/${q.d}`;};
// Reduce only perfect square roots; unsupported or irrational results stay out.
function rational(s:string):string {
 let result=s;
 for(let i=0;i<24&&/sqrt|abs/.test(result);i++){
  const matches=[...result.matchAll(/(sqrt|abs)\(/g)],m=matches.at(-1)!;
  const start=m.index!+m[0].length;let depth=1,end=start;
  for(;end<result.length;end++){if(result[end]==='(')depth++;if(result[end]===')'&&!--depth)break;}
  if(depth)throw Error('unbalanced');
  const q=exactRationalNumber(result.slice(start,end));let replacement='';
  if(m[1]==='abs')replacement=`(${q.n<0n?-q.n:q.n}/${q.d})`;
  else{const n=Math.sqrt(Number(q.n)),d=Math.sqrt(Number(q.d));if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||BigInt(n)**2n!==q.n||BigInt(d)**2n!==q.d)throw Error('not a perfect square');replacement=`(${n}/${d})`;}
  result=result.slice(0,m.index)+replacement+result.slice(end+1);
 }
 return exact(result);
}
/** New authored conditions, not additional exercises claimed from a textbook.
 * Original proof is the trusted template. Unsupported changes fail closed. */
export function makeImportedRepair(original:Task,serial:number):Task|null {
 const p=byId.get(original.id);if(!p||!Number.isInteger(serial)||serial<1||serial>1000)return null;
 try{
  let condition='',answer='',ru:string[]=[],kk:string[]=[];
  if('expression'in p&&p.expression){
   const tokens=[...p.expression.matchAll(/\d+(?:\.\d+)?/g)];if(!tokens.length)return null;
   // One literal changes; operation order, signs and the method stay intact.
   const token=tokens[(serial-1)%tokens.length],value=Number(token[0]);
   const next=Number.isInteger(Math.sqrt(value))&&/sqrt\(\d+\)/.test(p.expression)?(Math.sqrt(value)+Math.ceil(serial/tokens.length))**2:value+Math.ceil(serial/tokens.length);
   condition=p.expression.slice(0,token.index)+next+p.expression.slice(token.index!+token[0].length);
   answer=rational(condition);
   ru=[original.hints.ru[0],`Вычисляем выражение: ${condition} = ${answer}.`,`Проверь знаки и порядок действий. Ответ: ${answer}.`];
   kk=[original.hints.kk[0],`Өрнекті есептейміз: ${condition} = ${answer}.`,`Таңбалар мен амалдардың ретін тексер. Жауабы: ${answer}.`];
  }else if('equation'in p&&p.equation&&'roots'in p&&p.roots){
   const shift=serial,replace=(s:string)=>s.replace(/x/g,`(x-${shift})`);
   condition=p.equation.map(replace).join(' = ');
   answer=`{${p.roots.map(r=>exact(`(${r})+${shift}`)).join(';')}}`;
   ru=[`Обозначь y = x − ${shift}.`,...original.solution.ru.filter(s=>!s.startsWith('Ответ:')).map(s=>s.replace(/x/g,'y')),`Вернись к x: x = y + ${shift}. Ответ: ${answer}.`];
   kk=[`y = x − ${shift} деп белгіле.`,...original.solution.kk.filter(s=>!s.startsWith('Жауабы:')).map(s=>s.replace(/x/g,'y')),`x-ке орал: x = y + ${shift}. Жауабы: ${answer}.`];
  }else if('inequality'in p&&p.inequality){
   condition=`${p.inequality.expression.replace(/x/g,`(x-${serial})`)} ${p.inequality.relation} 0`;
   answer=p.answer.replace(/(?<=[\[(;{])(-?\d+(?:\/\d+)?)(?=[;\])}])/g,v=>exact(`(${v})+${serial}`));
   ru=[`Обозначь y = x − ${serial}.`,...original.solution.ru.filter(s=>!s.startsWith('Ответ:')).map(s=>s.replace(/x/g,'y')),`Сдвинь все границы на ${serial} вправо, сохрани открытые и закрытые концы. Ответ: ${answer}.`];
   kk=[`y = x − ${serial} деп белгіле.`,...original.solution.kk.filter(s=>!s.startsWith('Жауабы:')).map(s=>s.replace(/x/g,'y')),`Барлық шекараны ${serial} бірлік оңға жылжыт. Шекаралардың ашық не жабық екенін сақта. Жауабы: ${answer}.`];
  }else if(('gcd'in p&&p.gcd)||('lcm'in p&&p.lcm)){
   const values=('gcd'in p?p.gcd:undefined)||('lcm'in p?p.lcm:undefined);if(!values)return null;
   const factor=serial+1,a=values[0]*factor,b=values[1]*factor,gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
   const divisor=gcd(a,b),isGcd='gcd'in p;
   condition=`${isGcd?'НОД / ЕҮОБ':'НОК / ЕКОЕ'}(${a}, ${b})`;answer=String(isGcd?divisor:a*b/divisor);
   ru=[`Найди общий делитель чисел ${a} и ${b}.`,`НОД = ${divisor}. НОК = ${a} · ${b} / ${divisor}.`,`Ответ: ${answer}.`];
   kk=[`${a} және ${b} сандарының ортақ бөлгішін тап.`,`ЕҮОБ = ${divisor}. ЕКОЕ = ${a} · ${b} / ${divisor}.`,`Жауабы: ${answer}.`];
  }else return null;
  if('expression'in p&&p.expression&&Math.abs(calculate(condition)-calculate(answer))>1e-9*Math.max(1,Math.abs(calculate(answer))))return null;
  const task=structuredClone(original);delete task.source;
  if(task.domain)task.domain=task.domain.replace(/x/g,`(x-${serial})`);
  return {...task,id:`imported-repair-${original.id}-${serial}`,prompt:{ru:`${original.type==='expression'?'Реши':'Вычисли'}: ${condition}.`,kk:`${original.type==='expression'?'Шеш':'Есепте'}: ${condition}.`},answer,hints:{ru:ru.slice(0,2),kk:kk.slice(0,2)},solution:{ru,kk},reviewReserved:true,curriculumPractice:{origin:'authored-repair',templateTaskId:original.id},version:'imported-repair-v1',reviewStatus:'math-checked-translation-pending'};
 }catch{return null;}
}
