// @ts-expect-error Native Node tests.
import {EXAM_RULES,resolveExamScoring,selectionCredit,scoreExplanation,type ExamRuleSnapshot} from './exam-rules.ts';
export {EXAM_RULES};
// @ts-expect-error Native Node tests need explicit extensions.
import { schoolTopicIds } from "./school-curriculum.ts";
// @ts-expect-error Native Node tests need explicit extensions.
import { exactRationalNumber, proveRationalIdentity, proveLinearEquationStep, type Verdict } from './algebra-proof.ts';
// @ts-expect-error Native Node tests.
import{checkStructuredAnswer,type AnswerFormat}from'./structured-answer.ts';
// @ts-expect-error Native Node tests.
import{fitWeeklyBudget}from'./weekly-plan.ts';
// @ts-expect-error Native Node tests.
import {currentDiagnosticEvidence,type DiagnosticEvidence} from './diagnostic-evidence.ts';
// @ts-expect-error Native Node tests.
import {repairSkillTitle} from './repair-catalog.ts';
export type Language = "ru" | "kk";
export type Track = "base" | "profile" | "literacy";
export type LocalText = { ru: string; kk: string };
export type Answer = string | string[];
export type Task = {
  id: string; topicId: string; prompt: LocalText; type: "number" | "single" | "multiple" | "matching" | "expression";
  answer: Answer; difficulty: number; options?: string[]; pairs?: { left: string; right: string }[];
  hints: { ru: string[]; kk: string[] }; solution: { ru: string[]; kk: string[] };
  skill?: string | LocalText; errors?: { ru: string[]; kk: string[] }; units?: string; precision?: number;
  domain?: string; context?: LocalText; tolerance?: number; [key: string]: unknown;
};
export type Topic = { id: string; title: LocalText; track: Track; prerequisites?: string[]; minutes?: number; [key: string]: unknown };
export type Profile = { name: string; grade: string; learningMode?: "school" | "ent"; schoolPathway?:'natural-math'|'humanitarian'; track: Track; examDate: string; target: number; targets?: Partial<Record<Track, number>>; dailyMinutes: number; language: Language };
export type Progress = { attempts: number; correct: number; independent: number; mastered: boolean; reviewPassed?: boolean; independentTaskIds: string[]; confirmationTaskIds?: string[]; masteryRewarded?: boolean; lastAt?: string; masteryVersion?:string; masteryReadyAt?:string; masteryPending?:boolean;needsRecovery?:boolean;recoveryTaskIds?:string[]; evidence?:Record<string,{difficulty:number;methodFamily:string|null}> };
export type Attempt = { id: string; taskId: string; topicId: string; track: Track; answer: Answer; steps: string; correct: boolean; assisted: boolean; at: string; category: string;taskVersion?:string;checkingVersion?:string;evidence?:{schema:1;independent:boolean;reason:"independent"|"help"|"repeat"|"worked-example";condition:string;difficulty:number;skillIds:string[];methodFamily:string|null};taskSnapshot?:Pick<Task,'prompt'|'answer'|'solution'|'domain'|'type'|'units'|'precision'|'difficulty'> };
export type Review = { id: string; topicId: string; due: string; interval: number; completed: boolean; taskId?: string; methodFamily?:string; variant?:{seed:number;level:1|2|3} };
export type ErrorEntry = { id: string; taskId: string; topicId: string; answer: Answer; steps: string; category: string; explanation: LocalText; at: string; resolved: boolean; exerciseIds: string[]; prompt?: LocalText; solution?: Task["solution"]; hints?: Task["hints"]; correctAnswer?: Answer;repairRequired?:number;repairPassedTaskIds?:string[];repairVersion?:string;repairSkill?:LocalText;repairedAt?:string;source?:Task['source'];subtopic?:Task['subtopic'] };
export type Exam = { id: string; track: Track; variant: number; startedAt: string; durationMinutes: number; questions: Task[]; answers: Record<string, Answer>; flagged: number[]; answerUpdatedAt?: Record<string, number>; currentIndex?: number; currentIndexUpdatedAt?: number; finishedAt?: string; finishReason?: "submitted" | "time"; score?: number; maxScore?: number; results?: { taskId: string; topicId: string; answer: Answer; correct: boolean; points: number; max: number; prompt?: LocalText; context?: LocalText; solution: Task["solution"]; correctAnswer: Answer; scoringExplanation?:LocalText; gradingRuleId?:string }[]; rules: ExamRuleSnapshot;bankVersion?:string;familiarQuestionIds?:string[] };
export type LearnerState = { profile: Profile | null; progress: Record<string, Progress>; attempts: Attempt[]; errors: ErrorEntry[]; reviews: Review[]; exams: Exam[]; diagnostics: { id: string; schoolGrade?: string; schoolPathway?:'natural-math'|'humanitarian'; track: Track; at: string; score: number; total: number; strengths: string[]; gaps: string[]; taskIds?: string[]; evidence?:DiagnosticEvidence[]; clarificationSkillId?:string }[]; xp: number; lessonResume: { topicId: string; stage: number } | null; plan: PlanItem[]; activeExam: Exam | null; revision: number; planReason?: LocalText; practiceStartedAt?: string; streakDays: string[]; preferences?: { leaderboard: boolean }; streakRecoveries?: { day: string; at: string; week: string }[]; [key: string]: unknown };
export type PlanItem = { topicId: string; title: LocalText; reason: LocalText; type: "lesson" | "review" | "repair" | "practice"; minutes: number; day: number };

export function emptyState(): LearnerState {
  return { profile: null, progress: {}, attempts: [], errors: [], reviews: [], exams: [], diagnostics: [], xp: 0, lessonResume: null, plan: [], activeExam: null, revision: 0, streakDays: [], preferences: { leaderboard: false }, streakRecoveries: [] };
}

export const dayKey = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qyzylorda" }).format(now);
export function shiftDay(day: string, shift: number) { return new Date(Date.parse(`${day}T00:00:00Z`) + shift * 86400000).toISOString().slice(0, 10); }
export function weekStart(day: string) { return shiftDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7)); }
export function streakInfo(state: LearnerState, now = new Date()) {
  const today = dayKey(now), yesterday = shiftDay(today, -1), week = weekStart(today);
  const practice = new Set(state.streakDays.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today));
  const recoveredDays = [...new Set((state.streakRecoveries || []).map(r => r.day).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today))].sort();
  const effective = new Set([...practice, ...recoveredDays]);
  let current = 0, cursor: string | null = effective.has(today) ? today : effective.has(yesterday) ? yesterday : null;
  while (cursor && effective.has(cursor)) { current++; cursor = shiftDay(cursor, -1); }
  let best = 0, run = 0, previous: string | null = null;
  for (const day of [...effective].sort()) { run = previous && shiftDay(previous, 1) === day ? run + 1 : 1; best = Math.max(best, run); previous = day; }
  const usedThisWeek = (state.streakRecoveries || []).some(r => r.week === week);
  const recoveryAvailable = practice.has(today) && !effective.has(yesterday) && effective.has(shiftDay(today, -2)) && !usedThisWeek;
  return { today, current, best, practicedDays: practice.size, thisWeekPracticed: [...practice].filter(d => d >= week).length, recoveredDays, recoveryAvailable, recoveryDay: recoveryAvailable ? yesterday : null, recoveryUsedThisWeek: usedThisWeek };
}
export function recoverStreak(state: LearnerState, now = new Date()) {
  const info = streakInfo(state, now); if (!info.recoveryAvailable || !info.recoveryDay) throw new Error("Сначала вернитесь к практике. Можно восстановить один вчерашний пропуск раз в календарную неделю.");
  (state.streakRecoveries ||= []).push({ day: info.recoveryDay, at: now.toISOString(), week: weekStart(info.today) });
  return streakInfo(state, now);
}

