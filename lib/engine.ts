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
export type Profile = { name: string; grade: string; track: Track; examDate: string; target: number; dailyMinutes: number; language: Language };
export type Progress = { attempts: number; correct: number; independent: number; mastered: boolean; reviewPassed?: boolean; independentTaskIds: string[]; lastAt?: string };
export type Attempt = { id: string; taskId: string; topicId: string; track: Track; answer: Answer; steps: string; correct: boolean; assisted: boolean; at: string; category: string };
export type Review = { id: string; topicId: string; due: string; interval: number; completed: boolean; taskId?: string };
export type ErrorEntry = { id: string; taskId: string; topicId: string; answer: Answer; steps: string; category: string; explanation: LocalText; at: string; resolved: boolean; exerciseIds: string[]; prompt?: LocalText; solution?: Task["solution"]; hints?: Task["hints"]; correctAnswer?: Answer };
export type Exam = { id: string; track: Track; variant: number; startedAt: string; durationMinutes: number; questions: Task[]; answers: Record<string, Answer>; flagged: number[]; finishedAt?: string; score?: number; maxScore?: number; results?: { taskId: string; topicId: string; answer: Answer; correct: boolean; points: number; max: number; solution: Task["solution"]; correctAnswer: Answer }[]; rules: typeof EXAM_RULES };
export type LearnerState = { profile: Profile | null; progress: Record<string, Progress>; attempts: Attempt[]; errors: ErrorEntry[]; reviews: Review[]; exams: Exam[]; diagnostics: { id: string; track: Track; at: string; score: number; total: number; strengths: string[]; gaps: string[] }[]; xp: number; lessonResume: { topicId: string; stage: number } | null; plan: PlanItem[]; activeExam: Exam | null; revision: number; planReason?: LocalText; practiceStartedAt?: string; streakDays: string[]; preferences?: { leaderboard: boolean }; streakRecoveries?: { day: string; at: string; week: string }[]; [key: string]: unknown };
export type PlanItem = { topicId: string; title: LocalText; reason: LocalText; type: "lesson" | "review" | "repair"; minutes: number; day: number };

export const EXAM_RULES = {
  year: 2026, checkedAt: "2026-10-05", version: "Пункт 18, редакция 28.02.2024 № 92",
  source: "https://old.adilet.zan.kz/rus/docs/V1700015173", trainingMinutes: { profile: 80, literacy: 20 },
  note: { ru: "Время отдельного предмета — настройка платформы. Баллы — по пункту 18 правил ЕНТ. Это авторский тренировочный вариант, не официальный тест НЦТ.", kk: "Жеке пән уақыты — платформаның баптауы. Ұпай ЕНТ ережелерінің 18-тармағымен есептеледі. Бұл авторлық жаттығу нұсқасы, ҰТО-ның ресми тесті емес." },
} as const;

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
  const lessonBank = topic && Array.isArray(topic.tasks) ? topic.tasks as { id: string }[] : [];
  return [0, 1, 5, 10].some(i => lessonBank[i]?.id === task.id);
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

