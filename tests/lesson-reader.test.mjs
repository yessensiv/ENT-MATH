import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createContext,runInContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
import {withLessonEnrichment} from '../lib/lesson-enrichment.ts';
const require=createRequire(import.meta.url);
const compiled=ts.transpileModule(readFileSync(new URL('../components/lesson-reader.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(sourceTopic=topics.find(t=>t.id==='fractions')){
  const state=[],refs=[];let cursor=0,refIndex=0;
  const topic=withLessonEnrichment(sourceTopic);
  const calls={practice:0,stage:[],tutor:[]};
  const props={topic,curriculum:topics,lang:'ru',stage:0,onStage:n=>{calls.stage.push(n);props.stage=n;},onBack(){},backLabel:'К карте',originLabel:'Школьная программа',onPractice:()=>calls.practice++,onTutor:m=>calls.tutor.push(m),onVisual(){},onPrerequisite(){},simple:false,onSimple:v=>props.simple=v,exampleIndex:0,onExample:n=>props.exampleIndex=n,mastered:false};
  const hooks={...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useRef:initial=>refs[refIndex++]??(refs[refIndex-1]={current:initial})};
  const ctx=createContext({exports:{},require:id=>id==='react'?hooks:id==='./math-input'?{default:p=>React.createElement('input',{'aria-label':'Учебный ответ',value:p.value,onChange:e=>p.onChange(e.target.value)})}:id==='./solution-steps'?{default:p=>React.createElement('textarea',{'aria-label':'Учебные шаги',value:p.value,onChange:e=>p.onChange(e.target.value)})}:require(id),requestAnimationFrame:f=>f()});
  runInContext(compiled,ctx);
  const render=()=>{cursor=0;refIndex=0;return ctx.exports.default(props);};
  const walk=(node,result=[])=>{if(React.isValidElement(node)){result.push(node);React.Children.forEach(node.props.children,c=>walk(c,result));}return result;};
  const text=node=>typeof node==='string'||typeof node==='number'?String(node):React.isValidElement(node)?React.Children.toArray(node.props.children).map(text).join(''):'';
  const find=(tree,type,pattern)=>walk(tree).find(n=>n.type===type&&pattern.test(text(n)));
  return {props,calls,render,walk,find,html:()=>renderToStaticMarkup(render())};
}
test('lesson route shows current stage and keeps reading separate from mastery',()=>{
  const h=harness();let tree=h.render();const route=h.walk(tree).filter(n=>n.type==='button'&&n.props['aria-current']);assert.equal(route.length,1);
  assert.match(h.html(),/Математика в жизни/);assert.match(h.html(),/Полезные приёмы и лайфхаки/);assert.match(h.html(),/Освоение подтвердит практика/);
  h.find(tree,'button',/2Этап 2/).props.onClick();assert.equal(h.props.stage,1);assert.deepEqual(h.calls.stage,[1]);
});
test('all four examples can be selected, including the actual real life model',()=>{
  const h=harness();h.props.stage=1;const tree=h.render();h.find(tree,'button',/04Из жизни/).props.onClick();assert.equal(h.props.exampleIndex,3);
  assert.ok(h.html().includes(h.props.topic.lesson.enrichment.life.title.ru));assert.match(h.html(),/Вывод для жизни/);
});
test('guided help is progressive, preserves learner work, and reveals solution on request',()=>{
  const h=harness();h.props.stage=2;let tree=h.render();assert.equal(h.walk(tree).filter(n=>n.type==='li').length,0);
  h.find(tree,'button',/Дай первую подсказку/).props.onClick();tree=h.render();assert.equal(h.walk(tree).filter(n=>n.type==='li').length,1);
  const input=h.walk(tree).find(n=>n.type==='input'); // Input is a child component, inspect its props instead.
  assert.equal(input,undefined);
  const answer=h.walk(tree).find(n=>typeof n.type==='function'&&'numeric' in n.props);answer.props.onChange('3/4');
  const steps=h.walk(tree).find(n=>typeof n.type==='function'&&'onChange' in n.props&&!('numeric' in n.props));steps.props.onChange('1/2 = 2/4');
  h.props.lang='kk';tree=h.render();assert.ok(h.walk(tree).some(n=>n.props.value==='3/4'));assert.ok(h.walk(tree).some(n=>n.props.value==='1/2 = 2/4'));
  h.props.lang='ru';tree=h.render();h.find(tree,'button',/Сравнить с решением/).props.onClick();assert.match(h.html(),/Сверь каждый переход/);
});
test('why a step is valid passes the selected example and the actual step to tutor',()=>{
  const h=harness();h.props.stage=1;h.props.exampleIndex=2;const ex=h.props.topic.lesson.examples[2];h.find(h.render(),'button',/Почему так/).props.onClick();
  assert.ok(h.calls.tutor[0].includes(ex.problem.ru));assert.ok(h.calls.tutor[0].includes(ex.steps.ru[0]));
});
test('practice starts only from its explicit action, and page changes retain examples',()=>{
  const h=harness();h.props.stage=3;let tree=h.render();assert.equal(h.calls.practice,0);assert.match(h.html(),/Просмотр урока не означает освоение/);
  h.find(tree,'button',/Начать самостоятельную практику/).props.onClick();assert.equal(h.calls.practice,1);
  h.props.stage=1;h.props.exampleIndex=1;tree=h.render();h.find(tree,'button',/Назад/).props.onClick();assert.equal(h.props.stage,0);assert.equal(h.props.exampleIndex,1);
});
test('every lesson renders every stage in both languages without missing content',()=>{
  const all=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
  for(const t of all){const h=harness(t);for(const lang of ['ru','kk']){h.props.lang=lang;for(let stage=0;stage<4;stage++){
    h.props.stage=stage;const html=h.html();assert.ok(!html.includes('undefined'),`${t.id}/${lang}/${stage}`);assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
    if(stage===0)assert.ok(html.includes(lang==='ru'?'Математика в жизни':'Өмірдегі математика'),`${t.id}/${lang}`);
  }}}
});
