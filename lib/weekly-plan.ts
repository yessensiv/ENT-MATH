import type{PlanItem}from'./engine.ts';

/** Seven prospective days, rebuilt from today's priorities. Missed sessions
 * are never appended as debt. Durations are estimates, not earned progress. */
export function fitWeeklyBudget(priorities:PlanItem[],requestedMinutes:number):PlanItem[]{
 if(!priorities.length)return[];
 const daily=Math.max(5,Math.min(240,Math.round(Number(requestedMinutes)||20))),primary:PlanItem[]=[],practice:PlanItem[]=[];
 for(let day=1;day<=7;day++){
  const original=priorities[day-1],anchor=original||priorities[(day-1)%priorities.length];
  const main:PlanItem=original?{...original,day,minutes:Math.min(daily,15,Math.max(5,original.minutes))}:{...anchor,day,type:'practice',minutes:Math.min(15,daily),title:{ru:`Практика · ${anchor.title.ru}`,kk:`Практика · ${anchor.title.kk}`},reason:{ru:'Новые условия из уже включённой в маршрут темы. Продолжай после предыдущих шагов; план уточнится по результату.',kk:'Бағытқа енгізілген тақырыптың жаңа тапсырмалары. Алдыңғы қадамдардан кейін жалғастыр; жоспар нәтижеге қарай нақтыланады.'}};
  if(original&&main.minutes<original.minutes)main.reason={ru:`Пойдём короткими блоками, в твоём темпе. ${main.reason.ru}`,kk:`Өз қарқыныңмен қысқа кезеңдерге бөліп оқимыз. ${main.reason.kk}`};
  primary.push(main);
  const remaining=daily-main.minutes;
  if(remaining<5)continue;
  const blocks=Math.ceil(remaining/15),base=Math.floor(remaining/blocks),extra=remaining%blocks;
  for(let i=0;i<blocks;i++){
   const available=priorities.slice(0,Math.min(day,priorities.length)),target=available[(available.length-1-i%available.length)];
   practice.push({topicId:target.topicId,day,type:'practice',minutes:base+Number(i<extra),title:{ru:`Самостоятельная практика · ${target.title.ru}`,kk:`Өздік практика · ${target.title.kk}`},reason:{ru:'Потренируй способ из урока на новых условиях и сравни шаги после ответа. Подсказки доступны; для подтверждения нужны самостоятельные решения.',kk:'Сабақтағы тәсілді жаңа тапсырмаларда қолданып, жауаптан кейін қадамдарды салыстыр. Кеңестер қолжетімді; растау үшін өздік шешімдер керек.'}});
  }
 }
 // Keep priority order for callers choosing the next topic; views group by day.
 return [...primary,...practice];
}