export function isModelExample(task: Task, topic?: Topic): boolean {
  if (task.modelExample === true) return true;
  const lesson=topic?.lesson as {guided?:{problem?:LocalText};examples?:{problem?:LocalText}[]}|undefined;
  if([lesson?.guided,...(lesson?.examples||[])].some(e=>e?.problem?.ru===task.prompt.ru&&e?.problem?.kk===task.prompt.kk))return true;
  const lessonBank = topic && Array.isArray(topic.tasks) ? topic.tasks as { id: string }[] : [];
  return [0, 1, 2, 5, 10].some(i => lessonBank[i]?.id === task.id);
}
export function reservedReviewIds(topic: Topic | undefined) {
  const lessonBank = topic && Array.isArray(topic.tasks) ? topic.tasks as Task[] : [];
  const available = lessonBank.filter(t => !isModelExample(t, topic)), chosen: string[] = [];
  for (const level of [1, 2, 2, 3]) {
    const task = [...available].reverse().find(t => !chosen.includes(t.id) && Number(t.difficulty || t.level || 1) === level)
      || [...available].reverse().find(t => !chosen.includes(t.id));
    if (task) chosen.push(task.id);
  }
  return chosen;
}

export function seenTaskIds(state: LearnerState) {
  return new Set([...state.attempts.map(a => a.taskId), ...state.errors.map(e => e.taskId), ...state.exams.flatMap(e => e.questions.map(t => t.id)), ...(Array.isArray(state.assistedTaskIds) ? state.assistedTaskIds as string[] : []), ...(Array.isArray(state.diagnosticExposures)?state.diagnosticExposures as string[]:[]),...state.diagnostics.flatMap(d => Array.isArray(d.taskIds) ? d.taskIds as string[] : [])]);
}
export function taskFingerprint(task: Task) {
  const clean = (value: string) => value.toLowerCase().replace(/\s+/g, "").replace(/−/g, "-").replace(/,/g, ".");
  return JSON.stringify({ topicId: task.topicId, ru: clean(task.prompt.ru), kk: clean(task.prompt.kk), context: task.context ? [clean(task.context.ru), clean(task.context.kk)] : null, left: task.pairs?.map(p => clean(p.left)).sort() || [] });
}
export function deliverTask(task: Task, state?: LearnerState) {
  const seen = Boolean(state && seenTaskIds(state).has(task.id)) || Boolean(task.modelExample);
  const assisted = Boolean(task.modelExample) || Boolean(state && Array.isArray(state.assistedTaskIds) && state.assistedTaskIds.includes(task.id));
  return { ...sanitizeTask(task), seen, assisted, practiceEligible: !seen && !assisted };
}
export function confirmationCount(p: Progress | undefined) { return p ? p.confirmationTaskIds?.length ?? p.independent : 0; }
export function masteryReady(p:Progress|undefined,topic:Topic){
 const rubric=topic.masteryRubric as {reviewed?:boolean;minimumIndependent?:number;minimumDifficulty?:number;minimumFamilies?:number}|undefined;
 if(!p||!rubric?.reviewed)return false;
 const evidence=(p.confirmationTaskIds||[]).map(id=>p.evidence?.[id]).filter((e):e is NonNullable<typeof e>=>!!e);
 const minimum=Math.max(4,Math.min(6,Number(rubric.minimumIndependent)||4)),level=Math.max(1,Math.min(3,Number(rubric.minimumDifficulty)||2)),families=Math.max(2,Number(rubric.minimumFamilies)||2);
 return evidence.length>=minimum&&evidence.some(e=>e.difficulty>=level)&&new Set(evidence.map(e=>e.methodFamily).filter(Boolean)).size>=families;
}

// Restricted arithmetic parser. No eval, Function, executable JavaScript or property access.
type Polynomial = number[];
function trimPolynomial(p: Polynomial) { while (p.length > 1 && Math.abs(p[p.length - 1]) < 1e-14) p.pop(); return p; }
function polynomialValue(p: Polynomial, x: number) { return p.reduceRight((n, c) => n * x + c, 0); }
function polynomialRoots(input: Polynomial): number[] {
  const p = trimPolynomial([...input]), degree = p.length - 1;
  if (!degree || degree > 12) return [];
  if (degree === 1) return [-p[0] / p[1]];
  const bound = Math.min(1e9, 1 + Math.max(...p.slice(0, -1).map(c => Math.abs(c / p[degree]))));
  const stationary = polynomialRoots(p.slice(1).map((c, i) => c * (i + 1))).filter(x => x > -bound && x < bound);
  const points = [-bound, ...stationary.sort((a, b) => a - b), bound], roots: number[] = [];
  const close = (x: number) => Math.abs(polynomialValue(p, x)) <= 1e-10 * Math.max(1, p.reduce((sum, c, i) => sum + Math.abs(c * x ** i), 0));
  for (const x of stationary) if (close(x)) roots.push(x);
  for (let i = 1; i < points.length; i++) {
    let left = points[i - 1], right = points[i], f = polynomialValue(p, left);
    if (f === 0) roots.push(left);
    if (f * polynomialValue(p, right) >= 0) continue;
    for (let j = 0; j < 90; j++) { const mid = (left + right) / 2, value = polynomialValue(p, mid); if (f * value <= 0) right = mid; else { left = mid; f = value; } }
    roots.push((left + right) / 2);
  }
  return roots.filter(Number.isFinite);
}
export function calculate(source: string, x = 0, criticalPoints?: Set<number>): number {
  const input = source.trim().toLowerCase().replace(/\u2212/g, "-").replace(/х/g, "x").replace(/π/g, "pi").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√\s*\(/g, "sqrt(").replace(/√\s*(\d+(?:[.,]\d+)?|x)/g, "sqrt($1)").replace(/\|([^|]+)\|/g, "abs($1)").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/,/g, ".").replace(/\s+/g, "");
  if (input.length > 300 || !input.length) throw new Error("Invalid expression");
  const numberToken = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/;
  const rawTokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[a-z]+|[+\-*/^()]/g) || [];
  if (rawTokens.join("") !== input || rawTokens.length > 150) throw new Error("Unsupported expression");
  const tokens: string[] = [];
  rawTokens.forEach((token, i) => {
    const previous = rawTokens[i - 1];
    const endsFactor = previous && (numberToken.test(previous) || /^(?:x|pi|e)$/.test(previous) || previous === ")");
    const startsFactor = /^(?:x|pi|e|sqrt|sin|cos|tan|ln|log|abs)$/.test(token) || token === "(";
    if (endsFactor && startsFactor) tokens.push("*");
    tokens.push(token);
  });
  let pos = 0, depth = 0;
  type Value = { n: number; p: Polynomial | null };
  const constant = (n: number): Value => ({ n, p: [n] });
  const restrict = (p: Polynomial | null) => { if (p && criticalPoints) polynomialRoots(p).forEach(v => criticalPoints.add(v)); };
  function combine(a: Polynomial | null, b: Polynomial | null, op: string): Polynomial | null {
    if (!a || !b) return null;
    if (op === "/") return b.length === 1 && b[0] !== 0 ? a.map(n => n / b[0]) : null;
    if (op === "*") { if (a.length + b.length > 14) return null; const p = Array(a.length + b.length - 1).fill(0); a.forEach((v, i) => b.forEach((w, j) => { p[i + j] += v * w; })); return trimPolynomial(p); }
    return trimPolynomial(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (op === "+" ? 1 : -1) * (b[i] || 0)));
  }
  const peek = () => tokens[pos];
  function atom(): Value {
    if (++depth > 30) throw new Error("Too deeply nested");
    const token = tokens[pos++];
    let value: Value;
    if (token === "(") { value = sum(); if (tokens[pos++] !== ")") throw new Error("Unclosed bracket"); }
    else if (token === "x") value = { n: x, p: [0, 1] };
    else if (token === "pi") value = constant(Math.PI);
    else if (token === "e") value = constant(Math.E);
    else if (/^(sqrt|sin|cos|tan|ln|log|abs)$/.test(token || "")) {
      if (tokens[pos++] !== "(") throw new Error("Function requires parentheses");
      const arg = sum(); if (tokens[pos++] !== ")") throw new Error("Unclosed function");
      const functions: Record<string, (n: number) => number> = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, abs: Math.abs };
      if (["sqrt", "ln", "log"].includes(token)) restrict(arg.p);
      if (token === "tan" && Math.abs(Math.cos(arg.n)) < 1e-12) throw new Error("Tangent outside domain");
      const n = functions[token](arg.n); value = { n, p: arg.p?.length === 1 ? [n] : null };
    } else if (numberToken.test(token || "")) value = constant(Number(token));
    else throw new Error("Unknown term");
    if (!Number.isFinite(value.n)) throw new Error("Expression outside domain");
    depth--; return value;
  }
  function power(): Value { const a = atom(); if (peek() !== "^") return a; pos++; const b = unary(), n = Math.pow(a.n, b.n); if (!Number.isInteger(b.n) || b.n < 0) restrict(a.p); let p: Polynomial | null = [1]; if (b.p?.length === 1 && Number.isInteger(b.n) && b.n >= 0 && b.n <= 12) { for (let i = 0; i < b.n; i++) p = combine(p, a.p, "*"); } else p = null; return { n, p }; }
  function unary(): Value { if (peek() === "+") { pos++; return unary(); } if (peek() === "-") { pos++; const v = unary(); return { n: -v.n, p: v.p?.map(c => -c) || null }; } return power(); }
  function product(): Value { let a = unary(); while (peek() === "*" || peek() === "/") { const op = tokens[pos++], b = unary(); if (op === "/") { restrict(b.p); const scale = b.p?.reduce((sum, c, i) => sum + Math.abs(c * x ** i), 0) || 1; if (b.n === 0 || (b.p && b.p.length > 1 && Math.abs(b.n) <= 1e-12 * scale)) throw new Error("Division outside domain"); } a = { n: op === "*" ? a.n * b.n : a.n / b.n, p: combine(a.p, b.p, op) }; } return a; }
  function sum(): Value { let a = product(); while (peek() === "+" || peek() === "-") { const op = tokens[pos++], b = product(); a = { n: op === "+" ? a.n + b.n : a.n - b.n, p: combine(a.p, b.p, op) }; } return a; }
  const result = sum(); if (pos !== tokens.length || !Number.isFinite(result.n)) throw new Error("Expression outside domain");
  return result.n;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, "").replace(/−/g, "-").replace(/,/g, ".").toLowerCase();