// Restricted arithmetic parser. No eval, Function, executable JavaScript or property access.
export function calculate(source: string, x = 0): number {
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
  const peek = () => tokens[pos];
  function atom(): number {
    if (++depth > 30) throw new Error("Too deeply nested");
    const token = tokens[pos++];
    let n: number;
    if (token === "(") { n = sum(); if (tokens[pos++] !== ")") throw new Error("Unclosed bracket"); }
    else if (token === "x") n = x;
    else if (token === "pi") n = Math.PI;
    else if (token === "e") n = Math.E;
    else if (/^(sqrt|sin|cos|tan|ln|log|abs)$/.test(token || "")) {
      if (tokens[pos++] !== "(") throw new Error("Function requires parentheses");
      const arg = sum(); if (tokens[pos++] !== ")") throw new Error("Unclosed function");
      const functions: Record<string, (n: number) => number> = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, ln: Math.log, log: Math.log10, abs: Math.abs };
      n = functions[token](arg);
    } else if (numberToken.test(token || "")) n = Number(token);
    else throw new Error("Unknown term");
    depth--; return n;
  }
  function power(): number { const a = atom(); return peek() === "^" ? (pos++, Math.pow(a, unary())) : a; }
  function unary(): number { if (peek() === "+") { pos++; return unary(); } if (peek() === "-") { pos++; return -unary(); } return power(); }
  function product(): number { let n = unary(); while (peek() === "*" || peek() === "/") { const op = tokens[pos++], b = unary(); n = op === "*" ? n * b : n / b; } return n; }
  function sum(): number { let n = product(); while (peek() === "+" || peek() === "-") { const op = tokens[pos++], b = product(); n = op === "+" ? n + b : n - b; } return n; }
  const result = sum(); if (pos !== tokens.length || !Number.isFinite(result)) throw new Error("Expression outside domain");
  return result;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, "").replace(/−/g, "-").replace(/,/g, ".").toLowerCase();
export function equivalent(a: string, b: string, precision?: number, absoluteTolerance?: number): boolean {
  if (!a.trim()) return false;
  if (normalize(a) === normalize(b)) return true;
  try {
    const tolerance = absoluteTolerance ?? (precision === undefined ? 1e-8 : 0.5 * 10 ** -precision + 1e-10);
    const variable = /[xх]/i.test(a + b);
    const points = variable ? [-9.7, -3, -1, -0.2, 0, 0.17, 0.5, 1, 2, 4.3, 11] : [0];
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

export function grade(task: Task, answer: Answer): boolean {
  if (task.type === "multiple" || task.type === "matching") {
    const expected = Array.isArray(task.answer) ? task.answer : [task.answer];
    const provided = Array.isArray(answer) ? answer : [answer];
    if ((task.type === "multiple" && new Set(provided).size !== provided.length) || provided.length !== expected.length) return false;
    return task.type === "matching" ? expected.every((v, i) => normalize(v) === normalize(provided[i] || "")) : expected.every(v => provided.some(a => normalize(a) === normalize(v)));
  }
  if (Array.isArray(answer) || Array.isArray(task.answer)) return false;
  let cleaned = answer.trim();
  if (task.units) {
    const escaped = task.units.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`\\s*${escaped}$`, "i"), "").trim();
    // Any other trailing unit is rejected by the arithmetic parser.
  }
  return equivalent(cleaned, task.answer, task.precision, task.tolerance);
}

