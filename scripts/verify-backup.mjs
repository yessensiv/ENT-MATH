// Verify a downloaded full backup without sending any learner data elsewhere.
import{readFileSync}from'node:fs';import{verifyBackup}from'../lib/full-backup.ts';
const path=process.argv[2];if(!path)throw Error('Provide the full backup JSON path');
const backup=await verifyBackup(JSON.parse(readFileSync(path,'utf8')));
console.log(JSON.stringify({verified:true,createdAt:backup.createdAt,sha256:backup.sha256,tables:backup.tables.map(t=>({name:t.name,count:t.rows.length}))},null,2));