export function equivalent(a: string, b: string, precision?: number, absoluteTolerance?: number): boolean {
  if (!a.trim()) return false;
  if (/[xх]/i.test(a + b) && normalize(a) !== normalize(b)) return proveRationalIdentity(a,b) === 'correct';
  if (normalize(a) === normalize(b)) {
    if (/^[\d\s+\-*/^().,a-zхπ²³√|×·÷]+$/i.test(a)) {
      for (const x of /[xх]/i.test(a) ? [-1e6, -1000, -100, -10, -1, 0, 0.17, 1, 10, 100, 1000, 1e6] : [0]) { try { calculate(a, x); return true; } catch { /* Seek a real defined value, rather than accepting an always-undefined expression. */ } }
      return false;
    }
    return true;
  }
  try {
    const tolerance = absoluteTolerance ?? (precision === undefined ? 1e-8 : 0.5 * 10 ** -precision + 1e-10);
    const variable = /[xх]/i.test(a + b);
    const critical = new Set<number>();
    const points = variable ? [-9.7, -3, -1, -0.2, 0, 0.17, 0.5, 1, 2, 4.3, 11] : [0];
    if (variable) { for (const source of [a, b]) { for (const x of [0, 0.17, 1, 4.3]) { try { calculate(source, x, critical); } catch { /* Restrictions are collected even when evaluation is outside domain. */ } } } points.push(...critical); }
    let valid = 0;
    for (const x of points) {
      let av: number | null = null, bv: number | null = null;
      try { av = calculate(a, x); } catch { /* domain exclusion */ }
      try { bv = calculate(b, x); } catch { /* domain exclusion */ }
      if (av === null && bv === null) continue;
      if (av === null || bv === null) return false;
      valid++; if (Math.abs(av - bv) > tolerance * (precision === undefined && absoluteTolerance === undefined ? Math.max(1, Math.abs(bv)) : 1)) return false;
    }
    return valid >= (variable ? 5 : 1);
  } catch { return false; }
}

export function checkAnswer(task: Task, answer: Answer): {status: Verdict; verification: string} {
  if(task.answerFormat==='exact-number'){
    try{
      if(typeof answer!=='string'||typeof task.answer!=='string')throw Error('Expected a number');
      const a=exactRationalNumber(answer),b=exactRationalNumber(task.answer);
      return{status:a.n*b.d===b.n*a.d?'correct':'incorrect',verification:'exact-rational-number-v1'};
    }catch{return{status:'review',verification:'unsupported-exact-number'};}
  }
  if(['interval','root-set','pair'].includes(String(task.answerFormat))){return{status:typeof answer==='string'&&typeof task.answer==='string'?checkStructuredAnswer(task.answerFormat as AnswerFormat,answer,task.answer):'review',verification:'exact-structured-rational-v1'};}
  if (task.type === 'expression' && typeof answer === 'string' && typeof task.answer === 'string') {
    if (!answer.trim()) return {status:'incorrect',verification:'empty-answer'};
    if (/[xх]/i.test(answer+task.answer)) {
      const status=proveRationalIdentity(answer,task.answer,task.domain);
      if(status!=='review')return {status,verification:'exact-rational-polynomial-v1'};
      // Identical, well-defined syntax is a proof of identity; evaluating
      // different expressions at sample points is never a proof.
      if(normalize(answer)===normalize(task.answer)&&equivalent(answer,task.answer))return{status:'correct',verification:'identical-defined-expression'};
      return{status:'review',verification:'unsupported-expression'};
    }
    try {calculate(answer);calculate(task.answer);}catch{return{status:'review',verification:'unsupported-expression'};}
  }
  return {status:grade(task,answer)?'correct':'incorrect',verification:'verified-answer'};
}

export function grade(task: Task, answer: Answer): boolean {
  if(['interval','root-set','pair'].includes(String(task.answerFormat)))return checkAnswer(task,answer).status==='correct';
  if (task.type === "multiple" || task.type === "matching") {
    const expected = Array.isArray(task.answer) ? task.answer : [task.answer];
    const provided = Array.isArray(answer) ? answer : [answer];
    if ((task.type === "multiple" && new Set(provided).size !== provided.length) || provided.length !== expected.length) return false;
    return task.type === "matching" ? expected.every((v, i) => normalize(v) === normalize(provided[i] || "")) : expected.every(v => provided.some(a => normalize(a) === normalize(v)));
  }
  if (Array.isArray(answer) || Array.isArray(task.answer)) return false;
  if(task.type==='single'&&normalize(answer)===normalize(task.answer))return true;
  let cleaned = answer.trim();
  if (task.units) {
    const escaped = task.units.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`\\s*${escaped}$`, "i"), "").trim();
    // Any other trailing unit is rejected by the arithmetic parser.
  }
  return equivalent(cleaned, task.answer, task.precision, task.tolerance);
}

