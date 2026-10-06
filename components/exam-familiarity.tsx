import type {Exam,Language} from '@/lib/engine';

/** Familiar scores remain useful practice, but cannot establish independent growth. */
export default function ExamFamiliarity({exam,lang,compact=false}:{exam:Pick<Exam,'bankVersion'|'familiarQuestionIds'>;lang:Language;compact?:boolean}){
 const tr=(ru:string,kk:string)=>lang==='ru'?ru:kk;
 const count=exam.familiarQuestionIds?.length||0;
 const text=!exam.bankVersion
  ?tr('Архивный вариант: независимость заданий не подтверждена.','Мұрағаттық нұсқа: тапсырмалардың тәуелсіздігі расталмаған.')
  :count
   ?tr(`Знакомых вопросов: ${count}. Этот результат не подтверждает независимый рост.`, `Таныс сұрақтар: ${count}. Бұл нәтиже тәуелсіз өсуді растамайды.`)
   :tr('Новый набор: по сохранённой истории эти условия ещё не встречались.','Жаңа жинақ: сақталған тарих бойынша бұл шарттар бұрын кездеспеген.');
 return compact?<small>{text}</small>:<p className="notice" role="note">{text}</p>;
}
