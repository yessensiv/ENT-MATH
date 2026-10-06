// Rehearsal on a NEW restored copy only. Source backup is never modified.
import{spawnSync}from'node:child_process';import{DatabaseSync}from'node:sqlite';import{resolve}from'node:path';import assert from'node:assert/strict';
import{encodeState,decodeState,statePointer,stateSaveStatements}from'../lib/state-codec.ts';
import{prepareEventSave,eventWriteStatements,hydrateEvents,eventManifest,historyRowsSql,legacyEventState,eventDigest,extractEvents}from'../lib/event-storage.ts';
const [source,target]=process.argv.slice(2);if(!source||!target)throw Error('Usage: node --experimental-strip-types scripts/check-event-migration.mjs backup.json NEW.sqlite');
const restore=spawnSync(process.execPath,['--experimental-strip-types','scripts/restore-backup.mjs',source,target],{encoding:'utf8'});if(restore.status!==0)throw Error(restore.stderr);
const db=new DatabaseSync(resolve(target)),report=[];
function batch(list){db.exec('BEGIN IMMEDIATE');try{for(const s of list)db.prepare(s.sql).all(...s.params);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
async function load(userId){const row=db.prepare('SELECT * FROM learner_states WHERE user_id=?').get(userId),p=statePointer(row.data);const state=await decodeState(row.data,p?db.prepare('SELECT chunk_index AS chunkIndex,data FROM learner_state_chunks WHERE user_id=? AND token=? ORDER BY chunk_index').all(userId,p.token):[]);const m=eventManifest(state),baseline=m?await hydrateEvents(state,db.prepare(historyRowsSql).all(userId,m.branch,m.revision,m.revision)):null;return{row,state,baseline};}
try{for(const account of db.prepare('SELECT user_id FROM learner_states').all()){
 const {row,state,baseline}=await load(account.user_id),before=legacyEventState(state),digest=await eventDigest(extractEvents(state)),save=await prepareEventSave(state,row.revision+1,baseline||undefined),bundle=await encodeState({...save.aggregate,revision:row.revision+1},crypto.randomUUID());
 batch([...stateSaveStatements(row.user_id,row.email,row.revision,bundle,new Date().toISOString()),...eventWriteStatements(row.user_id,save.manifest,save.groups)]);
 const migrated=await load(row.user_id);assert.equal(await eventDigest(extractEvents(migrated.state)),digest);assert.deepEqual({...legacyEventState(migrated.state),revision:before.revision},before);
 const again=await prepareEventSave(migrated.state,migrated.row.revision+1,migrated.baseline);assert.equal(again.groups.length,0);
 // Add a clearly labelled rehearsal record, then prove rollback includes NEW data.
 migrated.state.attempts.push({id:'migration-rehearsal-only',at:new Date().toISOString(),answer:'fixture'});
 const delta=await prepareEventSave(migrated.state,migrated.row.revision+1,migrated.baseline),deltaBundle=await encodeState({...delta.aggregate,revision:migrated.row.revision+1},crypto.randomUUID());batch([...stateSaveStatements(row.user_id,row.email,migrated.row.revision,deltaBundle,'rehearsal'),...eventWriteStatements(row.user_id,delta.manifest,delta.groups)]);
 const latest=await load(row.user_id),rollback=await encodeState({...legacyEventState(latest.state),revision:latest.row.revision+1},crypto.randomUUID());batch(stateSaveStatements(row.user_id,row.email,latest.row.revision,rollback,'rehearsal-rollback'));
 const rolled=await load(row.user_id);assert.equal(rolled.baseline,null);assert.deepEqual(rolled.state.attempts,[...before.attempts,{...migrated.state.attempts.at(-1)}]);for(const key of Object.keys(before).filter(k=>!['attempts','revision'].includes(k)))assert.deepEqual(rolled.state[key],before[key]);
 report.push({attempts:before.attempts.length,exams:before.exams.length,errors:before.errors.length,eventChecksum:digest,historyPreserved:true,repeatedMigrationSafe:true,newWriteSurvivesRollback:true});
 }console.log(JSON.stringify({sourceBackupUnchanged:true,copy:resolve(target),integrity:db.prepare('PRAGMA integrity_check').get().integrity_check,accounts:report},null,2));}finally{db.close();}