export function answerFitsTask(task: Task, answer: Answer, exam = false) {
  if (task.type === "multiple" || task.type === "matching") {
    if (!Array.isArray(answer)) return false;
    if (task.type === "matching" && answer.length > (Array.isArray(task.answer) ? task.answer.length : 1)) return false;
    if (task.type === "multiple" && new Set(answer.map(normalize)).size !== answer.length) return false;
    return !task.options || answer.every(value => (task.type === "matching" && value === "") || task.options!.some(option => normalize(option) === normalize(value)));
  }
  if (Array.isArray(answer)) return false;
  return !(exam && task.type === "single" && answer.trim()) || !task.options || task.options.some(option => normalize(option) === normalize(answer));
}

export function classifyError(steps: string): { category: string; explanation: LocalText } {
  if (!steps.trim()) return { category: "unknown", explanation: { ru: "По одному ответу нельзя определить причину. Запиши ход решения: найдём первый переход, который нужно исправить.", kk: "Тек жауаппен қатенің себебін анықтай алмаймыз. Шешу жолын жаз: түзететін алғашқы қадамды табамыз." } };
  const signError = { category: "sign", explanation: { ru: "В переходе к 2x = 14 знак изменён неверно. Чтобы убрать +3, вычти 3 из обеих частей: 2x + 3 − 3 = 11 − 3. Получается 2x = 8. Теперь раздели обе части на 2.", kk: "2x = 14 қадамында таңба қате. +3-ті жою үшін екі жақтан да 3-ті азайт: 2x + 3 − 3 = 11 − 3. Сонда 2x = 8. Енді екі жағын 2-ге бөл." } };
  let previousEquation:string|undefined;
  for (const line of steps.split(/\n|→|=>/)) {
    const equation=line.trim();
    if(/[xх]/i.test(equation)&&equation.split('=').length===2){
      if(previousEquation&&proveLinearEquationStep(previousEquation,equation)==='incorrect'){
        const normalized=(s:string)=>s.replace(/\s/g,'').replace(/х/g,'x');
        if(normalized(previousEquation)==='2x+3=11'&&normalized(equation)==='2x=14')return signError;
        return{category:'method',explanation:{ru:`Переход «${previousEquation} → ${equation}» изменил решения уравнения. К обеим частям нужно применять одно и то же допустимое действие. Вернись к предыдущей строке: что ты сделал слева и справа? Делить можно только на ненулевое число.`,kk:`«${previousEquation} → ${equation}» ауысуы теңдеудің шешімдерін өзгертті. Екі жаққа да бірдей рұқсат етілген амал қолдану керек. Алдыңғы жолға орал: сол және оң жақта не істедің? Тек нөл емес санға бөлуге болады.`}};
      }
      previousEquation=proveLinearEquationStep(equation,equation)==='correct'?equation:undefined;
      continue;
    }
    if(/[a-zа-яәғқңөұүһі]/i.test(line))previousEquation=undefined;
    const pieces = line.trim().split("=");
    if (pieces.length !== 2 || /[a-zа-я]/i.test(line)) continue;
    try {
      const left = calculate(pieces[0]), right = calculate(pieces[1]);
      if (Math.abs(left - right) > 1e-8) return { category: "calculation", explanation: { ru: `В вычислении «${line.trim()}» левая часть равна ${Number(left.toFixed(8))}, а правая — ${Number(right.toFixed(8))}. Проверь порядок действий и повтори этот расчёт.`, kk: `«${line.trim()}» есептеуінде сол жағы ${Number(left.toFixed(8))}, оң жағы ${Number(right.toFixed(8))}. Амалдар ретін тексеріп, осы есептеуді қайтала.` } };
    } catch { /* A partial or unsupported line is not evidence of an error. */ }
  }
  return { category: "unconfirmed", explanation: { ru: "Ответ пока не совпал. Причина ещё не установлена: сравни свои шаги с разбором. Наставник поможет проверить первый переход; альтернативный метод решения допустим.", kk: "Жауап сәйкес келмеді. Себебі әлі анықталмаған: қадамдарыңды талдаумен салыстыр. Тәлімгер алғашқы қадамды тексеруге көмектеседі; балама әдіспен шешуге болады." } };
}

