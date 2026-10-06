export const reviewDisciplines=['math','methodology','kazakh'] as const;
export function canonical(value:unknown):string{if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;return JSON.stringify(value)??'null';}
export async function contentDigest(material:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(material))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function reviewCoverage(reviews:{discipline:string;verdict:string;note:string;createdAt:string}[],hash:string){
 return Object.fromEntries(reviewDisciplines.map(d=>{const current=reviews.filter(r=>r.discipline===d).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).find(r=>{try{return JSON.parse(r.note).hash===hash;}catch{return false;}});return [d,current?.verdict==='approved'];})) as Record<typeof reviewDisciplines[number],boolean>;
}
