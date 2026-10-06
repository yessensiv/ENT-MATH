// Append-only history, addressed by the aggregate's exact revision. Old backup
// pointers remain readable after later edits or restores; no destructive GC.
export const eventStreams=['attempts','exams','tutorMessages','tutorGenerations','submissions','submissionRequests'] as const;
export type EventStream=typeof eventStreams[number];
const arrayStreams=new Set<EventStream>(['attempts','exams','tutorMessages']);
export type EventRecord={stream:EventStream;id:string;position:number;data:string;deleted:number};
export type EventManifest={version:1;branch:string;revision:number;token:string;count:number;sha256:string;streams:EventStream[]};
export type EventState=Record<string,unknown>;
export type EventBaseline={manifest:EventManifest;records:EventRecord[]};
export type HistoryDatabase={prepare(sql:string):{bind(...values:(string|number)[]):{all<T>():Promise<{results:T[]}>}}};
const key=(r:EventRecord)=>r.stream+'\u0000'+r.id;
const ordered=(rows:EventRecord[])=>[...rows].sort((a,b)=>a.stream.localeCompare(b.stream)||a.position-b.position||a.id.localeCompare(b.id));
export async function eventDigest(rows:EventRecord[]){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(rows)))))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function extractEvents(state:EventState):EventRecord[]{
 const result:EventRecord[]=[];
 for(const stream of eventStreams){const value=state[stream];if(value===undefined)continue;
  if(arrayStreams.has(stream)){
   if(!Array.isArray(value))throw Error('EVENT_SHAPE');
   value.forEach((entry,position)=>{if(!entry||typeof entry!=='object')throw Error('EVENT_SHAPE');const id=typeof entry.id==='string'?entry.id:`legacy-${position}`;result.push({stream,id,position,data:JSON.stringify(entry),deleted:0});});
  }else{
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('EVENT_SHAPE');
   Object.entries(value).forEach(([id,entry],position)=>result.push({stream,id,position,data:JSON.stringify(entry),deleted:0}));
  }
 }
 if(new Set(result.map(key)).size!==result.length)throw Error('DUPLICATE_EVENT_ID');return result;
}
export function eventManifest(state:EventState):EventManifest|null{
 const v=state._entEvents as EventManifest|undefined;if(!v)return null;
 if(v.version!==1||typeof v.branch!=='string'||!v.branch||typeof v.token!=='string'||!v.token||!Number.isSafeInteger(v.revision)||v.revision<0||!Number.isSafeInteger(v.count)||v.count<0||!/^[a-f0-9]{64}$/.test(v.sha256)||!Array.isArray(v.streams)||new Set(v.streams).size!==v.streams.length||v.streams.some(s=>!eventStreams.includes(s)))throw Error('EVENT_MANIFEST');return v;
}
export const historyRowsSql=`SELECT e.stream,e.event_id AS id,e.position,e.data,e.deleted FROM learner_event_versions e
 WHERE e.user_id=? AND e.branch_id=? AND e.revision<=? AND e.revision=(
 SELECT MAX(v.revision) FROM learner_event_versions v WHERE v.user_id=e.user_id AND v.branch_id=e.branch_id AND v.stream=e.stream AND v.event_id=e.event_id AND v.revision<=?) AND e.deleted=0 ORDER BY e.stream,e.position,e.event_id`;
export async function hydrateEvents(state:EventState,rows:EventRecord[]):Promise<EventBaseline|null>{
 const manifest=eventManifest(state);if(!manifest)return null;
 if(rows.length!==manifest.count||await eventDigest(rows)!==manifest.sha256)throw Error('EVENT_INTEGRITY');
 for(const stream of eventStreams){delete state[stream];if(manifest.streams.includes(stream))state[stream]=arrayStreams.has(stream)?[]:{};}
 for(const row of ordered(rows)){
  if(!manifest.streams.includes(row.stream)||row.deleted)throw Error('EVENT_SHAPE');
  const value=JSON.parse(row.data);
  if(arrayStreams.has(row.stream))(state[row.stream] as unknown[]).push(value);
  else Object.defineProperty(state[row.stream] as object,row.id,{value,enumerable:true,writable:true,configurable:true});
 }
 return{manifest,records:rows};
}
export async function readEvents(db:HistoryDatabase,userId:string,state:EventState){const manifest=eventManifest(state);if(!manifest)return null;const rows=await db.prepare(historyRowsSql).bind(userId,manifest.branch,manifest.revision,manifest.revision).all<EventRecord>();return hydrateEvents(state,rows.results);}
export async function prepareEventSave(state:EventState,revision:number,baseline?:EventBaseline){
 const records=extractEvents(state),previous=new Map((baseline?.records||[]).map(r=>[key(r),r])),current=new Set(records.map(key));
 const changes=records.filter(r=>{const old=previous.get(key(r));return !old||old.data!==r.data||old.position!==r.position;});
 for(const [id,old]of previous)if(!current.has(id))changes.push({...old,data:'null',deleted:1});
 const manifest:EventManifest={version:1,branch:baseline?.manifest.branch||crypto.randomUUID(),revision,token:crypto.randomUUID(),count:records.length,sha256:await eventDigest(records),streams:eventStreams.filter(s=>state[s]!==undefined)};
 const aggregate={...state,_entEvents:manifest};for(const stream of eventStreams)delete (aggregate as EventState)[stream];
 const groups:EventRecord[][]=[];let group:EventRecord[]=[],bytes=2;
 for(const row of changes){const size=new TextEncoder().encode(JSON.stringify(row)).length+1;if(size>1400000)throw Error('EVENT_CAPACITY');if(group.length&&bytes+size>450000){groups.push(group);group=[];bytes=2;}group.push(row);bytes+=size;}if(group.length)groups.push(group);
 if(groups.length>30)throw Error('EVENT_MIGRATION_BATCH_REQUIRED');
 return{aggregate,manifest,groups,baseline:{manifest,records}};
}
export function eventWriteStatements(userId:string,manifest:EventManifest,groups:EventRecord[][]){return groups.map(group=>({sql:`INSERT INTO learner_event_versions(user_id,branch_id,stream,event_id,revision,position,data,deleted)
 SELECT ?,?,json_extract(value,'$.stream'),json_extract(value,'$.id'),?,json_extract(value,'$.position'),json_extract(value,'$.data'),json_extract(value,'$.deleted') FROM json_each(?)
 WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND revision=? AND json_extract(data,'$._entEvents.token')=?)`,params:[userId,manifest.branch,manifest.revision,JSON.stringify(group),userId,manifest.revision,manifest.token] as (string|number)[]}));}
export function legacyEventState(state:EventState){const result={...state};delete result._entEvents;return result;}
