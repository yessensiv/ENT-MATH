'use client';
import type{DiagnosticEvidence}from'@/lib/diagnostic-evidence';
import{repairSkillTitle}from'@/lib/repair-catalog';
export function DiagnosticReport({evidence,lang,busy,onClarify}:{evidence:DiagnosticEvidence[];lang:'ru'|'kk';busy:boolean;onClarify:(id:string)=>void}){
 const tr=(ru:string,kk:string)=>lang==='ru'?ru:kk;
 if(!evidence.length)return null;
 const status={supported:tr('Способ подтверждён в этой проверке','Тәсіл осы тексеруде расталды'),mixed:tr('Результаты различаются','Нәтижелер әртүрлі'),gap:tr('Нужно разобрать способ','Тәсілді талдау керек'),unknown:tr('Пока недостаточно данных','Әзірге дерек жеткіліксіз'),preliminary:tr('Первый успешный ответ','Алғашқы дұрыс жауап')};
 return <section aria-label={tr('Результаты по навыкам','Дағдылар бойынша нәтижелер')}><h3>{tr('Что показали ответы','Жауаптар нені көрсетті')}</h3><p>{tr('Короткая проверка уточняет один способ решения. Освоение потребует разных самостоятельных задач и повторения спустя время. Причину неверного ответа определим только по шагам.','Қысқа тексеру бір шешу тәсілін нақтылайды. Меңгеру үшін әртүрлі өздік есептер және кейін қайталау қажет. Қате жауаптың себебін тек шешу қадамдары арқылы анықтаймыз.')}</p>{evidence.filter(e=>e.skillId).map(e=><article className="panel" key={e.skillId}><h4>{repairSkillTitle(e.skillId)?.[lang]}</h4><p><strong>{status[e.status]}</strong></p><p>{tr(`Верно: ${e.correct}; пока неверно: ${e.incorrect}; без вывода: ${e.unknown}. Всего: ${e.total}.`,`Дұрыс: ${e.correct}; әзірге қате: ${e.incorrect}; қорытындысыз: ${e.unknown}. Барлығы: ${e.total}.`)}</p>{e.status!=='supported'&&<button className="secondary" disabled={busy} onClick={()=>onClarify(e.skillId!)}>{tr('Уточнить · 3–5 новых задач','Нақтылау · 3–5 жаңа есеп')}</button>}</article>)}</section>;
}
