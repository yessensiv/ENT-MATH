import { env } from "cloudflare:workers";
import { eq, and, sql, lt, asc } from "drizzle-orm";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { learnerStates, learnerStateChunks, contentOverrides, contentReports, tutorUsage,editorialReviews } from "@/db/schema";
import { contentDigest,independentReviewCoverage } from '@/lib/material-review';
import {publishedSnapshot} from '@/lib/content-versions';
import{boundedText}from'@/lib/bounded-body';
import { encodeState, decodeState, statePointer, stateSaveStatements } from "@/lib/state-codec";
import{readEvents,prepareEventSave,eventWriteStatements,legacyEventState,type EventBaseline}from'@/lib/event-storage';
import{historySummary}from'@/lib/history-summary';
import { schoolTopics, schoolTasks } from "@/lib/school-content";
import {schoolExtensionTopics,schoolExtensionTasks} from '@/lib/school-extension-content';
import {schoolAdvancedTopics,schoolAdvancedTasks} from '@/lib/school-advanced-content';
import * as curriculum from "@/lib/content";
import {withLessonEnrichment,validLessonEnrichment} from '@/lib/lesson-enrichment';
import type {Topic as AuthoredTopic} from '@/lib/content';
import { emptyState, sanitizeExam, makePlan, isModelExample, reservedReviewIds, calculate, checkAnswer,streakInfo, expireExam, diagnosticTasks, type LearnerState, type Topic, type Task } from "@/lib/engine";

export class ApiError extends Error { constructor(message: string, public status = 400, public code?: string) { super(message); } }
export function configuration() { return env as unknown as { DB?: D1Database; ADMIN_EMAILS?: string; TUTOR_API_KEY?: string; TUTOR_BASE_URL?: string; TUTOR_MODEL?: string; TUTOR_VISION_MODEL?: string; TUTOR_DAILY_LIMIT?: string; TUTOR_DAILY_TOKEN_LIMIT?:string;EVENT_STORAGE_MODE?:string }; }
const eventBaselines=new WeakMap<LearnerState,EventBaseline>();
export const isAdmin = (user: ChatGPTUser) => (configuration().ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase());
export async function authenticate() { const user = await getChatGPTUser(); if (!user) throw new ApiError("Войдите через ChatGPT, чтобы сохранять учебный прогресс.", 401); return user; }
export async function adminAuthenticate() { const user = await authenticate(); if (!isAdmin(user)) throw new ApiError("Доступ разрешён только администратору.", 403); return user; }

