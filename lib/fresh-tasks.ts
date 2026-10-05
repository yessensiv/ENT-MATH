// @ts-expect-error Native Node regression tests require an explicit extension.
import { isModelExample, seenTaskIds, taskFingerprint, type LearnerState, type Task } from "./engine.ts";

export type ReviewGenerator = {
  generateReviewTask: (topicId: string, serial: number, level: 1 | 2 | 3) => unknown;
  validateGeneratedTask: (task: unknown) => { valid: boolean; errors: string[] };
  reviewCapacity: (topicId: string, level: 1 | 2 | 3) => number;
};

export function fillFreshTasks(state: LearnerState, topicId: string, bank: Task[], generator: ReviewGenerator, review: boolean, level: 1 | 2 | 3, wanted: number) {
  const generated = (Array.isArray(state.generatedTasks) ? state.generatedTasks : []) as Task[], seen = seenTaskIds(state);
  const fresh = [...bank, ...generated].filter(t => t.topicId === topicId && !isModelExample(t) && !seen.has(t.id) && (review || !t.reviewReserved));
  const relevant = review ? fresh.filter(t => t.difficulty === level) : fresh;
  if (relevant.length >= wanted) return { changed: false, exhausted: false };
  const serials = { ...(state.reviewSerials as Record<string, number> || {}) }, fingerprints = new Set([...bank, ...generated, ...state.exams.flatMap(e => e.questions)].filter(t => t.topicId === topicId).map(taskFingerprint));
  let count = relevant.length, changed = false;
  const levels = review ? [level] : [level, ...([1, 2, 3] as const).filter(l => l !== level)];
  for (const difficulty of levels) {
    const key = `${topicId}:${difficulty}`, capacity = generator.reviewCapacity(topicId, difficulty); let serial = serials[key] || 0;
    while (count < wanted && serial < capacity) {
      serial++; serials[key] = serial; changed = true;
      const raw = generator.generateReviewTask(topicId, serial, difficulty); if (!raw || !generator.validateGeneratedTask(raw).valid) continue;
      const candidate = raw as Task & { level?: number; unit?: string }, fingerprint = taskFingerprint(candidate);
      if (seen.has(candidate.id) || fingerprints.has(fingerprint)) continue;
      fingerprints.add(fingerprint); generated.push({ ...candidate, difficulty, units: candidate.unit || candidate.units, modelExample: false, reviewReserved: review }); count++;
    }
    if (count >= wanted) break;
  }
  if (changed) { state.generatedTasks = generated; state.reviewSerials = serials; }
  return { changed, exhausted: count < wanted };
}