export function makePlan(state: LearnerState, topics: Topic[], now = new Date()): PlanItem[] {
  const track = state.profile?.track || "profile";
  const schoolGrade = state.profile?.learningMode === "school" ? state.profile.grade : undefined;
  const courseIds = schoolGrade ? schoolTopicIds(schoolGrade,state.profile?.schoolPathway) : null;
  const selected = courseIds ? courseIds.map(id => topics.find(t => t.id === id)).filter((t): t is Topic => Boolean(t)) : topics.filter(t => t.track === track && !t.schoolOnly);
  const byId = new Map(topics.map(t => [t.id, t]));
  const latestDiagnostic = [...state.diagnostics].reverse().find(d => !d.clarificationSkillId && d.track === track && d.schoolGrade === schoolGrade && (!schoolGrade || Number(schoolGrade)<10 || (d.schoolPathway??'natural-math')===(state.profile?.schoolPathway??'natural-math')));
  const skillEvidence=currentDiagnosticEvidence(state);
  const previousGaps=(latestDiagnostic?.gaps||[]).filter(id=>{
    const original=latestDiagnostic?.evidence?.filter(e=>e.topicId===id&&e.incorrect>0);
    return !original?.length||original.some(e=>!e.skillId||!skillEvidence.some(latest=>latest.skillId===e.skillId&&latest.status==='supported'));
  });
  const gaps = new Set([...previousGaps,...skillEvidence.filter(e=>e.incorrect>0).map(e=>e.topicId)]);
  const foundationStrengths = new Set((latestDiagnostic?.strengths || []).filter(id => (latestDiagnostic?.strengths.filter(s=>s===id).length||0)>=2&&!latestDiagnostic?.gaps.includes(id)&&byId.get(id)?.track === "base" && !state.errors.some(e => e.topicId === id && !e.resolved && e.at > (latestDiagnostic?.at || ""))));
  const ready = (id: string) => Boolean(state.progress[id]?.mastered || confirmationCount(state.progress[id]) >= 3 || foundationStrengths.has(id));
  const futureReview = (id: string) => state.reviews.some(r => r.topicId === id && !r.completed && Date.parse(r.due) > now.getTime());
  const reachable = new Set<string>();
  function include(topic: Topic) { if (reachable.has(topic.id)) return; reachable.add(topic.id); for (const id of topic.prerequisites || []) { const p = byId.get(id); if (p) include(p); } }
  selected.forEach(include);
  const date = schoolGrade ? undefined : state.profile?.examDate;
  const daysLeft = date ? Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86400000) : null;
  const nearExam = daysLeft !== null && daysLeft >= 0 && daysLeft <= 21;
  const maximum = track === "literacy" ? 10 : 50, target = schoolGrade ? undefined : state.profile?.target;
  const ambitiousGoal = target !== undefined && target >= maximum * 0.8;
  const context: LocalText = target === undefined ? { ru: "", kk: "" } : {
    ru: ` Цель: ${target}/${maximum}.${daysLeft === null ? "" : daysLeft >= 0 ? ` До экзамена ${daysLeft} дн.` : " Дата экзамена прошла — обновите её в настройках."}`,
    kk: ` Мақсат: ${target}/${maximum}.${daysLeft === null ? "" : daysLeft >= 0 ? ` Емтиханға ${daysLeft} күн.` : " Емтихан күні өтті — баптауларда жаңартыңыз."}`,
  };
  const planned: PlanItem[] = [], seen = new Set<string>();
  function add(topic: Topic, type: PlanItem["type"], reason: LocalText) {
    if (seen.has(topic.id) || planned.length >= 7) return;
    if(type==='lesson'&&(state.lessonCompletions as Record<string,{at:string}>|undefined)?.[topic.id]){
      type='practice';reason={ru:'Урок завершён. Проверим понимание новыми самостоятельными задачами.',kk:'Сабақ аяқталды. Түсінгеніңді жаңа өздік тапсырмалармен тексереміз.'};
    }
    seen.add(topic.id);
    const evidence=skillEvidence.filter(e=>e.topicId===topic.id&&e.incorrect>0);
    if(evidence.length){const descriptions=evidence.map(e=>({title:repairSkillTitle(e.skillId)!,e}));reason={ru:reason.ru+' Проверим конкретный способ: '+descriptions.map(({title,e})=>`${title.ru} (${e.correct} верно, ${e.incorrect} пока неверно, ${e.unknown} без вывода)`).join('; ')+'. Причину уточним по шагам решения.',kk:reason.kk+' Нақты тәсілді тексереміз: '+descriptions.map(({title,e})=>`${title.kk} (${e.correct} дұрыс, ${e.incorrect} әзірге қате, ${e.unknown} қорытындысыз)`).join('; ')+'. Себебін шешу қадамдары арқылы анықтаймыз.'};}
    planned.push({ topicId: topic.id, title: topic.title, type, minutes: Math.min(Number(topic.minutes || 12) + (ambitiousGoal && type === "repair" ? 5 : 0), state.profile?.dailyMinutes || 20), day: planned.length + 1, reason: { ru: reason.ru + context.ru, kk: reason.kk + context.kk } });
  }
  for (const review of state.reviews.filter(r => !r.completed && new Date(r.due) <= now && reachable.has(r.topicId)).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))) {
    const topic = byId.get(review.topicId); if (topic) add(topic, "review", { ru: "Проверим навык после перерыва: повторение закрепляет самостоятельное решение.", kk: "Үзілістен кейін дағдыны тексереміз: қайталау өз бетіңмен шешуді бекітеді." });
  }
  function prerequisite(topic: Topic, trail = new Set<string>()) {
    if (trail.has(topic.id)) return; trail.add(topic.id);
    for (const id of topic.prerequisites || []) { const p = byId.get(id); if (p && !ready(id)) { prerequisite(p, new Set(trail)); add(p, "repair", { ru: `Этот навык нужен перед темой «${topic.title.ru}».`, kk: `Бұл дағды «${topic.title.kk}» тақырыбына қажет.` }); } }
  }
  for(const topic of topics.filter(t=>reachable.has(t.id)&&state.progress[t.id]?.needsRecovery))add(topic,'repair',{
    ru:'Прежнее подтверждение темы сохранено. Проверим затруднение в новой задаче; одна ошибка не отменяет уже освоенные методы.',
    kk:'Тақырыптың бұрынғы расталуы сақталды. Қиындықты жаңа тапсырмада тексереміз; бір қате меңгерілген әдістерді жоққа шығармайды.',
  });
  const weak = selected.filter(t => {
    const recent=state.attempts.filter(a=>a.topicId===t.id).slice(-3);
    const hasDiagnostic=Boolean(latestDiagnostic?.taskIds?.length&&[...(latestDiagnostic.strengths||[]),...(latestDiagnostic.gaps||[]),...(latestDiagnostic.evidence||[]).map(e=>e.topicId)].includes(t.id))||skillEvidence.some(e=>e.topicId===t.id);
    return gaps.has(t.id)||state.errors.some(e=>e.topicId===t.id&&!e.resolved)||recent.some(a=>!a.correct)||(!hasDiagnostic&&!recent.length&&(state.progress[t.id]?.attempts||0)>(state.progress[t.id]?.correct||0));
  });
  if (nearExam) weak.sort((a, b) => {
    const severity = (t: Topic) => { const p = state.progress[t.id]; return p?.attempts ? (p.attempts - p.correct) / p.attempts : gaps.has(t.id) ? 1 : 0; };
    return severity(b) - severity(a);
  });
  for (const topic of [...weak, ...selected]) {
    if (state.progress[topic.id]?.mastered) continue;
    if (confirmationCount(state.progress[topic.id]) >= 3 && futureReview(topic.id)) continue;
    if (foundationStrengths.has(topic.id) && !weak.includes(topic)) continue;
    prerequisite(topic);
    const needsRepair = weak.includes(topic);
    add(topic, needsRepair ? "repair" : "lesson", {
      ru: needsRepair ? (nearExam ? "Экзамен близко: сначала исправим наиболее заметный пробел, затем продолжим программу." : gaps.has(topic.id) ? "Диагностика показала пробел: восстановим этот навык перед следующими темами." : "Добавили закрепление: в последних задачах возникли трудности.") : "Следующий небольшой шаг по программе, с учётом нужных основ.",
      kk: needsRepair ? (nearExam ? "Емтихан жақын: алдымен ең айқын олқылықты түзетіп, кейін бағдарламаны жалғастырамыз." : gaps.has(topic.id) ? "Диагностика олқылықты көрсетті: келесі тақырыптардан бұрын осы дағдыны қалпына келтіреміз." : "Бекіту қостық: соңғы тапсырмаларда қиындық болды.") : "Қажетті негіздерді ескеретін бағдарламаның келесі шағын қадамы.",
    });
  }
  if(!planned.length&&selected.length)add(selected[0],'practice',{ru:'Темы маршрута пройдены или ожидают повторения. Поддержим самостоятельное решение новой практикой.',kk:'Бағыт тақырыптары өтілді немесе қайталауды күтуде. Жаңа практика арқылы өздік шешуді сақтаймыз.'});
  return fitWeeklyBudget(planned,state.profile?.dailyMinutes||20);
}

