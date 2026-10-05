export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Some browsers ship incomplete Kazakh month names. Numeric timezone parts
 * plus explicit translations keep the study date readable on those devices. */
export function studyDate(language: 'ru' | 'kk', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qyzylorda', day: 'numeric', month: 'numeric' }).formatToParts(now);
  const day = String(Number(parts.find(p => p.type === 'day')!.value));
  const month = Number(parts.find(p => p.type === 'month')!.value) - 1;
  const names = {
    ru: ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'],
    kk: ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'],
  };
  return `${day} ${names[language][month]}`;
}

/** A network failure must never turn a saved account into demo data. */
export async function requestJson<T extends Record<string, unknown> = Record<string, unknown>>(url: string, body?: Record<string, unknown>, transport: typeof fetch = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await transport(url, {
      credentials: 'same-origin', signal: controller.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    let data: Record<string, unknown>;
    try { data = await response.json(); }
    catch { throw new RequestError('Сервис временно недоступен. Ответ не сохранён — попробуй снова. / Қызмет уақытша қолжетімсіз. Жауап сақталмады — қайта көр.', response.status); }
    if (!response.ok) throw new RequestError(typeof data.error === 'string' ? data.error : 'Не удалось сохранить. Попробуй снова. / Сақталмады. Қайта көр.', response.status);
    return data as T;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Не удалось связаться с сервером. Проверь интернет и повтори. / Сервермен байланыс жоқ. Интернетті тексеріп, қайтала.', 0);
  } finally { clearTimeout(timer); }
}

/** Serial writes keep rapid clicks and language changes in their intended order. */
export function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(work: () => Promise<T>): Promise<T> => {
    const next = tail.then(work, work);
    tail = next.catch(() => undefined);
    return next;
  };
}

export function returnedToChallenge(attempts: { topicId: string; correct: boolean; assisted: boolean }[]) {
  const failures = new Map<string, number>();
  return attempts.some(a => {
    if (a.correct) { if (a.assisted) return false; const earned = (failures.get(a.topicId) ?? 0) >= 2; failures.set(a.topicId, 0); return earned; }
    failures.set(a.topicId, (failures.get(a.topicId) ?? 0) + 1);
    return false;
  });
}

export function examSkillBreakdown(results: { topicId: string; points: number; max: number }[]) {
  const skills = new Map<string, { topicId: string; points: number; max: number; count: number }>();
  for (const result of results) {
    const skill = skills.get(result.topicId) ?? { topicId: result.topicId, points: 0, max: 0, count: 0 };
    skill.points += result.points; skill.max += result.max; skill.count++;
    skills.set(result.topicId, skill);
  }
  return [...skills.values()].sort((a, b) => a.points / a.max - b.points / b.max);
}

export function completeAnswer(task: { type?: string; pairs?: unknown[] }, answer: string | string[] | undefined) {
  if (!task.type) return false;
  if (typeof answer === 'string') return Boolean(answer.trim());
  if (!Array.isArray(answer) || !answer.length || Array.from(answer).some(value => !value?.trim())) return false;
  return task.type !== 'matching' || answer.length === task.pairs?.length;
}
