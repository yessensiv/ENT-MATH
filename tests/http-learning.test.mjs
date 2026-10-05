// Writes only the starter's explicitly labelled local test account.
// Keep its results so persistence and notebook records can be inspected afterwards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { topics, tasks as sourceTasks } from "../lib/content.ts";
import { makeExam, officialSection, reservedReviewIds } from "../lib/engine.ts";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
const bank = sourceTasks.map(t => ({ ...t, difficulty: t.level, units: t.unit }));
let cookie = "", state, originalLanguage, pendingExam;
async function get(path) {
  const response = await fetch(base + path, { headers: { Cookie: cookie } });
  const data = await response.json(); return { status: response.status, data };
}
async function post(body, path = "/api/state") {
  const response = await fetch(base + path, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json(); return { status: response.status, data };
}
async function update(body) { const result = await post(body); assert.equal(result.status, 200, JSON.stringify(result.data)); state = result.data; return state; }
function unseen(topicId) {
  const topic = topics.find(t => t.id === topicId), models = [0, 1, 5, 10].map(i => topic.tasks[i].id);
  const reserved = reservedReviewIds(topic);
  return bank.filter(t => t.topicId === topicId && !models.includes(t.id) && !reserved.includes(t.id) && !state.assistedTaskIds?.includes(t.id) && !state.attempts.some(a => a.taskId === t.id));
}

test("authenticated learning, grading, tutor, durable progress and exam flow", async t => {
  try {
    await t.test("sign in through the existing local dispatch and preserve the existing profile", async () => {
      const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0];
      const result = await get("/api/state"); assert.equal(result.status, 200); state = result.data;
      assert.equal(state.user.id, "local_seedy"); assert.equal(state.testIdentity, true); assert.equal(state.storage, "cloudflare-d1");
      if (!state.profile) await update({ action: "onboard", profile: { name: "Локальная проверка", grade: "11", track: "profile", examDate: "2027-06-01", target: 45, dailyMinutes: 30, language: "ru" } });
      originalLanguage = state.profile.language;
    });
    await t.test("diagnostic is graded on the server, ignoring caller-supplied correct flags", async () => {
      const result = await get("/api/diagnostic?track=profile"); assert.equal(result.status, 200);
      const questions = result.data.tasks, answers = questions.map((q, i) => ({ taskId: q.id, answer: i === 0 ? "999999999" : bank.find(t => t.id === q.id).answer, correct: true }));
      const next = await update({ action: "diagnostic", track: "profile", answers }); assert.equal(next.diagnostic.score, questions.length - 1); assert.equal(next.diagnostic.gaps.length, 1); assert.ok(next.plan.length > 0);
    });
    await t.test("unfinished lesson stage is restored from D1", async () => {
      await update({ action: "resume", topicId: "linear", stage: 2 }); const restored = await get("/api/state"); assert.deepEqual(restored.data.lessonResume, { topicId: "linear", stage: 2 });
    });
    await t.test("wrong transition is journaled with original task and a supported sign explanation", async () => {
      const next = await update({ action: "attempt", taskId: "linear-2", answer: "7", steps: "2x + 3 = 11\n2x = 14\nx = 7", correct: true, xp: 9999999 });
      assert.equal(next.feedback.correct, false); assert.equal(next.feedback.errorCategory, "sign");
      const error = next.errors.at(-1); assert.equal(error.taskId, "linear-2"); assert.ok(error.prompt.ru.includes("2x+3=11")); assert.ok(error.solution.ru.length); assert.equal(error.correctAnswer, "4");
    });
    await t.test("tutor uses the current task and provided steps, with explicit fallback status", async () => {
      const result = await post({ taskId: "linear-2", topicId: "linear", message: "Проверь мой первый ошибочный шаг.", steps: "2x + 3 = 11\n2x = 14" }, "/api/tutor");
      assert.equal(result.status, 200); assert.ok(["study-helper", "ai"].includes(result.data.mode));
      if (result.data.mode === "study-helper") { assert.match(result.data.reply, /2x\s*=\s*8/); assert.ok(result.data.notice); }
      assert.equal("TUTOR_API_KEY" in result.data, false); state = (await get("/api/state")).data;
    });
    await t.test("correct equivalent answer is accepted; a worked lesson example does not confer mastery", async () => {
      const independent = state.progress.linear.independent;
      const next = await update({ action: "attempt", taskId: "linear-2", answer: "8/2", steps: "2x=11-3\nx=8/2", assisted: false });
      assert.equal(next.feedback.correct, true); assert.equal(next.feedback.independentEligible, false); assert.equal(next.progress.linear.independent, independent);
    });
    await t.test("three fresh tasks produce a delayed review rather than immediate mastery", async () => {
      const freshTopic = [topics.find(t => t.id === "linear"), ...topics.filter(t => t.track === "profile")].find(t => t && !state.progress[t.id]?.reviewPassed && unseen(t.id).length >= 4); assert.ok(freshTopic);
      const fresh = unseen(freshTopic.id).slice(0, 3); assert.equal(fresh.length, 3);
      for (const task of fresh) { const next = await update({ action: "attempt", taskId: task.id, answer: task.answer, assisted: false, steps: "" }); assert.equal(next.feedback.correct, true); assert.equal(next.feedback.independentEligible, true); }
      assert.ok(state.progress[freshTopic.id].independent >= 3); assert.equal(state.progress[freshTopic.id].mastered, false);
      const review = state.reviews.find(r => r.topicId === freshTopic.id && !r.completed); assert.ok(review); assert.ok(Date.parse(review.due) > Date.now());
      const next = unseen(freshTopic.id)[0], count = state.attempts.length;
      const refused = await post({ action: "attempt", taskId: next.id, answer: next.answer, reviewId: review.id }); assert.equal(refused.status, 400);
      assert.equal((await get("/api/state")).data.attempts.length, count);
    });
    await t.test("a wrong final answer alone keeps the cause unknown", async () => {
      const task = unseen("fractions")[0]; assert.ok(task);
      const next = await update({ action: "attempt", taskId: task.id, answer: "999999", steps: "" }); assert.equal(next.feedback.correct, false); assert.equal(next.feedback.errorCategory, "unknown");
    });
    await t.test("language changes preserve all attempts and restore on another request", async () => {
      const count = state.attempts.length, xp = state.xp;
      await update({ action: "profile", language: "kk" }); const reloaded = (await get("/api/state")).data; assert.equal(reloaded.profile.language, "kk"); assert.equal(reloaded.attempts.length, count); assert.equal(reloaded.xp, xp);
      await update({ action: "profile", language: originalLanguage });
    });
    await t.test("report is saved for editorial review and learner cannot open administration", async () => {
      const next = await update({ action: "report", taskId: "linear-2", message: "[Локальная проверка API] Проверка передачи сообщения редактору; задание математически верно." }); assert.equal(next.report.status, "review"); assert.equal((await get("/api/admin")).status, 403);
    });
    const expected = makeExam("profile", 5, topics, bank);
    await t.test("exam snapshot has broad official coverage and exposes no answer keys", async () => {
      assert.equal(state.activeExam, null);
      await update({ action: "exam-start", track: "profile", variant: 5 }); pendingExam = state.activeExam.id;
      assert.equal(state.activeExam.questions.length, 40); assert.equal(new Set(state.activeExam.questions.map(q => officialSection(topics.find(p => p.id === q.topicId)))).size, 10);
      assert.deepEqual(state.activeExam.questions.map(q => q.id), expected.questions.map(q => q.id));
      for (const q of state.activeExam.questions) { assert.equal("answer" in q, false); assert.equal("solution" in q, false); assert.equal("hints" in q, false); }
    });
    await t.test("answers, flags and start time persist; tutor and practice are blocked during exam", async () => {
      const startedAt = state.activeExam.startedAt;
      await update({ action: "exam-answer", examId: pendingExam, index: 0, answer: expected.questions[0].answer, flagged: true });
      const restored = (await get("/api/state")).data; assert.equal(restored.activeExam.startedAt, startedAt); assert.deepEqual(restored.activeExam.answers["0"], expected.questions[0].answer); assert.ok(restored.activeExam.flagged.includes(0));
      assert.equal((await post({ taskId: "linear-2", message: "Подскажи" }, "/api/tutor")).status, 409);
      assert.equal((await post({ action: "attempt", taskId: "linear-2", answer: "4" })).status, 409);
    });
    await t.test("full perfect variant scores 50 and gives all forty worked solutions", async () => {
      for (let index = 1; index < expected.questions.length; index++) await update({ action: "exam-answer", examId: pendingExam, index, answer: expected.questions[index].answer });
      const finished = await update({ action: "exam-finish", examId: pendingExam }); pendingExam = undefined;
      assert.equal(finished.result.score, 50); assert.equal(finished.result.maxScore, 50); assert.equal(finished.result.results.length, 40); assert.ok(finished.result.results.every(r => r.solution.ru.length > 0)); assert.equal(finished.activeExam, null);
    });
    await t.test("sign out and a new sign-in retain the same saved learner results", async () => {
      const count = state.attempts.length, exams = state.exams.length;
      await fetch(base + "/signout-with-chatgpt?return_to=/", { headers: { Cookie: cookie }, redirect: "manual" }); cookie = ""; assert.equal((await get("/api/state")).status, 401);
      const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0];
      const persisted = (await get("/api/state")).data; assert.equal(persisted.attempts.length, count); assert.equal(persisted.exams.length, exams); assert.equal(persisted.exams.at(-1).score, 50);
    });
  } finally {
    if (pendingExam) await post({ action: "exam-finish", examId: pendingExam });
    if (originalLanguage && cookie) await post({ action: "profile", language: originalLanguage });
  }
});
