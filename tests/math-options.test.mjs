import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createContext,runInContext} from 'node:vm';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function compile(file,imports={}){
 const exports={};
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInContext(source,createContext({exports,require:id=>imports[id]??require(id)}));return exports;
}
const formatter=compile('../lib/math-format.ts');
const math=compile('../components/formatted-math.tsx',{'../lib/math-format':formatter});
const options=compile('../components/math-options.tsx',{'./formatted-math':math});
test('matching options render mathematical choices and preserve the actual submitted value',()=>{
 let selected;
 const tree=options.default({label:'Соответствие 1',options:[{value:'1/2',label:'1/2'},{value:'x^2',label:'x^2'}],value:'1/2',onChange:value=>selected=value});
 const html=renderToStaticMarkup(tree);
 assert.match(html,/<mfrac>/);assert.match(html,/<msup>/);assert.doesNotMatch(html,/<select/);
 const buttons=tree.props.children;
 assert.equal(buttons[0].props['aria-pressed'],true);
 buttons[1].props.onClick();assert.equal(selected,'x^2');
});
