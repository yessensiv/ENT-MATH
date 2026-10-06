// @ts-expect-error Native Node content checks need explicit extensions.
import {basicsEnrichment} from './lesson-enrichment-basics.ts';
// @ts-expect-error Native Node content checks need explicit extensions.
import {advancedEnrichment} from './lesson-enrichment-advanced.ts';
// @ts-expect-error Native Node content checks need explicit extensions.
import {schoolEnrichment} from './lesson-enrichment-school.ts';
import type {Topic} from './content.ts';
export const lessonEnrichment={...basicsEnrichment,...advancedEnrichment,...schoolEnrichment};
export function withLessonEnrichment(topic:Topic):Topic {
  if(topic.lesson.enrichment)return topic;
  const enrichment=lessonEnrichment[topic.id];
  return enrichment?{...topic,lesson:{...topic.lesson,enrichment}}:topic;
}
export function validLessonEnrichment(value:unknown):boolean {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const e=value as Record<string,unknown>;
  const bilingual=(v:unknown)=>!!v&&typeof v==='object'&&['ru','kk'].every(l=>typeof (v as Record<string,unknown>)[l]==='string'&&((v as Record<string,string>)[l]).trim().length>0);
  const notes=(v:unknown,caution=false)=>Array.isArray(v)&&v.length>=(caution?1:2)&&v.every(n=>n&&bilingual(n.title)&&bilingual(n.body)&&(!caution||bilingual(n.caution)));
  const life=e.life as Record<string,unknown>|undefined;
  const steps=life?.steps as Record<string,unknown>|undefined;
  return bilingual(e.intuition)&&notes(e.details)&&notes(e.hacks,true)&&!!life&&['title','problem','connection','takeaway'].every(k=>bilingual(life[k]))&&typeof life.answer==='string'&&life.answer.trim().length>0&&(life.answerText===undefined||bilingual(life.answerText))&&!!steps&&['ru','kk'].every(l=>Array.isArray(steps[l])&&(steps[l] as unknown[]).length>=3&&(steps[l] as unknown[]).every(s=>typeof s==='string'&&s.trim()));
}
