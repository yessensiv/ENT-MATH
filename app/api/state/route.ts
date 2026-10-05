import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authenticate, loadCurrentState, saveState, clientState, publishedContent, response, failure, parseBody, textValue, answerValue, trackValue, ApiError, assertStudyAllowed, updatePlan, recordReport, updateContent } from "@/lib/server-store";
import { diagnosticTasks, grade, recordAttempt, makeExam, finishExam, sanitizeExam, recoverStreak, streakInfo, seenTaskIds, answerFitsTask, type Profile, type Task } from "@/lib/engine";
import { applyExamSnapshot } from "@/lib/exam-snapshot";
import { snapshotTime, beginDraftSnapshot, finishDraftSnapshot } from "@/lib/draft-snapshot";

export async function GET() {
  try {
    const user = await getChatGPTUser(); if (!user) return response({ user: null, profile: null, error: "Войдите через ChatGPT для сохранения результатов.", demo: false }, 401);
    const { state, expired } = await loadCurrentState(user), { topics } = await publishedContent();
    updatePlan(state, topics);
    return response({ ...clientState(user, state), timedOut: Boolean(expired) });
  } catch (e) { return failure(e); }
}

export async function POST(request: Request) {
  try {
    const user = await authenticate(), input = await parseBody(request), content = await publishedContent();
    for (let retry = 0; retry < 3; retry++) {
    const { state, expired } = await loadCurrentState(user), { topics } = content, tasks = [...content.tasks, ...(Array.isArray(state.generatedTasks) ? state.generatedTasks as Task[] : [])];
    let extra: Record<string, unknown> = {};
    if (["exam-answer", "exam-finish"].includes(String(input.action))) {
      const finished = state.exams.find(e => e.id === input.examId);
      if (finished) return response({ ...clientState(user, state), result: finished, alreadyFinished: true, timedOut: Boolean(expired) || finished.finishReason === "time" });
    }
    switch (input.action) {
      case "save-draft": {
        assertStudyAllowed(state);
        if (input.kind !== "practice" && input.kind !== "diagnostic") throw new ApiError("Выберите тип незавершённого занятия.");
        let time: number; try { time = snapshotTime(input.updatedAt); } catch(e) { throw new ApiError(e instanceof Error ? e.message : "Неверное время сохранения."); }
        if (!beginDraftSnapshot(state, input.kind, time)) return response({ ...clientState(user, state), staleSnapshot: true });
        if (input.clear === true) { state[input.kind === "practice" ? "practiceDraft" : "diagnosticDraft"] = null; break; }
        if (input.kind === "practice") {
          const taskId = textValue(input.taskId, 120), task = tasks.find(t => t.id === taskId); if (!task) throw new ApiError("Задание не найдено.", 404);
          if (input.assisted !== undefined && typeof input.assisted !== "boolean") throw new ApiError("Некорректный статус подсказок.");
          const reviewId = input.reviewId === undefined ? undefined : textValue(input.reviewId, 100);
          if (reviewId && !state.reviews.some(r => r.id === reviewId && r.topicId === task.topicId && !r.completed)) throw new ApiError("Повторение не найдено.", 404);
          state.practiceDraft = { topicId: task.topicId, taskId, answer: answerValue(input.answer ?? ""), steps: textValue(input.steps ?? "", 4000), assisted: Boolean(input.assisted), ...(reviewId ? { reviewId } : {}), updatedAt: new Date().toISOString() };
        } else {
          const track = trackValue(input.track || state.profile?.track), expected = diagnosticTasks(track, topics, content.tasks), allowed = new Set(expected.map(t => t.id));
          if (!Array.isArray(input.answers) || input.answers.length > expected.length) throw new ApiError("Некорректные ответы диагностики.");
          const answers = input.answers.map(a => { if (!a || typeof a !== "object" || Array.isArray(a)) throw new ApiError("Некорректный ответ диагностики."); const item = a as Record<string, unknown>, taskId = textValue(item.taskId, 120); if (!allowed.has(taskId)) throw new ApiError("Вопрос диагностики не найден."); return { taskId, answer: answerValue(item.answer) }; });
          if (new Set(answers.map(a => a.taskId)).size !== answers.length) throw new ApiError("Вопросы диагностики повторяются.");
          const taskId = input.taskId === undefined ? undefined : textValue(input.taskId, 120);
          if (taskId && (!allowed.has(taskId) || answers.some(a => a.taskId === taskId))) throw new ApiError("Текущий вопрос должен быть новым вопросом этой диагностики.");
          if (input.answer !== undefined && !taskId) throw new ApiError("Укажите текущий вопрос диагностики.");
          state.diagnosticDraft = { track, answers, ...(taskId ? { taskId, answer: answerValue(input.answer ?? "") } : {}), updatedAt: new Date().toISOString() };
        }
        break;
      }
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
        const name = textValue(p.name ?? state.profile?.name ?? user.displayName, 80).trim(), grade = String(p.grade ?? state.profile?.grade ?? "11");
        if (!["9", "10", "11", "graduate"].includes(grade)) throw new ApiError("Укажите 9–11 класс или выпускник.");
        const language = p.language ?? state.profile?.language ?? "ru"; if (language !== "ru" && language !== "kk") throw new ApiError("Выберите русский или казахский язык.");
        const track = trackValue(p.track ?? state.profile?.track ?? "profile"), targets = { ...(state.profile?.targets || {}) };
        if (state.profile) targets[state.profile.track] = state.profile.target;
        const dailyMinutes = Number(p.dailyMinutes ?? state.profile?.dailyMinutes ?? 20), target = Number(p.target ?? targets[track] ?? (track === "literacy" ? 8 : 40)), examDate = String(p.examDate ?? state.profile?.examDate ?? "2027-06-01");
        if (!name || !Number.isFinite(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 240 || !Number.isInteger(target) || target < 1 || target > (track === "literacy" ? 10 : 50) || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !Number.isFinite(new Date(examDate).getTime()) || new Date(examDate).toISOString().slice(0, 10) !== examDate) throw new ApiError("Проверьте цель, дату и время занятий.");
        targets[track] = target;
        state.profile = { name, grade, track, examDate, target, targets, dailyMinutes, language } as Profile;
        break;
      }
      case "diagnostic": {
        assertStudyAllowed(state);
        let submittedAt: number; try { submittedAt = snapshotTime(input.draftUpdatedAt); } catch(e) { throw new ApiError(e instanceof Error ? e.message : "Неверное время сохранения."); }
        const track = trackValue(input.track || state.profile?.track), expected = diagnosticTasks(track, topics, tasks);
        if (!Array.isArray(input.answers) || input.answers.length !== expected.length) throw new ApiError("Завершите все вопросы диагностики.");
        const byId = new Map((input.answers as Record<string, unknown>[]).map(a => { if (!a || typeof a !== "object" || Array.isArray(a)) throw new ApiError("Некорректный ответ диагностики."); return [textValue(a.taskId, 120), answerValue(a.answer)] as const; }));
        if (byId.size !== expected.length || expected.some(t => !byId.has(t.id))) throw new ApiError("Вопросы диагностики не совпадают.");
        const strengths: string[] = [], gaps: string[] = []; let score = 0;
        for (const task of expected) {
          const correct = grade(task, byId.get(task.id)!); score += Number(correct);
          (correct ? strengths : gaps).push(task.topicId);
          const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] }; p.attempts++; p.correct += Number(correct);
        }
        const result = { id: crypto.randomUUID(), track, at: new Date().toISOString(), score, total: expected.length, strengths, gaps, taskIds: expected.map(t => t.id) };
        finishDraftSnapshot(state, "diagnostic", submittedAt);
        state.diagnostics.push(result); state.planReason = { ru: "Первая неделя составлена по диагностике. Вернёмся к нужным основам и проверим их в новых заданиях.", kk: "Алғашқы апта диагностика бойынша құрылды. Қажетті негізге оралып, жаңа тапсырмаларда тексереміз." }; extra = { diagnostic: result }; break;
      }
      case "attempt": case "review": {
        assertStudyAllowed(state); const task = tasks.find(t => t.id === input.taskId); if (!task) throw new ApiError("Задание не найдено.", 404);
        let submittedAt: number; try { submittedAt = snapshotTime(input.draftUpdatedAt); } catch(e) { throw new ApiError(e instanceof Error ? e.message : "Неверное время сохранения."); }
        const topic = topics.find(t => t.id === task.topicId); if (!topic) throw new ApiError("Тема не найдена.", 404);
        if (task.reviewReserved && !input.reviewId) throw new ApiError("Эта новая задача сохранена для повторения после перерыва. Для обычной практики выберите другую задачу.");
        if (input.reviewId) {
          const review = state.reviews.find(r => r.id === input.reviewId && r.topicId === task.topicId && !r.completed);
          if (!review || new Date(review.due).getTime() > Date.now() || seenTaskIds(state).has(task.id)) throw new ApiError("Для повторения выберите новую задачу после назначенной даты.");
        }
        const serverAssisted = Array.isArray(state.assistedTaskIds) && state.assistedTaskIds.includes(task.id);
        const answer = answerValue(input.answer); if (!answerFitsTask(task, answer)) throw new ApiError("Формат ответа не соответствует заданию.");
        const feedback = recordAttempt(state, task, topic, { answer, steps: input.steps === undefined ? "" : textValue(input.steps, 4000), assisted: Boolean(input.assisted) || serverAssisted, reviewId: input.reviewId ? textValue(input.reviewId, 100) : undefined }, tasks);
        finishDraftSnapshot(state, "practice", submittedAt);
        state.planReason = feedback.correct ? state.planReason : { ru: "Добавили закрепление этой темы, потому что в последней задаче возникли трудности.", kk: "Соңғы тапсырмада қиындық болғандықтан осы тақырыпты бекіту қостық." };
        extra = { feedback }; break;
      }
      case "resume": {
        const topicId = textValue(input.topicId, 120), stage = Number(input.stage || 0); if (!topics.some(t => t.id === topicId) || !Number.isInteger(stage) || stage < 0 || stage > 10) throw new ApiError("Неверный этап урока."); state.lessonResume = { topicId, stage }; break;
      }
      case "report": {
        const taskId = textValue(input.taskId || input.topicId, 120), message = textValue(input.message, 2000); if (!message.trim() || (!tasks.some(t => t.id === taskId) && !topics.some(t => t.id === taskId))) throw new ApiError("Выберите материал и опишите ошибку."); await recordReport(user, taskId, message); return response({ ...clientState(user, state), report: { status: "review", message: "Сообщение сохранено для редактора." } });
      }
      case "admin-update": { return response({ ...clientState(user, state), contentUpdate: await updateContent(user, input) }); }
      case "exam-start": {
        if (state.activeExam) { extra = { activeExam: sanitizeExam(state.activeExam) }; break; }
        const track = trackValue(input.track || state.profile?.track), variant = Number(input.variant ?? 1);
        if (track === "base" || !Number.isInteger(variant) || variant < 1 || variant > 5) throw new ApiError("Выберите экзаменационное направление и вариант 1–5.");
        state.activeExam = makeExam(track, variant, topics, content.tasks); break;
      }
      case "exam-answer": {
        const exam = state.activeExam; if (!exam || exam.id !== input.examId) throw new ApiError("Активный экзамен не найден.", 404);
        if (Date.now() >= new Date(exam.startedAt).getTime() + exam.durationMinutes * 60000) { extra = { result: finishExam(exam, state), timedOut: true }; break; }
        const index = Number(input.index); if (!Number.isInteger(index) || index < 0 || index >= exam.questions.length) throw new ApiError("Неверный вопрос.");
        const answer = input.answer === undefined ? undefined : answerValue(input.answer); if (answer !== undefined && !answerFitsTask(exam.questions[index], answer, true)) throw new ApiError("Выберите варианты ответа этого вопроса в допустимом формате.");
        if (input.flagged !== undefined && typeof input.flagged !== "boolean") throw new ApiError("Неверная отметка вопроса.");
        if (input.updatedAt !== undefined && typeof input.updatedAt !== "number") throw new ApiError("Неверное время сохранения ответа.");
        const nextIndex = input.nextIndex === undefined ? undefined : Number(input.nextIndex);
        let accepted: boolean;
        try { accepted = applyExamSnapshot(exam, { index, answer, flagged: input.flagged as boolean | undefined, nextIndex, updatedAt: input.updatedAt as number | undefined }); } catch (e) { throw new ApiError(e instanceof Error ? e.message : "Неверный ответ."); }
        if (!accepted) return response({ ...clientState(user, state), staleSnapshot: true });
        break;
      }
      case "exam-finish": {
        const exam = state.activeExam; if (!exam || exam.id !== input.examId) throw new ApiError("Активный экзамен не найден.", 404);
        extra = { result: finishExam(exam, state) }; break;
      }
      default: throw new ApiError("Неизвестное действие.");
    }
    updatePlan(state, topics);
    try { await saveState(user, state); return response({ ...clientState(user, state), ...extra }); }
    catch (e) { if (!(e instanceof ApiError && e.code === "STATE_CONFLICT") || retry === 2) throw e; }
    }
    throw new ApiError("Обновите страницу и повторите действие.", 409, "STATE_CONFLICT");
  } catch (e) { return failure(e); }
}
