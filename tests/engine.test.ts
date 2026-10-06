import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node's native type-stripping test runner requires explicit .ts extensions.
import { calculate, equivalent, grade, scoreExamTask, emptyState, makePlan, recordAttempt, classifyError, sanitizeTask, makeExam, finishExam, reservedReviewIds, dayKey, streakInfo, recoverStreak, EXAM_RULES, type Task, type Topic } from "../lib/engine.ts";

const topics: Topic[] = [
  { id: "fractions", title: { ru: "Дроби", kk: "Бөлшектер" }, track: "base", prerequisites: [] },
  { id: "equations", title: { ru: "Уравнения", kk: "Теңдеулер" }, track: "profile", prerequisites: ["fractions"] },
];
const taskNumbers=new Map<string,number>();
function task(id = "one", answer: string | string[] = "4", type: Task["type"] = "number"): Task {
  const n=taskNumbers.get(id)??taskNumbers.size+3;taskNumbers.set(id,n);
  return { id, answer, type, topicId: "equations", difficulty: 1, prompt: { ru: `2x+${n}=${8+n}`, kk: `2x+${n}=${8+n}` }, hints: { ru: ["Вычти 3"], kk: ["3-ті азайт"] }, solution: { ru: ["x=4"], kk: ["x=4"] } };
}

