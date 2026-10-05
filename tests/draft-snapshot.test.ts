import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Native Node type stripping requires explicit extensions.
import { beginDraftSnapshot, finishDraftSnapshot, snapshotTime } from "../lib/draft-snapshot.ts";
test("older practice and diagnostic snapshots are ignored independently", () => {
  const s: Record<string, unknown> = { xp: 85 }; assert.equal(beginDraftSnapshot(s, "practice", 2000), true); assert.equal(beginDraftSnapshot(s, "practice", 1000), false); assert.equal(beginDraftSnapshot(s, "diagnostic", 1000), true); assert.deepEqual(s.draftUpdatedAt, { practice: 2000, diagnostic: 1000 }); assert.equal(s.xp, 85);
});
test("submission fences old beacons without erasing a newer concurrently edited draft", () => {
  const s: Record<string, unknown> = { practiceDraft: { answer: "B" } }; beginDraftSnapshot(s, "practice", 2000); assert.equal(finishDraftSnapshot(s, "practice", 1000), false); assert.deepEqual(s.practiceDraft, { answer: "B" }); assert.equal(beginDraftSnapshot(s, "practice", 1000), false);
  assert.equal(finishDraftSnapshot(s, "practice", 2000), true); assert.equal(s.practiceDraft, null); assert.equal(beginDraftSnapshot(s, "practice", 2000), false); assert.equal(beginDraftSnapshot(s, "practice", 2001), true);
});
test("client draft stamps are finite integers within the server clock window", () => {
  for (const value of ["1000", NaN, Infinity, -1, 1.5, 63001]) assert.throws(() => snapshotTime(value, 3000)); assert.equal(snapshotTime(undefined, 3000), 3000); assert.equal(snapshotTime(63000, 3000), 63000);
});
