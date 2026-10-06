import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';
test('a restored lesson draft cannot overwrite the newly selected stage or example in the real save payload',()=>{
 const source=readFileSync('components/learning-app.tsx','utf8'),body=source.match(/const body=(\{[^;]+action:'save-lesson'[^;]+\});const key=JSON.stringify\(body\)/)?.[1];assert.ok(body);
 const result=vm.runInNewContext('JSON.stringify('+body+')',{work:{stage:2,exampleIndex:1,simple:true,answer:'4',steps:'2x=8',guidedHints:2},topic:{id:'linear'},lessonStep:0,exampleIndex:3,simple:false});
 assert.deepEqual(JSON.parse(result),{stage:0,exampleIndex:3,simple:false,answer:'4',steps:'2x=8',guidedHints:2,action:'save-lesson',topicId:'linear'});
});
