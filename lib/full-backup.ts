export const backupTables=['learner_states','learner_state_chunks','content_overrides','content_reports','tutor_usage','support_invites','support_links','study_assignments','learner_backups','learner_backup_chunks','service_issues','editorial_reviews'] as const;
export type BackupTable={name:string;columns:string[];rows:Record<string,unknown>[]};
export type FullBackup={format:'ent-math-full-v1';createdAt:string;tables:BackupTable[];sha256:string};
export async function backupDigest(tables:BackupTable[]){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(tables)))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyBackup(value:unknown):Promise<FullBackup>{
 const b=value as FullBackup;if(!b||b.format!=='ent-math-full-v1'||!Array.isArray(b.tables)||b.tables.length!==backupTables.length||new Set(b.tables.map(t=>t.name)).size!==backupTables.length)throw Error('BACKUP_FORMAT');
 for(const table of b.tables){if(!(backupTables as readonly string[]).includes(table.name)||!Array.isArray(table.columns)||!table.columns.length||table.columns.some(c=>!/^[_a-z][_a-z0-9]*$/i.test(c))||!Array.isArray(table.rows)||table.rows.some(r=>!r||typeof r!=='object'||Object.keys(r).some(c=>!table.columns.includes(c))))throw Error('BACKUP_TABLE');}
 if(await backupDigest(b.tables)!==b.sha256)throw Error('BACKUP_HASH');return b;
}
