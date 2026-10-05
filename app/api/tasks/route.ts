import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishedContent, response, failure, loadCurrentState, saveState, ApiError, assertStudyAllowed } from "@/lib/server-store";
import { deliverTask, seenTaskIds, type Task } from "@/lib/engine";
import { fillFreshTasks, type ReviewGenerator } from "@/lib/fresh-tasks";
import * as curriculum from "@/lib/content";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, topic = params.get("topic"), reviewId = params.get("reviewId"), { topics, tasks } = await publishedContent();
    if (!topic || !topics.some(t => t.id === topic)) throw new ApiError("Тема не найдена.", 404);
    const user = await getChatGPTUser();
    if (!user) { if (reviewId) throw new ApiError("Войдите для повторения.", 401); return response({ tasks: tasks.filter(t => t.topicId === topic).map(t => deliverTask(t)) }); }
    for (let retry = 0; retry < 3; retry++) {
      const { state } = await loadCurrentState(user); assertStudyAllowed(state);
      const review = reviewId ? state.reviews.find(r => r.id === reviewId && r.topicId === topic && !r.completed) : undefined;
      if (reviewId && !review) throw new ApiError("Повторение не найдено.", 404);
      if (review && Date.parse(review.due) > Date.now()) throw new ApiError("Для проверки спустя время дождитесь назначенной даты. Сегодня доступна обычная практика.");
      const desiredLevel = review?.interval === 14 ? 3 : review && review.interval !== 1 ? 2 : 1;
      const supply = fillFreshTasks(state, topic, tasks, curriculum as unknown as ReviewGenerator, Boolean(review), desiredLevel, review ? 1 : 3);
      if (supply.changed) { try { await saveState(user, state); } catch (e) { if (e instanceof ApiError && e.code === "STATE_CONFLICT" && retry < 2) continue; throw e; } }
      const all = [...tasks, ...(state.generatedTasks as Task[] || [])].filter(t => t.topicId === topic), seen = seenTaskIds(state);
      const selected = review ? all.filter(t => !t.modelExample && !seen.has(t.id)).sort((a, b) => Math.abs(a.difficulty - desiredLevel) - Math.abs(b.difficulty - desiredLevel) || Number(Boolean(b.reviewReserved)) - Number(Boolean(a.reviewReserved))) : all;
      return response({ tasks: selected.map(t => deliverTask(t, state)), ...(review ? { review: { id: review.id, topicId: review.topicId, due: review.due, interval: review.interval } } : {}), exhausted: supply.exhausted, ...(supply.exhausted ? { notice: { ru: "Новых проверенных задач этого уровня больше нет. Знакомые упражнения доступны для тренировки; для нового подтверждения навыка редактору нужно расширить банк.", kk: "Осы деңгейдегі жаңа тексерілген тапсырмалар таусылды. Таныс жаттығулар қолжетімді; дағдыны қайта растау үшін редактор банкке жаңа тапсырма қосуы керек." } } : {}) });
    }
    throw new ApiError("Данные изменились. Повторите запрос.", 409, "STATE_CONFLICT");
  } catch(e) { return failure(e); }
}
