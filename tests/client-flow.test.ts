import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node's native TS runner requires the explicit extension.
import { createWriteQueue, requestJson, RequestError, returnedToChallenge, examSkillBreakdown, completeAnswer } from '../lib/client-flow.ts';

test('HTTP authentication is distinguishable from a broken connection or invalid response', async () => {
  await assert.rejects(requestJson('/api/state', undefined, (async () => new Response('{"error":"Войди"}', {status:401})) as typeof fetch), (e: RequestError) => e.status === 401);
  await assert.rejects(requestJson('/api/state', undefined, (async () => { throw Error('offline'); }) as typeof fetch), (e: RequestError) => e.status === 0);
  await assert.rejects(requestJson('/api/state', undefined, (async () => new Response('<html>down</html>', {status:502})) as typeof fetch), (e: RequestError) => e.status === 502 && !e.message.includes('JSON'));
});

test('writes are serialized and a failed write does not block the next save', async () => {
  const queue = createWriteQueue(), events: number[] = [];
  let release!: () => void;
  const first = queue(async () => { events.push(1); await new Promise<void>(r => release=r); throw Error('failed'); });
  const second = queue(async () => { events.push(2); return 'saved'; });
  await Promise.resolve(); assert.deepEqual(events,[1]); release();
  await assert.rejects(first); assert.equal(await second,'saved'); assert.deepEqual(events,[1,2]);
});

test('return achievement requires independent success after repeated errors in the same skill', () => {
  const fail = {topicId:'fractions',correct:false,assisted:false};
  assert.equal(returnedToChallenge([fail,fail]),false);
  assert.equal(returnedToChallenge([fail,fail,{...fail,correct:true,assisted:true}]),false);
  assert.equal(returnedToChallenge([fail,fail,{...fail,correct:true}]),true);
  assert.equal(returnedToChallenge([fail,fail,{topicId:'linear',correct:true,assisted:false}]),false);
});

test('exam breakdown aggregates points by skill and puts gaps first', () => {
  assert.deepEqual(examSkillBreakdown([{topicId:'a',points:1,max:1},{topicId:'b',points:0,max:2},{topicId:'a',points:1,max:2}]),[{topicId:'b',points:0,max:2,count:1},{topicId:'a',points:2,max:3,count:2}]);
});

test('partly filled matching is incomplete, including sparse answer arrays', () => {
  const task = {type:'matching',pairs:[{},{}]};
  assert.equal(completeAnswer(task,['2','']),false);
  assert.equal(completeAnswer(task,[,'2'] as string[]),false);
  assert.equal(completeAnswer(task,['1','2']),true);
  assert.equal(completeAnswer({type:'single'},'   '),false);
});
