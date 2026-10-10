import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/d1';
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { TursoD1 } from '../lib/turso-d1.ts';
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
