import {test} from 'node:test';
import assert from 'node:assert/strict';
import {curriculumPracticeTasks as bank} from '../lib/curriculum-practice.ts';
import {makeCurriculumPractice} from '../lib/curriculum-practice-generator.ts';

test('geometry conditions state the hypotheses required by their formulas',()=>{
 for(const q of bank.filter(q=>q.topicId==='sections'&&q.difficulty===2)){
  assert.match(q.prompt.ru,/параллельн.*основан/iu,q.id);
  assert.match(q.prompt.kk,/табан.*параллель/iu,q.id);
 }
 for(const q of bank.filter(q=>q.topicId==='prisms'&&q.difficulty===3)){
  assert.match(q.prompt.ru,/прямоугольный/iu,q.id);
  assert.match(q.prompt.kk,/тікбұрышты/iu,q.id);
 }
});

test('rounding to hundredths actually requires discarding a nonzero digit',()=>{
 for(let serial=1;serial<=48;serial+=2){
  const q=makeCurriculumPractice('school-rounding',serial,2);
  assert.ok(q);
  const given=Number(q.prompt.ru.match(/Округли ([\d,]+)/)[1].replace(',','.'));
  assert.notEqual(given,Number(q.answer),q.id);
  assert.equal(Math.round((given+1e-10)*100)/100,Number(q.answer));
 }
});

test('real-life decimal examples use plausible quantities and matching units',()=>{
 for(const q of bank.filter(q=>q.topicId==='school-decimals'&&q.difficulty===2&&q.curriculumPractice.serial%2===1)){
  assert.equal(q.units,'кг');assert.match(q.prompt.ru,/крупы/);assert.match(q.prompt.kk,/жарма/);
  assert.ok(q.solution.ru.at(-1).includes('кг'));
 }
});

test('high-level statistics and inverse trigonometry require more than direct lookup',()=>{
 for(const q of bank.filter(q=>q.topicId==='statistics'&&q.difficulty===3)){
  assert.match(q.prompt.ru,/среднее.*медиан/iu);assert.match(q.prompt.kk,/орташа.*медиан/iu);
 }
 for(const q of bank.filter(q=>q.topicId==='school-inverse-trig'&&q.difficulty===3))assert.ok(Number(q.answer)<0,q.id);
});

test('all 2607 bilingual conditions preserve numerical data and contain no unfinished placeholders',()=>{
 const numbers=text=>(text.match(/\d+(?:[.,]\d+)?/g)||[]).sort().join('|');
 for(const q of bank){
  assert.equal(numbers(q.prompt.ru),numbers(q.prompt.kk),q.id);
  assert.doesNotMatch(JSON.stringify(q),/TODO|undefined|NaN|\[object Object\]/,q.id);
 }
});
