import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{editorialPermissions}from'../lib/editorial-permissions.ts';
test('editorial roles fail closed and keep publication, writing and reviews independent',()=>{
 for(const raw of ['broken','[]','null','{"author@test":"author"}'])assert.equal(editorialPermissions('author@test',false,raw).access,false);
 const config=JSON.stringify({'Author@Test':['author'],'review@test':['math','kazakh'],'release@test':['publisher'],'fake@test':['admin']});
 assert.deepEqual(editorialPermissions('author@test',false,config),{access:true,author:true,publish:false,reviews:[]});
 assert.deepEqual(editorialPermissions('review@test',false,config),{access:true,author:false,publish:false,reviews:['math','kazakh']});
 assert.deepEqual(editorialPermissions('release@test',false,config),{access:true,author:false,publish:true,reviews:[]});
 assert.equal(editorialPermissions('fake@test',false,config).access,false);assert.equal(editorialPermissions('stranger@test',false,config).access,false);
 assert.equal(editorialPermissions('owner@test',true).reviews.length,3);
});
