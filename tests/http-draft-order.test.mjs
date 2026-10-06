import { test } from "node:test";
import assert from "node:assert/strict";
import { beginLocalFixture } from "./local-state-fixture.mjs";
import { tasks } from "../lib/content.ts";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
let cookie = "";
async function call(path, body) { const r = await fetch(base + path, { headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
test("draft beacons cannot revert newer work or resurrect completed sessions", async t => {
  const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0]; assert.equal((await call("/api/state")).data.user.id, "local_seedy");
  await t.test("practice keeps newer draft and refuses an old beacon after submission", async () => {
    const fixture = await beginLocalFixture(original => ({ ...original, activeExam: null, practiceDraft: null, draftUpdatedAt: {} })), now = Date.now();
    try {
      const newer = { action: "save-draft", kind: "practice", taskId: "linear-2", answer: "4", steps: "2x=8", updatedAt: now };
      assert.equal((await call("/api/state", newer)).status, 200); const old = await call("/api/state", { ...newer, answer: "7", steps: "2x=14", updatedAt: now - 1 }); assert.equal(old.status, 200); assert.equal(old.data.staleSnapshot, true); assert.equal(old.data.practiceDraft.answer, "4");
      const solved = await call("/api/state", { action: "attempt", taskId: "linear-2", answer: "4", steps: "2x=8", draftUpdatedAt: now }); assert.equal(solved.status, 200); assert.equal(solved.data.practiceDraft, null); assert.equal(solved.data.xp, fixture.original.xp);
      const beacon = await call("/api/state", { ...newer, updatedAt: now - 1 }); assert.equal(beacon.data.staleSnapshot, true); assert.equal(beacon.data.practiceDraft, null); assert.equal(beacon.data.revision, solved.data.revision);
    } finally { await fixture.restore(fixture.revision + 2); }
  });
  await t.test("diagnostic completion preserves its watermark against a late old draft", async () => {
    const fixture = await beginLocalFixture(original => ({ ...original, activeExam: null, diagnosticDraft: null, draftUpdatedAt: {} })), now = Date.now();
    try {
      const questions = (await call("/api/diagnostic?track=base")).data.tasks, draft = { action: "save-draft", kind: "diagnostic", track: "base", answers: [], taskId: questions[0].id, answer: "1", updatedAt: now };
      assert.equal((await call("/api/state", draft)).status, 200); const older = await call("/api/state", { ...draft, answer: "2", updatedAt: now - 1 }); assert.equal(older.data.staleSnapshot, true); assert.equal(older.data.diagnosticDraft.answer, "1");
      const answers = questions.map(q => ({ taskId: q.id, answer: tasks.find(t => t.id === q.id).answer })), completed = await call("/api/state", { action: "diagnostic", track: "base", answers, draftUpdatedAt: now }); assert.equal(completed.status, 200); assert.equal(completed.data.diagnosticDraft, null);
      const beacon = await call("/api/state", { ...draft, updatedAt: now - 1 }); assert.equal(beacon.data.staleSnapshot, true); assert.equal(beacon.data.diagnosticDraft, null); assert.equal(beacon.data.revision, completed.data.revision);
    } finally { await fixture.restore(fixture.revision + 3); }
  });
});
