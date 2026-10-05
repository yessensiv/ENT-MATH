import { publishedContent, response, failure, authenticate, loadState, ApiError, assertStudyAllowed } from "@/lib/server-store";
import { sanitizeTask } from "@/lib/engine";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, topic = params.get("topic"), reviewId = params.get("reviewId"), { tasks } = await publishedContent();
    if (reviewId) {
      const user = await authenticate(), state = await loadState(user); assertStudyAllowed(state);
      const review = state.reviews.find(r => r.id === reviewId && r.topicId === topic && !r.completed);
      if (!review) throw new ApiError("Повторение не найдено.", 404);
      if (Date.parse(review.due) > Date.now()) throw new ApiError("Для проверки спустя время дождитесь назначенной даты. Сегодня доступна обычная практика.");
      const seen = new Set(state.attempts.map(a => a.taskId));
      const desiredLevel = review.interval === 1 ? 1 : review.interval === 14 ? 3 : 2;
      const fresh = tasks.filter(t => t.topicId === topic && !t.modelExample && !seen.has(t.id)).sort((a, b) => Number(Boolean(b.reviewReserved)) - Number(Boolean(a.reviewReserved)) || Math.abs(a.difficulty - desiredLevel) - Math.abs(b.difficulty - desiredLevel));
      return response({ tasks: fresh.map(sanitizeTask), review: { id: review.id, topicId: review.topicId, due: review.due, interval: review.interval } });
    }
    return response({ tasks: tasks.filter(t => t.topicId === topic).map(sanitizeTask) });
  } catch(e) { return failure(e); }
}