type ContentExports = { topics?: unknown[]; tasks?: unknown[]; allTasks?: unknown[]; getTasks?: (topicId?: string) => unknown[] };
export function baseContent() {
  const data = curriculum as unknown as ContentExports;
  const topics = ([...(data.topics || []), ...[...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics].map(t=>({...t,schoolOnly:true}))] as AuthoredTopic[]).map(withLessonEnrichment) as unknown as Topic[];
  const rawTasks = data.tasks || data.allTasks || (data.getTasks ? topics.flatMap(t => data.getTasks!(t.id)) : topics.flatMap(t => Array.isArray(t.tasks) ? t.tasks : []));
  const tasks = [...rawTasks, ...schoolTasks,...schoolExtensionTasks,...schoolAdvancedTasks].map(raw => { const t = raw as Task & { level?: number; unit?: string }; const topic = topics.find(p => p.id === t.topicId); return { ...t, difficulty: t.difficulty || t.level || 1, units: t.units || t.unit, modelExample: isModelExample(t, topic), reviewReserved: reservedReviewIds(topic).includes(t.id) }; }) as Task[];
  return { topics, tasks };
}
export async function publishedContent() {
  const { topics, tasks } = baseContent();
  if (!configuration().DB) return { topics, tasks };
  const rows = await getDb().select().from(contentOverrides);
  const topicMap = new Map(topics.map(t => [t.id, t])), taskMap = new Map(tasks.map(t => [t.id, t]));
  for (const row of rows) {
    try {
      const data = publishedSnapshot(row); if(!data)continue;
      if (row.kind === "topic" && topicMap.has(row.id)) topicMap.set(row.id, { ...topicMap.get(row.id)!, ...data, id: row.id });
      if (row.kind === "task" && taskMap.has(row.id)) { const merged = { ...taskMap.get(row.id)!, ...data, id: row.id }; merged.difficulty = Number(data.level || data.difficulty || merged.difficulty); merged.units = typeof data.unit==='string'?data.unit:typeof data.units==='string'?data.units:merged.units; taskMap.set(row.id, merged); }
    } catch { /* A corrupt draft must not break a learner session. */ }
  }
  return { topics: [...topicMap.values()].map(t=>withLessonEnrichment(t as unknown as AuthoredTopic)) as unknown as Topic[], tasks: [...taskMap.values()] };
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
  let decoded: Record<string, unknown> | undefined;
  for (let retry = 0; retry < 3; retry++) {
    try {
      const pointer = statePointer(row.data), chunks = pointer ? await db.select({ chunkIndex: learnerStateChunks.chunkIndex, data: learnerStateChunks.data }).from(learnerStateChunks).where(and(eq(learnerStateChunks.userId, user.userId), eq(learnerStateChunks.token, pointer.token))).orderBy(asc(learnerStateChunks.chunkIndex)) : [];
      decoded = await decodeState(row.data, chunks); break;
    } catch {
      const latest = await db.select().from(learnerStates).where(eq(learnerStates.userId, user.userId)).get();
      if (!latest || latest.revision === row.revision || retry === 2) throw new ApiError("Не удалось проверить целостность сохранения. Не начинайте занятие заново; обратитесь к администратору.", 503, "STATE_INTEGRITY");
      row = latest;
    }
  }
  if (!decoded) throw new ApiError("Не удалось прочитать сохранённый профиль.", 503);
  let events:EventBaseline|null;
  try{events=await readEvents(configuration().DB!,user.userId,decoded);}catch{throw new ApiError('Не удалось проверить целостность учебной истории. Новые записи остановлены; обратитесь к администратору.',503,'EVENT_INTEGRITY');}
  const state = { ...emptyState(), ...decoded, revision: row.revision } as LearnerState;
  if(events)eventBaselines.set(state,events);
  if (state.diagnostics.some(d => !d.taskIds)) { const content = baseContent(); for (const diagnostic of state.diagnostics) diagnostic.taskIds ||= diagnosticTasks(diagnostic.track, content.topics, content.tasks,diagnostic.schoolGrade,diagnostic.schoolPathway).map(t => t.id); }
  return state;
}

export async function saveState(user: ChatGPTUser, state: LearnerState,options:{storage?:'legacy'|'events'}={}) {
  const revision = state.revision;
  let bundle,eventSave;
  const useEvents=(options.storage??(configuration().EVENT_STORAGE_MODE==='legacy'?'legacy':'events'))==='events';
  try {if(useEvents)eventSave=await prepareEventSave(state,revision+1,eventBaselines.get(state));bundle = await encodeState({ ...(eventSave?.aggregate??legacyEventState(state)), revision: revision + 1 }, crypto.randomUUID()); }
  catch (e) { if (e instanceof Error && ['STATE_CAPACITY','EVENT_CAPACITY','EVENT_MIGRATION_BATCH_REQUIRED'].includes(e.message)) throw new ApiError("Этот перенос превышает лимит одной операции. Последнее занятие ещё не сохранено; прежние записи сохранены. Администратору нужен отдельный пакетный перенос.", 507, "STATE_CAPACITY"); throw e; }
  const db = configuration().DB!, statements = stateSaveStatements(user.userId, user.email, revision, bundle, new Date().toISOString());
  const backupId=`${user.userId}:${new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Qyzylorda'}).format(new Date())}`;
  // One snapshot of the previous saved state per day. Head and all old chunks
  // are copied in the same transaction before the normal chunk cleanup.
  const backup=[
    db.prepare("INSERT OR IGNORE INTO learner_backups(id,user_id,head,revision,created_at) SELECT ?,user_id,data,revision,? FROM learner_states WHERE user_id=? AND revision=? AND json_type(data,'$.profile')='object'").bind(backupId,new Date().toISOString(),user.userId,revision),
    db.prepare("INSERT OR IGNORE INTO learner_backup_chunks(backup_id,chunk_index,data) SELECT ?,c.chunk_index,c.data FROM learner_state_chunks c JOIN learner_backups b ON b.id=? JOIN learner_states s ON s.user_id=b.user_id WHERE c.user_id=? AND c.token=json_extract(b.head,'$._entStorage.token') AND b.revision=s.revision AND s.revision=?").bind(backupId,backupId,user.userId,revision),
  ];
  const oldest=new Date(Date.now()-7*86400000).toISOString();
  const cleanup=[db.prepare('DELETE FROM learner_backup_chunks WHERE backup_id IN (SELECT id FROM learner_backups WHERE user_id=? AND created_at<?)').bind(user.userId,oldest),db.prepare('DELETE FROM learner_backups WHERE user_id=? AND created_at<?').bind(user.userId,oldest)];
  const eventStatements=eventSave?eventWriteStatements(user.userId,eventSave.manifest,eventSave.groups):[];
  // Reserve query capacity for the route's reads. Fail before any write rather
  // than exceeding the free-plan limit partway through a large conversion.
  if(statements.length+eventStatements.length>36)throw new ApiError('Нужен отдельный пакетный перенос большой истории. Сохранённые записи не изменены.',507,'STATE_CAPACITY');
  const results = await db.batch([...backup,...statements.map(s => db.prepare(s.sql).bind(...s.params)),...eventStatements.map(s=>db.prepare(s.sql).bind(...s.params)),...cleanup]);
  if (!results[2].results?.length) throw new ApiError("Данные изменились в другой вкладке. Обновите страницу и повторите действие.", 409, "STATE_CONFLICT");
  state.revision++;
  if(eventSave){state._entEvents=eventSave.manifest;eventBaselines.set(state,eventSave.baseline);}else{delete state._entEvents;eventBaselines.delete(state);}
}