export function classifyError(steps: string): { category: string; explanation: LocalText } {
  if (!steps.trim()) return { category: "unknown", explanation: { ru: "По одному ответу нельзя определить причину. Запиши ход решения: найдём первый переход, который нужно исправить.", kk: "Тек жауаппен қатенің себебін анықтай алмаймыз. Шешу жолын жаз: түзететін алғашқы қадамды табамыз." } };
  if (/2\s*[xх]\s*[=]\s*14/.test(steps) && /2\s*[xх]\s*\+\s*3\s*=\s*11/.test(steps)) return { category: "sign", explanation: { ru: "В переходе к 2x = 14 знак изменён неверно. Чтобы убрать +3, вычти 3 из обеих частей: 2x + 3 − 3 = 11 − 3. Получается 2x = 8. Теперь раздели обе части на 2.", kk: "2x = 14 қадамында таңба қате. +3-ті жою үшін екі жақтан да 3-ті азайт: 2x + 3 − 3 = 11 − 3. Сонда 2x = 8. Енді екі жағын 2-ге бөл." } };
  for (const line of steps.split(/\n|→|=>/)) {
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
  const selected = topics.filter(t => t.track === track);
  const byId = new Map(topics.map(t => [t.id, t]));
  const latestDiagnostic = [...state.diagnostics].reverse().find(d => d.track === track);
  const gaps = new Set(latestDiagnostic?.gaps || []);
  const foundationStrengths = new Set((latestDiagnostic?.strengths || []).filter(id => byId.get(id)?.track === "base"));
  const ready = (id: string) => Boolean(state.progress[id]?.mastered || (state.progress[id]?.independent || 0) >= 3 || foundationStrengths.has(id));
  const futureReview = (id: string) => state.reviews.some(r => r.topicId === id && !r.completed && Date.parse(r.due) > now.getTime());
  const reachable = new Set<string>();
  function include(topic: Topic) { if (reachable.has(topic.id)) return; reachable.add(topic.id); for (const id of topic.prerequisites || []) { const p = byId.get(id); if (p) include(p); } }
  selected.forEach(include);
  const date = state.profile?.examDate;
  const daysLeft = date ? Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86400000) : null;
  const nearExam = daysLeft !== null && daysLeft >= 0 && daysLeft <= 21;
  const maximum = track === "literacy" ? 10 : 50, target = state.profile?.target;
  const ambitiousGoal = target !== undefined && target >= maximum * 0.8;
  const context: LocalText = target === undefined ? { ru: "", kk: "" } : {
    ru: ` Цель: ${target}/${maximum}.${daysLeft === null ? "" : daysLeft >= 0 ? ` До экзамена ${daysLeft} дн.` : " Дата экзамена прошла — обновите её в настройках."}`,
    kk: ` Мақсат: ${target}/${maximum}.${daysLeft === null ? "" : daysLeft >= 0 ? ` Емтиханға ${daysLeft} күн.` : " Емтихан күні өтті — баптауларда жаңартыңыз."}`,
  };
  const planned: PlanItem[] = [], seen = new Set<string>();
  function add(topic: Topic, type: PlanItem["type"], reason: LocalText) {
    if (seen.has(topic.id) || planned.length >= 7) return;
    seen.add(topic.id);
    planned.push({ topicId: topic.id, title: topic.title, type, minutes: Math.min(Number(topic.minutes || 12) + (ambitiousGoal && type === "repair" ? 5 : 0), state.profile?.dailyMinutes || 20), day: planned.length + 1, reason: { ru: reason.ru + context.ru, kk: reason.kk + context.kk } });
  }
  for (const review of state.reviews.filter(r => !r.completed && new Date(r.due) <= now && reachable.has(r.topicId)).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))) {
    const topic = byId.get(review.topicId); if (topic) add(topic, "review", { ru: "Проверим навык после перерыва: повторение закрепляет самостоятельное решение.", kk: "Үзілістен кейін дағдыны тексереміз: қайталау өз бетіңмен шешуді бекітеді." });
  }
  function prerequisite(topic: Topic, trail = new Set<string>()) {
    if (trail.has(topic.id)) return; trail.add(topic.id);
    for (const id of topic.prerequisites || []) { const p = byId.get(id); if (p && !ready(id)) { prerequisite(p, new Set(trail)); add(p, "repair", { ru: `Этот навык нужен перед темой «${topic.title.ru}».`, kk: `Бұл дағды «${topic.title.kk}» тақырыбына қажет.` }); } }
  }
  const weak = selected.filter(t => (state.progress[t.id]?.attempts || 0) > (state.progress[t.id]?.correct || 0) || gaps.has(t.id));
  if (nearExam) weak.sort((a, b) => {
    const severity = (t: Topic) => { const p = state.progress[t.id]; return p?.attempts ? (p.attempts - p.correct) / p.attempts : gaps.has(t.id) ? 1 : 0; };
    return severity(b) - severity(a);
  });
  for (const topic of [...weak, ...selected]) {
    if (state.progress[topic.id]?.mastered) continue;
    if ((state.progress[topic.id]?.independent || 0) >= 3 && futureReview(topic.id)) continue;
    if (foundationStrengths.has(topic.id) && !weak.includes(topic)) continue;
    prerequisite(topic);
    const needsRepair = weak.includes(topic);
    add(topic, needsRepair ? "repair" : "lesson", {
      ru: needsRepair ? (nearExam ? "Экзамен близко: сначала исправим наиболее заметный пробел, затем продолжим программу." : gaps.has(topic.id) ? "Диагностика показала пробел: восстановим этот навык перед следующими темами." : "Добавили закрепление: в последних задачах возникли трудности.") : "Следующий небольшой шаг по программе, с учётом нужных основ.",
      kk: needsRepair ? (nearExam ? "Емтихан жақын: алдымен ең айқын олқылықты түзетіп, кейін бағдарламаны жалғастырамыз." : gaps.has(topic.id) ? "Диагностика олқылықты көрсетті: келесі тақырыптардан бұрын осы дағдыны қалпына келтіреміз." : "Бекіту қостық: соңғы тапсырмаларда қиындық болды.") : "Қажетті негіздерді ескеретін бағдарламаның келесі шағын қадамы.",
    });
  }
  return planned;
}

