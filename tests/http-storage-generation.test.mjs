import { test } from "node:test";
import assert from "node:assert/strict";
import { beginLocalFixture } from "./local-state-fixture.mjs";
import { tasks, generateReviewTask } from "../lib/content.ts";
import { EXAM_RULES, taskFingerprint } from "../lib/engine.ts";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
let cookie = "";
async function call(path, body) { const r = await fetch(base + path, { headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }); const raw = await r.text(); return { status: r.status, data: r.headers.get("content-type")?.includes("application/json") ? JSON.parse(raw) : { error: raw } }; }
test("real D1 generated exercises, large snapshots and out-of-order answer persistence", async t => {
  const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0];
  const initial = (await call("/api/state")).data; assert.equal(initial.user.id, "local_seedy"); assert.equal(initial.activeExam, null);
  await t.test("an older exam request cannot overwrite the newer answer or navigation", async () => {
    const question = { ...tasks.find(t => t.id === "linear-1"), difficulty: 1 }, now = Date.now(), id = `snapshot-fixture-${now}`;
    const fixture = await beginLocalFixture(original => ({ ...original, activeExam: { id, track: "profile", variant: 1, startedAt: new Date(now).toISOString(), durationMinutes: 80, questions: [question, { ...question, id: "snapshot-question-2" }], answers: {}, flagged: [], rules: EXAM_RULES } }));
    try {
      const newer = await call("/api/state", { action: "exam-answer", examId: id, index: 0, answer: question.options[1], flagged: true, nextIndex: 1, updatedAt: now }); assert.equal(newer.status, 200); assert.equal(newer.data.activeExam.currentIndex, 1);
      const older = await call("/api/state", { action: "exam-answer", examId: id, index: 0, answer: question.options[0], flagged: false, nextIndex: 0, updatedAt: now - 100 }); assert.equal(older.status, 200); assert.equal(older.data.staleSnapshot, true); assert.equal(older.data.revision, newer.data.revision);
      const bad = await call("/api/state", { action: "exam-answer", examId: id, index: 0, answer: question.options[0], updatedAt: Date.now() + 70000 }); assert.equal(bad.status, 400);
      const reloaded = (await call("/api/state")).data; assert.equal(reloaded.activeExam.answers["0"], question.options[1]); assert.deepEqual(reloaded.activeExam.flagged, [0]); assert.equal(reloaded.activeExam.currentIndex, 1); assert.equal(reloaded.activeExam.answerUpdatedAt["0"], now);
      assert.equal((await call("/api/tutor", { taskId: question.id, message: "Помоги" })).status, 409);
    } finally { await fixture.restore(fixture.revision + 1); }
  });
  await t.test("a >2 MB persisted snapshot saves concurrent updates without losing Unicode history", async () => {
    const history = "Әлия русский 😀".repeat(110000), fixture = await beginLocalFixture(original => ({ ...original, reliabilityHistory: history, activeExam: null, preferences: { leaderboard: true } }));
    try {
      const before = (await call("/api/state")).data; assert.equal(before.reliabilityHistory, history); assert.ok(fixture.db.prepare("SELECT COUNT(*) AS n FROM learner_state_chunks WHERE user_id='local_seedy'").get().n > 1);
      const results = await Promise.all([call("/api/state", { action: "resume", topicId: "linear", stage: 4 }), call("/api/state", { action: "preferences", leaderboard: false })]); assert.ok(results.every(r => r.status === 200), JSON.stringify(results.map(r => [r.status, r.data.error])));
      const after = (await call("/api/state")).data; assert.equal(after.reliabilityHistory, history); assert.equal(after.lessonResume.stage, 4); assert.equal(after.preferences.leaderboard, false); assert.equal(after.revision, fixture.revision + 2); assert.equal(after.xp, before.xp); assert.deepEqual(after.attempts, before.attempts);
      const chunks = fixture.db.prepare("SELECT token,LENGTH(CAST(data AS BLOB)) AS bytes FROM learner_state_chunks WHERE user_id='local_seedy'").all(); assert.ok(chunks.every(c => c.bytes < 1000000)); assert.equal(new Set(chunks.map(c => c.token)).size, 1);
      const ranking = (await call("/api/leaderboard")).data; assert.equal(ranking.optedIn, false);
    } finally { await fixture.restore(fixture.revision + 2); }
  });
  await t.test("exhausted practice generates checked tasks and restores their draft and answer verification", async () => {
    const fixture = await beginLocalFixture(original => ({ ...original, activeExam: null, assistedTaskIds: [...new Set([...(original.assistedTaskIds || []), ...tasks.filter(t => t.topicId === "linear").map(t => t.id), ...(original.generatedTasks || []).filter(t => t.topicId === "linear").map(t => t.id)])], practiceDraft: null }));
    let writes = 0;
    try {
      const response = await call("/api/tasks?topic=linear"); assert.equal(response.status, 200); writes++; const fresh = response.data.tasks.filter(t => t.practiceEligible && !t.reviewReserved); assert.equal(fresh.length, 3); assert.equal(response.data.exhausted, false);
      assert.ok(response.data.tasks.filter(t => /^linear-\d+$/.test(t.id)).every(t => t.seen));
      for (const q of fresh) for (const key of ["answer", "solution", "hints", "generation"]) assert.equal(key in q, false);
      const q = fresh[0], match = /^review-linear-(\d)-(\d+)$/.exec(q.id), verified = generateReviewTask("linear", Number(match[2]), Number(match[1])); assert.equal(taskFingerprint(q), taskFingerprint(verified));
      const draft = await call("/api/state", { action: "save-draft", kind: "practice", taskId: q.id, answer: "7", steps: "Черновик нового задания" }); assert.equal(draft.status, 200); writes++;
      const restored = (await call("/api/state")).data; assert.equal(restored.practiceDraft.taskId, q.id); assert.equal(restored.practiceDraft.topicId, "linear"); assert.equal("generatedTasks" in restored, false); assert.equal(restored.xp, fixture.original.xp);
      const attempted = await call("/api/state", { action: "attempt", taskId: q.id, answer: verified.answer, assisted: false }); assert.equal(attempted.status, 200); writes++; assert.equal(attempted.data.feedback.correct, true); assert.equal(attempted.data.feedback.independentEligible, true); assert.equal(attempted.data.practiceDraft, null);
      assert.equal((await call("/api/tasks?topic=linear&reviewId=does-not-exist")).status, 404);
    } finally { await fixture.restore(fixture.revision + writes); }
  });
});
