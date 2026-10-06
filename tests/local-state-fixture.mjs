// Only for explicitly labelled local_seedy tests. Back up chunk manifests and
// parts, and refuse restoration if a concurrent writer changes our revision.
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeState, decodeState, statePointer, stateSaveStatements } from "../lib/state-codec.ts";
import{eventManifest,historyRowsSql,hydrateEvents,legacyEventState}from'../lib/event-storage.ts';
export function localDatabase() {
  const dir = resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  for (const name of readdirSync(dir).filter(n => n.endsWith(".sqlite") && n !== "metadata.sqlite")) { const db = new DatabaseSync(resolve(dir, name)); if (db.prepare("SELECT name FROM sqlite_master WHERE name='learner_states'").get()) return db; db.close(); }
  throw new Error("Local D1 learner_states not found");
}
function transaction(db, statements) { db.exec("BEGIN IMMEDIATE"); try { const values = statements.map(s => db.prepare(s.sql).all(...s.params)); db.exec("COMMIT"); return values; } catch(e) { db.exec("ROLLBACK"); throw e; } }
export async function beginLocalFixture(makeState) {
  const db = localDatabase(), row = db.prepare("SELECT * FROM learner_states WHERE user_id=?").get("local_seedy"); assert.ok(row);
  const backupChunks = db.prepare("SELECT token,chunk_index,data FROM learner_state_chunks WHERE user_id=? ORDER BY token,chunk_index").all("local_seedy"), pointer = statePointer(row.data);
  const backupRows=db.prepare('SELECT * FROM learner_backups WHERE user_id=?').all('local_seedy');
  const backupParts=db.prepare('SELECT c.* FROM learner_backup_chunks c JOIN learner_backups b ON b.id=c.backup_id WHERE b.user_id=?').all('local_seedy');
  const backupEvents=db.prepare('SELECT * FROM learner_event_versions WHERE user_id=?').all('local_seedy');
  const backupDir = resolve(".sites-runtime/tests/backups"); mkdirSync(backupDir, { recursive: true });
  writeFileSync(resolve(backupDir, `${Date.now()}-${crypto.randomUUID()}.json`), JSON.stringify({ userId: "local_seedy", row, chunks: backupChunks,backups:backupRows,backupParts,events:backupEvents }));
  const original = await decodeState(row.data, pointer ? backupChunks.filter(r => r.token === pointer.token).map(r => ({ chunkIndex: r.chunk_index, data: r.data })) : []);
  const manifest=eventManifest(original);if(manifest)await hydrateEvents(original,db.prepare(historyRowsSql).all('local_seedy',manifest.branch,manifest.revision,manifest.revision));
  const state = { ...legacyEventState(makeState(original)), revision: row.revision + 1, localIntegrationFixture: true };
  const bundle = await encodeState(state, `local-fixture-${crypto.randomUUID()}`);
  assert.equal(transaction(db, stateSaveStatements("local_seedy", row.email, row.revision, bundle, new Date().toISOString()))[0].length, 1);
  return { db, original, revision: row.revision + 1, async restore(expectedRevision) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const changed = db.prepare("UPDATE learner_states SET data=?,revision=revision+1,email=?,updated_at=? WHERE user_id=? AND revision=?").run(row.data, row.email, new Date().toISOString(), "local_seedy", expectedRevision); assert.equal(changed.changes, 1, "Another writer intervened; fixture restoration must not overwrite it");
      db.prepare("DELETE FROM learner_state_chunks WHERE user_id=?").run("local_seedy");
      for (const part of backupChunks) db.prepare("INSERT INTO learner_state_chunks VALUES(?,?,?,?)").run("local_seedy", part.token, part.chunk_index, part.data);
      db.prepare('DELETE FROM learner_backup_chunks WHERE backup_id IN (SELECT id FROM learner_backups WHERE user_id=?)').run('local_seedy');
      db.prepare('DELETE FROM learner_backups WHERE user_id=?').run('local_seedy');
      for(const b of backupRows)db.prepare('INSERT INTO learner_backups VALUES(?,?,?,?,?)').run(b.id,b.user_id,b.head,b.revision,b.created_at);
      for(const b of backupParts)db.prepare('INSERT INTO learner_backup_chunks VALUES(?,?,?)').run(b.backup_id,b.chunk_index,b.data);
      db.prepare('DELETE FROM learner_event_versions WHERE user_id=?').run('local_seedy');
      for(const e of backupEvents)db.prepare('INSERT INTO learner_event_versions(user_id,branch_id,stream,event_id,revision,position,data,deleted) VALUES(?,?,?,?,?,?,?,?)').run(e.user_id,e.branch_id,e.stream,e.event_id,e.revision,e.position,e.data,e.deleted);
      db.exec("COMMIT");
    } catch(e) { db.exec("ROLLBACK"); throw e; } finally { db.close(); }
  } };
}
