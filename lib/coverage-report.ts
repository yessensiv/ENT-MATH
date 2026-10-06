// @ts-expect-error Native Node tests.
import {isModelExample,type Task,type Topic} from './engine.ts';
export function coverageReport(topics:Topic[],tasks:Task[]){
 const rows=topics.map(topic=>{
  const bank=tasks.filter(t=>t.topicId===topic.id),practice=bank.filter(t=>!isModelExample(t,topic)&&!t.reviewReserved),control=bank.filter(t=>t.reviewReserved);
  const missing=[];
  if(!Array.isArray(topic.skillIds)||!topic.skillIds.length)missing.push('CUR-01: выделить атомарные навыки и связи с целями');
  if(practice.length<20)missing.push(`TASK-02: самостоятельных условий ${practice.length}, требуется минимум 20 на навык`);
  if(control.length<8)missing.push(`TASK-02: контрольных условий ${control.length}, требуется минимум 8 на навык`);
  const families=new Set(bank.map(t=>t.methodFamily).filter(v=>typeof v==='string'));
  if(families.size<3)missing.push('TASK-07: проверить сложность и минимум три семейства способов решения');
  if(!(topic.masteryRubric as {reviewed?:boolean}|undefined)?.reviewed)missing.push('MAST-01: утвердить рубрику освоения');
  if(bank.some(t=>!t.version||!Array.isArray(t.skillIds)||!t.skillIds.length))missing.push('TASK-03: заполнить версии и skillIds задач');
  return{topicId:topic.id,title:topic.title,track:topic.track,schoolOnly:Boolean(topic.schoolOnly),officialSection:topic.spec??null,prerequisites:topic.prerequisites||[],counts:{total:bank.length,examples:bank.length-practice.length-control.length,practice:practice.length,control:control.length,methodFamilies:families.size},missing};
 });
 const cycles:string[][]=[],missingDependencies:string[]=[],active:string[]=[],done=new Set<string>();const byId=new Map(topics.map(t=>[t.id,t]));
 const visit=(id:string)=>{const index=active.indexOf(id);if(index>=0){cycles.push([...active.slice(index),id]);return;}if(done.has(id))return;const topic=byId.get(id);if(!topic){missingDependencies.push(id);return;}active.push(id);for(const prerequisite of topic.prerequisites||[])visit(prerequisite);active.pop();done.add(id);};for(const topic of topics)visit(topic.id);
 return{schemaVersion:1,generatedAt:new Date().toISOString(),scope:'Published authored conditions; generated numeric variants counted separately, not as independent methods.',readiness:'requires-expert-review',topics:rows,cycles,missingDependencies:[...new Set(missingDependencies)]};
}