export async function loadCurrentState(user: ChatGPTUser) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await loadState(user), result = expireExam(state);
    if (!result) return { state, expired: null };
    updatePlan(state, (await publishedContent()).topics);
    try { await saveState(user, state); return { state, expired: result }; }
    catch (e) { if (!(e instanceof ApiError && e.code === "STATE_CONFLICT") || attempt === 2) throw e; }
  }
  throw new ApiError("Обновите страницу, чтобы получить сохранённый результат.", 409, "STATE_CONFLICT");
}

export function clientState(user: ChatGPTUser, state: LearnerState) {
  const testIdentity = user.userId === "local_seedy" && user.email === "seedy@sites.test";
  const { generatedTasks: _generated, reviewSerials: _serials, submissions:_submissions, submissionRequests:_requests,tutorGenerations:_generations,tutorMessages:_messages,_entEvents:_events,...safe } = state; void _generated; void _serials;void _submissions;void _requests;void _generations;void _messages;void _events;
  const history={attempts:state.attempts.length,exams:state.exams.length,returnedAttempts:Math.min(100,state.attempts.length),returnedExams:Math.min(10,state.exams.length),endpoint:'/api/history'};
  safe.attempts=state.activeExam?[]:state.attempts.slice(-100);safe.exams=state.activeExam?[]:state.exams.slice(-10);if(state.activeExam)safe.errors=[];safe.history=history;safe.statistics=historySummary(state);
  return { ...safe, serverNow: Date.now(), streak: streakInfo(state), activeExam: sanitizeExam(state.activeExam), isAdmin: isAdmin(user), aiConfigured: Boolean(configuration().TUTOR_API_KEY), user: { id: user.userId, email: user.email, name: user.displayName }, storage: "cloudflare-d1", demo: false, testIdentity, identityNotice: testIdentity ? { ru: "Локальный тестовый аккаунт. Здесь сохраняются результаты ваших проверок; это не реальная регистрация через ChatGPT.", kk: "Жергілікті сынақ аккаунты. Мұнда тексеру нәтижелері сақталады; бұл ChatGPT арқылы нақты тіркелу емес." } : null };
}
export function response(data: unknown, status = 200, requestId=crypto.randomUUID()) { const body=data&&typeof data==='object'&&!Array.isArray(data)?{...data,requestId,apiVersion:1}:data;return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",'X-Request-Id':requestId } }); }
export function failure(error: unknown) {
  const status=error instanceof ApiError?error.status:500,requestId=crypto.randomUUID();
  const defaults:Record<number,string>={400:'INVALID_INPUT',401:'AUTH_REQUIRED',403:'FORBIDDEN',404:'NOT_FOUND',409:'CONFLICT',413:'BODY_TOO_LARGE',429:'RATE_LIMITED',503:'SERVICE_UNAVAILABLE'};
  const code=error instanceof ApiError&&error.code?error.code:defaults[status]||'INTERNAL_ERROR';
  // Technical logs deliberately exclude identities, answers, chat, and exception text.
  if(status>=500)console.error(JSON.stringify({event:'api_failure',requestId,code,status,at:new Date().toISOString()}));
  return response({error:error instanceof ApiError?error.message:'Не удалось выполнить запрос. Повторите отправку после восстановления связи.',code,retryable:status>=500||status===429||code==='STATE_CONFLICT',requestId},status,requestId);
}
export async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new ApiError("Недопустимый источник запроса.", 403);
  let raw:string;try{raw=await boundedText(request,200000);}catch{throw new ApiError('Запрос слишком большой или прерван.',413,'BODY_TOO_LARGE');}if(raw.length>50000)throw new ApiError('Запрос слишком большой.',413,'BODY_TOO_LARGE');
  try { const data = JSON.parse(raw); if (!data || Array.isArray(data) || typeof data !== "object") throw new Error(); return data; } catch { throw new ApiError("Некорректный JSON."); }
}
export function textValue(value: unknown, max = 2000): string { if (typeof value !== "string" || value.length > max) throw new ApiError("Некорректное текстовое значение."); return value; }
export function answerValue(value: unknown) { if (typeof value === "string" && value.length <= 300) return value; if (Array.isArray(value) && value.length <= 8 && value.every(v => typeof v === "string" && v.length <= 300)) return value as string[]; throw new ApiError("Введите ответ."); }
export function trackValue(value: unknown): "base" | "profile" | "literacy" { if (value !== "base" && value !== "profile" && value !== "literacy") throw new ApiError("Выберите направление подготовки."); return value; }
export function assertStudyAllowed(state: LearnerState) { if (state.activeExam) throw new ApiError("Во время экзамена подсказки и тренажёр закрыты. Завершите экзамен, чтобы открыть разбор.", 409); }
export function updatePlan(state: LearnerState, topics: Topic[]) { state.plan = makePlan(state, topics); }

