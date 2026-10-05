export type DraftKind = "practice" | "diagnostic";
export function snapshotTime(value: unknown, now = Date.now()) {
  const time = value === undefined ? now : value;
  if (typeof time !== "number" || !Number.isSafeInteger(time) || time < 0 || time > now + 60000) throw new Error("Неверное время сохранения. Обновите страницу.");
  return time;
}
function marker(state: Record<string, unknown>, kind: DraftKind) {
  const saved = state.draftUpdatedAt as Partial<Record<DraftKind, number>> | undefined;
  return typeof saved?.[kind] === "number" ? saved[kind]! : 0;
}
function mark(state: Record<string, unknown>, kind: DraftKind, time: number) { state.draftUpdatedAt = { ...(state.draftUpdatedAt as object || {}), [kind]: Math.max(marker(state, kind), time) }; }
export function beginDraftSnapshot(state: Record<string, unknown>, kind: DraftKind, time: number) {
  if (time <= marker(state, kind)) return false; mark(state, kind, time); return true;
}
// Completion fences only the submitted client snapshot. A newer draft edited
// while that submission was in flight is kept for the student.
export function finishDraftSnapshot(state: Record<string, unknown>, kind: DraftKind, time: number) {
  const newer = marker(state, kind) > time; mark(state, kind, time);
  if (!newer) state[kind === "practice" ? "practiceDraft" : "diagnosticDraft"] = null;
  return !newer;
}
