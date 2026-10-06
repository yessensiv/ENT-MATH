import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../lib/content';
// @ts-expect-error Node's native TypeScript runner requires the extension.
import { schoolTopics } from '../lib/school-content.ts';
// @ts-expect-error Node's native TypeScript runner requires the extension.
import { generateSchoolReviewTask, schoolReviewCapacity, validateSchoolReviewTask } from '../lib/school-review-content.ts';

const ids = ['school-divisibility', 'school-gcd-lcm', 'school-decimals', 'school-rounding', 'school-sets', 'school-absolute-value', 'school-basic-angles', 'school-perimeter'];
const task = (id: string, serial: number, level: 1 | 2 | 3): Task => {
  const result = generateSchoolReviewTask(id, serial, level);
  assert.ok(result, `${id}/${level}/${serial}`);
  return result;
};

test('all 1 152 school review variants have new RU/KK conditions, verified keys and teaching aids', () => {
  const seenIds = new Set<string>(), formats = new Set<string>();
  let checked = 0;
  for (const id of ids) {
    const original = schoolTopics.find(topic => topic.id === id);
    assert.ok(original);
    const seen = {
      ru: new Set(original.tasks.map(t => t.prompt.ru)),
      kk: new Set(original.tasks.map(t => t.prompt.kk)),
    };
    for (const level of [1, 2, 3] as const) {
      const count = schoolReviewCapacity(id, level);
      assert.equal(count, 48);
      const answerKeys = new Set<string>();
      for (let serial = 1; serial <= count; serial++) {
        const t = task(id, serial, level);
        assert.equal(validateSchoolReviewTask(t).valid, true, t.id);
        assert.equal(seenIds.has(t.id), false, t.id);
        seenIds.add(t.id); formats.add(t.type); answerKeys.add(JSON.stringify(t.answer));
        assert.ok(t.id.startsWith('school-review-'));
        assert.equal(t.topicId, id); assert.equal(t.skill, id); assert.equal(t.level, level);
        for (const lang of ['ru', 'kk'] as const) {
          assert.equal(seen[lang].has(t.prompt[lang]), false, `${t.id}/${lang}`);
          seen[lang].add(t.prompt[lang]);
          assert.equal(t.hints[lang].length, 3, t.id);
          assert.ok(t.solution[lang].length >= 3, t.id);
          assert.ok([...t.solution[lang], ...t.hints[lang], t.commonError[lang]].every(s => s.trim().length > 0), t.id);
        }
        if (t.type === 'single' || t.type === 'multiple') {
          assert.ok(t.options && new Set(t.options).size === t.options.length, t.id);
          const answers = Array.isArray(t.answer) ? t.answer : [t.answer];
          assert.ok(answers.length && answers.every(answer => t.options!.includes(answer)), t.id);
          assert.ok(answers.length < t.options.length, t.id);
        }
        if (t.type === 'matching') {
          assert.ok(Array.isArray(t.answer));
          assert.equal(t.pairs?.length, 3);
          assert.deepEqual(t.pairs?.map(p => p.right), t.answer);
          assert.equal(new Set(t.answer).size, 3, t.id);
        }
        checked++;
      }
      assert.ok(answerKeys.size >= 10, `${id}/${level} lacks variation`);
    }
  }
  assert.equal(checked, 1152);
  assert.deepEqual([...formats].sort(), ['matching', 'multiple', 'number', 'single']);
});

