import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{claimTutorMessage,completeTutorMessage,tutorHistory,type TutorHistoryState}from'../lib/tutor-history.ts';
test('AI-02/07: one request owns one generation; conflicting replay and duplicate reply are fenced',()=>{
 const s:TutorHistoryState={};claimTutorMessage(s,'message-1','hash','linear:task','Помоги');claimTutorMessage(s,'message-1','hash','linear:task','Помоги');assert.equal(s.tutorMessages?.length,1);
 assert.throws(()=>claimTutorMessage(s,'message-1','other','linear:task','Другой вопрос'),/CONFLICT/);
 const result={reply:'Первый шаг',mode:'study-helper'};completeTutorMessage(s,'message-1',result);completeTutorMessage(s,'message-1',{reply:'Дубликат'});assert.equal(s.tutorMessages?.length,2);assert.equal(tutorHistory(s,'linear:task').messages[1].content,result.reply);assert.equal(tutorHistory(s,'other').messages.length,0);
});
