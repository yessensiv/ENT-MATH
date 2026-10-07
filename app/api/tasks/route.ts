import {makePracticeVariant,validatePracticeVariant} from '@/lib/practice-variants';
import {taskFingerprint} from '@/lib/engine';
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { publishedContent, response, failure, loadCurrentState, saveState, ApiError, assertStudyAllowed } from "@/lib/server-store";
import { deliverTask, seenTaskIds, type Task } from "@/lib/engine";
import { fillFreshTasks } from "@/lib/fresh-tasks";
import {reviewGenerator} from '@/lib/review-generator';
import{assignErrorRepairs}from'@/lib/error-repair';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, topic = params.get("topic"), reviewId = params.get("reviewId"), errorId=params.get('errorId'), { topics, tasks } = await publishedContent();
    if (!topic || !topics.some(t => t.id === topic)) throw new ApiError("Тема не найдена.", 404);
    const user = await getChatGPTUser();
    if (!user) { if (reviewId||errorId) throw new ApiError("Войдите для повторения.", 401); return response({ tasks: tasks.filter(t => t.topicId === topic).map(t => deliverTask(t)) }); }
    if(errorId&&reviewId)throw new ApiError('Закрепление ошибки и отложенная проверка запускаются отдельно.');
    for (let retry = 0; retry < 3; retry++) {
      const { state } = await loadCurrentState(user); assertStudyAllowed(state);
      if(errorId){
        const error=state.errors.find(e=>e.id===errorId&&e.topicId===topic);
        if(!error)throw new ApiError('Ошибка не найдена.',404);
        const repair=assignErrorRepairs(state,error,tasks,reviewGenerator);
        if(repair.changed){try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}}
        const notice=repair.status==='unmapped'?{ru:'Для этой версии задачи ещё не проверена точная связь с упражнениями закрепления. Можно изучить разбор и повторить урок; случайное упражнение не закроет ошибку.',kk:'Осы тапсырма нұсқасының бекіту жаттығуларымен нақты байланысы әлі тексерілмеген. Талдауды қарап, сабақты қайталауға болады; кездейсоқ жаттығу қатені жаппайды.'}:repair.status==='complete'?{ru:'Эта ошибка уже закреплена. Следующий шаг — повторение спустя время.',kk:'Бұл қате бойынша бекіту аяқталды. Келесі қадам — уақыт өткеннен кейін қайталау.'}:repair.status==='exhausted'?{ru:'Запас новых проверенных условий этого навыка закончился. Сохранённые результаты остаются; редактору нужно расширить банк.',kk:'Осы дағдының жаңа тексерілген тапсырмалары таусылды. Сақталған нәтижелер қалады; редактор банкке жаңа тапсырма қосуы керек.'}:{ru:`Проверим: ${error.repairSkill?.ru}. Два новых самостоятельных ответа закрепят именно эту ошибку. Причину ошибки уточняем по шагам решения.`,kk:`Тексереміз: ${error.repairSkill?.kk}. Екі жаңа өздік жауап осы қатені бекітеді. Қатенің себебін шешу қадамдары арқылы анықтаймыз.`};
        return response({tasks:repair.tasks.map(t=>deliverTask(t,state)),notice,repair:{errorId,status:repair.status,required:2,passed:error.repairPassedTaskIds?.length||0}});
      }
      const review = reviewId ? state.reviews.find(r => r.id === reviewId && r.topicId === topic && !r.completed) : undefined;
      if (reviewId && !review) throw new ApiError("Повторение не найдено.", 404);
      if (review && Date.parse(review.due) > Date.now()) throw new ApiError("Для проверки спустя время дождитесь назначенной даты. Сегодня доступна обычная практика.");
      if(review?.variant&&review.methodFamily){
        const generated=(state.generatedTasks||[]) as Task[],seen=seenTaskIds(state);
        let assigned=generated.find(t=>t.reviewForId===review.id&&!seen.has(t.id)&&t.methodFamily===review.methodFamily&&validatePracticeVariant(t)),changed=false;
        if(!assigned){const fingerprints=new Set([...tasks,...generated,...state.exams.flatMap(e=>e.questions)].map(taskFingerprint));for(let offset=1;offset<=10000;offset++){const candidate=makePracticeVariant(topic,(review.variant.seed+offset*137-1)%10000+1,review.variant.level);if(candidate&&candidate.methodFamily===review.methodFamily&&validatePracticeVariant(candidate)&&!fingerprints.has(taskFingerprint(candidate))){assigned={...candidate,reviewReserved:true,reviewForId:review.id};generated.push(assigned);state.generatedTasks=generated;changed=true;break;}}}
        if(changed){try{await saveState(user,state);}catch(e){if(e instanceof ApiError&&e.code==='STATE_CONFLICT'&&retry<2)continue;throw e;}}
        return response({tasks:assigned?[deliverTask(assigned,state)]:[],review:{id:review.id,topicId:review.topicId,due:review.due,interval:review.interval},notice:assigned?{ru:'Новая задача на тот же способ решения после перерыва. Выполни самостоятельно, чтобы проверить сохранение навыка.',kk:'Үзілістен кейін сол шешу тәсіліне жаңа есеп. Дағдының сақталуын тексеру үшін өз бетінше орында.'}:{ru:'Новые проверенные условия этого способа закончились. Повторение остаётся назначенным.',kk:'Осы тәсілдің жаңа тексерілген есептері таусылды. Қайталау тағайындауы сақталады.'}});
      }
      const desiredLevel = review?.interval === 14 ? 3 : review && review.interval !== 1 ? 2 : 1;
      const supply = fillFreshTasks(state, topic, tasks, reviewGenerator, Boolean(review), desiredLevel, review ? 1 : 3);
      if (supply.changed) { try { await saveState(user, state); } catch (e) { if (e instanceof ApiError && e.code === "STATE_CONFLICT" && retry < 2) continue; throw e; } }
      const all = [...tasks, ...(state.generatedTasks as Task[] || [])].filter(t => t.topicId === topic), seen = seenTaskIds(state);
      const selected = review ? all.filter(t => !t.modelExample && !seen.has(t.id)).sort((a, b) => Math.abs(a.difficulty - desiredLevel) - Math.abs(b.difficulty - desiredLevel) || Number(Boolean(b.reviewReserved)) - Number(Boolean(a.reviewReserved))) : all;
      return response({ tasks: selected.map(t => deliverTask(t, state)), ...(review ? { review: { id: review.id, topicId: review.topicId, due: review.due, interval: review.interval } } : {}), exhausted: supply.exhausted, ...(supply.exhausted ? { notice: { ru: "Новых проверенных задач этого уровня больше нет. Знакомые упражнения доступны для тренировки; для нового подтверждения навыка редактору нужно расширить банк.", kk: "Осы деңгейдегі жаңа тексерілген тапсырмалар таусылды. Таныс жаттығулар қолжетімді; дағдыны қайта растау үшін редактор банкке жаңа тапсырма қосуы керек." } } : {}) });
    }
    throw new ApiError("Данные изменились. Повторите запрос.", 409, "STATE_CONFLICT");
  } catch(e) { return failure(e); }
}