export function recordAttempt(state: LearnerState, task: Task, topic: Topic, input: { answer: Answer; steps?: string; assisted?: boolean; reviewId?: string; submissionId?:string }, tasks: Task[], now = new Date()) {
  const payload=JSON.stringify([task.id,input.answer,input.steps||'',Boolean(input.assisted),input.reviewId||'']);
  type Feedback={correct:boolean;status:Verdict;solution:Task['solution'];hints:Task['hints'];errorCategory:string;explanation:LocalText;answer:Answer;independentEligible:boolean;verification:string};
  const receipts=(state.submissions||{}) as Record<string,{payload:string;feedback:Feedback}>;
  if(input.submissionId && receipts[input.submissionId]) {const prior=receipts[input.submissionId];if(prior.payload!==payload)throw Error('SUBMISSION_CONFLICT');return structuredClone(prior.feedback);}
  const saveReceipt=(feedback:Feedback)=>{if(input.submissionId){receipts[input.submissionId]={payload,feedback:structuredClone(feedback)};state.submissions=receipts;}return feedback;};
  const checked=checkAnswer(task,input.answer),correct=checked.status==='correct',at=now.toISOString();
  if(checked.status==='review')return saveReceipt({correct:false,status:'review',solution:{ru:[],kk:[]},hints:task.hints,errorCategory:'unverified',explanation:{ru:'Этот ответ требует проверки: автоматический проверяющий не смог доказать равенство. Ошибка не начислена, освоение не изменено. Покажи ход решения или сообщи редактору.',kk:'Бұл жауапты тексеру қажет: автоматты тексеру теңдікті дәлелдей алмады. Қате есептелмеді, меңгеру өзгермеді. Шешу жолын көрсет немесе редакторға хабарла.'},answer:'',independentEligible:false,verification:checked.verification});
  const confirmationsBefore = confirmationCount(state.progress[task.topicId]);
  const readinessBefore=masteryReady(state.progress[task.topicId],topic);
  const condition=taskFingerprint(task);
  const previousSame = seenTaskIds(state).has(task.id)||state.attempts.some(a=>a.evidence?.condition===condition)||state.exams.some(e=>e.questions.some(t=>taskFingerprint(t)===condition));
  const assignedReview = input.reviewId ? state.reviews.find(r => r.id === input.reviewId && r.topicId === task.topicId && !r.completed) : undefined;
  if (input.reviewId && (!assignedReview || new Date(assignedReview.due) > now || previousSame || (assignedReview.methodFamily&&assignedReview.methodFamily!==task.methodFamily))) throw new Error("Повторение ещё не назначено или задача уже решалась");
  const assisted = Boolean(input.assisted) || previousSame || isModelExample(task, topic);
  const mistake = correct ? { category: "none", explanation: { ru: "Верно!", kk: "Дұрыс!" } } : classifyError(input.steps || "");
  const attempt: Attempt = { id: crypto.randomUUID(), taskId: task.id, topicId: task.topicId, track: topic.track, answer: input.answer, steps: input.steps || "", correct, assisted, at, category: mistake.category };
  attempt.taskVersion=typeof task.version==='string'?task.version:`attempt-snapshot:${attempt.id}`;
  attempt.checkingVersion=checked.verification;
  attempt.evidence={schema:1,independent:!assisted,reason:input.assisted?"help":isModelExample(task,topic)?"worked-example":previousSame?"repeat":"independent",condition,difficulty:task.difficulty,skillIds:Array.isArray(task.skillIds)?task.skillIds.filter((id):id is string=>typeof id==='string'):[],methodFamily:typeof task.methodFamily==='string'?task.methodFamily:null};
  attempt.taskSnapshot=structuredClone({prompt:task.prompt,answer:task.answer,solution:task.solution,domain:task.domain,type:task.type,units:task.units,precision:task.precision,difficulty:task.difficulty});
  state.attempts.push(attempt);
  const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] };
  p.attempts++; p.correct += Number(correct); p.lastAt = at;
  p.independentTaskIds ||= [];
  p.confirmationTaskIds ||= [...p.independentTaskIds];
  p.masteryRewarded ||= p.mastered;
  if (correct && !assisted && !p.independentTaskIds.includes(task.id)) { p.independentTaskIds.push(task.id); p.confirmationTaskIds.push(task.id);(p.evidence||={})[task.id]={difficulty:task.difficulty,methodFamily:typeof task.methodFamily==='string'?task.methodFamily:null};p.independent = p.independentTaskIds.length; state.xp += 10; }
  if(!readinessBefore&&masteryReady(p,topic))p.masteryReadyAt=at;
  const day = dayKey(now);
  if (!state.streakDays.includes(day)) state.streakDays.push(day);
  if (!correct) {
    scheduleErrorReview(state, task, now);
    state.errors.push({ id: attempt.id, taskId: task.id, topicId: task.topicId, answer: input.answer, steps: input.steps || "", category: mistake.category, explanation: mistake.explanation, at, resolved: false, exerciseIds: tasks.filter(t => t.topicId === task.topicId && t.id !== task.id).slice(0, 3).map(t => t.id), prompt: task.prompt, solution: task.solution, hints: task.hints, correctAnswer: task.answer, source:task.source,subtopic:task.subtopic });
  } else if (!assisted) {
    // An unrelated success in the same broad topic cannot prove that this
    // particular mistake is repaired. Assignments must explicitly target it.
    const eligible = state.errors.filter(e => e.topicId === task.topicId && !e.resolved && e.taskId !== task.id && e.exerciseIds.includes(task.id) && Array.isArray(task.repairsTaskIds) && task.repairsTaskIds.includes(e.taskId) && (!task.repairForErrorId || task.repairForErrorId===e.id));
    const corrected:ErrorEntry[]=[];
    for (const error of eligible) {
      if(error.repairRequired){error.repairPassedTaskIds=[...new Set([...(error.repairPassedTaskIds||[]),task.id])];if(error.repairPassedTaskIds.length<error.repairRequired)continue;}
      else if(confirmationCount(p)<3)continue;
      error.resolved=true;error.repairedAt=at;corrected.push(error);
    }
    if(corrected.length&&p.needsRecovery){p.recoveryTaskIds=(p.recoveryTaskIds||[]).filter(id=>state.errors.some(e=>e.taskId===id&&!e.resolved));p.needsRecovery=p.recoveryTaskIds.length>0;}
    if (corrected.length) state.xp += 5;
  }
  if (input.reviewId) {
    const review = assignedReview!;
    if (correct && !assisted) {
      review.completed = true; review.taskId = task.id;
      p.reviewPassed = readinessBefore&&Boolean(p.masteryReadyAt)&&now.getTime()-Date.parse(p.masteryReadyAt!)>=86400000;
      const intervals = [1, 3, 7, 14], next = intervals[intervals.indexOf(review.interval) + 1];
      if (next) state.reviews.push({ id: crypto.randomUUID(), topicId: task.topicId, due: new Date(now.getTime() + next * 86400000).toISOString(), interval: next, completed: false, ...(review.methodFamily?{methodFamily:review.methodFamily,variant:review.variant}:{}) });
    } else { p.reviewPassed = false; review.due = new Date(now.getTime() + 86400000).toISOString(); review.interval = 1; }
  }
  if (!p.reviewPassed && confirmationsBefore < 3 && confirmationCount(p) >= 3) {
    const pending = state.reviews.find(r => r.topicId === task.topicId && !r.completed);
    if (pending) { pending.due = new Date(Math.max(Date.parse(pending.due), now.getTime() + 86400000)).toISOString(); pending.interval = 1; }
  }
  if (confirmationCount(p) >= 3 && !state.reviews.some(r => r.topicId === task.topicId && !r.completed) && !p.reviewPassed) state.reviews.push({ id: crypto.randomUUID(), topicId: task.topicId, due: new Date(now.getTime() + 86400000).toISOString(), interval: 1, completed: false });
  const wasMastered = p.mastered;
  p.mastered = wasMastered || masteryReady(p,topic) && Boolean(p.reviewPassed);
  p.masteryPending=!p.mastered&&confirmationCount(p)>=4;
  if(!wasMastered&&p.mastered)p.masteryVersion='reviewed-rubric-v2';
  if (!wasMastered && p.mastered && !p.masteryRewarded) { state.xp += 50; p.masteryRewarded = true; }
  state.lessonResume = { topicId: task.topicId, stage: 3 };
  return saveReceipt({ correct, status:checked.status, solution: task.solution, hints: task.hints, errorCategory: mistake.category, explanation: mistake.explanation, answer: task.answer, independentEligible: !assisted, verification: checked.verification });
}

function scheduleErrorReview(state: LearnerState, task:Task, now: Date) {
  const topicId=task.topicId,p = state.progress[topicId];
  if(p){p.masteryRewarded ||= p.mastered;if(p.mastered){p.needsRecovery=true;p.recoveryTaskIds=[...new Set([...(p.recoveryTaskIds||[]),task.id])];}
   else{p.reviewPassed=false;p.confirmationTaskIds=[];delete p.masteryReadyAt;}}
  const targeted=task.variant&&typeof task.methodFamily==='string'?{methodFamily:task.methodFamily,variant:task.variant as {seed:number;level:1|2|3}}:undefined;
  const scheduled = state.reviews.find(r => r.topicId === topicId && !r.completed && (targeted?r.methodFamily===targeted.methodFamily:!r.methodFamily)), due = new Date(now.getTime() + 86400000).toISOString();
  if (scheduled) { scheduled.due = due; scheduled.interval = 1; }
  else state.reviews.push({ id: crypto.randomUUID(), topicId, due, interval: 1, completed: false,...targeted });
}

