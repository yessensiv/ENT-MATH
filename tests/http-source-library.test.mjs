// Run against the isolated loopback test server, never production.
import {test} from 'node:test';
import assert from 'node:assert/strict';
const base=process.env.ENT_LIBRARY_TEST_URL||'http://127.0.0.1:5188';
assert.equal(new URL(base).hostname,'127.0.0.1');
const headers={'oai-authenticated-user-id':'source_library_test','oai-authenticated-user-email':'library-check@example.invalid'};
test('source archive API protects originals, filters, lazy-loads, and rejects unknown IDs',async()=>{
 const call=async(path,auth=headers)=>{const r=await fetch(base+path,{headers:auth});return{status:r.status,data:await r.json()};};
 assert.equal((await call('/api/admin/source-library',{})).status,401);
 assert.equal((await call('/api/admin/source-library',{'oai-authenticated-user-id':'source_library_learner','oai-authenticated-user-email':'learner@example.invalid'})).status,403);
 const list=await call('/api/admin/source-library?book=intermediate-algebra&topic=numbers&q=Exercises');
 assert.equal(list.status,200);assert.ok(list.data.total>0);assert.ok(list.data.pages.length<=20);
 const row=list.data.pages.find(p=>p.status==='draft'&&p.candidateCount>0);assert.ok(row);
 const loaded=await call('/api/admin/source-library?id='+row.id);assert.equal(loaded.status,200);
 assert.equal(loaded.data.material.id,row.id);assert.equal(loaded.data.material.license,'CC BY 4.0');
 assert.ok(loaded.data.material.originalText.length>100);assert.equal(loaded.data.material.exercises.length,row.candidateCount);
 assert.equal(loaded.data.material.reviewStatus,'unreviewed');
 assert.equal((await call('/api/admin/source-library?id=../../.dev.vars')).status,404);
 assert.equal((await call('/api/admin/source-library?id=00000000000000000000')).status,404);
});
