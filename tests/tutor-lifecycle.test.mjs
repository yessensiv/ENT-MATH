import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import {tutorContextKey} from '../lib/tutor-context.ts';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const source=readFileSync(new URL('../components/learning-app.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('learning-app.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let taskExpression,navigateExpression,resetEffect;
function walk(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)){
  if(node.name.text==='tutorTaskId')taskExpression=node.initializer;
  if(node.name.text==='navigate')navigateExpression=node.initializer;
}if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'&&node.arguments[0].getText(ast).includes('setChat([])'))resetEffect=node.arguments[0];ts.forEachChild(node,walk);}walk(ast);
const run=(context,text)=>runInContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
test('moving practice into the mentor keeps the current task and conversation, changing the task clears context',()=>{
  let chat=[];
  const context=createContext({user:null,topic:{id:'numbers'},currentTask:{id:'numbers-4',topicId:'numbers'},screen:'practice',mentorTaskContext:{current:undefined},tutorContext:{current:''},tutorContextKey,
    flushDraft(){},requestGeneration:{current:0},routeRef:{current:'practice'},setScreen:s=>context.screen=s,setMenu(){},setLessonOrigin(){},location:{hash:''},window:{scrollTo(){}},setChat:c=>chat=c,setChatMode(){}});
  const render=()=>{run(context,`var tutorTaskId=${taskExpression.getText(ast)}; (${resetEffect.getText(ast)})();`);};
  render();chat=[{role:'assistant',content:'Сначала 3 · 6 = 18.'}];
  run(context,`(${navigateExpression.getText(ast)})('mentor');`);render();
  assert.equal(context.tutorTaskId,'numbers-4');assert.equal(chat.length,1);
  context.currentTask={id:'numbers-5',topicId:'numbers'};render();assert.equal(context.tutorTaskId,undefined);assert.equal(chat.length,0);
});
test('a stale practice task cannot attach itself to help from another lesson',()=>{
  const context=createContext({screen:'mentor',topic:{id:'fractions'},currentTask:{id:'numbers-4',topicId:'numbers'},mentorTaskContext:{current:'numbers-4'}});
  run(context,`var tutorTaskId=${taskExpression.getText(ast)};`);assert.equal(context.tutorTaskId,undefined);
});

test('exam direction selection has one selected tab and cannot change the school profile',()=>{
  let tabs;
  function find(node){if(ts.isJsxElement(node)&&node.openingElement.getText(ast).includes('exam-track-tabs'))tabs=node;ts.forEachChild(node,find);}find(ast);assert.ok(tabs);
  let selected='profile';const context=createContext({exports:{},React,examTrack:'profile',track:'base',tr:ru=>ru,tracks:{profile:{ru:'Профильная'},literacy:{ru:'Грамотность'}},lang:'ru',setExamTrack:value=>selected=value,changeTrack:()=>{throw new Error('Exam selection must not edit a profile');}});
  const code=ts.transpileModule(`exports.tabs=()=>(${tabs.getText(ast)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;runInContext(code,context);
  const tree=context.exports.tabs();const buttons=React.Children.toArray(tree.props.children);assert.equal((renderToStaticMarkup(tree).match(/aria-pressed="true"/g)||[]).length,1);
  buttons[1].props.onClick();assert.equal(selected,'literacy');assert.equal(context.track,'base');
});

test('starting a literacy exam uses the selected exam direction while retaining the school route',async()=>{
  let start;
  function find(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='startExam')start=node.initializer;ts.forEachChild(node,find);}find(ast);
  const requests=[],profile={learningMode:'school',grade:'5',track:'base'};
  const context=createContext({state:{profile},examTrack:'literacy',track:'base',setOnboard(){},setExamReview(){},setExamIndex(){},setTimeLeft(){},setFinishConfirm(){},expiredHandled:{current:''},savedExamSignature:{current:''},act:async body=>requests.push(body)});
  run(context,`var start=${start.getText(ast)};`);await context.start(3);assert.equal(requests[0].track,'literacy');assert.equal(requests[0].variant,3);assert.equal(profile.learningMode,'school');assert.equal(profile.track,'base');
});
