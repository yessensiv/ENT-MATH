import {test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{publishedSnapshot}from'../lib/content-versions.ts';
test('CMS-02: a new draft preserves the last publication, including legacy history',()=>{
 const row={status:'draft',data:JSON.stringify({answer:'draft'}),history:JSON.stringify([{status:'published',previousData:null},{status:'draft',previousData:{answer:'published'}},{status:'draft',previousData:{answer:'draft 1'}}])};
 assert.deepEqual(publishedSnapshot(row),{answer:'published'});
 assert.equal(publishedSnapshot({...row,history:'[]'}),null);
 assert.deepEqual(publishedSnapshot({...row,status:'published',data:'{"answer":"new"}'}),{answer:'new'});
});
