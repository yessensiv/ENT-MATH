/** Reading completion and independently confirmed mastery are separate measures. */
export function courseProgress(ids:string[],completions:Record<string,{at:string}>,progress:Record<string,{mastered?:boolean}>){
 const unique=[...new Set(ids)],total=unique.length;
 const completed=unique.filter(id=>Boolean(completions[id])).length;
 const mastered=unique.filter(id=>Boolean(progress[id]?.mastered)).length;
 const unread=unique.find(id=>!completions[id]&&!progress[id]?.mastered);
 const practice=unique.find(id=>!progress[id]?.mastered);
 return {total,completed,mastered,completionPercent:total?Math.round(completed/total*100):0,
  masteryPercent:total?Math.round(mastered/total*100):0,nextId:unread??practice,
  nextAction:unread?'lesson':practice?'practice':null};
}