export function recordAttempt(state: LearnerState, task: Task, topic: Topic, input: { answer: Answer; steps?: string; assisted?: boolean; reviewId?: string }, tasks: Task[], now = new Date()) {
  const correct = grade(task, input.answer), at = now.toISOString();
  const previousSame = state.attempts.some(a => a.taskId === task.id);
  const assignedReview = input.reviewId ? state.reviews.find(r => r.id === input.reviewId && r.topicId === task.topicId && !r.completed) : undefined;
  if (input.reviewId && (!assignedReview || new Date(assignedReview.due) > now || previousSame)) throw new Error("Повторение ещё не назначено или задача уже решалась");
  const assisted = Boolean(input.assisted) || previousSame || isModelExample(task, topic);
  const mistake = correct ? { category: "none", explanation: { ru: "Верно!", kk: "Дұрыс!" } } : classifyError(input.steps || "");
  const attempt: Attempt = { id: crypto.randomUUID(), taskId: task.id, topicId: task.topicId, track: topic.track, answer: input.answer, steps: input.steps || "", correct, assisted, at, category: mistake.category };
  state.attempts.push(attempt);
  const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] };
  p.attempts++; p.correct += Number(correct); p.lastAt = at;
  p.independentTaskIds ||= [];
  if (correct && !assisted && !p.independentTaskIds.includes(task.id)) { p.independentTaskIds.push(task.id); p.independent = p.independentTaskIds.length; state.xp += 10; }
  const day = dayKey(now);
  if (!state.streakDays.includes(day)) state.streakDays.push(day);
  if (!correct) {
    scheduleErrorReview(state, task.topicId, now);
    state.errors.push({ id: attempt.id, taskId: task.id, topicId: task.topicId, answer: input.answer, steps: input.steps || "", category: mistake.category, explanation: mistake.explanation, at, resolved: false, exerciseIds: tasks.filter(t => t.topicId === task.topicId && t.id !== task.id).slice(0, 3).map(t => t.id), prompt: task.prompt, solution: task.solution, hints: task.hints, correctAnswer: task.answer });
  } else if (!assisted) {
    for (const error of state.errors.filter(e => e.topicId === task.topicId && !e.resolved && e.taskId !== task.id)) { error.resolved = true; state.xp += 5; }
  }
  if (input.reviewId) {
    const review = assignedReview!;
    if (correct && !assisted) {
      review.completed = true; review.taskId = task.id;
      p.reviewPassed = true;
      const intervals = [1, 3, 7, 14], next = intervals[intervals.indexOf(review.interval) + 1];
      if (next) state.reviews.push({ id: crypto.randomUUID(), topicId: task.topicId, due: new Date(now.getTime() + next * 86400000).toISOString(), interval: next, completed: false });
    } else { p.reviewPassed = false; review.due = new Date(now.getTime() + 86400000).toISOString(); review.interval = 1; }
  }
  if (p.independent >= 3 && !state.reviews.some(r => r.topicId === task.topicId)) state.reviews.push({ id: crypto.randomUUID(), topicId: task.topicId, due: new Date(now.getTime() + 86400000).toISOString(), interval: 1, completed: false });
  const wasMastered = p.mastered;
  p.mastered = p.independent >= 3 && Boolean(p.reviewPassed);
  if (!wasMastered && p.mastered) state.xp += 50;
  state.lessonResume = { topicId: task.topicId, stage: 3 };
  return { correct, solution: task.solution, hints: task.hints, errorCategory: mistake.category, explanation: mistake.explanation, answer: task.answer, independentEligible: !assisted, verification: task.type === "expression" ? "sampled-domain-check" : "verified-answer" };
}

