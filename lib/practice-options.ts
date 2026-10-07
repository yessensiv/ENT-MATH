/** Keep submitted option keys unchanged while moving inline labels into readable choices. */
export function practiceOptions(prompt:string,options:string[]){
 if(!options.length||!options.every(o=>/^[A-F]$/.test(o)))return{prompt,options:options.map(value=>({value,label:value}))};
 const matches=[...prompt.matchAll(/(?:^|[\s;])([A-F])\s*[:：]\s*/g)];
 if(matches.length!==options.length||matches.some((m,i)=>m[1]!==options[i]))return{prompt,options:options.map(value=>({value,label:value}))};
 return{prompt:prompt.slice(0,matches[0].index).trim(),options:matches.map((m,i)=>({value:m[1],label:prompt.slice(m.index!+m[0].length,matches[i+1]?.index??prompt.length).replace(/[;\s]+$/,'')}))};
}
