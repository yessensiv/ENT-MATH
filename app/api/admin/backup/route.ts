import{adminAuthenticate,configuration,response,failure,ApiError}from'@/lib/server-store';
import{backupTables,backupDigest,type BackupTable}from'@/lib/full-backup';
export async function GET(){try{
 await adminAuthenticate();const db=configuration().DB;if(!db)throw new ApiError('База недоступна.',503);
 // D1 batch reads form one snapshot; table names are fixed application constants.
 const result=await db.batch(backupTables.flatMap(name=>[db.prepare(`PRAGMA table_info("${name}")`),db.prepare(`SELECT * FROM "${name}" LIMIT 10001`)]));
 const tables:BackupTable[]=backupTables.map((name,i)=>({name,columns:(result[i*2].results as {name:string}[]).map(c=>c.name),rows:result[i*2+1].results as Record<string,unknown>[]}));
 if(tables.some(t=>t.rows.length>10000))throw new ApiError('База превышает лимит браузерного экспорта. Используйте полный экспорт D1; неполная копия не будет выдана.',413,'BACKUP_CAPACITY');
 const backup={format:'ent-math-full-v2',createdAt:new Date().toISOString(),tables,sha256:await backupDigest(tables)};
 const encoded=JSON.stringify(backup);if(new TextEncoder().encode(encoded).length>24000000)throw new ApiError('Нужен полный экспорт D1: копия превышает 24 МБ.',413,'BACKUP_CAPACITY');
 return new Response(encoded,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="ent-math-full-backup.json"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return failure(e);}}
