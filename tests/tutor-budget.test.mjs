import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/server-store.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('store.ts',source,ts.ScriptTarget.Latest,true);
const names=new Set(['consumeTutorBudget','releaseFailedTutorBudget','tokenLimitForAttempts','sqlIncrement','lessThanLimit','settleTutorTokens']);
const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.has(n.name?.text)).map(n=>n.getText(ast).replace(/^export /,'')).join('\n');
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE tutor_usage(id TEXT PRIMARY KEY,user_id TEXT,day TEXT,requests INTEGER DEFAULT 0,reserved_tokens INTEGER DEFAULT 0)');
 const fields={id:'id',userId:'user_id',day:'day',requests:'requests',reservedTokens:'reserved_tokens'};
 const table=Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{text:v,params:[]}]));
 const sql=(parts,...values)=>{let text=parts[0],params=[];values.forEach((v,i)=>{if(v&&typeof v==='object'&&'text'in v){text+=v.text;params.push(...v.params);}else{text+='?';params.push(v);}text+=parts[i+1];});return{text,params};};
 const eq=(a,b)=>sql`${a}=${b}`,lt=(a,b)=>sql`${a}<${b}`;
 const and=(...args)=>({text:args.map(a=>'('+a.text+')').join(' AND '),params:args.flatMap(a=>a.params)});
 const getDb=()=>({insert:()=>({values:row=>({onConflictDoNothing:()=>{const keys=Object.keys(row);db.prepare('INSERT OR IGNORE INTO tutor_usage('+keys.map(k=>fields[k]).join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}})}),update:()=>({set:values=>({where:where=>{const entries=Object.entries(values),query='UPDATE tutor_usage SET '+entries.map(([k,v])=>fields[k]+'='+v.text).join(',')+' WHERE '+where.text,params=[...entries.flatMap(([,v])=>v.params),...where.params];return{then:resolve=>resolve(db.prepare(query).run(...params)),returning:()=>db.prepare(query+' RETURNING requests AS count').all(...params)};}})})});
 class ApiError extends Error{constructor(message,status){super(message);this.status=status;}}
 const ctx=createContext({getDb,tutorUsage:table,configuration:()=>({TUTOR_DAILY_LIMIT:'2',TUTOR_DAILY_TOKEN_LIMIT:'24000'}),sql,eq,lt,and,ApiError,Intl,Date});
 runInContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);
 return{ctx,db,user:{userId:'test-student'},rows:()=>db.prepare('SELECT * FROM tutor_usage ORDER BY id').all()};
}
test('failed provider answer releases learner quota but retains bounded attempt accounting',async()=>{
 const f=fixture();await f.ctx.consumeTutorBudget(f.user);await f.ctx.releaseFailedTutorBudget(f.user);
 const rows=f.rows();assert.equal(rows[0].requests,0);assert.equal(rows[0].reserved_tokens,0);assert.equal(rows[1].requests,1);assert.equal(rows[1].reserved_tokens,8000);
 await f.ctx.consumeTutorBudget(f.user);await f.ctx.consumeTutorBudget(f.user);await assert.rejects(()=>f.ctx.consumeTutorBudget(f.user),/лимит ИИ/);f.db.close();
});
test('repeated failures still reach the independent protective cap',async()=>{
 const f=fixture();for(let i=0;i<6;i++){await f.ctx.consumeTutorBudget(f.user);await f.ctx.releaseFailedTutorBudget(f.user);}
 await assert.rejects(()=>f.ctx.consumeTutorBudget(f.user),/защитный лимит/);assert.equal(f.rows()[0].requests,0);f.db.close();
});

test('successful answer keeps request count but replaces estimated tokens with reported usage',async()=>{
 const f=fixture();const budget=await f.ctx.consumeTutorBudget(f.user);await f.ctx.settleTutorTokens(budget.reservationId,2100,100);assert.equal(f.rows()[0].requests,1);assert.equal(f.rows()[0].reserved_tokens,2200);assert.equal(f.rows()[1].reserved_tokens,8000);f.db.close();
});
