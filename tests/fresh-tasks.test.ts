import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Native Node type stripping requires explicit extensions.
import { topics, tasks, generateReviewTask, validateGeneratedTask, reviewCapacity } from "../lib/content.ts";
// @ts-expect-error Native Node type stripping requires explicit extensions.
import { emptyState, deliverTask, isModelExample, reservedReviewIds, taskFingerprint, type Task, type Topic } from "../lib/engine.ts";
// @ts-expect-error Native Node type stripping requires explicit extensions.
import { fillFreshTasks, type ReviewGenerator } from "../lib/fresh-tasks.ts";
const generator = { generateReviewTask, validateGeneratedTask, reviewCapacity } as unknown as ReviewGenerator;
const bank = tasks.map(t => { const topic = topics.find(p => p.id === t.topicId) as unknown as Topic; return { ...t, difficulty: t.level, modelExample: isModelExample(t as unknown as Task, topic), reviewReserved: reservedReviewIds(topic).includes(t.id) }; }) as unknown as Task[];
test("exhausted normal practice receives three genuinely fresh checked tasks", () => {
  const state = emptyState(); state.assistedTaskIds = bank.filter(t => t.topicId === "linear").map(t => t.id);
  const filled = fillFreshTasks(state, "linear", bank, generator, false, 1, 3); assert.equal(filled.changed, true); assert.equal(filled.exhausted, false);
  const generated = state.generatedTasks as Task[]; assert.equal(generated.length, 3); assert.equal(new Set([...bank.filter(t => t.topicId === "linear"), ...generated].map(taskFingerprint)).size, bank.filter(t => t.topicId === "linear").length + 3);
  for (const task of generated) { assert.equal(task.reviewReserved, false); const delivered = deliverTask(task, state); assert.equal(delivered.practiceEligible, true); for (const key of ["answer", "solution", "hints", "generation"]) assert.equal(Object.hasOwn(delivered, key), false); }
  assert.equal(fillFreshTasks(state, "linear", bank, generator, false, 1, 3).changed, false);
});
test("delayed reviews generate the requested level and never reuse an exposed task", () => {
  const state = emptyState(); state.assistedTaskIds = bank.filter(t => t.topicId === "linear").map(t => t.id);
  for (const level of [1, 2, 3] as const) { const filled = fillFreshTasks(state, "linear", bank, generator, true, level, 1); assert.equal(filled.exhausted, false); const generated = state.generatedTasks as Task[]; const selected = generated.filter(t => t.difficulty === level); assert.equal(selected.length, 1); assert.equal(selected[0].reviewReserved, true); (state.assistedTaskIds as string[]).push(selected[0].id); }
  assert.equal((state.generatedTasks as Task[]).length, 3);
});
test("invalid generation is quarantined and finite pool exhaustion is explicit", () => {
  const state = emptyState(); state.assistedTaskIds = bank.filter(t => t.topicId === "linear").map(t => t.id);
  const invalid: ReviewGenerator = { reviewCapacity: () => 2, generateReviewTask: () => ({ broken: true }), validateGeneratedTask: () => ({ valid: false, errors: ["bad"] }) };
  const result = fillFreshTasks(state, "linear", bank, invalid, true, 1, 1); assert.equal(result.exhausted, true); assert.deepEqual(state.generatedTasks, []); assert.equal((state.reviewSerials as Record<string, number>)["linear:1"], 2); assert.equal(fillFreshTasks(state, "linear", bank, invalid, true, 1, 1).changed, false);
});
test("a previously seen generated ID is skipped even if its serial cursor was reset", () => {
  const state = emptyState(); state.assistedTaskIds = [...bank.filter(t => t.topicId === "linear").map(t => t.id), "review-linear-1-1"];
  fillFreshTasks(state, "linear", bank, generator, false, 1, 3); const generated = state.generatedTasks as Task[]; assert.equal(generated.filter(t => deliverTask(t, state).practiceEligible).length, 3); assert.equal(generated.some(t => t.id === "review-linear-1-1"), false);
});
