import { env } from "cloudflare:workers";
import { eq, and, sql, lt } from "drizzle-orm";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { learnerStates, contentOverrides, contentReports, tutorUsage } from "@/db/schema";
import * as curriculum from "@/lib/content";
import { emptyState, sanitizeExam, makePlan, isModelExample, reservedReviewIds, calculate, streakInfo, type LearnerState, type Topic, type Task } from "@/lib/engine";

export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function configuration() { return env as unknown as { DB?: D1Database; ADMIN_EMAILS?: string; TUTOR_API_KEY?: string; TUTOR_BASE_URL?: string; TUTOR_MODEL?: string; TUTOR_DAILY_LIMIT?: string }; }
export const isAdmin = (user: ChatGPTUser) => (configuration().ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
export async function authenticate() { const user = await getChatGPTUser(); if (!user) throw new ApiError("Войдите через ChatGPT, чтобы сохранять учебный прогресс.", 401); return user; }
export async function adminAuthenticate() { const user = await authenticate(); if (!isAdmin(user)) throw new ApiError("Доступ разрешён только администратору.", 403); return user; }

type ContentExports = { topics?: unknown[]; tasks?: unknown[]; allTasks?: unknown[]; getTasks?: (topicId?: string) => unknown[] };
export function baseContent() {
  const data = curriculum as unknown as ContentExports;
  const topics = (data.topics || []) as Topic[];
  const rawTasks = data.tasks || data.allTasks || (data.getTasks ? topics.flatMap(t => data.getTasks!(t.id)) : topics.flatMap(t => Array.isArray(t.tasks) ? t.tasks : []));
  const tasks = rawTasks.map(raw => { const t = raw as Task & { level?: number; unit?: string }; const topic = topics.find(p => p.id === t.topicId); return { ...t, difficulty: t.difficulty || t.level || 1, units: t.units || t.unit, modelExample: isModelExample(t, topic), reviewReserved: reservedReviewIds(topic).includes(t.id) }; }) as Task[];
  return { topics, tasks };
}
export async function publishedContent() {
  const { topics, tasks } = baseContent();
  if (!configuration().DB) return { topics, tasks };
  const rows = await getDb().select().from(contentOverrides).where(eq(contentOverrides.status, "published"));
  const topicMap = new Map(topics.map(t => [t.id, t])), taskMap = new Map(tasks.map(t => [t.id, t]));
  for (const row of rows) {
    try {
      const data = JSON.parse(row.data);
      if (row.kind === "topic" && topicMap.has(row.id)) topicMap.set(row.id, { ...topicMap.get(row.id)!, ...data, id: row.id });
      if (row.kind === "task" && taskMap.has(row.id)) { const merged = { ...taskMap.get(row.id)!, ...data, id: row.id }; merged.difficulty = Number(data.level || data.difficulty || merged.difficulty); merged.units = data.unit || data.units || merged.units; taskMap.set(row.id, merged); }
    } catch { /* A corrupt draft must not break a learner session. */ }
  }
  return { topics: [...topicMap.values()], tasks: [...taskMap.values()] };
}

export async function loadState(user: ChatGPTUser): Promise<LearnerState> {
  if (!configuration().DB) throw new ApiError("Хранилище ещё не подключено. Администратор должен подключить D1 и применить миграции.", 503);
  const db = getDb();
  let row = await db.select().from(learnerStates).where(eq(learnerStates.userId, user.userId)).get();
  if (!row) {
    await db.insert(learnerStates).values({ userId: user.userId, email: user.email, data: JSON.stringify(emptyState()), updatedAt: new Date().toISOString() }).onConflictDoNothing();
    row = await db.select().from(learnerStates).where(eq(learnerStates.userId, user.userId)).get();
  }
  if (!row) throw new ApiError("Не удалось открыть учебный профиль.", 503);
  return { ...emptyState(), ...JSON.parse(row.data), revision: row.revision };
}

export async function saveState(user: ChatGPTUser, state: LearnerState) {
  const revision = state.revision;
  const result = await getDb().update(learnerStates).set({ data: JSON.stringify({ ...state, revision: revision + 1 }), revision: revision + 1, email: user.email, updatedAt: new Date().toISOString() }).where(and(eq(learnerStates.userId, user.userId), eq(learnerStates.revision, revision))).returning({ id: learnerStates.userId });
  if (!result.length) throw new ApiError("Данные изменились в другой вкладке. Обновите страницу и повторите действие.", 409);
  state.revision++;
}

export function clientState(user: ChatGPTUser, state: LearnerState) {
  const testIdentity = user.userId === "local_seedy" && user.email === "seedy@sites.test";
  return { ...state, streak: streakInfo(state), activeExam: sanitizeExam(state.activeExam), isAdmin: isAdmin(user), aiConfigured: Boolean(configuration().TUTOR_API_KEY), user: { id: user.userId, email: user.email, name: user.displayName }, storage: "cloudflare-d1", demo: false, testIdentity, identityNotice: testIdentity ? { ru: "Локальный тестовый аккаунт. Здесь сохраняются результаты ваших проверок; это не реальная регистрация через ChatGPT.", kk: "Жергілікті сынақ аккаунты. Мұнда тексеру нәтижелері сақталады; бұл ChatGPT арқылы нақты тіркелу емес." } : null };
}
export function response(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export function failure(error: unknown) { return response({ error: error instanceof ApiError ? error.message : "Не удалось выполнить запрос. Попробуйте ещё раз; ваш сохранённый прогресс не потерян." }, error instanceof ApiError ? error.status : 500); }
export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("Недопустимый источник запроса.", 403);
  const raw = await request.text(); if (raw.length > 50000) throw new ApiError("Запрос слишком большой.", 413);
  try { const data = JSON.parse(raw); if (!data || Array.isArray(data) || typeof data !== "object") throw new Error(); return data; } catch { throw new ApiError("Некорректный JSON."); }
}
export function textValue(value: unknown, max = 2000): string { if (typeof value !== "string" || value.length > max) throw new ApiError("Некорректное текстовое значение."); return value; }
export function answerValue(value: unknown) { if (typeof value === "string" && value.length <= 300) return value; if (Array.isArray(value) && value.length <= 8 && value.every(v => typeof v === "string" && v.length <= 300)) return value as string[]; throw new ApiError("Введите ответ."); }
export function trackValue(value: unknown): "base" | "profile" | "literacy" { if (value !== "base" && value !== "profile" && value !== "literacy") throw new ApiError("Выберите направление подготовки."); return value; }
export function assertStudyAllowed(state: LearnerState) { if (state.activeExam) throw new ApiError("Во время экзамена подсказки и тренажёр закрыты. Завершите экзамен, чтобы открыть разбор.", 409); }
export function updatePlan(state: LearnerState, topics: Topic[]) { state.plan = makePlan(state, topics); }

export async function consumeTutorBudget(user: ChatGPTUser) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qyzylorda" }).format(new Date());
  const id = `${user.userId}:${day}`, limit = Math.max(1, Math.min(200, Number(configuration().TUTOR_DAILY_LIMIT || 30) || 30));
  const db = getDb();
  await db.insert(tutorUsage).values({ id, userId: user.userId, day, requests: 0 }).onConflictDoNothing();
  const rows = await db.update(tutorUsage).set({ requests: sqlIncrement() }).where(and(eq(tutorUsage.id, id), lessThanLimit(limit))).returning({ count: tutorUsage.requests });
  if (!rows.length) throw new ApiError("Сегодня лимит ИИ достигнут. Учебные материалы, практика и обычные подсказки доступны.", 429);
  return { used: rows[0].count, limit };
}
function sqlIncrement() { return sql`${tutorUsage.requests} + 1`; }
function lessThanLimit(limit: number) { return lt(tutorUsage.requests, limit); }

