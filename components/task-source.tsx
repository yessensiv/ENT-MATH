import type {ExerciseSource} from '@/lib/source-exercises';
import type {LocalText} from '@/lib/engine';

/** Compact attribution on every view that displays an adapted exercise. */
export function TaskSource({task,lang}:{task:{source?:ExerciseSource;practiceOrigin?:{kind:string;author:string};subtopic?:{title:LocalText}};lang:'ru'|'kk'}){
 const source=task.source;
 if(!source&&task.practiceOrigin?.kind==='authored')return <aside className="task-source">
  {task.subtopic&&<p><strong>{lang==='ru'?'Проверяем: ':'Тексереміз: '}</strong>{task.subtopic.title[lang]}</p>}
  <details><summary>{lang==='ru'?'Авторское задание ENT Math · о проверке':'ENT Math авторлық тапсырмасы · тексеру туралы'}</summary>
   <p>{lang==='ru'?'Условие и ответ проверены вычислительной логикой учебного шаблона. Перевод, сложность и методика ожидают независимой редакционной проверки.':'Шарт пен жауап оқу үлгісінің есептеу логикасымен тексерілген. Аударма, күрделілік және әдістеме тәуелсіз редакциялық тексеруді күтуде.'}</p>
  </details>
 </aside>;
 if(!source)return null;
 return <aside className="task-source">
  {task.subtopic&&<p><strong>{lang==='ru'?'Навык: ':'Дағды: '}</strong>{task.subtopic.title[lang]}</p>}
  <p><a href={source.url} target="_blank" rel="noopener noreferrer">OpenStax / LibreTexts · {lang==='ru'?'упражнение':'жаттығу'} {source.exercise}</a> · <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer">{source.license}</a></p>
  <details><summary>{lang==='ru'?'Об источнике и проверке':'Дереккөз және тексеру туралы'}</summary><p>{source.book}. {source.authors}.</p><p>{source.adaptation[lang]}</p><p>{lang==='ru'?'Ответ проверен вычислением. Перевод и методика ожидают независимой проверки.':'Жауап есептеумен тексерілді. Аударма мен әдістеме тәуелсіз тексеруді күтуде.'}</p></details>
 </aside>;
}
