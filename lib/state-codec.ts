// Keep each D1 value well below the 2 MB row/string limit. A bounded batch also
// leaves room for reads within the free plan's 50-query invocation limit.
export const INLINE_STATE_BYTES = 600000;
export const STATE_CHUNK_CHARACTERS = 180000;
export const MAX_STATE_CHUNKS = 32;
export type StatePointer = { version: 1; token: string; chunks: number; bytes: number; sha256: string };
export type StateBundle = { head: string; chunks: string[]; pointer?: StatePointer };
const byteLength = (value: string) => new TextEncoder().encode(value).byteLength;
async function digest(value: string) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].map(v => v.toString(16).padStart(2, "0")).join(""); }
export function statePointer(head: string): StatePointer | null {
  const marker = JSON.parse(head)._entStorage;
  if (!marker) return null;
  if (marker.version !== 1 || typeof marker.token !== "string" || !marker.token || !Number.isInteger(marker.chunks) || marker.chunks < 1 || marker.chunks > MAX_STATE_CHUNKS || !Number.isSafeInteger(marker.bytes) || marker.bytes < 1 || typeof marker.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(marker.sha256)) throw new Error("Invalid state manifest");
  return marker as StatePointer;
}
export async function encodeState(state: Record<string, unknown>, token: string): Promise<StateBundle> {
  const serialized = JSON.stringify(state), bytes = byteLength(serialized);
  if (bytes <= INLINE_STATE_BYTES) return { head: serialized, chunks: [] };
  const chunks: string[] = [];
  for (let i = 0; i < serialized.length;) {
    let end = Math.min(serialized.length, i + STATE_CHUNK_CHARACTERS);
    const last = serialized.charCodeAt(end - 1); if (end < serialized.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(serialized.slice(i, end)); i = end;
    if (chunks.length > MAX_STATE_CHUNKS) throw new Error("STATE_CAPACITY");
  }
  const pointer: StatePointer = { version: 1, token, chunks: chunks.length, bytes, sha256: await digest(serialized) };
  const progress = Object.fromEntries(Object.entries((state.progress || {}) as Record<string, { mastered?: boolean }>).map(([id, p]) => [id, { mastered: Boolean(p.mastered) }]));
  // The head remains a small real-data summary for opt-in rankings.
  return { head: JSON.stringify({ _entStorage: pointer, profile: state.profile, preferences: state.preferences, xp: state.xp, progress, revision: state.revision }), chunks, pointer };
}
export async function decodeState(head: string, rows: { chunkIndex: number; data: string }[]): Promise<Record<string, unknown>> {
  const pointer = statePointer(head); if (!pointer) return JSON.parse(head);
  if (rows.length !== pointer.chunks || rows.some((r, i) => r.chunkIndex !== i)) throw new Error("Missing state chunks");
  const value = rows.map(r => r.data).join("");
  if (byteLength(value) !== pointer.bytes || await digest(value) !== pointer.sha256) throw new Error("State checksum mismatch");
  return JSON.parse(value);
}
export type StateStatement = { sql: string; params: (string | number)[] };
export function stateSaveStatements(userId: string, email: string, revision: number, bundle: StateBundle, at: string): StateStatement[] {
  const next = revision + 1, guard = bundle.pointer ? "revision=? AND json_extract(data,'$._entStorage.token')=?" : "revision=? AND data=?", guardValue = bundle.pointer?.token || bundle.head;
  const result: StateStatement[] = [{ sql: "UPDATE learner_states SET data=?,revision=?,email=?,updated_at=? WHERE user_id=? AND revision=? RETURNING user_id", params: [bundle.head, next, email, at, userId, revision] }];
  bundle.chunks.forEach((data, index) => result.push({ sql: `INSERT INTO learner_state_chunks(user_id,token,chunk_index,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND ${guard})`, params: [userId, bundle.pointer!.token, index, data, userId, next, guardValue] }));
  result.push({ sql: `DELETE FROM learner_state_chunks WHERE user_id=? ${bundle.pointer ? "AND token<>? " : ""}AND EXISTS(SELECT 1 FROM learner_states WHERE user_id=? AND ${guard})`, params: [userId, ...(bundle.pointer ? [bundle.pointer.token] : []), userId, next, guardValue] });
  return result;
}
