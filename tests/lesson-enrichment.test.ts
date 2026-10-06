import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node checks use explicit extensions.
import {topics} from '../lib/content.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {schoolTopics} from '../lib/school-content.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {lessonEnrichment,validLessonEnrichment,withLessonEnrichment} from '../lib/lesson-enrichment.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {calculate} from '../lib/engine.ts';
// @ts-expect-error Native Node checks use explicit extensions.
import {offlineHtml} from '../lib/offline-pack.ts';
const all=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
test('every one of 121 lessons has its own complete bilingual supplement',()=>{
  assert.equal(all.length,121);assert.equal(Object.keys(lessonEnrichment).length,121);
  assert.deepEqual(Object.keys(lessonEnrichment).sort(),all.map(t=>t.id).sort());
  for(const t of all){const e=lessonEnrichment[t.id];assert.ok(validLessonEnrichment(e),t.id);
    assert.equal(e.life.steps.ru.length,e.life.steps.kk.length,t.id);
    for(const l of ['ru','kk'] as const){assert.ok(e.intuition[l].length>=35,t.id);assert.ok(e.details.every(n=>n.body[l].length>=80),t.id);assert.ok(e.hacks.every(n=>n.caution[l].length>=20),t.id);assert.ok(e.life.problem[l].length>=45,t.id);}
  }
});
test('supplements are distinct explanations and actual extra examples',()=>{
  assert.equal(new Set(all.map(t=>lessonEnrichment[t.id].life.problem.ru)).size,121);
  assert.equal(new Set(all.map(t=>lessonEnrichment[t.id].intuition.ru)).size,121);
  for(const t of all)assert.ok(t.lesson.examples.every(ex=>ex.problem.ru!==lessonEnrichment[t.id].life.problem.ru),t.id);
});
test('numeric life model checks are independently calculated by the safe engine',()=>{
  let checks=0;
  for(const t of all){const e=lessonEnrichment[t.id];assert.ok(e.checks.length>0,t.id);for(const c of e.checks){
    assert.match(c.expression,/^[0-9+*/().\s-]+$/,t.id);assert.ok(Number.isFinite(c.expected),t.id);
    const result=calculate(c.expression.replace(/\*\*/g,'^'));assert.ok(result!==null&&Math.abs(result-c.expected)<1e-7,`${t.id}: ${c.expression} = ${result}, expected ${c.expected}`);checks++;
  }}assert.ok(checks>=121);
});
test('enrichment preserves existing lesson examples and all task keys',()=>{
  for(const t of all){const copy=withLessonEnrichment(t);assert.equal(copy.tasks,t.tasks);assert.equal(copy.lesson.examples,t.lesson.examples);assert.equal(copy.lesson.guided,t.lesson.guided);assert.equal(copy.lesson.enrichment,lessonEnrichment[t.id]);assert.equal(t.lesson.enrichment,undefined);}
});
test('incomplete supplements cannot pass the publication structure check',()=>{
  const e=lessonEnrichment.fractions;
  for(const bad of [null,{}, {...e,details:[]},{...e,hacks:[{...e.hacks[0],caution:{ru:'',kk:'x'}}]},{...e,life:{...e.life,steps:{ru:['1','2','3'],kk:['1']}}},{...e,intuition:{ru:'',kk:'x'}}])assert.equal(validLessonEnrichment(bad),false);
});
test('offline lessons include the full supplement in both languages and escape HTML',()=>{
  for(const language of ['ru','kk'] as const){const t=withLessonEnrichment(topics.find(t=>t.id==='fractions')!);const html=offlineHtml({id:'lesson-test',topic:t,tasks:[],language,createdAt:'2026-10-06'});
    assert.ok(html.includes(t.lesson.enrichment!.life.title[language]));assert.ok(html.includes(t.lesson.enrichment!.details[0].title[language]));assert.ok(html.includes(t.lesson.enrichment!.hacks[0].title[language]));
    const malicious={...t,lesson:{...t.lesson,enrichment:{...t.lesson.enrichment!,intuition:{ru:'<script>alert(1)</script>',kk:'<script>alert(1)</script>'}}}};
    const escaped=offlineHtml({id:'lesson-test',topic:malicious,tasks:[],language,createdAt:'2026-10-06'});assert.ok(!escaped.includes('<script>alert(1)</script>'));assert.ok(escaped.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  }
});
