import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's native type stripping requires explicit extensions.
import { calculate, equivalent, emptyState, recordAttempt, makePlan, finishExam, expireExam, scoreExamTask, answerFitsTask, EXAM_RULES, type Task, type Topic } from "../lib/engine.ts";

const topic: Topic = { id: "linear", title: { ru: "Уравнения", kk: "Теңдеулер" }, track: "profile",masteryRubric:{reviewed:true,minimumIndependent:4} };
const taskNumbers=new Map<string,number>();
const condition=(id:string)=>{const n=taskNumbers.get(id)??taskNumbers.size+3;taskNumbers.set(id,n);return {ru:`2x+${n}=${8+n}`,kk:`2x+${n}=${8+n}`};};
const task = (id: string): Task => ({ id, topicId: "linear", type: "number", difficulty: 2,methodFamily:id.includes('1')||id.includes('one')?'model':'transformation',answer: "4", prompt: condition(id), hints: { ru: ["Вычти 3"], kk: ["3-ті азайт"] }, solution: { ru: ["x=4"], kk: ["x=4"] } });
const start = new Date("2026-10-05T08:00:00Z");
function mastered() {
  const state = emptyState(); for (let i = 0; i < 4; i++) recordAttempt(state, task(`p${i}`), topic, { answer: "4" }, [], start);
  recordAttempt(state, task("r1"), topic, { answer: "4", reviewId: state.reviews[0].id }, [], new Date("2026-10-06T09:00:00Z")); return state;
}
test("a new wrong answer flags recovery while keeping prior mastery and a repair in the route", () => {
  const state = mastered(); recordAttempt(state, task("mistake"), topic, { answer: "7" }, [], new Date("2026-10-06T10:00:00Z"));
  assert.equal(state.progress.linear.mastered, true); assert.equal(state.progress.linear.needsRecovery, true); assert.equal(state.progress.linear.reviewPassed, true); assert.equal(makePlan(state, [topic], new Date("2026-10-06T10:01:00Z"))[0].type, "repair");
});
test("recovery cannot farm the original mastery award and unrelated checks do not clear it", () => {
  const state = mastered(); const before = state.xp;
  recordAttempt(state, task("mistake"), topic, { answer: "7", reviewId: state.reviews[1].id }, [], new Date("2026-10-09T10:00:00Z"));
  const next = new Date("2026-10-10T11:00:00Z"); for (let i = 0; i < 4; i++) recordAttempt(state, task(`again-${i}`), topic, { answer: "4" }, [], next);
  assert.equal(state.progress.linear.mastered, true); assert.equal(state.progress.linear.needsRecovery, true); recordAttempt(state, task("again-delayed"), topic, { answer: "4", reviewId: state.reviews[1].id }, [], new Date("2026-10-11T12:00:00Z"));
  assert.equal(state.progress.linear.mastered, true); assert.equal(state.progress.linear.needsRecovery, true); assert.equal(state.xp - before, 50,'five new successes; the original mastery award is not paid again');
});
test("a revealed exam answer cannot later count as fresh independent practice", () => {
  const state = emptyState(), t = task("exam-seen"), exam = { id: "e", track: "profile" as const, variant: 1, startedAt: start.toISOString(), durationMinutes: 80, questions: [t], answers: { "0": "4" }, flagged: [], rules: EXAM_RULES };
  finishExam(exam, state, start); const feedback = recordAttempt(state, t, topic, { answer: "4" }, [], start);
  assert.equal(feedback.independentEligible, false); assert.equal(state.progress.linear.independent, 0);
});
test("exam-seen task is rejected for a delayed fresh review", () => {
  const state = emptyState(), t = task("exam-seen"), exam = { id: "e", track: "profile" as const, variant: 1, startedAt: start.toISOString(), durationMinutes: 80, questions: [t], answers: {}, flagged: [], rules: EXAM_RULES };
  finishExam(exam, state, start); assert.throws(() => recordAttempt(state, t, topic, { answer: "4", reviewId: state.reviews[0].id }, [], new Date("2026-10-06T09:00:00Z")));
});
test("rational cancellation checks denominator roots outside the fixed sample grid", () => {
  assert.equal(equivalent("(x-0.3)/(x-0.3)", "1"), false);
  assert.equal(equivalent("(x^2-0.09)/(x-0.3)", "x+0.3"), false);
  assert.equal(equivalent("(2x+3)/(x+0.3)", "(3+2x)/(0.3+x)"), true);
});
test("constant undefined expressions and tangent poles are rejected", () => {
  assert.equal(equivalent("1/0", "1/0"), false); assert.equal(equivalent("1/(x-x)", "1/(x-x)"), false); assert.throws(() => calculate("tan(pi/2)"));
});
test("deadline is closed at the exact boundary and repeated completion is idempotent", () => {
  const state = emptyState(); state.activeExam = { id: "deadline", track: "profile", variant: 1, startedAt: start.toISOString(), durationMinutes: 80, questions: [task("deadline-task")], answers: {}, flagged: [], rules: EXAM_RULES };
  assert.equal(expireExam(state, new Date(start.getTime() + 80 * 60000 - 1)), null);
  const result = expireExam(state, new Date(start.getTime() + 80 * 60000)); assert.ok(result); assert.equal(result.id, "deadline"); assert.equal(result.finishReason, "time"); assert.equal(result.score, 0); assert.deepEqual(result.results?.[0].prompt, task("deadline-task").prompt);
  finishExam(result, state, new Date(start.getTime() + 81 * 60000)); assert.equal(state.exams.length, 1); assert.equal(state.errors.length, 1); assert.equal(state.activeExam, null);
});
test("official exam choices reject unknown values, duplicate selections and excess matching rows", () => {
  const single = { ...task("single"), type: "single" as const, options: ["4", "3", "2", "1"] };
  assert.equal(answerFitsTask(single, "8/2", false), true); assert.equal(answerFitsTask(single, "8/2", true), false); assert.equal(scoreExamTask(single, "8/2").points, 0);
  const matching = { ...task("matching"), type: "matching" as const, answer: ["A", "B", "C"], options: ["A", "B", "C", "D"] };
  assert.equal(scoreExamTask(matching, ["A", "B", ""]).points, 1); assert.equal(scoreExamTask(matching, ["A", "B", "C", "D"]).points, 0); assert.equal(answerFitsTask(matching, ["A", "B", "UNLISTED"], true), false);
  const multiple = { ...matching, type: "multiple" as const, answer: ["A"] }; assert.equal(scoreExamTask(multiple, ["A", " A"]).points, 0);
});
test("repeated errors need several fresh solutions and cannot multiply the correction reward", () => {
  const repair={...task('fix-c'),repairsTaskIds:['same-error']};
  const state = emptyState(); for (let i = 0; i < 5; i++) recordAttempt(state, task("same-error"), topic, { answer: "7" }, [task('fix-a'),task('fix-b'),repair], start);
  recordAttempt(state, task("fix-a"), topic, { answer: "4" }, [], start); assert.equal(state.errors.every(e => e.resolved), false); assert.equal(state.xp, 10);
  recordAttempt(state, task("fix-b"), topic, { answer: "4" }, [], start); recordAttempt(state, repair, topic, { answer: "4" }, [], start); assert.equal(state.errors.every(e => e.resolved), true); assert.equal(state.xp, 35);
});
test("an early remedial review cannot stand in for the delayed check after four confirmations", () => {
  const state = emptyState(); recordAttempt(state, task("wrong-first"), topic, { answer: "7" }, [], start);
  recordAttempt(state, task("fresh-one"), topic, { answer: "4" }, [], start);
  const later = new Date("2026-10-06T09:00:00Z"); recordAttempt(state, task("early-review"), topic, { answer: "4", reviewId: state.reviews[0].id }, [], later);
  recordAttempt(state, task("fresh-third"), topic, { answer: "4" }, [], later);
  recordAttempt(state, task("fresh-fourth"), topic, { answer: "4" }, [], later);
  assert.equal(state.progress.linear.mastered, false); assert.equal(state.progress.linear.reviewPassed, false); assert.ok(state.reviews.some(r => !r.completed && Date.parse(r.due) > later.getTime()));
  const pending = state.reviews.find(r => !r.completed)!;recordAttempt(state,task('too-soon'),topic,{answer:'4'},[],later);assert.equal(state.progress.linear.mastered,false);
  recordAttempt(state, task("delayed-final"), topic, { answer: "4", reviewId: pending.id }, [], new Date(Date.parse(pending.due)+1000)); assert.equal(state.progress.linear.mastered, true);
});
