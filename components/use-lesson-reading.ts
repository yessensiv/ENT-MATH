"use client";
import {useEffect,useRef,type RefObject} from 'react';
import {captureReadingPosition,readingScrollTarget,type LessonReading} from '@/lib/lesson-position';

export function useLessonReading(root:RefObject<HTMLDivElement|null>,view:string,language:string,content:unknown,reading:LessonReading|undefined,onReading:((value:LessonReading)=>void)|undefined,captureRef:RefObject<(()=>void)|null>|undefined){
 const latest=useRef({reading,onReading});latest.current={reading,onReading};
 useEffect(()=>{
  const element=root.current;if(!element)return;
  let cancelled=false,ready=false,timer:ReturnType<typeof setTimeout>|undefined,frame=0;
  const anchors=()=>Array.from(element.querySelectorAll<HTMLElement>('[data-reading-anchor]')).map(el=>{const r=el.getBoundingClientRect();return{id:el.dataset.readingAnchor!,top:r.top,height:r.height};});
  const details=()=>Array.from(element.querySelectorAll<HTMLDetailsElement>('details[data-reading-detail]'));
  const capture=()=>{
   if(!ready||!element.isConnected)return;
   const prior=latest.current.reading??{positions:{},openDetails:[]},present=new Set(details().map(d=>d.dataset.readingDetail!));
   const value:LessonReading={positions:{...prior.positions,[view]:captureReadingPosition(anchors(),window.scrollY)},openDetails:[...prior.openDetails.filter(id=>!present.has(id)),...details().filter(d=>d.open).map(d=>d.dataset.readingDetail!)]};
   if(JSON.stringify(value)!==JSON.stringify(prior)){latest.current.reading=value;latest.current.onReading?.(value);}
  };
  if(captureRef)captureRef.current=capture;
  const saved=latest.current.reading;
  for(const d of details())d.open=saved?.openDetails.includes(d.dataset.readingDetail!)??false;
  const finish=()=>{if(cancelled)return;window.scrollTo({top:readingScrollTarget(saved?.positions[view],anchors(),window.scrollY,Math.max(0,document.documentElement.scrollHeight-window.innerHeight)),behavior:'instant'});ready=true;};
  // Wait for text metrics, but stop restoring as soon as the learner interacts.
  void document.fonts.ready.then(()=>{if(!cancelled)frame=requestAnimationFrame(finish);});
  const interrupt=()=>{if(!ready){cancelled=true;cancelAnimationFrame(frame);ready=true;}};
  const schedule=()=>{if(!ready)return;clearTimeout(timer);timer=setTimeout(capture,120);};
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  window.addEventListener('wheel',interrupt,{passive:true});window.addEventListener('touchstart',interrupt,{passive:true});window.addEventListener('keydown',interrupt);
  element.addEventListener('toggle',schedule,true);
  return()=>{cancelled=true;clearTimeout(timer);cancelAnimationFrame(frame);if(captureRef?.current===capture)captureRef.current=null;window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('wheel',interrupt);window.removeEventListener('touchstart',interrupt);window.removeEventListener('keydown',interrupt);element.removeEventListener('toggle',schedule,true);};
 // A save changes reading, never the current viewport. Restore only on view,
 // language or published-content changes, using the latest saved position.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[view,language,content]);
}