export async function consumeTutorBudget(user: ChatGPTUser, reservation=8000) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qyzylorda" }).format(new Date());
  const id = `${user.userId}:${day}`, limit = Math.max(1, Math.min(200, Number(configuration().TUTOR_DAILY_LIMIT || 30) || 30));
  const db = getDb();
  await db.insert(tutorUsage).values({ id, userId: user.userId, day, requests: 0 }).onConflictDoNothing();
  const tokenLimit=Math.max(8000,Math.min(2000000,Number(configuration().TUTOR_DAILY_TOKEN_LIMIT||120000)||120000));
  const rows = await db.update(tutorUsage).set({ requests: sqlIncrement(),reservedTokens:sql`${tutorUsage.reservedTokens}+${reservation}` }).where(and(eq(tutorUsage.id, id), lessThanLimit(limit),sql`${tutorUsage.reservedTokens}+${reservation}<=${tokenLimit}`)).returning({ count: tutorUsage.requests });
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

export async function editableContent(kind: "task" | "topic", id: string) {
  const content = baseContent(), base = (kind === "task" ? content.tasks : content.topics).find(t => t.id === id);
  if (!base) throw new ApiError("Материал не найден.", 404);
  const saved = await getDb().select().from(contentOverrides).where(and(eq(contentOverrides.id, id), eq(contentOverrides.kind, kind))).get();
  if (!saved) return { material: base, status: "published",authorId:'source:ent-math-2026.3',editVersion:'source:ent-math-2026.3' };
  let data: Record<string, unknown>;
  try { data = JSON.parse(saved.data); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); }
  catch { throw new ApiError("Черновик повреждён. Обратитесь к администратору; опубликованный материал доступен ученикам.", 503); }
  return { material: { ...base, ...data, id }, status: saved.status,authorId:saved.updatedBy,editVersion:await contentDigest(saved) };
}

