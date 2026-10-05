import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node type stripping requires extensions.
import { emptyState, EXAM_RULES, type Exam } from "../lib/engine.ts";
// @ts-expect-error Node type stripping requires extensions.
import { applyExamSnapshot } from "../lib/exam-snapshot.ts";
function fixture(): Exam { return { id: "order", track: "profile", variant: 1, startedAt: new Date(0).toISOString(), durationMinutes: 80, questions: [0, 1].map(i => ({ id: `q${i}`, topicId: "linear", type: "single", difficulty: 1, answer: "4", prompt: { ru: "x=4?", kk: "x=4?" }, options: ["4", "5"], solution: { ru: ["4"], kk: ["4"] }, hints: { ru: [], kk: [] } })), answers: {}, flagged: [], rules: EXAM_RULES }; }
test("late older answer snapshot cannot overwrite a newer beacon snapshot", () => {
  const e = fixture(); applyExamSnapshot(e, { index: 0, answer: "5", flagged: true, nextIndex: 1, updatedAt: 2000 }, 3000);
  assert.equal(applyExamSnapshot(e, { index: 0, answer: "4", flagged: false, nextIndex: 0, updatedAt: 1000 }, 3000), false);
  assert.equal(e.answers["0"], "5"); assert.deepEqual(e.flagged, [0]); assert.equal(e.currentIndex, 1);
  assert.equal(applyExamSnapshot(e, { index: 0, answer: "4", flagged: false, updatedAt: 2000 }, 3000), false); assert.equal(e.answers["0"], "5");
});
test("an older different-question save preserves new navigation but keeps its own answer", () => {
  const e = fixture(); applyExamSnapshot(e, { index: 1, answer: "5", nextIndex: 0, updatedAt: 2000 }, 3000);
  applyExamSnapshot(e, { index: 0, answer: "4", nextIndex: 1, updatedAt: 1000 }, 3000); assert.equal(e.answers["0"], "4"); assert.equal(e.currentIndex, 0);
});
test("snapshot timestamps and indices are validated without any mutation", () => {
  const e = fixture(), original = JSON.stringify(e);
  for (const updatedAt of [NaN, Infinity, -1, 3000 + 60001, 1.5]) assert.throws(() => applyExamSnapshot(e, { index: 0, answer: "4", updatedAt }, 3000));
  assert.throws(() => applyExamSnapshot(e, { index: 0, nextIndex: 2 }, 3000)); assert.equal(JSON.stringify(e), original);
  assert.equal(applyExamSnapshot(e, { index: 0, answer: "4" }, 3000), true); assert.equal(e.answerUpdatedAt?.["0"], 3000); assert.ok(emptyState());
});
