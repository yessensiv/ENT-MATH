import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
async function request(path, options = {}) {
  const res = await fetch(base + path, options);
  const raw = await res.text();
  return { status: res.status, data: res.headers.get("content-type")?.includes("application/json") ? JSON.parse(raw) : { error: raw } };
}
let cookie = "";
test("local dispatch sign-in uses its own test-cookie flow", async () => {
  const res = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" });
  assert.ok([302, 303].includes(res.status));
  cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  assert.ok(cookie.includes("__sites_local_auth=1"));
});
test("anonymous state and writes are denied, with no supplied answer trusted", async () => {
  assert.equal((await request("/api/state")).status, 401);
  assert.equal((await request("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attempt", taskId: "linear-3", answer: "7", correct: true }) })).status, 401);
  assert.equal((await request("/api/admin")).status, 401);
});
test("caller-supplied authentication headers cannot forge administrator identity", async () => {
  const result = await request("/api/admin", { headers: { "oai-authenticated-user-id": "pretend-admin", "oai-authenticated-user-email": "teacher@example.kz" } });
  assert.equal(result.status, 401);
});
test("real local test identity has no administrator role", async () => {
  const result = await request("/api/admin", { headers: { Cookie: cookie } }); assert.equal(result.status, 403);
});
test("cross-origin state mutations are rejected before any storage write", async () => {
  const result = await request("/api/state", { method: "POST", headers: { Cookie: cookie, Origin: "https://untrusted.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ action: "profile", name: "Rejected request" }) }); assert.equal(result.status, 403);
});
test("practice and diagnostic responses whitelist questions without answer keys", async () => {
  for (const path of ["/api/tasks?topic=linear", "/api/tasks?topic=trig-circle", "/api/diagnostic?track=profile", "/api/diagnostic?track=literacy"]) {
    const result = await request(path); assert.equal(result.status, 200, path); assert.ok(result.data.tasks.length > 0, path);
    for (const task of result.data.tasks) {
      for (const key of ["answer", "solution", "hints", "correctAnswer", "commonError"]) assert.equal(key in task, false, `${path}: leaked ${key}`);
      if (task.type === "matching") assert.ok(task.pairs.every(p => p.right === ""));
    }
  }
});
test("both exam metadata endpoints report versioned official scoring and platform duration", async () => {
  const profile = await request("/api/exams?track=profile"), literacy = await request("/api/exams?track=literacy");
  assert.equal(profile.status, 200); assert.equal(profile.data.questionCount, 40); assert.equal(profile.data.maxScore, 50); assert.equal(profile.data.durationMinutes, 80);
  assert.equal(literacy.status, 200); assert.equal(literacy.data.questionCount, 10); assert.equal(literacy.data.maxScore, 10); assert.equal(literacy.data.durationMinutes, 20);
  assert.ok(profile.data.rules.source.includes("adilet")); assert.equal(profile.data.rules.checkedAt, "2026-10-05");
});