export function sanitizeTask(task: Task) {
  return { id: task.id, topicId: task.topicId, prompt: task.prompt, type: task.type, answerFormat:task.answerFormat,difficulty: task.difficulty, level: task.difficulty, options: task.options, pairs: task.pairs?.map(p => ({ left: p.left, right: "" })), skill: task.skill, skillIds:task.skillIds,curriculumSection:task.curriculumSection,units: task.units, unit: task.units, precision: task.precision, domain: task.domain, context: task.context, modelExample: Boolean(task.modelExample), reviewReserved: Boolean(task.reviewReserved),repairForErrorId:task.repairForErrorId,source:task.source,practiceOrigin:task.practiceOrigin,subtopic:task.subtopic,reviewStatus:task.reviewStatus };
}

export function diagnosticTasks(track: Track, topics: Topic[], tasks: Task[], schoolGrade?: string,schoolPathway?:'natural-math'|'humanitarian') {
  tasks=tasks.filter(t=>t.purpose!=='practice');
  const ids = schoolGrade ? schoolTopicIds(schoolGrade,schoolPathway) : null;
  const relevant = ids ? ids.map(id => topics.find(t => t.id === id)).filter((t): t is Topic => Boolean(t)) : topics.filter(t => !t.schoolOnly && (t.track === track || (track === "profile" && t.track === "base")));
  const result: Task[] = [];
  for (let i = 0; i < relevant.length && result.length < 10; i += Math.max(1, Math.floor(relevant.length / 10))) {
    const task = tasks.find(t => t.topicId === relevant[i].id && t.difficulty === 1 && t.type === "single") || tasks.find(t => t.topicId === relevant[i].id && t.difficulty === 1);
    if (task) result.push(task);
  }
  if (track === "profile" && !schoolGrade) {
    // Explicitly sample foundations rather than relying on where they occur in the topic order.
    const foundations = ["numbers", "fractions", "negatives", "percentages"].map(id => tasks.find(t => t.topicId === id && t.difficulty === 1 && t.type === "single") || tasks.find(t => t.topicId === id && t.difficulty === 1)).filter((t): t is Task => Boolean(t));
    return [...foundations, ...result.filter(t => !foundations.some(f => f.topicId === t.topicId))].slice(0, 10);
  }
  return result;
}

export function scoreExamTask(task: Task, answer: Answer, rules: ExamRuleSnapshot = EXAM_RULES) {
  const scoring=resolveExamScoring(rules),selection=task.type==='multiple'||task.type==='matching';
  const max=selection?scoring.selectionMax:scoring.singleMax;
  if(!answerFitsTask(task,answer,true))return{points:0,max,explanation:{ru:'Ответ не соответствует формату вопроса: 0 баллов.',kk:'Жауап сұрақ форматына сәйкес емес: 0 балл.'},ruleId:scoring.id};
  const full=grade(task,answer);
  if(!selection){const points=full?max:0;return{points,max,explanation:scoreExplanation(points,max),ruleId:scoring.id};}
  const expected=(Array.isArray(task.answer)?task.answer:[task.answer]).map(normalize);
  const values=(Array.isArray(answer)?answer:answer?[answer]:[]).map(normalize);
  const hits=task.type==='matching'?values.filter((v,i)=>v&&v===expected[i]).length:values.filter(v=>expected.includes(v)).length;
  const wrong=values.filter((v,i)=>v&&(task.type==='matching'?v!==expected[i]:!expected.includes(v))).length;
  const points=selectionCredit(expected.length,hits,wrong,full,scoring);
  return{points,max,explanation:scoreExplanation(points,max,hits,wrong),ruleId:scoring.id};
}

function hash(s: string) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0; }
export function officialSection(topic: Topic | undefined) {
  const n = Number(String(topic?.spec || "").match(/\d+/)?.[0]);
  if (n >= 1 && n <= 4) return "01-04";
  if (n >= 5 && n <= 7) return "05-07";
  if (n >= 8 && n <= 9) return "08-09";
  if (n === 10 || n === 11 || n === 12 || n === 13 || n === 18) return String(n);
  if (n === 14 || n === 15) return "14-15";
  if (n === 16 || n === 17) return "16-17";
  return "preparatory";
}
function asSingle(task: Task): Task {
  if (task.type === "single") return structuredClone(task);
  if (Array.isArray(task.answer)) throw new Error("Cannot convert multiple answer");
  let n: number;
  try { n = calculate(task.answer); } catch { throw new Error("Non-numeric task requires reviewed options"); }
  const options = [...new Set([task.answer, String(n + 1), String(n - 1), String(n + 2)])];
  if (options.length !== 4) throw new Error("Invalid distractors");
  return { ...structuredClone(task), type: "single", options: options.sort((a, b) => hash(a + task.id) - hash(b + task.id)) };
}

function contextTask(index: number, variant: number, difficulty: number, topicId: string): Task {
  const p = 200 + variant * 50, count = 8 + variant, discount = 10;
  const context: LocalText = { ru: `Класс купил ${count} билетов по ${p} тенге. Магазин дал скидку ${discount}% на весь заказ. Доставка стоит ${p} тенге. Используй эти данные в следующих пяти вопросах.`, kk: `Сынып әрқайсысы ${p} теңге тұратын ${count} билет алды. Дүкен бүкіл тапсырысқа ${discount}% жеңілдік берді. Жеткізу ${p} теңге. Келесі бес сұраққа осы деректерді пайдалан.` };
  const values = [count * p, count * p / 10, count * p * 0.9, count * p * 0.9 + p, (count * p * 0.9 + p) / count];
  const ru = ["Стоимость билетов до скидки?", "Сумма скидки, в тенге?", "Стоимость билетов после скидки?", "Сумма заказа с доставкой?", "Сколько платит каждый ученик, если весь заказ разделить поровну? Ответ округли до двух знаков после запятой."];
  const kk = ["Жеңілдікке дейінгі билет құны?", "Жеңілдік сомасы неше теңге?", "Жеңілдіктен кейінгі билет құны?", "Жеткізумен қоса тапсырыс сомасы?", "Тапсырыс сомасын тең бөлсек, әр оқушы қанша төлейді? Жауапты үтірден кейін екі таңбаға дейін дөңгелекте."];
  const answer = index === 4 ? values[index].toFixed(2) : String(values[index]);
  return asSingle({ id: `context-v${variant}-${index}`, topicId, context, prompt: { ru: ru[index], kk: kk[index] }, type: "number", difficulty, answer, units: "тенге", precision: index === 4 ? 2 : undefined, hints: { ru: ["Запиши нужные величины."], kk: ["Қажетті шамаларды жаз."] }, solution: { ru: [`До скидки: ${count} · ${p} = ${values[0]}.`, `Скидка: ${values[0]} · 0,1 = ${values[1]}.`, `После скидки: ${values[0]} − ${values[1]} = ${values[2]}.`, `С доставкой: ${values[2]} + ${p} = ${values[3]}.`, `На одного: ${values[3]} / ${count} = ${values[4].toFixed(2)}.`, `Ответ на вопрос: ${answer}.`], kk: [`Жеңілдікке дейін: ${count} · ${p} = ${values[0]}.`, `Жеңілдік: ${values[0]} · 0,1 = ${values[1]}.`, `Жеңілдіктен кейін: ${values[0]} − ${values[1]} = ${values[2]}.`, `Жеткізумен: ${values[2]} + ${p} = ${values[3]}.`, `Бір оқушыға: ${values[3]} / ${count} = ${values[4].toFixed(2)}.`, `Жауап: ${answer}.`] } });
}