export async function recordReport(user: ChatGPTUser, taskId: string, message: string) {
  await getDb().insert(contentReports).values({ id: crypto.randomUUID(), userId: user.userId, taskId, message, createdAt: new Date().toISOString() });
}

export async function adminData() {
  const [overrides, reports] = await Promise.all([getDb().select().from(contentOverrides), getDb().select().from(contentReports)]);
  return { ...baseContent(), overrides: overrides.map(r => ({ ...r, data: JSON.parse(r.data), history: JSON.parse(r.history) })), reports };
}

export async function updateContent(user: ChatGPTUser, input: Record<string, unknown>) {
  if (!isAdmin(user)) throw new ApiError("Доступ разрешён только администратору.", 403);
  const id = textValue(input.id, 120), kind = input.kind;
  if (kind !== "topic" && kind !== "task" && kind !== "rules") throw new ApiError("Неизвестный тип материала.");
  const status = input.status;
  if (!["draft", "review", "published"].includes(String(status))) throw new ApiError("Неверный статус.");
  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) throw new ApiError("Требуется объект материала.");
  const data = input.data as Record<string, unknown>;
  if (JSON.stringify(data).length > 30000) throw new ApiError("Материал слишком большой.");
  const base = baseContent(), existingTask = base.tasks.find(t => t.id === id);
  if ((kind === "task" && !existingTask) || (kind === "topic" && !base.topics.some(t => t.id === id))) throw new ApiError("Материал не найден.", 404);
  if (status === "published" && (typeof input.reviewNote !== "string" || !input.reviewNote.trim())) throw new ApiError("Для публикации требуется запись о математической и языковой проверке.");
  const bilingualText = (value: unknown) => { const v = value as { ru?: unknown; kk?: unknown }; return v && typeof v.ru === "string" && v.ru.trim() && typeof v.kk === "string" && v.kk.trim(); };
  const bilingualSteps = (value: unknown) => { const v = value as { ru?: unknown; kk?: unknown }; return v && Array.isArray(v.ru) && v.ru.length && v.ru.every(s => typeof s === "string" && s.trim()) && Array.isArray(v.kk) && v.kk.length && v.kk.every(s => typeof s === "string" && s.trim()); };
  if (kind === "topic" && status === "published") {
    const merged = { ...base.topics.find(t => t.id === id)!, ...data };
    const lesson = merged.lesson as Record<string, unknown>;
    const exampleValid = (value: unknown) => { const v = value as { problem?: unknown; steps?: unknown; answer?: unknown }; return v && bilingualText(v.problem) && bilingualSteps(v.steps) && typeof v.answer === "string" && v.answer.trim(); };
    if (!bilingualText(merged.title) || !lesson || !["goal", "explanation", "simpler", "formula", "terms"].every(key => bilingualText(lesson[key])) || !bilingualSteps(lesson.mistakes) || !bilingualSteps(lesson.recap) || !Array.isArray(lesson.examples) || lesson.examples.length < 3 || !lesson.examples.every(exampleValid) || !exampleValid(lesson.guided)) throw new ApiError("Перед публикацией заполните весь урок: теория, термины, три примера, совместное решение и памятка на двух языках.");
    if (!Array.isArray(merged.prerequisites) || merged.prerequisites.some(p => typeof p !== "string" || !base.topics.some(t => t.id === p)) || !["base", "profile", "literacy"].includes(merged.track)) throw new ApiError("Проверьте направление и зависимости темы.");
    const current = (await publishedContent()).topics.map(t => t.id === id ? merged as Topic : t), visiting = new Set<string>(), visited = new Set<string>();
    const visit = (topicId: string) => { if (visiting.has(topicId)) throw new ApiError("В зависимостях тем возник цикл. Исправьте порядок изучения."); if (visited.has(topicId)) return; visiting.add(topicId); for (const p of current.find(t => t.id === topicId)?.prerequisites || []) visit(p); visiting.delete(topicId); visited.add(topicId); };
    for (const t of current) visit(t.id);
  }
  if (kind === "task" && status === "published") {
    if (!existingTask) throw new ApiError("Задание не найдено.");
    const merged = { ...existingTask, ...data } as Task;
    if (!bilingualText(merged.prompt) || !bilingualSteps(merged.solution) || !bilingualSteps(merged.hints) || !["number", "single", "multiple", "matching", "expression"].includes(merged.type) || ![1, 2, 3].includes(Number(data.level || data.difficulty || merged.difficulty)) || !base.topics.some(t => t.id === merged.topicId)) throw new ApiError("Перед публикацией заполните условия, ответ, решения и подсказки на двух языках; проверьте тип, навык и сложность.");
    const answer = answerValue(merged.answer);
    if (Array.isArray(answer) ? !answer.length || answer.some(a => !a.trim()) : !answer.trim()) throw new ApiError("Правильный ответ не может быть пустым.");
    if (["single", "multiple", "matching"].includes(merged.type) && (!Array.isArray(merged.options) || merged.options.length < 2 || merged.options.some(o => typeof o !== "string") || new Set(merged.options).size !== merged.options.length || (Array.isArray(answer) ? answer : [answer]).some(a => !merged.options!.includes(a)))) throw new ApiError("Варианты ответа должны быть уникальными и содержать все правильные ответы.");
    if (["multiple", "matching"].includes(merged.type) && !Array.isArray(answer)) throw new ApiError("Для нескольких ответов и соответствия нужен массив ответов.");
    if (!["multiple", "matching"].includes(merged.type) && Array.isArray(answer)) throw new ApiError("Для этого типа требуется один ответ.");
    if (merged.type === "matching" && (!merged.pairs || merged.pairs.length !== (answer as string[]).length || merged.pairs.some((p, i) => typeof p.left !== "string" || typeof p.right !== "string" || p.right !== (answer as string[])[i]))) throw new ApiError("Сопоставления должны совпадать с ключом ответа.");
    if (merged.type === "number") { try { if (/[xх]/i.test(answer as string)) throw new Error(); calculate(answer as string); } catch { throw new ApiError("Числовой ответ должен быть конечным числом или проверяемым числовым выражением."); } }
  }
  if (kind === "rules" && status === "published") throw new ApiError("Правила экзамена имеют версию в коде. Сохраните проект правил для проверки и обновите движок после сверки официального источника.");
  const db = getDb(), previous = await db.select().from(contentOverrides).where(eq(contentOverrides.id, id)).get();
  const history = previous ? JSON.parse(previous.history) : [];
  history.push({ at: new Date().toISOString(), by: user.email, status, previousData: previous ? JSON.parse(previous.data) : null, note: typeof input.reviewNote === "string" ? input.reviewNote : "" });
  const row = { id, kind: String(kind), status: String(status), data: JSON.stringify(data), history: JSON.stringify(history), updatedBy: user.userId, updatedAt: new Date().toISOString() };
  await db.insert(contentOverrides).values(row).onConflictDoUpdate({ target: contentOverrides.id, set: row });
  return { id, status, history };
}
