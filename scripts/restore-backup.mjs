// Restore only into a NEW local database. Never overwrites production or an existing file.
import{readFileSync,readdirSync,openSync,closeSync}from'node:fs';import{resolve}from'node:path';import{DatabaseSync}from'node:sqlite';
import{verifyBackup}from'../lib/full-backup.ts';import{decodeState,statePointer}from'../lib/state-codec.ts';
import{eventManifest,historyRowsSql,hydrateEvents}from'../lib/event-storage.ts';
const [input,target]=process.argv.slice(2);if(!input||!target)throw Error('Usage: node --experimental-strip-types scripts/restore-backup.mjs backup.json NEW.sqlite');
const backup=await verifyBackup(JSON.parse(readFileSync(input,'utf8')));const destination=resolve(target);closeSync(openSync(destination,'wx'));const db=new DatabaseSync(destination);
try{
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(resolve('drizzle',file),'utf8'));
 db.exec('BEGIN IMMEDIATE');try{for(const table of backup.tables){const columns=db.prepare(`PRAGMA table_info("${table.name}")`).all().map(c=>c.name);if(JSON.stringify(columns)!==JSON.stringify(table.columns))throw Error('SCHEMA_MISMATCH: '+table.name);const statement=db.prepare(`INSERT INTO "${table.name}" (${columns.map(c=>`"${c}"`).join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);for(const row of table.rows)statement.run(...columns.map(c=>row[c]??null));}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 async function verifyState(userId,head,chunks){const state=await decodeState(head,chunks),m=eventManifest(state);if(m)await hydrateEvents(state,db.prepare(historyRowsSql).all(userId,m.branch,m.revision,m.revision));}
 for(const row of db.prepare('SELECT user_id,data FROM learner_states').all()){const pointer=statePointer(row.data);const chunks=pointer?db.prepare('SELECT chunk_index AS chunkIndex,data FROM learner_state_chunks WHERE user_id=? AND token=? ORDER BY chunk_index').all(row.user_id,pointer.token):[];await verifyState(row.user_id,row.data,chunks);}
 for(const row of db.prepare('SELECT id,user_id,head FROM learner_backups').all()){const chunks=statePointer(row.head)?db.prepare('SELECT chunk_index AS chunkIndex,data FROM learner_backup_chunks WHERE backup_id=? ORDER BY chunk_index').all(row.id):[];await verifyState(row.user_id,row.head,chunks);}
 const integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;if(integrity!=='ok')throw Error('INTEGRITY: '+integrity);
 console.log(JSON.stringify({restored:true,destination,integrity,tables:backup.tables.map(t=>({name:t.name,count:db.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get().n})),sha256:backup.sha256},null,2));
}finally{db.close();}