test('the finite bank stops exactly at its boundaries and rejects invalid inputs', () => {
  for (const id of ids) for (const level of [1, 2, 3] as const) {
    assert.ok(generateSchoolReviewTask(id, 48, level));
    for (const serial of [0, -1, 49, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(generateSchoolReviewTask(id, serial, level), null);
    assert.deepEqual(generateSchoolReviewTask(id, 19, level), generateSchoolReviewTask(id, 19, level));
  }
  assert.equal(schoolReviewCapacity('missing', 1), 0);
  assert.equal(generateSchoolReviewTask('missing', 1, 1), null);
  for (const level of [0, 4, NaN] as (1 | 2 | 3)[]) {
    assert.equal(schoolReviewCapacity(ids[0], level), 0);
    assert.equal(generateSchoolReviewTask(ids[0], 1, level), null);
  }
  for (const raw of [null, undefined, 1, 'task', {}, { generation: { version: 'other' } }]) assert.equal(validateSchoolReviewTask(raw).valid, false);
});

test('known arithmetic cases independently cover all eight topics and four response formats', () => {
  const cases: [string, number, 1 | 2 | 3, string | string[]][] = [
    ['school-divisibility', 1, 1, ['2', '4', '6', '11']], // 132
    ['school-divisibility', 1, 2, '6'], // 261
    ['school-divisibility', 2, 3, '5'], // 77 minus 5
    ['school-gcd-lcm', 1, 1, '10'], // gcd(20,30)
    ['school-gcd-lcm', 1, 2, '96'], // lcm(24,32)
    ['school-gcd-lcm', 1, 3, '3'], // simultaneous signals at 60,120,180
    ['school-gcd-lcm', 2, 3, '216'], // lcm(18,24,27)
    ['school-decimals', 2, 1, '2.58'], // 1.61+.97
    ['school-decimals', 1, 2, '3.58'], // 3*1.27-.23
    ['school-decimals', 1, 3, '41'], // 10.35/.25, full packages
    ['school-decimals', 2, 3, '1.2'], // .3x+1.6=1.96
    ['school-rounding', 4, 1, '2.3'], // 2.25 to tenths
    ['school-rounding', 2, 2, ['1.2', '1.3', '2']],
    ['school-rounding', 1, 3, '176'], // 25.17*7=176.19
    ['school-rounding', 2, 3, ['205', '206', '214']],
    ['school-sets', 1, 3, '28'], // 61-(21+18-6)
    ['school-sets', 2, 3, '10'], // 26+26-42
    ['school-absolute-value', 1, 3, ['-13', '-11', '-9']],
    ['school-absolute-value', 2, 3, '7'],
    ['school-basic-angles', 31, 1, '2'], // exactly 90 degrees
    ['school-basic-angles', 33, 1, '3'], // 95 degrees
    ['school-basic-angles', 1, 3, '97'], // 97+83=180, difference14
    ['school-basic-angles', 2, 3, '158'], // 158+158+44=360
    ['school-perimeter', 1, 1, '27'],
    ['school-perimeter', 2, 1, '56'],
    ['school-perimeter', 2, 2, ['28', '24', '26']],
    ['school-perimeter', 1, 3, '62'], // rectangle17*8 plus12
  ];
  for (const [id, serial, level, answer] of cases) assert.deepEqual(task(id, serial, level).answer, answer, `${id}/${level}/${serial}`);
});

test('a missing digit condition explicitly chooses the smallest valid digit, including zero', () => {
  const t = task('school-divisibility', 7, 2); // 5?4 admits both504 and594
  assert.equal(t.answer, '0');
  assert.match(t.prompt.ru, /наименьшую/); assert.match(t.prompt.kk, /ең кіші/);
  assert.equal(validateSchoolReviewTask({ ...t, answer: '9' }).valid, false);
});

test('edits to either language, key, options, pairs, units, precision or provenance require review', () => {
  for (const id of ids) for (const level of [1, 2, 3] as const) for (const serial of [1, 2, 47, 48]) {
    const t = task(id, serial, level);
    const changed: unknown[] = [
      { ...t, answer: '999999' },
      { ...t, prompt: { ...t.prompt, ru: 'Другое условие.' } },
      { ...t, prompt: { ...t.prompt, kk: 'Өзгертілген шарт.' } },
      { ...t, level: level === 1 ? 2 : 1 },
      { ...t, topicId: ids[(ids.indexOf(id) + 1) % ids.length] },
      { ...t, unit: 'м²' }, { ...t, tolerance: 10 },
      { ...t, solution: { ...t.solution, kk: ['Қате шешім.'] } },
      { ...t, hints: { ...t.hints, ru: [] } },
      { ...t, generation: { ...t.generation, param: 9999 } },
      { ...t, id: 'school-review-changed' },
    ];
    if (t.options) changed.push({ ...t, options: [...t.options, '99999'] });
    if (t.pairs) changed.push({ ...t, pairs: t.pairs.map((p, i) => i === 0 ? { ...p, right: '99999' } : p) });
    for (const raw of changed) assert.equal(validateSchoolReviewTask(raw).valid, false, t.id);
    assert.equal(validateSchoolReviewTask(JSON.parse(JSON.stringify(t))).valid, true, t.id);
    t.commonError.ru = 'Изменённая памятка.';
    assert.equal(validateSchoolReviewTask(t).valid, false, t.id);
    assert.equal(validateSchoolReviewTask(task(id, serial, level)).valid, true, t.id);
  }
  const t = task('school-perimeter', 1, 3), circular = { ...t, extra: {} };
  circular.extra = circular;
  assert.equal(validateSchoolReviewTask(circular).valid, false);
});

// @ts-expect-error Native tests require explicit extensions.
import {grade,type Task as EngineTask} from '../lib/engine.ts';
test('server grading accepts every generated school key including choices and matching',()=>{
 for(const topic of ['school-divisibility','school-gcd-lcm','school-decimals','school-rounding','school-sets','school-absolute-value','school-basic-angles','school-perimeter'])for(const level of [1,2,3] as const)for(let serial=1;serial<=48;serial++){const task=generateSchoolReviewTask(topic,serial,level)!;assert.equal(grade({...task,difficulty:level,units:task.unit} as EngineTask,task.answer),true,task.id);}
});
