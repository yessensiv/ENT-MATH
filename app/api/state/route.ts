import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authenticate, loadState, saveState, clientState, publishedContent, response, failure, parseBody, textValue, answerValue, trackValue, ApiError, assertStudyAllowed, updatePlan, recordReport, updateContent } from "@/lib/server-store";
import { diagnosticTasks, grade, recordAttempt, makeExam, finishExam, sanitizeExam, recoverStreak, streakInfo, type Profile } from "@/lib/engine";

export async function GET() {
  try {
    const user = await getChatGPTUser(); if (!user) return response({ user: null, profile: null, error: "Войдите через ChatGPT для сохранения результатов.", demo: false }, 401);
    const state = await loadState(user), { topics } = await publishedContent();
    const expired = state.activeExam && Date.now() > new Date(state.activeExam.startedAt).getTime() + state.activeExam.durationMinutes * 60000;
    if (expired && state.activeExam) finishExam(state.activeExam, state);
    updatePlan(state, topics); if (expired) await saveState(user, state);
    return response({ ...clientState(user, state), timedOut: Boolean(expired) });
  } catch (e) { return failure(e); }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(), input = await parseBody(request), state = await loadState(user), { topics, tasks } = await publishedContent();
    let extra: Record<string, unknown> = {};
    switch (input.action) {
      case "preferences": {
        const preferences = input.preferences && typeof input.preferences === "object" ? input.preferences as Record<string, unknown> : input;
        if (typeof preferences.leaderboard !== "boolean") throw new ApiError("Выберите, участвовать ли в добровольном рейтинге.");
        state.preferences = { leaderboard: preferences.leaderboard }; break;
      }
      case "streak-recover": {
        if (!streakInfo(state).recoveryAvailable) throw new ApiError("После возвращения к практике можно восстановить один вчерашний пропуск раз в календарную неделю. Результаты обучения при этом не меняются.");
        extra = { streak: recoverStreak(state) }; break;
      }
      case "onboard": case "profile": {
        const p = (input.profile && typeof input.profile === "object" ? input.profile : input) as Record<string, unknown>;
        const name = textValue(p.name || state.profile?.name || user.displayName, 80).trim(), grade = String(p.grade || state.profile?.grade || "11");
        if (!["9", "10", "11", "graduate"].includes(grade)) throw new ApiError("Укажите 9–11 класс или выпускник.");
        const language = p.language || state.profile?.language || "ru"; if (language !== "ru" && language !== "kk") throw new ApiError("Выберите русский или казахский язык.");
        const track = trackValue(p.track || state.profile?.track || "profile");
        const dailyMinutes = Number(p.dailyMinutes || state.profile?.dailyMinutes || 20), rawTarget = Number(p.target || state.profile?.target || (track === "literacy" ? 8 : 40)), target = track === "literacy" ? Math.min(rawTarget, 10) : rawTarget, examDate = String(p.examDate || state.profile?.examDate || "2027-06-01");
        if (!name || !Number.isFinite(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 240 || !Number.isFinite(target) || target < 1 || target > 50 || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !Number.isFinite(new Date(examDate).getTime()) || new Date(examDate).toISOString().slice(0, 10) !== examDate) throw new ApiError("Проверьте цель, дату и время занятий.");
        state.profile = { name, grade, track, examDate, target, dailyMinutes, language } as Profile;
        break;
      }
      case "diagnostic": {
        assertStudyAllowed(state);
        const track = trackValue(input.track || state.profile?.track), expected = diagnosticTasks(track, topics, tasks);
        if (!Array.isArray(input.answers) || input.answers.length !== expected.length) throw new ApiError("Завершите все вопросы диагностики.");
        const byId = new Map((input.answers as Record<string, unknown>[]).map(a => [textValue(a.taskId, 120), answerValue(a.answer)]));
        if (byId.size !== expected.length || expected.some(t => !byId.has(t.id))) throw new ApiError("Вопросы диагностики не совпадают.");
        const strengths: string[] = [], gaps: string[] = []; let score = 0;
        for (const task of expected) {
          const correct = grade(task, byId.get(task.id)!); score += Number(correct);
          (correct ? strengths : gaps).push(task.topicId);
          const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] }; p.attempts++; p.correct += Number(correct);
        }
        const result = { id: crypto.randomUUID(), track, at: new Date().toISOString(), score, total: expected.length, strengths, gaps };
        state.diagnostics.push(result); state.planReason = { ru: "Первая неделя составлена по диагностике. Вернёмся к нужным основам и проверим их в новых заданиях.", kk: "Алғашқы апта диагностика бойынша құрылды. Қажетті негізге оралып, жаңа тапсырмаларда тексереміз." }; extra = { diagnostic: result }; break;
      }
      case "attempt": case "review": {
        assertStudyAllowed(state); const task = tasks.find(t => t.id === input.taskId); if (!task) throw new ApiError("Задание не найдено.", 404);
        const topic = topics.find(t => t.id === task.topicId); if (!topic) throw new ApiError("Тема не найдена.", 404);
        if (task.reviewReserved && !input.reviewId) throw new ApiError("Эта новая задача сохранена для повторения после перерыва. Для обычной практики выберите другую задачу.");
        if (input.reviewId) {
          const review = state.reviews.find(r => r.id === input.reviewId && r.topicId === task.topicId && !r.completed);
          if (!review || new Date(review.due).getTime() > Date.now() || state.attempts.some(a => a.taskId === task.id)) throw new ApiError("Для повторения выберите новую задачу после назначенной даты.");
        }
        const serverAssisted = Array.isArray(state.assistedTaskIds) && state.assistedTaskIds.includes(task.id);
        const feedback = recordAttempt(state, task, topic, { answer: answerValue(input.answer), steps: input.steps ? textValue(input.steps, 4000) : "", assisted: Boolean(input.assisted) || serverAssisted, reviewId: input.reviewId ? textValue(input.reviewId, 100) : undefined }, tasks);
        state.planReason = feedback.correct ? state.planReason : { ru: "Добавили закрепление этой темы, потому что в последней задаче возникли трудности.", kk: "Соңғы тапсырмада қиындық болғандықтан осы тақырыпты бекіту қостық." };
        extra = { feedback }; break;
      }
      case "resume": {
        const topicId = textValue(input.topicId, 120), stage = Number(input.stage || 0); if (!topics.some(t => t.id === topicId) || !Number.isInteger(stage) || stage < 0 || stage > 10) throw new ApiError("Неверный этап урока."); state.lessonResume = { topicId, stage }; break;
      }
      case "report": {
        const taskId = textValue(input.taskId || input.topicId, 120), message = textValue(input.message, 2000); if (!message.trim() || (!tasks.some(t => t.id === taskId) && !topics.some(t => t.id === taskId))) throw new ApiError("Выберите материал и опишите ошибку."); await recordReport(user, taskId, message); extra = { report: { status: "review", message: "Сообщение сохранено для редактора." } }; break;
      }
      case "admin-update": { extra = { contentUpdate: await updateContent(user, input) }; break; }
      case "exam-start": {
        if (state.activeExam) { extra = { activeExam: sanitizeExam(state.activeExam) }; break; }
        state.activeExam = makeExam(trackValue(input.track || state.profile?.track), Number(input.variant || 1), topics, tasks); break;
      }
      case "exam-answer": {
        const exam = state.activeExam; if (!exam || exam.id !== input.examId) throw new ApiError("Активный экзамен не найден.", 404);
        if (Date.now() > new Date(exam.startedAt).getTime() + exam.durationMinutes * 60000) { extra = { result: finishExam(exam, state), timedOut: true }; break; }
        const index = Number(input.index); if (!Number.isInteger(index) || index < 0 || index >= exam.questions.length) throw new ApiError("Неверный вопрос.");
        if (input.answer !== undefined) exam.answers[String(index)] = answerValue(input.answer);
        if (typeof input.flagged === "boolean") exam.flagged = input.flagged ? [...new Set([...exam.flagged, index])] : exam.flagged.filter(i => i !== index); break;
      }
      case "exam-finish": {
        const exam = state.activeExam; if (!exam || exam.id !== input.examId) throw new ApiError("Активный экзамен не найден.", 404);
        extra = { result: finishExam(exam, state) }; break;
      }
      default: throw new ApiError("Неизвестное действие.");
    }
    updatePlan(state, topics); await saveState(user, state); return response({ ...clientState(user, state), ...extra });
  } catch (e) { return failure(e); }
}
