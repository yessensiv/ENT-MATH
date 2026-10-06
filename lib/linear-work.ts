// @ts-expect-error Native tests.
import{proveLinearEquationStep,proveRationalIdentity,type Verdict}from'./algebra-proof.ts';
/** Only an authored, recognized equation anchors the work. Free text is never
 * stripped into a guessed formula; unknown lines keep the result unverified. */
export function reviewLinearWork(prompt:string,steps:string):{status:Verdict;transitions:number;anchoredSteps?:string}{
 const original=prompt.match(/^Реши\s+(.+?)\.?$/)?.[1],lines=steps.split(/\n|→|=>/).map(s=>s.trim()).filter(Boolean);
 if(!original||!lines.length||lines.length>40||proveLinearEquationStep(original,original)!=='correct')return{status:'review',transitions:0};
 if(lines.length===1&&/^[xх]\s*=\s*[-+\d.,/]+$/i.test(lines[0]))return{status:'review',transitions:0};
 let previous=original,transitions=0;
 for(const line of lines){
  if(!/[xх]/i.test(line)){const p=line.split('=');if(p.length!==2||proveRationalIdentity(p[0],p[1])!=='correct')return{status:'review',transitions};continue;}
  const verdict=proveLinearEquationStep(previous,line);if(verdict!=='correct')return{status:verdict,transitions,anchoredSteps:verdict==='incorrect'?[original,...lines].join('\n'):undefined};
  previous=line;transitions++;
 }
 return{status:transitions?'correct':'review',transitions};
}
