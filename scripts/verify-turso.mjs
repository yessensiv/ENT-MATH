import { createClient } from '@libsql/client';
const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
try {
 const tx = await client.transaction('write');
 try {
  await tx.execute('CREATE TABLE ent_connection_probe (id TEXT PRIMARY KEY, revision INTEGER NOT NULL)');
  await tx.execute({ sql: 'INSERT INTO ent_connection_probe VALUES (?,?)', args: ['probe',1] });
  const read = await tx.execute('SELECT revision FROM ent_connection_probe');
  if (read.rows[0]?.revision !== 1) throw Error('READ_BACK_FAILED');
  const changes = await tx.execute('UPDATE ent_connection_probe SET revision=2 WHERE revision=1');
  if (changes.rowsAffected !== 1) throw Error('WRITE_FAILED');
 } finally { await tx.rollback(); tx.close(); }
 const leftovers = await client.execute("SELECT name FROM sqlite_master WHERE name='ent_connection_probe'");
 if (leftovers.rows.length) throw Error('ROLLBACK_FAILED');
 const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
 console.log(JSON.stringify({connected:true,writeReadVerified:true,rollbackVerified:true,tables:tables.rows.length}));
} finally { client.close(); }
