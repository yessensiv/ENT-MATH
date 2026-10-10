import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { TursoD1 } from '../lib/turso-d1.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { encodeState, decodeState, stateSaveStatements } from '../lib/state-codec.ts';
import { prepareEventSave, eventWriteStatements, readEvents } from '../lib/event-storage.ts';
test('Turso adapter preserves Drizzle values, ordered raw rows, CAS and atomic rollback', async () => {
 const client = createClient({ url: ':memory:' });
 const db = new TursoD1(client);
 try {
  await db.prepare('CREATE TABLE example(id TEXT PRIMARY KEY, revision INTEGER NOT NULL)').run();
  const table = sqliteTable('example', { id: text('id').primaryKey(), revision: integer('revision').notNull() });
  const orm = drizzle(db);
  await orm.insert(table).values({ id: 'student', revision: 1 });
  assert.deepEqual(await orm.select().from(table), [{ id: 'student', revision: 1 }]);
  assert.deepEqual(await db.prepare('SELECT revision,id FROM example').raw(), [[1,'student']]);
  assert.equal((await db.prepare('UPDATE example SET revision=2 WHERE id=? AND revision=1').bind('student').run()).meta.changes, 1);
  assert.equal((await db.prepare('UPDATE example SET revision=3 WHERE id=? AND revision=1').bind('student').run()).meta.changes, 0);
  await assert.rejects(db.batch([db.prepare('UPDATE example SET revision=99'), db.prepare("INSERT INTO example VALUES('student',1)")]));
  assert.equal(await db.prepare('SELECT revision FROM example').first('revision'), 2);
 } finally { client.close(); }
});
test('existing learner chunks and immutable events survive Turso saves and stale writes', async () => {
 const client = createClient({url: ':memory:'}); const db = new TursoD1(client);
 try {
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) await client.executeMultiple(readFileSync(`drizzle/${file}`,'utf8'));
  const initial={profile:{language:'kk'},attempts:[],exams:[],tutorMessages:[],tutorGenerations:{},submissions:{},submissionRequests:{}};
  await db.prepare('INSERT INTO learner_states(user_id,email,data,revision,updated_at) VALUES(?,?,?,?,?)').bind('google:test','test@example.com',JSON.stringify(initial),0,'2026-10-10').run();
  const changed={...initial,largeNote:'x'.repeat(650000),attempts:[{id:'attempt1',correct:false}],revision:1};
  const events=await prepareEventSave(changed,1); const bundle=await encodeState(events.aggregate,'token1');
  const statements=[...stateSaveStatements('google:test','test@example.com',0,bundle,'2026-10-10'),...eventWriteStatements('google:test',events.manifest,events.groups)];
  await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.params)));
  const row=await db.prepare('SELECT data,revision FROM learner_states').first();
  const chunks=(await db.prepare('SELECT chunk_index AS chunkIndex,data FROM learner_state_chunks ORDER BY chunk_index').all()).results;
  const decoded=await decodeState(row.data,chunks); await readEvents(db,'google:test',decoded);
  assert.equal(row.revision,1); assert.equal(decoded.profile.language,'kk'); assert.equal(decoded.largeNote.length,650000); assert.deepEqual(decoded.attempts,changed.attempts);
  const stale=await encodeState({...initial,revision:1},'stale');
  const staleResults=await db.batch(stateSaveStatements('google:test','test@example.com',0,stale,'2026-10-11').map(s=>db.prepare(s.sql).bind(...s.params)));
  assert.equal(staleResults[0].results.length,0);
  assert.equal((await db.prepare('SELECT data FROM learner_states').first()).data,row.data);
 } finally {client.close();}
});