export function makeExam(track: Track, variant: number, topics: Topic[], tasks: Task[], now = new Date()): Exam {
  if (!Number.isInteger(variant) || variant < 1 || variant > 10 || !["profile", "literacy"].includes(track)) throw new Error("Выберите направление и вариант 1–10");
  const topicIds = new Set(topics.filter(t => t.track === track && t.spec !== null).map(t => t.id));
  const byTopic = new Map(topics.map(t => [t.id, t]));
  const bank = tasks.filter(t => t.purpose!=='practice' && topicIds.has(t.topicId) && !isModelExample(t, topics.find(p => p.id === t.topicId))), used = new Set<string>(), questions: Task[] = [];
  const eligible = (t: Task, type: "single" | "multiple" | "matching", d: number) => t.difficulty === d && !used.has(t.id) && (type === "single" ? ["number", "single"].includes(t.type) : t.type === type && Array.isArray(t.answer) && t.answer.length > 0 && t.answer.length <= 3);
  let coverageSize = -1;
  const sectionCounts = new Map<string, number>(), topicCounts = new Map<string, number>(), moduleCounts = new Map<string, number>(), ranks = new Map<string, number[]>();
  function coverageRank(task: Task) {
    if (coverageSize !== questions.length) {
      coverageSize = questions.length; sectionCounts.clear(); topicCounts.clear(); moduleCounts.clear(); ranks.clear();
      for (const q of questions) {
        const t = byTopic.get(q.topicId), section = officialSection(t), moduleName = String(t?.module || "misc");
        sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1); topicCounts.set(q.topicId, (topicCounts.get(q.topicId) || 0) + 1); moduleCounts.set(moduleName, (moduleCounts.get(moduleName) || 0) + 1);
      }
    }
    const cached = ranks.get(task.id); if (cached) return cached;
    const topic = byTopic.get(task.topicId), section = officialSection(topic);
    const sectionCount = sectionCounts.get(section) || 0, topicCount = topicCounts.get(task.topicId) || 0, moduleCount = moduleCounts.get(String(topic?.module || "misc")) || 0;
    const rank = [sectionCount === 0 ? 0 : 1, topicCount === 0 ? 0 : 1, sectionCount, moduleCount, topicCount, hash(`${variant}:${task.id}`)]; ranks.set(task.id, rank); return rank;
  }
  function compareCoverage(a: Task, b: Task) { const av = coverageRank(a), bv = coverageRank(b); for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return av[i] - bv[i]; return 0; }
  function select(type: "single" | "multiple" | "matching", counts: number[]) {
    counts.forEach((count, d) => {
      const pool = bank.filter(t => eligible(t, type, d + 1));
      if (pool.length < count) throw new Error(`Недостаточно проверенных заданий: ${type}, уровень ${d + 1}`);
      for (let i = 0; i < count; i++) { pool.sort(compareCoverage); const task = pool.shift()!; used.add(task.id); questions.push(type === "single" ? asSingle(task) : structuredClone(task)); }
    });
  }
  if (track === "literacy") {
    // Reserve one question per literacy skill while respecting the 5/3/2 blueprint.
    const quotas = [5, 3, 2], selected = topics.filter(t => t.track === "literacy");
    if (selected.length !== 10) throw new Error("Грамотность требует 10 отдельных навыков");
    const possible = new Map(selected.map(t => [t.id, [1, 2, 3].filter(d => bank.some(q => q.topicId === t.id && eligible(q, "single", d)))]));
    const ordered = [...selected].sort((a, b) => possible.get(a.id)!.length - possible.get(b.id)!.length || hash(`${variant}:${a.id}`) - hash(`${variant}:${b.id}`));
    const assignments = new Map<string, number>();
    function assign(index: number): boolean {
      if (index === ordered.length) return quotas.every(q => q === 0);
      const topic = ordered[index], levels = [...possible.get(topic.id)!].sort((a, b) => hash(`${variant}:${topic.id}:${a}`) - hash(`${variant}:${topic.id}:${b}`));
      for (const d of levels) { if (!quotas[d - 1]) continue; quotas[d - 1]--; assignments.set(topic.id, d); if (assign(index + 1)) return true; assignments.delete(topic.id); quotas[d - 1]++; }
      return false;
    }
    if (!assign(0)) throw new Error("Невозможно покрыть все навыки грамотности в пропорции 50/30/20");
    for (const topic of selected.sort((a, b) => hash(`${variant}:order:${a.id}`) - hash(`${variant}:order:${b.id}`))) {
      const pool = bank.filter(q => q.topicId === topic.id && eligible(q, "single", assignments.get(topic.id)!)).sort((a, b) => hash(`${variant}:${a.id}`) - hash(`${variant}:${b.id}`));
      const task = pool[0]; used.add(task.id); questions.push(asSingle(task));
    }
  }
  else {
    select("single", [12, 8, 5]);
    const contextTopicIds=['numbers','percentages','percentages','numbers','fractions'];
    [1, 1, 1, 2, 3].forEach((d, i) => {const id=contextTopicIds[i];if(!byTopic.has(id))throw new Error(`Missing context skill: ${id}`);questions.push({...contextTask(i, variant, d, id),skillIds:[id],assessmentTrack:'profile',curriculumSection:'13'});});
    select("multiple", [3, 1, 1]); select("matching", [2, 2, 1]);
  }
  return { id: crypto.randomUUID(), track, variant, startedAt: now.toISOString(), durationMinutes: track === "profile" ? 80 : 20, questions, answers: {}, flagged: [], rules: structuredClone(EXAM_RULES) };
}

export function finishExam(exam: Exam, state: LearnerState, now = new Date()) {
  if (exam.finishedAt) return exam;
  // Resolve and grade the entire saved version before changing any history.
  resolveExamScoring(exam.rules);
  const graded=exam.questions.map((task,i)=>scoreExamTask(task,exam.answers[String(i)] || (Array.isArray(task.answer)?[]:""),exam.rules));
  const deadline = Date.parse(exam.startedAt) + exam.durationMinutes * 60000;
  exam.finishReason = now.getTime() >= deadline ? "time" : "submitted";
  exam.finishedAt = new Date(Math.min(now.getTime(), deadline)).toISOString(); exam.score = 0; exam.maxScore = 0;
  exam.results = exam.questions.map((task, i) => {
    const answer = exam.answers[String(i)] || (Array.isArray(task.answer) ? [] : ""), { points, max,explanation,ruleId } = graded[i];
    exam.score! += points; exam.maxScore! += max;
    const correct = grade(task, answer);
    const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] };
    p.attempts++; p.correct += Number(correct);
    if (!correct) { scheduleErrorReview(state, task, now); state.errors.push({ id: crypto.randomUUID(), taskId: task.id, topicId: task.topicId, answer, steps: "", category: "unknown", explanation: classifyError("").explanation, at: now.toISOString(), resolved: false, exerciseIds: [], prompt: task.prompt, solution: task.solution, hints: task.hints, correctAnswer: task.answer, source:task.source,subtopic:task.subtopic }); }
    return { taskId: task.id, topicId: task.topicId, answer, correct, points, max, prompt: task.prompt, context: task.context, solution: task.solution, correctAnswer: task.answer,scoringExplanation:explanation,gradingRuleId:ruleId };
  });
  state.exams.push(exam); state.activeExam = null;
  state.planReason = { ru: "План обновлён по результатам пробного экзамена: сначала закрепим навыки, в которых были ошибки.", kk: "Сынақ емтиханының нәтижесімен жоспар жаңартылды: алдымен қате кеткен дағдыларды бекітеміз." };
  return exam;
}

export function expireExam(state: LearnerState, now = new Date()) {
  const exam = state.activeExam;
  return exam && now.getTime() >= Date.parse(exam.startedAt) + exam.durationMinutes * 60000 ? finishExam(exam, state, now) : null;
}

export function sanitizeExam(exam: Exam | null) { return exam ? { ...exam, questions: exam.questions.map((q, index) => ({ ...sanitizeTask(q), index })) } : null; }