export async function updateContent(user: ChatGPTUser, input: Record<string, unknown>) {
  if (!isAdmin(user)) throw new ApiError("Доступ разрешён только администратору.", 403);
  const id = textValue(input.id, 120), kind = input.kind;
  if (kind !== "topic" && kind !== "task" && kind !== "rules") throw new ApiError("Неизвестный тип материала.");
  const status = input.status;
  if (!["draft", "review", "published"].includes(String(status))) throw new ApiError("Неверный статус.");
  if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) throw new ApiError("Требуется объект материала.");
  const db = getDb(), previous = await db.select().from(contentOverrides).where(eq(contentOverrides.id, id)).get();
  if(input.editVersion!==undefined&&input.editVersion!==(previous?await contentDigest(previous):'source:ent-math-2026.3'))throw new ApiError('Материал изменён другим редактором. Скопируйте свои изменения и загрузите актуальную версию.',409,'CONTENT_CONFLICT');
  const data = input.data as Record<string, unknown>;
  // Expanded bilingual lessons include their existing tasks; the request stays below parseBody's 50k bound.
  if (JSON.stringify(data).length > (kind === 'topic' ? 40000 : 30000)) throw new ApiError("Материал слишком большой.");
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
    if(!validLessonEnrichment(lesson.enrichment))throw new ApiError("Заполните подробное объяснение, полезный приём с ограничениями и жизненный пример с тремя шагами на русском и казахском.");
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
    if(merged.answerFormat!==undefined&&(!["interval","root-set","pair"].includes(String(merged.answerFormat))||merged.type!=="expression"||checkAnswer(merged,answer).status!=="correct"))throw new ApiError("Проверьте формат ответа: interval, root-set или pair, тип expression и проверяемые рациональные границы/элементы.");
    if (Array.isArray(answer) ? !answer.length || answer.some(a => !a.trim()) : !answer.trim()) throw new ApiError("Правильный ответ не может быть пустым.");
    if (["single", "multiple", "matching"].includes(merged.type) && (!Array.isArray(merged.options) || merged.options.length < 2 || merged.options.some(o => typeof o !== "string") || new Set(merged.options).size !== merged.options.length || (Array.isArray(answer) ? answer : [answer]).some(a => !merged.options!.includes(a)))) throw new ApiError("Варианты ответа должны быть уникальными и содержать все правильные ответы.");
    if (["multiple", "matching"].includes(merged.type) && !Array.isArray(answer)) throw new ApiError("Для нескольких ответов и соответствия нужен массив ответов.");
    if (!["multiple", "matching"].includes(merged.type) && Array.isArray(answer)) throw new ApiError("Для этого типа требуется один ответ.");
    if (merged.type === "matching" && (!merged.pairs || merged.pairs.length !== (answer as string[]).length || merged.pairs.some((p, i) => typeof p.left !== "string" || typeof p.right !== "string" || p.right !== (answer as string[])[i]))) throw new ApiError("Сопоставления должны совпадать с ключом ответа.");
    if (merged.type === "number") { try { if (/[xх]/i.test(answer as string)) throw new Error(); calculate(answer as string); } catch { throw new ApiError("Числовой ответ должен быть конечным числом или проверяемым числовым выражением."); } }
  }
  if (kind === "rules" && status === "published") throw new ApiError("Правила экзамена имеют версию в коде. Сохраните проект правил для проверки и обновите движок после сверки официального источника.");
  if(status==='published'&&(kind==='topic'||kind==='task')){
    const material={...(kind==='topic'?base.topics:base.tasks).find(t=>t.id===id)!,...data,id};
    const reviews=await getDb().select().from(editorialReviews).where(eq(editorialReviews.materialId,id));
    const coverage=independentReviewCoverage(reviews,await contentDigest(material),previous?.updatedBy??'source:ent-math-2026.3');
    if(!coverage.complete)throw new ApiError('Нужны три актуальные проверки минимум двух специалистов. Автор материала не может подтвердить собственную математическую проверку. Изменение текста отменяет прежние заключения.');
  }
  const history = previous ? JSON.parse(previous.history) : [];
  history.push({ versionId:crypto.randomUUID(),at: new Date().toISOString(), by: user.email, status, previousStatus:previous?.status, previousData: previous ? JSON.parse(previous.data) : null, note: typeof input.reviewNote === "string" ? input.reviewNote : "" });
  const row = { id, kind: String(kind), status: String(status), data: JSON.stringify(data), history: JSON.stringify(history), updatedBy: user.userId, updatedAt: new Date().toISOString() };
  const changed=previous?await db.update(contentOverrides).set(row).where(and(eq(contentOverrides.id,id),eq(contentOverrides.history,previous.history),eq(contentOverrides.data,previous.data))).returning({id:contentOverrides.id}):await db.insert(contentOverrides).values(row).onConflictDoNothing().returning({id:contentOverrides.id});
  if(!changed.length)throw new ApiError('Материал изменён другим редактором. Загрузите актуальную версию перед сохранением.',409,'CONTENT_CONFLICT');
  return { id, status, history,editVersion:await contentDigest(row) };
}