function scheduleErrorReview(state: LearnerState, topicId: string, now: Date) {
  const scheduled = state.reviews.find(r => r.topicId === topicId && !r.completed), due = new Date(now.getTime() + 86400000).toISOString();
  if (scheduled) { scheduled.due = due; scheduled.interval = 1; }
  else state.reviews.push({ id: crypto.randomUUID(), topicId, due, interval: 1, completed: false });
}

export function sanitizeTask(task: Task) {
  return { id: task.id, topicId: task.topicId, prompt: task.prompt, type: task.type, difficulty: task.difficulty, level: task.difficulty, options: task.options, pairs: task.pairs?.map(p => ({ left: p.left, right: "" })), skill: task.skill, units: task.units, unit: task.units, precision: task.precision, domain: task.domain, context: task.context, modelExample: Boolean(task.modelExample), reviewReserved: Boolean(task.reviewReserved) };
}

export function diagnosticTasks(track: Track, topics: Topic[], tasks: Task[]) {
  const relevant = topics.filter(t => t.track === track || (track === "profile" && t.track === "base"));
  const result: Task[] = [];
  for (let i = 0; i < relevant.length && result.length < 10; i += Math.max(1, Math.floor(relevant.length / 10))) {
    const task = tasks.find(t => t.topicId === relevant[i].id && t.difficulty === 1 && t.type === "single") || tasks.find(t => t.topicId === relevant[i].id && t.difficulty === 1);
    if (task) result.push(task);
  }
  if (track === "profile") {
    // Explicitly sample foundations rather than relying on where they occur in the topic order.
    const foundations = ["numbers", "fractions", "negatives", "percentages"].map(id => tasks.find(t => t.topicId === id && t.difficulty === 1 && t.type === "single") || tasks.find(t => t.topicId === id && t.difficulty === 1)).filter((t): t is Task => Boolean(t));
    return [...foundations, ...result.filter(t => !foundations.some(f => f.topicId === t.topicId))].slice(0, 10);
  }
  return result;
}

