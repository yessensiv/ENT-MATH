import { getChatGPTUser } from "@/app/chatgpt-auth";
import { authenticate, loadCurrentState, saveState, clientState, publishedContent, response, failure, parseBody, textValue, answerValue, trackValue, ApiError, assertStudyAllowed, updatePlan, recordReport, updateContent } from "@/lib/server-store";
import { diagnosticTasks, checkAnswer, recordAttempt, finishExam, sanitizeExam, recoverStreak, streakInfo, seenTaskIds, answerFitsTask, type Profile, type Task } from "@/lib/engine";
import { applyExamSnapshot } from "@/lib/exam-snapshot";
import { snapshotTime, beginDraftSnapshot, finishDraftSnapshot } from "@/lib/draft-snapshot";
import{submissionIdentity,submissionPayload}from'@/lib/submission';
import{validateLessonWork,saveLessonWork,type LessonWork}from'@/lib/lesson-work';
import{diagnosticEvidence}from'@/lib/diagnostic-evidence';
import{assignedDiagnostic}from'@/lib/diagnostic-session';
import{reservedExam}from'@/lib/exam-bank';

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
    let submissionId:string|undefined;
    if(input.action==='attempt'||input.action==='review'||input.action==='diagnostic'){try{submissionId=await submissionIdentity(input);}catch{throw new ApiError('Неверный идентификатор отправки.',400,'INVALID_SUBMISSION_ID');}}
    for (let retry = 0; retry < 3; retry++) {
    const { state, expired } = await loadCurrentState(user), { topics } = content, tasks = [...content.tasks, ...(Array.isArray(state.generatedTasks) ? state.generatedTasks as Task[] : [])];
    let extra: Record<string, unknown> = {};
    const submissionRequests=(state.submissionRequests||{}) as Record<string,{payload:string;feedback?:unknown;diagnostic?:unknown}>;
    if(submissionId&&submissionRequests[submissionId]){const saved=submissionRequests[submissionId];if(saved.payload!==submissionPayload(input))throw new ApiError('Идентификатор уже использован для другого ответа. Сохраните ответ как новую попытку.',409,'SUBMISSION_CONFLICT');return response({...clientState(user,state),...(input.action==='diagnostic'?{diagnostic:saved.diagnostic}:{feedback:saved.feedback}),replayed:true});}
    if (["exam-answer", "exam-finish"].includes(String(input.action))) {
      const finished = state.exams.find(e => e.id === input.examId);
      if (finished) return response({ ...clientState(user, state), result: finished, alreadyFinished: true, timedOut: Boolean(expired) || finished.finishReason === "time" });
    }
    switch (input.action) {
      case 'save-lesson': {
        assertStudyAllowed(state);const topicId=textValue(input.topicId,120);if(!topics.some(t=>t.id===topicId))throw new ApiError('Урок не найден.',404);
        let draft:LessonWork;try{snapshotTime(input.updatedAt);draft=validateLessonWork(input);}catch{throw new ApiError('Проверьте сохранение урока.',400,'INVALID_LESSON_WORK');}
        const work=(state.lessonWork||{}) as Record<string,LessonWork>;
        if(!saveLessonWork(work,topicId,draft))return response({...clientState(user,state),staleSnapshot:true});
        state.lessonWork=work;state.lessonResume={topicId,stage:draft.stage};break;
      }
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
          state.practiceDraft = { topicId: task.topicId, taskId, ...(typeof task.repairForErrorId==='string'?{errorId:task.repairForErrorId}:{}), answer: answerValue(input.answer ?? ""), steps: textValue(input.steps ?? "", 4000), assisted: Boolean(input.assisted), ...(reviewId ? { reviewId } : {}), updatedAt: new Date().toISOString() };
        } else {
          const track = trackValue(input.track || state.profile?.track), expected = assignedDiagnostic(state,track,topics,tasks)??diagnosticTasks(track, topics, content.tasks, state.profile?.learningMode === "school" ? state.profile.grade : undefined, state.profile?.schoolPathway), allowed = new Set(expected.map(t => t.id));
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
        if (!["5", "6", "7", "8", "9", "10", "11", "graduate"].includes(grade)) throw new ApiError("Укажите 5–11 класс или выпускник.");
        const learningMode = p.learningMode ?? state.profile?.learningMode ?? (Number(grade) < 9 ? "school" : "ent");
        if (learningMode !== "school" && learningMode !== "ent" || learningMode === "school" && grade === "graduate") throw new ApiError("Для школьной программы выберите класс 5–11.");
        const schoolPathway=p.schoolPathway??state.profile?.schoolPathway??'natural-math';if(schoolPathway!=='natural-math'&&schoolPathway!=='humanitarian')throw new ApiError('Выберите ЕМН или ОГН.');
        const language = p.language ?? state.profile?.language ?? "ru"; if (language !== "ru" && language !== "kk") throw new ApiError("Выберите русский или казахский язык.");
        const track = trackValue(p.track ?? state.profile?.track ?? "profile"), targets = { ...(state.profile?.targets || {}) };
        if (state.profile) targets[state.profile.track] = state.profile.target;
        const dailyMinutes = Number(p.dailyMinutes ?? state.profile?.dailyMinutes ?? 20), target = Number(p.target ?? targets[track] ?? (track === "literacy" ? 8 : 40)), examDate = String(p.examDate ?? state.profile?.examDate ?? "2027-06-01");
        if (!name || !Number.isFinite(dailyMinutes) || dailyMinutes < 5 || dailyMinutes > 240 || !Number.isInteger(target) || target < 1 || target > (track === "literacy" ? 10 : 50) || !/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !Number.isFinite(new Date(examDate).getTime()) || new Date(examDate).toISOString().slice(0, 10) !== examDate) throw new ApiError("Проверьте цель, дату и время занятий.");
        targets[track] = target;
        if ((p.learningMode !== undefined && learningMode !== (state.profile?.learningMode ?? "ent")) || grade !== state.profile?.grade || schoolPathway!==state.profile?.schoolPathway || track!==state.profile?.track) {
          state.diagnosticSession=null;
          const previous = (state.draftUpdatedAt as {diagnostic?:number}|undefined)?.diagnostic ?? 0;
          finishDraftSnapshot(state, "diagnostic", Math.max(Date.now(), previous));
        }
        state.profile = { name, grade, learningMode, schoolPathway, track, examDate, target, targets, dailyMinutes, language } as Profile;
        break;
      }
      case "diagnostic": {
        assertStudyAllowed(state);
        let submittedAt: number; try { submittedAt = snapshotTime(input.draftUpdatedAt); } catch(e) { throw new ApiError(e instanceof Error ? e.message : "Неверное время сохранения."); }
        const track = trackValue(input.track || state.profile?.track), expected = assignedDiagnostic(state,track,topics,tasks)??diagnosticTasks(track, topics, tasks, state.profile?.learningMode === "school" ? state.profile.grade : undefined, state.profile?.schoolPathway);
        if (!Array.isArray(input.answers) || input.answers.length !== expected.length) throw new ApiError("Завершите все вопросы диагностики.");
        const byId = new Map((input.answers as Record<string, unknown>[]).map(a => { if (!a || typeof a !== "object" || Array.isArray(a)) throw new ApiError("Некорректный ответ диагностики."); return [textValue(a.taskId, 120), answerValue(a.answer)] as const; }));
        if (byId.size !== expected.length || expected.some(t => !byId.has(t.id))) throw new ApiError("Вопросы диагностики не совпадают.");
        const {score,strengths,gaps,unknowns,evidence}=diagnosticEvidence(expected,byId);
        for (const task of expected) {
          const answer=byId.get(task.id)!;if((Array.isArray(answer)?answer.length===0:!answer.trim())){continue;}
          const checked=checkAnswer(task,answer);if(checked.status==='review'){continue;}const correct = checked.status==='correct';
          const p = state.progress[task.topicId] ||= { attempts: 0, correct: 0, independent: 0, mastered: false, independentTaskIds: [] }; p.attempts++; p.correct += Number(correct);
        }
        const result = { id: crypto.randomUUID(), unknowns,evidence,clarificationSkillId:(state.diagnosticSession as {skillId?:string})?.skillId,evidenceScope:'tested-method',version:(state.diagnosticSession as {version?:number})?.version??1,schoolGrade: state.profile?.learningMode === "school" ? state.profile.grade : undefined, schoolPathway:state.profile?.learningMode==='school'&&Number(state.profile.grade)>=10?state.profile.schoolPathway:undefined, track, at: new Date().toISOString(), score, total: expected.length, strengths, gaps, taskIds: expected.map(t => t.id) };
        state.diagnosticSession=null;
        if(submissionId){submissionRequests[submissionId]={payload:submissionPayload(input),diagnostic:result};state.submissionRequests=submissionRequests;}
        finishDraftSnapshot(state, "diagnostic", submittedAt);
        state.diagnostics.push(result); state.planReason = { ru: "Первая неделя составлена по диагностике. Вернёмся к нужным основам и проверим их в новых заданиях.", kk: "Алғашқы апта диагностика бойынша құрылды. Қажетті негізге оралып, жаңа тапсырмаларда тексереміз." }; extra = { diagnostic: result }; break;
      }
      case "attempt": case "review": {
        assertStudyAllowed(state); const task = tasks.find(t => t.id === input.taskId); if (!task) throw new ApiError("Задание не найдено.", 404);
        if((state.diagnosticSession as {taskIds?:string[]}|undefined)?.taskIds?.includes(task.id))throw new ApiError('Завершите диагностику, чтобы открыть проверку этого вопроса.',409,'DIAGNOSTIC_ACTIVE');
        let submittedAt: number; try { submittedAt = snapshotTime(input.draftUpdatedAt); } catch(e) { throw new ApiError(e instanceof Error ? e.message : "Неверное время сохранения."); }
        const topic = topics.find(t => t.id === task.topicId); if (!topic) throw new ApiError("Тема не найдена.", 404);
        const assignedRepair=typeof task.repairForErrorId==='string'&&state.errors.some(e=>e.id===task.repairForErrorId&&!e.resolved&&e.exerciseIds.includes(task.id));
        if (task.reviewReserved && !input.reviewId && !assignedRepair) throw new ApiError("Эта новая задача сохранена для повторения после перерыва. Для обычной практики выберите другую задачу.");
        if (input.reviewId) {
          const review = state.reviews.find(r => r.id === input.reviewId && r.topicId === task.topicId && !r.completed);
          if (!review || new Date(review.due).getTime() > Date.now() || seenTaskIds(state).has(task.id)) throw new ApiError("Для повторения выберите новую задачу после назначенной даты.");
        }
        const serverAssisted = Array.isArray(state.assistedTaskIds) && state.assistedTaskIds.includes(task.id);
        const answer = answerValue(input.answer); if (!answerFitsTask(task, answer)) throw new ApiError("Формат ответа не соответствует заданию.");
        const feedback = recordAttempt(state, task, topic, { answer, steps: input.steps === undefined ? "" : textValue(input.steps, 4000), assisted: Boolean(input.assisted) || serverAssisted, reviewId: input.reviewId ? textValue(input.reviewId, 100) : undefined }, tasks);
        finishDraftSnapshot(state, "practice", submittedAt);
        state.planReason = feedback.correct || feedback.status==='review' ? state.planReason : { ru: "Добавили закрепление этой темы, потому что в последней задаче возникли трудности.", kk: "Соңғы тапсырмада қиындық болғандықтан осы тақырыпты бекіту қостық." };
        if(submissionId){submissionRequests[submissionId]={payload:submissionPayload(input),feedback};state.submissionRequests=submissionRequests;}
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
        if (track === "base" || !Number.isInteger(variant) || variant < 1 || variant > 10) throw new ApiError("Выберите экзаменационное направление и вариант 1–10.");
        state.activeExam = reservedExam(track, variant, state); break;
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
