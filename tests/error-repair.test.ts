import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{recordAttempt,emptyState,type Task}from'../lib/engine.ts';
test('ERR-01: simple successes never close an unrelated complex mistake',()=>{
 const state=emptyState(),topic={id:'fractions',track:'base' as const,title:{ru:'Дроби',kk:'Бөлшектер'}};
 const task=(id:string,difficulty:number):Task=>({id,topicId:topic.id,type:'number',difficulty,answer:'1',prompt:topic.title,hints:{ru:[],kk:[]},solution:{ru:[],kk:[]}});
 const hard=task('hard',3),easy=[task('a',1),task('b',1),task('c',1)];recordAttempt(state,hard,topic,{answer:'0'},[hard,...easy]);
 for(const t of easy)recordAttempt(state,t,topic,{answer:'1'},[hard,...easy]);assert.equal(state.errors[0].resolved,false);
});