export function scoreExamTask(task: Task, answer: Answer) {
  const max = task.type === "multiple" || task.type === "matching" ? 2 : 1;
  if (grade(task, answer)) return { points: max, max };
  if (max === 1) return { points: 0, max };
  const expected = Array.isArray(task.answer) ? task.answer : [task.answer];
  const values = Array.isArray(answer) ? answer : (answer ? [answer] : []);
  if (task.type === "multiple" && new Set(values).size !== values.length) return { points: 0, max };
  const provided = task.type === "matching" ? values : [...new Set(values)];
  const hits = task.type === "matching" ? provided.filter((v, i) => v === expected[i]).length : provided.filter(v => expected.includes(v)).length;
  const wrong = provided.filter((v, i) => task.type === "matching" ? v !== expected[i] : !expected.includes(v)).length;
  const partial = wrong < 2 && (expected.length === 1 ? hits === 1 : expected.length === 2 ? hits >= 1 : hits >= 2);
  return { points: partial ? 1 : 0, max };
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
  if (!Number.isInteger(variant) || variant < 1 || variant > 5 || !["profile", "literacy"].includes(track)) throw new Error("Выберите направление и вариант 1–5");
  const topicIds = new Set(topics.filter(t => t.track === track).map(t => t.id));
  const byTopic = new Map(topics.map(t => [t.id, t]));
  const bank = tasks.filter(t => topicIds.has(t.topicId) && !isModelExample(t, topics.find(p => p.id === t.topicId))), used = new Set<string>(), questions: Task[] = [];
  const eligible = (t: Task, type: "single" | "multiple" | "matching", d: number) => t.difficulty === d && !used.has(t.id) && (type === "single" ? ["number", "single"].includes(t.type) : t.type === type && Array.isArray(t.answer) && t.answer.length > 0 && t.answer.length <= 3);
  let coverageSize = -1;
  const sectionCounts = new Map<string, number>(), topicCounts = new Map<string, number>(), moduleCounts = new Map<string, number>(), ranks = new Map<string, number[]>();
  function coverageRank(task: Task) {
    if (coverageSize !== questions.length) {
      coverageSize = questions.length; sectionCounts.clear(); topicCounts.clear(); moduleCounts.clear(); ranks.clear();
      for (const q of questions) {
        const t = byTopic.get(q.topicId), section = officialSection(t), module = String(t?.module || "misc");
        sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1); topicCounts.set(q.topicId, (topicCounts.get(q.topicId) || 0) + 1); moduleCounts.set(module, (moduleCounts.get(module) || 0) + 1);
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
    const topic = topics.find(t => t.track === "profile" && /процент|модел|задач/i.test(t.title.ru)) || topics.find(t => t.track === "profile");
    if (!topic) throw new Error("No profile curriculum");
    [1, 1, 1, 2, 3].forEach((d, i) => questions.push(contextTask(i, variant, d, topic.id)));
    select("multiple", [3, 1, 1]); select("matching", [2, 2, 1]);
  }
  return { id: crypto.randomUUID(), track, variant, startedAt: now.toISOString(), durationMinutes: track === "profile" ? 80 : 20, questions, answers: {}, flagged: [], rules: EXAM_RULES };
}

export function finishExam(exam: Exam, state: LearnerState, now = new Date()) {
  if (exam.finishedAt) return exam;
  exam.finishedAt = now.toISOString(); exam.score = 0; exam.maxScore = 0;
  exam.results = exam.questions.map((task, i) => {
    const answer = exam.answers[String(i)] || (Array.isArray(task.answer) ? [] : ""), { points, max } = scoreExamTask(task, answer);
    exam.score! += points; exam.maxScore! += max;
    const correct = grade(task, answer);
    const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] };
    p.attempts++; p.correct += Number(correct);
    if (!correct) { scheduleErrorReview(state, task.topicId, now); state.errors.push({ id: crypto.randomUUID(), taskId: task.id, topicId: task.topicId, answer, steps: "", category: "unknown", explanation: classifyError("").explanation, at: now.toISOString(), resolved: false, exerciseIds: [], prompt: task.prompt, solution: task.solution, hints: task.hints, correctAnswer: task.answer }); }
    return { taskId: task.id, topicId: task.topicId, answer, correct, points, max, solution: task.solution, correctAnswer: task.answer };
  });
  state.exams.push(exam); state.activeExam = null;
  state.planReason = { ru: "План обновлён по результатам пробного экзамена: сначала закрепим навыки, в которых были ошибки.", kk: "Сынақ емтиханының нәтижесімен жоспар жаңартылды: алдымен қате кеткен дағдыларды бекітеміз." };
  return exam;
}

export function sanitizeExam(exam: Exam | null) { return exam ? { ...exam, questions: exam.questions.map((q, index) => ({ ...sanitizeTask(q), index })) } : null; }
