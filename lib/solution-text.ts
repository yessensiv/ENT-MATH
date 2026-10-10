/** Keep an existing labelled final answer; add one only when the solution omits it. */
export function solutionText(steps:string[],answer:string|string[],lang:'ru'|'kk',units=''){
 const lines=[...steps];
 if(!/(?:Ответ|Жауабы|Жауап)\s*:/i.test(lines.at(-1)||''))lines.push(`${lang==='ru'?'Ответ':'Жауабы'}: ${Array.isArray(answer)?answer.join(', '):answer}${units?' '+units:''}.`);
 return lines.join('\n\n');
}
