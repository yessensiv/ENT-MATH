import { test } from "node:test";
import assert from "node:assert/strict";
import { tasks } from "../lib/content.ts";
const base = process.env.ENT_TEST_BASE_URL || "http://127.0.0.1:5173";
let cookie = "";
async function call(path, body) { const r = await fetch(base + path, { headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { method: "POST", body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; }
test("voluntary ranking, honest streak metadata and reserved reviews", async t => {
  const sign = await fetch(base + "/signin-with-chatgpt?return_to=/", { redirect: "manual" }); cookie = sign.headers.get("set-cookie").split(";")[0];
  const initial = (await call("/api/state")).data, original = Boolean(initial.preferences?.leaderboard);
  assert.equal(initial.user.id, "local_seedy");
  try {
    await t.test("opt-out is excluded and opt-in shows only real confirmed progress", async () => {
      assert.equal((await call("/api/state", { action: "preferences", leaderboard: false })).status, 200);
      const before = (await call("/api/leaderboard")).data; assert.equal(before.optedIn, false); assert.equal(before.entries.some(e => e.self), false);
      assert.equal((await call("/api/state", { action: "preferences", leaderboard: true })).status, 200);
      const ranked = (await call("/api/leaderboard")).data, own = ranked.entries.find(e => e.self); assert.ok(own); assert.equal(ranked.optedIn, true); assert.equal(ranked.totalOptedIn, before.totalOptedIn + 1);
      assert.equal(own.name, initial.profile.name); assert.equal(own.xp, initial.xp); assert.equal(own.level, Math.floor(initial.xp / 250) + 1); assert.equal(own.mastered, Object.values(initial.progress).filter(p => p.mastered).length); assert.equal(own.testIdentity, true); assert.equal("email" in own, false); assert.equal("id" in own, false);
      assert.equal((await call("/api/state", { action: "preferences", leaderboard: false })).status, 200); assert.equal((await call("/api/leaderboard")).data.optedIn, false);
    });
    await t.test("streak recovery rejection never invents practice or awards XP", async () => {
      const before = (await call("/api/state")).data; assert.ok(before.streak); assert.equal(before.streak.practicedDays, new Set(before.streakDays).size);
      if (!before.streak.recoveryAvailable) { assert.equal((await call("/api/state", { action: "streak-recover" })).status, 400); const after = (await call("/api/state")).data; assert.deepEqual(after.streakDays, before.streakDays); assert.equal(after.xp, before.xp); assert.deepEqual(after.progress, before.progress); }
    });
    await t.test("four fresh tasks are reserved, and cannot be consumed before due review", async () => {
      const result = (await call("/api/tasks?topic=linear")).data, reserved = result.tasks.filter(t => t.reviewReserved); assert.equal(reserved.length, 4); assert.ok(reserved.every(t => !t.modelExample)); assert.deepEqual(reserved.map(t => t.level).sort(), [1, 2, 2, 3]);
      const before = (await call("/api/state")).data, task = tasks.find(t => t.id === reserved[0].id);
      assert.equal((await call("/api/state", { action: "attempt", taskId: task.id, answer: task.answer })).status, 400); assert.equal((await call("/api/state")).data.attempts.length, before.attempts.length);
      const future = before.reviews.find(r => r.topicId === "linear" && !r.completed && Date.parse(r.due) > Date.now()); if (future) assert.equal((await call(`/api/tasks?topic=linear&reviewId=${future.id}`)).status, 400);
    });
  } finally { await call("/api/state", { action: "preferences", leaderboard: original }); }
});
