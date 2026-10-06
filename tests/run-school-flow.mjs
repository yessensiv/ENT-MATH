import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { beginLocalFixture } from './local-state-fixture.mjs';
const base=process.env.ENT_TEST_BASE_URL||'http://127.0.0.1:5173';
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
const cookie=sign.headers.get('set-cookie').split(';')[0];
async function state(){const r=await fetch(base+'/api/state',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();}
const before=await state();assert.equal(before.user.id,'local_seedy');assert.ok(before.profile);assert.equal(before.activeExam,null);
const fixture=await beginLocalFixture(original=>({...original,schoolFixture:true}));
let code;
try{
 code=await new Promise(resolve=>{const child=spawn(process.execPath,['--experimental-strip-types','--test','tests/http-school.test.mjs'],{cwd:process.cwd(),env:process.env,stdio:'inherit'});child.on('close',c=>resolve(c));child.on('error',()=>resolve(1));});
 assert.equal(code,0);const done=await state();assert.equal(done.revision,fixture.revision+26);assert.equal(done.schoolFixture,true);
}finally{const done=await state();assert.equal(done.schoolFixture,true,'Restore only our isolated school fixture');await fixture.restore(done.revision);}
const after=await state();for(const key of ['profile','attempts','errors','progress','reviews','exams','xp','diagnosticDraft'])assert.deepEqual(after[key],before[key],key);
console.log('School flow verified; original learner state restored.');
