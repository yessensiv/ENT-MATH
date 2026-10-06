import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests.
import {equivalent, emptyState, recordAttempt, makeExam, type Task} from '../lib/engine.ts';
// @ts-expect-error Native Node tests.
import {topics, tasks} from '../lib/content.ts';

test('TASK-04: a polynomial crafted to vanish at old sample points is not x',()=>{
 assert.equal(equivalent('x+(x+9.7)*(x+3)*(x+1)*(x+0.2)*x*(x-0.17)*(x-0.5)*(x-1)*(x-2)*(x-4.3)*(x-11)','x'),false);
});
test('TASK-06: a replay cannot create a second attempt or erase its independent result',()=>{
 const state=emptyState(); const topic={id:'test',title:{ru:'Тест',kk:'Тест'},track:'base' as const};
 const task:Task={id:'test-1',topicId:'test',type:'number',answer:'4',prompt:topic.title,difficulty:1,hints:{ru:[],kk:[]},solution:{ru:[],kk:[]}};
 const input={answer:'4',submissionId:'550e8400-e29b-41d4-a716-446655440000'};
 const first=recordAttempt(state,task,topic,input,[task]); const snapshot=JSON.stringify(state);
 assert.deepEqual(recordAttempt(state,task,topic,input,[task]),first);assert.equal(JSON.stringify(state),snapshot);
 assert.throws(()=>recordAttempt(state,task,topic,{...input,answer:'5'},[task]),/SUBMISSION_CONFLICT/);
});
test('EXAM-02: percent/order context does not create motion mistakes',()=>{
 const exam=makeExam('profile',1,topics as never,tasks.map(t=>({...t,difficulty:t.level})) as never);
 assert.equal(exam.questions.filter(t=>t.context).some(t=>t.topicId==='motion'),false);
});
test('ARCH-01: a later material edit cannot alter a new attempt snapshot',()=>{
 const state=emptyState(),topic={id:'linear',track:'profile' as const,title:{ru:'A',kk:'A'}},task:Task={id:'snapshot',topicId:'linear',type:'number',answer:'4',prompt:topic.title,difficulty:1,hints:{ru:[],kk:[]},solution:{ru:['2x=8'],kk:['2x=8']}};
 recordAttempt(state,task,topic,{answer:'4'},[task]);task.solution.ru[0]='changed';task.answer='8';
 assert.equal(state.attempts[0].taskSnapshot?.answer,'4');assert.equal(state.attempts[0].taskSnapshot?.solution.ru[0],'2x=8');assert.ok(state.attempts[0].taskVersion);assert.ok(state.attempts[0].checkingVersion);
});