test("safe parser handles fractions, implicit multiplication, power precedence and rejects executable code", () => {
  assert.equal(calculate("1/2 + 0,5"), 1);
  assert.equal(calculate("-2^2"), -4);
  assert.equal(calculate("2x(x+1)", 3), 24);
  assert.equal(calculate("sqrt(16) + 2^3"), 12);
  assert.equal(calculate("√(х²)+|х|", -3), 6);
  assert.equal(calculate("1e3 + 2e-2"), 1000.02);
  for (const input of ["globalThis.fetch('x')", "process.exit()", "1/0", "sqrt(-1)", "x.constructor", "function(){return 1}"]) assert.throws(() => calculate(input));
});
test("equivalent expressions check arithmetic, domains and absolute rounding tolerance", () => {
  assert.equal(equivalent("(x+2)(x-2)", "x^2-4"), true);
  assert.equal(equivalent("x/x", "1"), false);
  assert.equal(equivalent("(x^2-1)/(x-1)", "x+1"), false);
  assert.equal(equivalent("1/2", "0.5"), true);
  assert.equal(equivalent("1000.01", "1000", 2), false);
  assert.equal(equivalent("1000.004", "1000", 2), true);
  assert.equal(equivalent("х", "0"), false);
  assert.equal(grade({ ...task("zero", "0"), tolerance: 0.000001 }, "x"), false);
});
test("single and multiple grading reject extra answers and respect units", () => {
  assert.equal(grade(task(), "8/2"), true);
  assert.equal(grade({ ...task(), units: "м" }, "4 м"), true);
  assert.equal(grade({ ...task(), units: "м" }, "4 км"), false);
  const t = task("multi", ["2", "4"], "multiple");
  assert.equal(grade(t, ["4", "2"]), true);
  assert.equal(grade(t, ["2", "4", "8"]), false);
  assert.equal(grade(t, ["2", "2"]), false);
});
test('textual choice keys are selected literally rather than parsed as arithmetic',()=>{
 const t={...task('proof','SSS','single'),options:['SSS','SAS','AAA','SSA']};
 assert.equal(grade(t,'SSS'),true);assert.equal(grade(t,'AAA'),false);assert.equal(grade({...t,answer:'A',options:['A','B']},'A'),true);
 assert.equal(grade({...t,answer:'4',options:['4','8']},'8/2'),true);
});
test("official p18 partial credit covers all three answer counts", () => {
  assert.equal(scoreExamTask(task("a", ["a"], "multiple"), ["a", "b"]).points, 1);
  assert.equal(scoreExamTask(task("a", ["a"], "multiple"), ["a", "b", "c"]).points, 0);
  assert.equal(scoreExamTask(task("a", ["a", "b"], "multiple"), ["a"]).points, 1);
  assert.equal(scoreExamTask(task("a", ["a", "b"], "multiple"), ["a", "b", "c"]).points, 1);
  assert.equal(scoreExamTask(task("a", ["a", "b", "c"], "multiple"), ["a"]).points, 0);
  assert.equal(scoreExamTask(task("a", ["a", "b", "c"], "multiple"), ["a", "b", "d"]).points, 1);
  assert.equal(scoreExamTask(task("a", ["a", "b", "c"], "multiple"), ["a", "b", "c"]).points, 2);
  assert.equal(scoreExamTask(task("a", ["a", "b"], "matching"), ["a", "x"]).points, 1);
});
test("plan restores prerequisite before profile skill", () => {
  const state = emptyState(); state.profile = { name: "A", grade: "11", track: "profile", dailyMinutes: 20, examDate: "2027-06-01", target: 40, language: "ru" };
  const plan = makePlan(state, topics); assert.equal(plan[0].topicId, "fractions"); assert.equal(plan[1].topicId, "equations");
});
test("provisional readiness opens successors while delayed review remains required for mastery", () => {
  const state = emptyState(), now = new Date("2026-10-05T08:00:00Z"); state.profile = { name: "A", grade: "11", track: "profile", dailyMinutes: 20, examDate: "2027-06-01", target: 40, language: "ru" };
  state.progress.fractions = { attempts: 3, correct: 3, independent: 3, independentTaskIds: ["a", "b", "c"], mastered: false };
  state.progress.equations = { attempts: 3, correct: 3, independent: 3, independentTaskIds: ["d", "e", "f"], mastered: false };
  state.reviews.push({ id: "delayed", topicId: "equations", due: "2026-10-06T08:00:00Z", interval: 1, completed: false });
  const next: Topic = { id: "systems", title: { ru: "Системы", kk: "Жүйелер" }, track: "profile", prerequisites: ["equations"] };
  const plan = makePlan(state, [...topics, next], now); assert.equal(plan[0].topicId, "systems"); assert.equal(state.progress.equations.mastered, false);
  assert.equal(makePlan(state, [...topics, next], new Date("2026-10-06T08:01:00Z"))[0].type, "review");
});
test("one diagnostic success cannot establish a whole prerequisite", () => {
  const state = emptyState(); state.diagnostics.push({ id: "diag", track: "profile", at: "2026-10-05", score: 1, total: 2, strengths: ["fractions"], gaps: ["equations"] });
  assert.equal(makePlan(state, topics)[0].topicId, "fractions"); assert.equal(state.progress.fractions, undefined); assert.equal(state.xp, 0);
});
test("close deadline prioritizes most severe gaps and includes target and days left", () => {
  const state = emptyState(), now = new Date("2026-10-05T08:00:00Z"); state.profile = { name: "A", grade: "11", track: "profile", dailyMinutes: 20, examDate: "2026-10-15", target: 40, language: "ru" };
  const other: Topic = { id: "functions", title: { ru: "Функции", kk: "Функциялар" }, track: "profile", prerequisites: [] };
  state.progress.equations = { attempts: 10, correct: 8, independent: 0, independentTaskIds: [], mastered: false };
  state.progress.functions = { attempts: 5, correct: 1, independent: 0, independentTaskIds: [], mastered: false };
  const plan = makePlan(state, [...topics, other], now); assert.equal(plan[0].topicId, "functions"); assert.match(plan[0].reason.ru, /40\/50/); assert.match(plan[0].reason.ru, /10 дн/); assert.match(plan[0].reason.ru, /Экзамен близко/);
  state.profile.examDate = "2027-06-01"; assert.equal(makePlan(state, [...topics, other], now)[0].topicId, "fractions");
});
test("reserved repetition contains basic, two medium and one high fresh task", () => {
  const bank = Array.from({ length: 15 }, (_, i) => ({ ...task(`reserved-${i}`), difficulty: Math.floor(i / 5) + 1 }));
  const topic = { ...topics[1], tasks: bank };
  const ids = reservedReviewIds(topic); assert.equal(ids.length, 4); assert.deepEqual(ids.map(id => bank.find(t => t.id === id)!.difficulty).sort(), [1, 2, 2, 3]); assert.equal(new Set(ids).size, 4);
});
test("exam errors assign one-day repetition without duplicated topic schedules", () => {
  const state = emptyState(), now = new Date("2026-10-05T08:00:00Z");
  const exam = { id: "exam", track: "profile" as const, variant: 1, startedAt: now.toISOString(), durationMinutes: 80, questions: [task("exam-a"), task("exam-b")], answers: {}, flagged: [], rules: EXAM_RULES };
  finishExam(exam, state, now); assert.equal(state.errors.length, 2); assert.equal(state.reviews.length, 1); assert.equal(state.reviews[0].due, "2026-10-06T08:00:00.000Z");
});
test("legacy topic successes do not prove mastery without reviewed methods and rubric", () => {
  const state = emptyState(), bank = ["a", "b", "c", "d"].map(id => task(id)), now = new Date("2026-10-05T08:00:00Z");
  for (const t of bank.slice(0, 3)) recordAttempt(state, t, topics[1], { answer: "4" }, bank, now);
  assert.equal(state.progress.equations.mastered, false); assert.equal(state.progress.equations.independent, 3);
  const review = state.reviews[0]; assert.throws(() => recordAttempt(structuredClone(state), bank[3], topics[1], { answer: "4", reviewId: review.id }, bank, now));
  recordAttempt(state, bank[3], topics[1], { answer: "4", reviewId: review.id }, bank, new Date("2026-10-06T08:01:00Z"));
  assert.equal(state.progress.equations.mastered, false); assert.equal(state.reviews[1].interval, 3);
});
test('MAST-01: reviewed rubric needs four independent tasks in two methods, required level and delayed check',()=>{
 const state=emptyState(),now=new Date('2026-10-05T08:00:00Z'),bank=['a','b','c','d','e'].map((id,i)=>({...task(id),difficulty:2,methodFamily:i%2?'balance':'inverse'}));
 const topic={...topics[1],masteryRubric:{reviewed:true,minimumIndependent:4,minimumDifficulty:2,minimumFamilies:2}};
 for(const t of bank.slice(0,4))recordAttempt(state,t,topic,{answer:'4'},bank,now);assert.equal(state.progress.equations.mastered,false);
 recordAttempt(state,bank[4],topic,{answer:'4',reviewId:state.reviews[0].id},bank,new Date('2026-10-06T08:01:00Z'));assert.equal(state.progress.equations.mastered,true);
});
test("repeat task and assisted answer never count as new independent mastery", () => {
  const state = emptyState(), t = task(); recordAttempt(state, t, topics[1], { answer: "4", assisted: true }, [t]); recordAttempt(state, t, topics[1], { answer: "4" }, [t]); assert.equal(state.progress.equations.independent, 0);
});
test("published lesson examples never count as independent practice", () => {
  const state = emptyState(), t = task(); recordAttempt(state, { ...t, modelExample: true }, topics[1], { answer: "4" }, [t]); assert.equal(state.progress.equations.independent, 0);
});
test("final answer alone does not invent an error cause; known faulty transition identified", () => {
  assert.equal(classifyError("").category, "unknown");
  assert.equal(classifyError("2x + 3 = 11\n2x = 14").category, "sign");
  assert.equal(classifyError("x = 7").category, "unconfirmed");
});
test("task delivery excludes answer keys, hints and solutions", () => {
  const safe = sanitizeTask({ ...task(), secretAnswer: "4" }); assert.equal("answer" in safe, false); assert.equal("solution" in safe, false); assert.equal("hints" in safe, false); assert.equal("secretAnswer" in safe, false);
});
test("a new error assigns one-day repetition and further errors reset its interval", () => {
  const state = emptyState(), t = task(), now = new Date("2026-10-05T08:00:00Z"); recordAttempt(state, t, topics[1], { answer: "7" }, [t], now);
  assert.equal(state.reviews.length, 1); assert.equal(state.reviews[0].due, "2026-10-06T08:00:00.000Z"); state.reviews[0].interval = 7;
  recordAttempt(state, { ...t, id: "another" }, topics[1], { answer: "9" }, [t], new Date("2026-10-05T10:00:00Z"));
  assert.equal(state.reviews.length, 1); assert.equal(state.reviews[0].interval, 1); assert.equal(state.reviews[0].due, "2026-10-06T10:00:00.000Z");
});
test("voluntary ranking defaults off and streak uses Kazakhstan calendar days", () => {
  const state = emptyState(); assert.equal(state.preferences?.leaderboard, false);
  assert.equal(dayKey(new Date("2026-10-05T20:30:00Z")), "2026-10-06");
  state.streakDays = ["2026-10-03", "2026-10-04", "2026-10-05", "2026-09-20"];
  const info = streakInfo(state, new Date("2026-10-05T08:00:00Z")); assert.equal(info.current, 3); assert.equal(info.best, 3); assert.equal(info.thisWeekPracticed, 1);
});
test("streak recovery bridges one missed day weekly without adding practice, XP or mastery", () => {
  const state = emptyState(), now = new Date("2026-10-05T08:00:00Z"); state.streakDays = ["2026-10-03", "2026-10-05"];
  assert.equal(streakInfo(state, now).recoveryAvailable, true); const before = JSON.stringify({ days: state.streakDays, xp: state.xp, progress: state.progress });
  const info = recoverStreak(state, now); assert.equal(info.current, 3); assert.equal(info.practicedDays, 2); assert.deepEqual(info.recoveredDays, ["2026-10-04"]); assert.equal(info.recoveryUsedThisWeek, true);
  assert.equal(JSON.stringify({ days: state.streakDays, xp: state.xp, progress: state.progress }), before); assert.throws(() => recoverStreak(state, now));
  state.streakDays.push("2026-10-07"); assert.equal(streakInfo(state, new Date("2026-10-07T08:00:00Z")).recoveryAvailable, false);
});
test("all five profile variants have blueprint types and 50/30/20 difficulties", () => {
  const bank: Task[] = [];
  for (const type of ["single", "multiple", "matching"] as const) for (const d of [1, 2, 3]) for (let i = 0; i < 20; i++) bank.push({ ...task(`${type}-${d}-${i}`, type === "single" ? "4" : ["4", "5"], type), difficulty: d, options: ["4", "5", "6", "7"] });
  for (let variant = 1; variant <= 5; variant++) {
    const exam = makeExam("profile", variant, [...topics, ...["numbers","percentages"].map(id=>({id,title:{ru:id,kk:id},track:"base" as const}))], bank);
    assert.equal(exam.questions.length, 40);
    assert.equal(exam.questions.filter(t => t.type === "single" && !t.context).length, 25);
    assert.equal(exam.questions.filter(t => t.context).length, 5);
    assert.equal(exam.questions.filter(t => t.type === "multiple").length, 5);
    assert.equal(exam.questions.filter(t => t.type === "matching").length, 5);
    assert.deepEqual([1, 2, 3].map(d => exam.questions.filter(t => t.difficulty === d).length), [20, 12, 8]);
    assert.equal(new Set(exam.questions.map(t => t.id)).size, 40);
  }
});
