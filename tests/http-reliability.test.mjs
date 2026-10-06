import { test } from "node:test";
import assert from "node:assert/strict";
import { beginLocalFixture } from "./local-state-fixture.mjs";
import { tasks } from "../lib/content.ts";
import { EXAM_RULES } from "../lib/engine.ts";

const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
let cookie = "";
async function call(path, body) { const r = await fetch(base + path, { headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }); const raw = await r.text(); return { status: r.status, data: r.headers.get("content-type")?.includes("application/json") ? JSON.parse(raw) : { error: raw } }; }
const invariant = s => ({ xp: s.xp, attempts: s.attempts, progress: s.progress, diagnostics: s.diagnostics });

test("server drafts, validation, concurrent saves and expiry regressions", async t => {
  const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0];
  const prior = (await call("/api/state")).data; assert.equal(prior.user.id, "local_seedy"); assert.equal(prior.activeExam, null, "Finish a real local exam before fixture tests");
  const isolated = await beginLocalFixture(old=>({...old,diagnosticDraft:null,diagnosticSession:null,tutorGenerations:{},tutorMessages:[]}));
  const initial = (await call('/api/state')).data;
  try {
    await t.test("partial diagnostics and practice survive reload without changing learning results", async () => {
      const diagnostic = (await call("/api/diagnostic?track=profile")).data.tasks;
      const practice = { action: "save-draft", kind: "practice", taskId: "linear-2", answer: "7", steps: "2x=14", assisted: true };
      const completed = [{ taskId: diagnostic[0].id, answer: "1" }];
      const draft = { action: "save-draft", kind: "diagnostic", track: "profile", answers: completed, taskId: diagnostic[1].id, answer: "3/4" };
      const responses = await Promise.all([call("/api/state", practice), call("/api/state", draft)]); assert.ok(responses.every(r => r.status === 200), JSON.stringify(responses));
      const restored = (await call("/api/state")).data; assert.equal(restored.practiceDraft.taskId, "linear-2"); assert.equal(restored.practiceDraft.topicId, "linear"); assert.equal(restored.practiceDraft.steps, "2x=14"); assert.deepEqual(restored.diagnosticDraft.answers, completed); assert.equal(restored.diagnosticDraft.answer, "3/4"); assert.equal(restored.diagnosticDraft.answers.some(a => a.taskId === draft.taskId), false); assert.deepEqual(invariant(restored), invariant(initial));
    });
    await t.test("malformed drafts, answers and tutor steps cannot mutate state", async () => {
      const before = (await call("/api/state")).data;
      const multi = tasks.find(t => t.type === "matching"), extra = Array(multi.pairs.length + 1).fill(multi.options[0]);
      const invalid = [
        ["/api/state", { action: "save-draft", kind: "diagnostic", track: "profile", answers: [{ taskId: "NOT-A-QUESTION", answer: "4" }] }],
        ["/api/state", { action: "attempt", taskId: "linear-2", answer: ["4"] }],
        ["/api/state", { action: "attempt", taskId: multi.id, answer: extra }],
        ["/api/state", { action: "diagnostic", track: "profile", answers: Array(10).fill(null) }],
        ["/api/tutor", { taskId: "fractions-1", message: "Помоги", steps: { invalid: true } }],
        ["/api/tutor", { taskId: "fractions-1", message: "Помоги", fullSolution: "yes" }],
      ];
      for (const [path, body] of invalid) assert.equal((await call(path, body)).status, 400, JSON.stringify(body));
      const after = (await call("/api/state")).data; assert.equal(after.revision, before.revision); assert.deepEqual(after.assistedTaskIds, before.assistedTaskIds); assert.deepEqual(invariant(after), invariant(before));
    });
    await t.test("switching tracks restores separate score targets and rejects zero", async () => {
      await call("/api/state", { action: "profile", track: "profile", target: 45 }); const literacy = await call("/api/state", { action: "profile", track: "literacy" }); assert.equal(literacy.status, 200); assert.ok(literacy.data.profile.target <= 10);
      const profile = await call("/api/state", { action: "profile", track: "profile" }); assert.equal(profile.data.profile.target, 45); assert.equal(profile.data.profile.targets.profile, 45);
      const before = profile.data; assert.equal((await call("/api/state", { action: "profile", target: 0 })).status, 400); assert.equal((await call("/api/state")).data.revision, before.revision);
    });
    await t.test("public exam answers obey listed choices and invalid start receives 400", async () => {
      assert.equal((await call("/api/state", { action: "exam-start", track: "base", variant: 1 })).status, 400); assert.equal((await call("/api/state", { action: "exam-start", track: "profile", variant: 6 })).status, 400);
    });
    await t.test("expired exam refuses the late answer, survives retries, and releases study tools", async () => {
      const fixtureId = `local-expiry-fixture-${Date.now()}`;
      const question = { ...tasks.find(t => t.id === "linear-2"), id: "local-expiry-question", difficulty: 1, modelExample: true };
      const fixture = await beginLocalFixture(original => ({ ...original, activeExam: { id: fixtureId, track: "profile", variant: 1, startedAt: new Date(Date.now() - 81 * 60000).toISOString(), durationMinutes: 80, questions: [question], answers: {}, flagged: [], rules: EXAM_RULES, integrationFixture: true } }));
      try {
        const late = await call("/api/state", { action: "exam-answer", examId: fixtureId, index: 0, answer: "4" }); assert.equal(late.status, 200); assert.equal(late.data.result.id, fixtureId); assert.equal(late.data.result.score, 0); assert.equal(late.data.timedOut, true); assert.deepEqual(late.data.result.answers, {}); assert.equal(late.data.result.results[0].prompt.ru, question.prompt.ru);
        const retry = await call("/api/state", { action: "exam-finish", examId: fixtureId }); assert.equal(retry.status, 200); assert.equal(retry.data.alreadyFinished, true); assert.equal(retry.data.result.score, 0);
        const state = (await call("/api/state")).data; assert.equal(state.activeExam, null); assert.equal(state.exams.filter(e => e.id === fixtureId).length, 1);
        const helper = await call("/api/tutor", { message: "Объясни проще", topicId: "linear" }); assert.equal(helper.status, 200); assert.equal(helper.data.mode, "study-helper");
      } finally {
        await fixture.restore(fixture.revision + 3);
      }
    });
  } finally {
    await isolated.restore((await call('/api/state')).data.revision);
  }
});
