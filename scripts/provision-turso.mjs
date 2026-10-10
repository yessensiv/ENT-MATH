// Creates schema only on an empty target. No existing learner data is overwritten.
import { readFileSync, readdirSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { verifyBackup } from '../lib/full-backup.ts';
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
try {
 const existing = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
 if (existing.rows.length) throw Error('TARGET_NOT_EMPTY: refuse to overwrite existing database');
 const backup = process.argv[2] ? await verifyBackup(JSON.parse(readFileSync(process.argv[2], 'utf8'))) : null;
 const tx = await client.transaction('write');
 try {
  for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
   for (const sql of readFileSync(`drizzle/${file}`, 'utf8').split('--> statement-breakpoint').filter(s => s.trim())) await tx.execute(sql);
  }
  if (backup) for (const table of backup.tables) {
   const columns = (await tx.execute(`PRAGMA table_info("${table.name}")`)).rows.map(r => r.name);
   if (JSON.stringify(columns) !== JSON.stringify(table.columns)) throw Error('SCHEMA_MISMATCH');
   for (const row of table.rows) await tx.execute({ sql: `INSERT INTO "${table.name}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, args: columns.map(c => row[c] ?? null) });
   const count = (await tx.execute(`SELECT COUNT(*) AS n FROM "${table.name}"`)).rows[0].n;
   if (Number(count) !== table.rows.length) throw Error('ROW_COUNT_MISMATCH');
  }
  await tx.commit();
 } catch (error) { await tx.rollback(); throw error; } finally { tx.close(); }
 console.log(JSON.stringify({ schemaCreated: true, historyImported: Boolean(backup), sourceDigest: backup?.sha256 ?? null }));
} finally { client.close(); }
