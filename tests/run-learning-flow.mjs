// Run with the temporary local administrator role disabled and the browser idle.
// The real local learner aggregate is backed up and restored with a CAS fence.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { beginLocalFixture } from "./local-state-fixture.mjs";
import { emptyState } from "../lib/engine.ts";

const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" });
const cookie = sign.headers.get("set-cookie").split(";")[0];
async function state() { const r = await fetch(base + "/api/state", { headers: { Cookie: cookie } }); assert.equal(r.status, 200); return await r.json(); }
const before = await state(); assert.equal(before.user.id, "local_seedy"); assert.equal(before.isAdmin, false, "Turn off the temporary local admin role before this runner"); assert.equal(before.activeExam, null); assert.ok(before.profile);
const fixture = await beginLocalFixture(original => ({ ...emptyState(), profile: original.profile, learningFlowFixture: true }));
let result;
try {
  result = await new Promise(resolve => {
    const child = spawn(process.execPath, ["--experimental-strip-types", "--test", "--test-concurrency=1", "tests/http-learning.test.mjs"], { cwd: process.cwd(), env: process.env, stdio: "inherit" });
    child.on("error", error => resolve({ code: 1, error })); child.on("close", code => resolve({ code: code ?? 1 }));
  });
  assert.equal(result.code, 0, result.error?.message || "Full learning flow failed");
  const completed = await state(); assert.equal(completed.revision, fixture.revision + 57, "Unexpected writer or changed flow: do not blindly restore the learner"); assert.equal(completed.exams.at(-1).score, 50); assert.equal(completed.learningFlowFixture, true);
} finally {
  // A passing current flow has exactly 57 learner mutations. A failure keeps the
  // durable backup and deliberately refuses a guessed restoration revision.
  if (result?.code === 0) await fixture.restore(fixture.revision + 57);
  else { fixture.db.close(); throw new Error("Isolated flow failed. Inspect its durable .sites-runtime/tests/backups snapshot before restoring; no guessed revision was applied."); }
}
const restored = await state();
for (const key of ["profile", "attempts", "errors", "progress", "reviews", "exams", "xp"]) assert.deepEqual(restored[key], before[key], `Restored ${key} differs`);
console.log("Original local learner profile and all learning results restored.");
