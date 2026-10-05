import type { Answer, Exam } from "./engine";
// @ts-expect-error Native Node regression tests require an explicit extension.
import { snapshotTime } from "./draft-snapshot.ts";

// A stable client timestamp orders answer snapshots across an ordinary request and
// a pagehide beacon. It is an ordering hint, never evidence of exam timeliness.
export function applyExamSnapshot(exam: Exam, input: { index: number; answer?: Answer; flagged?: boolean; nextIndex?: number; updatedAt?: number }, now = Date.now()) {
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= exam.questions.length) throw new Error("Неверный вопрос.");
  if (input.nextIndex !== undefined && (!Number.isInteger(input.nextIndex) || input.nextIndex < 0 || input.nextIndex >= exam.questions.length)) throw new Error("Неверный следующий вопрос.");
  const updatedAt = snapshotTime(input.updatedAt, now);
  const key = String(input.index), previous = exam.answerUpdatedAt?.[key];
  if (previous !== undefined && updatedAt <= previous) return false;
  if (input.answer !== undefined) exam.answers[key] = input.answer;
  if (typeof input.flagged === "boolean") exam.flagged = input.flagged ? [...new Set([...exam.flagged, input.index])] : exam.flagged.filter(i => i !== input.index);
  (exam.answerUpdatedAt ||= {})[key] = updatedAt;
  if (updatedAt >= (exam.currentIndexUpdatedAt ?? 0)) { exam.currentIndex = input.nextIndex ?? input.index; exam.currentIndexUpdatedAt = updatedAt; }
  return true;
}
