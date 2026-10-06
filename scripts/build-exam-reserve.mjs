// Regenerate deliberately after mathematical review; never on each request.
import{writeFileSync,mkdirSync}from'node:fs';
import{topics,generateReviewTask,reviewCapacity,validateGeneratedTask}from'../lib/content.ts';
import{makeExam,taskFingerprint}from'../lib/engine.ts';
import{examContext,basicMatchingReserve}from'../lib/exam-contexts.ts';
import{contentDigest}from'../lib/material-review.ts';
const version='exam-2026.1',bank={},reservations=new Set(),used=new Set(),fingerprints=new Set();
for(const track of ['profile','literacy']){
 const candidates=[];
 for(const topic of topics.filter(t=>t.track===track&&t.spec!==null))for(const level of [1,2,3]){
  const max=reviewCapacity(topic.id,level);
  for(let serial=Math.max(1,max-11);serial<=max;serial++){
   const t=generateReviewTask(topic.id,serial,level);if(!t||!validateGeneratedTask(t).valid)throw Error('Unverified candidate');
   candidates.push({...t,difficulty:level,units:t.unit,modelExample:false,reviewReserved:false});
  }
 }
 if(track==='profile')candidates.push(...basicMatchingReserve());
 bank[track]=[];
 for(let variant=1;variant<=10;variant++){
  const generated=makeExam(track,variant,topics,candidates.filter(t=>!used.has(t.id)),new Date('2026-10-06T00:00:00Z'));
  const questions=generated.questions.map((t,i)=>{
   if(t.context)return examContext(variant)[i-25];
   used.add(t.id);if(t.generation)reservations.add(t.id);
   return{...t,id:t.id.startsWith('exam-')?t.id:`${version}-${t.id}`,sourceTaskId:t.id,version,purpose:'exam',reviewStatus:'computed-key-checked; teaching-review-pending'};
  });
  for(const t of questions){const fp=taskFingerprint(t);if(fingerprints.has(fp))throw Error('Repeated condition '+t.id);fingerprints.add(fp);}
  bank[track].push({variant,questions});
 }
}
const data={version,year:2026,createdAt:'2026-10-06',reviewStatus:'mathematically-checked; difficulty-and-methodology-review-pending',variants:bank};
writeFileSync('lib/exam-reserve-data.json',JSON.stringify(data));
writeFileSync('lib/exam-reservations.ts','/** These generated conditions belong to the private exam reserve. */\nexport const examReservations=new Set<string>('+JSON.stringify([...reservations].sort())+');\n');
mkdirSync('docs/reviews',{recursive:true});
writeFileSync('docs/reviews/EXAM-RESERVE-2026-10-06.json',JSON.stringify({version,sha256:await contentDigest(JSON.parse(JSON.stringify(data))),reviewerType:'ai-assisted',scope:'Exact generated keys and disjoint conditions. Difficulty and full instructional review remain pending.',counts:{profile:bank.profile.length,literacy:bank.literacy.length,conditions:fingerprints.size,reservedGeneratorConditions:reservations.size},contextFamilies:['shared-cost','garden-path','average-speed']},null,2)+'\n');
console.log({profile:bank.profile.length,literacy:bank.literacy.length,conditions:fingerprints.size,reserved:reservations.size});
