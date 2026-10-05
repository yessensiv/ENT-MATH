import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
// @ts-expect-error Native Node type stripping requires explicit extensions.
import { encodeState, decodeState, statePointer, stateSaveStatements, INLINE_STATE_BYTES, MAX_STATE_CHUNKS, STATE_CHUNK_CHARACTERS, type StateStatement } from "../lib/state-codec.ts";
function fixture() { return { profile: { name: "Әлия 😀", track: "profile" }, preferences: { leaderboard: true }, xp: 120, progress: { linear: { mastered: true, independentTaskIds: ["a", "b"] } }, generatedTasks: [{ answer: "private" }], history: "Қазақша русский 😀 Ω 漢字".repeat(65000), revision: 2 }; }
function database() { const db = new DatabaseSync(":memory:"); db.exec("CREATE TABLE learner_states(user_id TEXT PRIMARY KEY,email TEXT,data TEXT,revision INTEGER,updated_at TEXT); CREATE TABLE learner_state_chunks(user_id TEXT,token TEXT,chunk_index INTEGER,data TEXT,PRIMARY KEY(user_id,token,chunk_index));"); db.prepare("INSERT INTO learner_states VALUES(?,?,?,?,?)").run("owner", "e", "{}", 1, "now"); return db; }
function batch(db: DatabaseSync, statements: StateStatement[]) { db.exec("BEGIN IMMEDIATE"); try { const result = statements.map(s => db.prepare(s.sql).all(...s.params)); db.exec("COMMIT"); return result; } catch (e) { db.exec("ROLLBACK"); throw e; } }
function head(db: DatabaseSync) { return (db.prepare("SELECT data FROM learner_states WHERE user_id='owner'").get() as { data: string }).data; }
function rows(db: DatabaseSync, token: string) { return db.prepare("SELECT chunk_index AS chunkIndex,data FROM learner_state_chunks WHERE user_id='owner' AND token=? ORDER BY chunk_index").all(token) as { chunkIndex: number; data: string }[]; }
test("a >2 MB multilingual snapshot round-trips losslessly through bounded D1 chunks", async () => {
  const original = fixture(); assert.ok(new TextEncoder().encode(JSON.stringify(original)).length > 2000000);
  const bundle = await encodeState(original, "big"); assert.ok(bundle.pointer); assert.ok(new TextEncoder().encode(bundle.head).length < INLINE_STATE_BYTES); assert.ok(bundle.chunks.every(c => new TextEncoder().encode(c).length <= 4 * STATE_CHUNK_CHARACTERS));
  assert.deepEqual(await decodeState(bundle.head, bundle.chunks.map((data, chunkIndex) => ({ chunkIndex, data }))), original);
  const summary = JSON.parse(bundle.head); assert.equal(summary.xp, 120); assert.deepEqual(summary.progress, { linear: { mastered: true } }); assert.equal(summary.generatedTasks, undefined);
});
test("missing, reordered or corrupted chunks never become a partial learner state", async () => {
  const bundle = await encodeState(fixture(), "integrity"), parts = bundle.chunks.map((data, chunkIndex) => ({ chunkIndex, data }));
  await assert.rejects(decodeState(bundle.head, parts.slice(1))); await assert.rejects(decodeState(bundle.head, [...parts].reverse())); await assert.rejects(decodeState(bundle.head, parts.map((r, i) => i ? r : { ...r, data: "X" + r.data.slice(1) })));
  assert.throws(() => statePointer(JSON.stringify({ _entStorage: { version: 1, chunks: 100000 } })));
});
test("batch CAS has one winner and a stale writer cannot leave or delete chunks", async () => {
  const db = database(); try {
    const first = await encodeState(fixture(), "winner"), second = await encodeState({ ...fixture(), xp: 999 }, "loser");
    assert.equal(batch(db, stateSaveStatements("owner", "e", 1, first, "now"))[0].length, 1);
    assert.equal(batch(db, stateSaveStatements("owner", "e", 1, second, "now"))[0].length, 0);
    assert.equal(rows(db, "loser").length, 0); assert.deepEqual(await decodeState(head(db), rows(db, "winner")), fixture());
    const inline = await encodeState({ xp: 121, revision: 3 }, "inline"); assert.equal(batch(db, stateSaveStatements("owner", "e", 2, inline, "later"))[0].length, 1); assert.deepEqual(await decodeState(head(db), []), { xp: 121, revision: 3 }); assert.equal(db.prepare("SELECT COUNT(*) AS n FROM learner_state_chunks").get()?.n, 0);
  } finally { db.close(); }
});
test("a failed chunk statement rolls the head update and all other parts back", async () => {
  const db = database(); try {
    const bundle = await encodeState(fixture(), "rollback"), statements = stateSaveStatements("owner", "e", 1, bundle, "now"); statements.splice(2, 0, statements[1]); assert.throws(() => batch(db, statements)); assert.equal(head(db), "{}"); assert.equal(db.prepare("SELECT revision FROM learner_states").get()?.revision, 1); assert.equal(db.prepare("SELECT COUNT(*) AS n FROM learner_state_chunks").get()?.n, 0);
  } finally { db.close(); }
});
test("capacity is rejected before a database write plan is produced", async () => {
  await assert.rejects(encodeState({ history: "a".repeat((MAX_STATE_CHUNKS + 1) * STATE_CHUNK_CHARACTERS) }, "too-big"), /STATE_CAPACITY/);
});
