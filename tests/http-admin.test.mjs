// Run only while the root has intentionally configured local ADMIN_EMAILS.
// Learner-role 403 is covered separately with that temporary configuration off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { localDatabase } from "./local-state-fixture.mjs";
import { tasks } from "../lib/content.ts";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
let cookie = "";
async function call(path, body, authenticated = true) { const r = await fetch(base + path, { headers: { ...(authenticated ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
test("protected editor restores saved drafts and rejects unchecked publication", async t => {
  const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0]; assert.equal((await call("/api/state")).data.isAdmin, true, "Enable the local-only ADMIN_EMAILS fixture before this suite");
  await t.test("single material is private and falls back to published source", async () => {
    assert.equal((await call("/api/admin?kind=task&id=linear-3", undefined, false)).status, 401);
    const db = localDatabase(); try {
      const unchanged = tasks.find(t => !db.prepare("SELECT id FROM content_overrides WHERE id=?").get(t.id)); assert.ok(unchanged);
      const loaded = await call(`/api/admin?kind=task&id=${unchanged.id}`); assert.equal(loaded.status, 200); assert.equal(loaded.data.status, "published"); assert.equal(loaded.data.material.answer, unchanged.answer); assert.equal(loaded.data.material.prompt.kk, unchanged.prompt.kk);
      assert.equal((await call("/api/admin?kind=topic&id=linear-3")).status, 404); assert.equal((await call("/api/admin?kind=task&id=missing-task")).status, 404);
    } finally { db.close(); }
  });
  await t.test("the root's saved task draft resumes with its key, translation and status intact", async () => {
    const db = localDatabase(); try {
      const saved = db.prepare("SELECT * FROM content_overrides WHERE id=? AND kind=?").get("linear-3", "task"); assert.ok(saved, "Root's existing local draft is the fixture; do not replace it"); assert.ok(["draft", "review"].includes(saved.status));
      const data = JSON.parse(saved.data), source = tasks.find(t => t.id === "linear-3"), loaded = await call("/api/admin?kind=task&id=linear-3"); assert.equal(loaded.status, 200); assert.equal(loaded.data.status, saved.status); assert.equal(loaded.data.material.answer, data.answer ?? source.answer); assert.equal(loaded.data.material.prompt.kk, (data.prompt ?? source.prompt).kk); assert.equal(loaded.data.material.prompt.ru, (data.prompt ?? source.prompt).ru); assert.deepEqual(loaded.data.material.solution, data.solution ?? source.solution);
    } finally { db.close(); }
  });
  await t.test("publication needs a review note and a finite numeric key, without changing drafts", async () => {
    const db = localDatabase(); try {
      const before = db.prepare("SELECT * FROM content_overrides WHERE id=?").get("linear-3"), loaded = (await call("/api/admin?kind=task&id=linear-3")).data.material;
      const unchecked = await call("/api/admin", { id: "linear-3", kind: "task", status: "published", data: loaded, reviewNote: "" }); assert.equal(unchecked.status, 400);
      const invalid = await call("/api/admin", { id: "linear-3", kind: "task", status: "published", data: { ...loaded, type: "number", answer: "1/0" }, reviewNote: "Local invalid-key rejection test" }); assert.equal(invalid.status, 400); assert.match(invalid.data.error, /Числовой ответ/);
      assert.deepEqual(db.prepare("SELECT * FROM content_overrides WHERE id=?").get("linear-3"), before);
    } finally { db.close(); }
  });
});
