import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createContext,runInContext} from 'node:vm';import ts from 'typescript';
import * as position from '../lib/lesson-position.ts';
const source=ts.transpileModule(readFileSync('components/use-lesson-reading.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function harness(reading){
 const events=new Map(),timers=new Map(),frames=new Map(),saves=[];let cleanup,seq=0,finishFonts;
 const anchors=[{dataset:{readingAnchor:'life'},getBoundingClientRect:()=>({top:900-window.scrollY,height:400})}],details=[{dataset:{readingDetail:'detail-3'},open:false}];
 const element={isConnected:true,querySelectorAll:s=>s.startsWith('details')?details:anchors,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const window={scrollY:0,innerHeight:700,scrollTo:({top})=>window.scrollY=top,addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)};
 const context=createContext({exports:{},require:id=>id==='react'?{useRef:current=>({current}),useEffect:f=>cleanup=f()}:position,window,document:{fonts:{ready:new Promise(r=>finishFonts=r)},documentElement:{scrollHeight:4000}},setTimeout:f=>{timers.set(++seq,f);return seq;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:f=>{frames.set(++seq,f);return seq;},cancelAnimationFrame:id=>frames.delete(id)});
 runInContext(source,context);const capture={current:null};context.exports.useLessonReading({current:element},'0','ru',{},reading,v=>saves.push(JSON.parse(JSON.stringify(v))),capture);
 return {window,details,events,saves,capture,async ready(){finishFonts();await Promise.resolve();for(const f of frames.values())f();frames.clear();},tick(){for(const f of timers.values())f();timers.clear();},cleanup:()=>cleanup()};
}
test('real reading hook opens saved details before restoring and captures latest viewport synchronously',async()=>{
 const h=harness({positions:{'0':{anchor:'life',offset:0.5},'1:0':{anchor:'example',offset:0.1}},openDetails:['detail-3','mistakes']});
 assert.equal(h.details[0].open,true);await h.ready();assert.equal(h.window.scrollY,1000);assert.equal(h.saves.length,0);
 h.window.scrollY=900;h.details[0].open=false;h.capture.current();assert.equal(h.saves.length,1);
 assert.deepEqual(h.saves[0],{positions:{'0':{anchor:'life',offset:0.25},'1:0':{anchor:'example',offset:0.1}},openDetails:['mistakes']});
 h.capture.current();assert.equal(h.saves.length,1);h.cleanup();assert.equal(h.capture.current,null);assert.equal(h.events.size,0);
});
test('real reading hook never moves the learner after interaction while fonts are pending',async()=>{
 const h=harness({positions:{'0':{anchor:'life',offset:0.5}},openDetails:[]});h.window.scrollY=50;h.events.get('wheel')();await h.ready();assert.equal(h.window.scrollY,50);
 h.events.get('scroll')();h.tick();assert.equal(h.saves.length,1);h.cleanup();
});
