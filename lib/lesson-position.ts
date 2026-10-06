export type ReadingPosition={anchor:string;offset:number};
export type LessonReading={positions:Record<string,ReadingPosition>;openDetails:string[]};
export type ReadingAnchor={id:string;top:number;height:number};
export function lessonViewKey(stage:number,example:number){return stage===1?`1:${example}`:String(stage);}
export function validateLessonReading(value:unknown):LessonReading{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_LESSON_WORK');
 const {positions,openDetails}=value as LessonReading;
 if(!positions||typeof positions!=='object'||Array.isArray(positions)||Object.keys(positions).length>7||!Array.isArray(openDetails)||openDetails.length>12)throw Error('INVALID_LESSON_WORK');
 const validId=(s:unknown)=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,47}$/.test(s);
 const clean:Record<string,ReadingPosition>={};
 for(const [key,p] of Object.entries(positions)){
  if(!/^(0|2|3|1:[0-3])$/.test(key)||!p||!validId(p.anchor)||!Number.isFinite(p.offset)||p.offset<0||p.offset>1)throw Error('INVALID_LESSON_WORK');
  clean[key]={anchor:p.anchor,offset:p.offset};
 }
 if(!openDetails.every(validId)||new Set(openDetails).size!==openDetails.length)throw Error('INVALID_LESSON_WORK');
 return {positions:clean,openDetails:[...openDetails]};
}
// Store the reading block and fractional position so a different screen width
// or language can restore the same explanation rather than an obsolete pixel.
export function captureReadingPosition(anchors:ReadingAnchor[],scrollY:number,inset=100):ReadingPosition{
 if(scrollY<5)return {anchor:'top',offset:0};
 const visible=anchors.filter(a=>a.height>0),before=visible.filter(a=>a.top<=inset);
 // A desktop sidebar follows the article in DOM order but sits beside it.
 const anchor=before.reduce<ReadingAnchor|undefined>((best,a)=>!best||a.top>best.top?a:best,undefined)??visible[0];
 if(!anchor)return {anchor:'top',offset:0};
 return {anchor:anchor.id,offset:Math.round(Math.max(0,Math.min(1,(inset-anchor.top)/anchor.height))*10000)/10000};
}
export function readingScrollTarget(p:ReadingPosition|undefined,anchors:ReadingAnchor[],scrollY:number,maxScroll:number,inset=100){
 if(!p||p.anchor==='top'&&p.offset===0)return 0;
 const a=anchors.find(a=>a.id===p.anchor);if(!a)return 0;
 return Math.max(0,Math.min(maxScroll,scrollY+a.top+a.height*p.offset-inset));
}
