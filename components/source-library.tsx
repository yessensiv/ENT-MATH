'use client';
import {useEffect,useState} from 'react';
import type {SourcePage,SourceIndex,SourceSummary} from '@/lib/source-library';
type Listing=Omit<SourceIndex,'pages'>&{pages:SourceSummary[];total:number;page:number;pageSize:number};
export default function SourceLibrary({lang}:{lang:'ru'|'kk'}){
 const tr=(ru:string,kk:string)=>lang==='ru'?ru:kk;
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[book,setBook]=useState(''),[topic,setTopic]=useState(''),[page,setPage]=useState(0),[selected,setSelected]=useState(''),[retry,setRetry]=useState(0);
 const [data,setData]=useState<Listing>(),[material,setMaterial]=useState<SourcePage>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   setLoading(true);setError('');
   try{
    const params=selected?new URLSearchParams({id:selected}):new URLSearchParams({q:query,book,topic,page:String(page)});
    const response=await fetch('/api/admin/source-library?'+params,{signal:controller.signal});
    const result=await response.json() as Listing&{material:SourcePage;error?:string};if(!response.ok)throw Error(result.error||String(response.status));
    if(controller.signal.aborted)return;
    if(selected)setMaterial(result.material);else{setData(result);setMaterial(undefined);}
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Ошибка загрузки');}
   finally{if(!controller.signal.aborted)setLoading(false);}
  },150);
  return()=>{clearTimeout(timer);controller.abort();};
 },[open,query,book,topic,page,selected,retry]);
 return <section className="panel source-library">
  <button type="button" className="secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{tr('Библиотека импортированных учебников','Импортталған оқулықтар кітапханасы')}</button>
  {open&&<div className="source-library-body" aria-busy={loading}>
   <p>{tr('Оригиналы на английском. Условия, общие инструкции и ответы источника сохранены. Переводы, решения и распределение по навыкам ещё нужно проверить. Эти черновики не выдаются ученику автоматически.','Ағылшын тіліндегі түпнұсқалар. Шарттар, ортақ нұсқаулар және дереккөз жауаптары сақталған. Аударма, шешім және дағдыға сәйкестік тексерілуі керек. Бұл жобалар оқушыға автоматты берілмейді.')}</p>
   {selected?<button className="secondary" type="button" onClick={()=>{setSelected('');setMaterial(undefined);}}>{tr('← К разделам','← Бөлімдерге')}</button>:<div className="source-library-filters">
    <label className="field"><span>{tr('Название раздела (английский)','Бөлім атауы (ағылшынша)')}</span><input value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="Fractions, equations, triangles…"/></label>
    <label className="field"><span>{tr('Учебник','Оқулық')}</span><select value={book} onChange={e=>{setBook(e.target.value);setPage(0);}}><option value="">{tr('Все учебники','Барлық оқулықтар')}</option>{data?.books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
    <label className="field"><span>{tr('Предварительная тема','Болжамды тақырып')}</span><select value={topic} onChange={e=>{setTopic(e.target.value);setPage(0);}}><option value="">{tr('Все темы','Барлық тақырыптар')}</option>{data?.topics.map(t=><option key={t.id} value={t.id}>{t.title[lang]} ({t.sections})</option>)}</select></label>
   </div>}
   {loading&&<p role="status">{tr('Загружаем источник…','Дереккөз жүктелуде…')}</p>}
   {error&&<div role="alert"><p>{error}</p><button className="secondary" type="button" onClick={()=>setRetry(retry+1)}>{tr('Повторить','Қайталау')}</button></div>}
   {!selected&&data&&<>
    <p role="status">{tr('Найдено разделов: ','Табылған бөлімдер: ')}{data.total}</p>
    <div className="source-library-list">{data.pages.map(p=><article key={p.id}>
     <strong>{p.title}</strong><p>{tr('Блоков для разбора: ','Талдауға арналған блоктар: ')}{p.candidateCount} · {tr('Рисунков: ','Суреттер: ')}{p.figureCount}</p>
     <p className="muted">{p.topicIds.map(id=>data.topics.find(t=>t.id===id)?.title[lang]).join(' · ')||tr('Тема требует разметки','Тақырыпты белгілеу қажет')}</p>
     {p.status==='draft'?<button className="secondary" disabled={loading} type="button" onClick={()=>{setMaterial(undefined);setSelected(p.id);}}>{tr('Открыть оригинал','Түпнұсқаны ашу')}</button>:<p>{tr('Перенос ограничен лицензией','Лицензия бойынша көшіру шектеулі')}</p>}
     <a href={p.url} target="_blank" rel="noopener noreferrer">{tr('Источник','Дереккөз')}</a>
    </article>)}</div>
    {!data.total&&<p>{tr('Попробуйте другую тему или уберите фильтр. Для некоторых тем подходящий источник ещё не найден.','Басқа тақырыпты таңдаңыз немесе сүзгіні алып тастаңыз. Кей тақырыпқа сәйкес дереккөз әлі табылмаған.')}</p>}
    <div className="source-library-pagination"><button type="button" className="secondary" disabled={loading||data.page===0} onClick={()=>setPage(Math.max(0,data.page-1))}>{tr('Назад','Артқа')}</button><span>{data.page+1} / {Math.max(1,Math.ceil(data.total/data.pageSize))}</span><button type="button" className="secondary" disabled={loading||(data.page+1)*data.pageSize>=data.total} onClick={()=>setPage(data.page+1)}>{tr('Далее','Келесі')}</button></div>
    <details><summary>{tr('Источники, требующие разрешения','Рұқсат қажет дереккөздер')}</summary>{data.blockedSources.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> — {s.reason}</p>)}</details>
   </>}
   {selected&&material&&material.id===selected&&<article>
    <h3>{material.title}</h3><p>{material.authors} · {material.book}</p>
    <p><a href={material.url} target="_blank" rel="noopener noreferrer">{tr('Оригинал в учебнике','Оқулықтағы түпнұсқа')}</a> · <a href={material.licenseUrl} target="_blank" rel="noopener noreferrer">{material.license}</a> · {material.checkedAt}</p>
    <p>{tr('Статус: черновик. Ответы источника не подтверждены платформой. Рисунки доступны по ссылкам и требуют отдельной проверки прав и переноса.','Мәртебесі: жоба. Дереккөз жауаптарын платформа тексерген жоқ. Суреттер сілтеме арқылы ашылады; оларды көшіру мен құқықтарын тексеру керек.')}</p>
    <details><summary>{tr('Упражнения и примеры — предварительное выделение','Жаттығулар мен мысалдар — алдын ала бөлу')} ({material.exercises.length})</summary>{material.exercises.map(e=><details key={e.ordinal} className="source-library-exercise"><summary>{tr('Блок','Блок')} {e.ordinal}{e.sourceNumber?` · № ${e.sourceNumber}`:''}</summary><p className="source-original">{e.context}</p><pre className="source-original">{e.original}</pre></details>)}</details>
    <details open><summary>{tr('Полный раздел: все условия и общие инструкции','Толық бөлім: барлық шарттар мен ортақ нұсқаулар')}</summary><pre className="source-original">{material.originalText}</pre></details>
    {!!material.figures.length&&<details><summary>{tr('Рисунки источника','Дереккөз суреттері')} ({material.figures.length})</summary><ul>{material.figures.map((f,i)=><li key={i}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.alt||`${tr('Рисунок','Сурет')} ${i+1}`}</a></li>)}</ul></details>}
    {!!material.references?.length&&<details><summary>{tr('Ссылки из условия и раздела','Шарт пен бөлімдегі сілтемелер')}</summary><ul>{material.references.map((r,i)=><li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.text||r.url}</a></li>)}</ul></details>}
   </article>}
  </div>}
 </section>;
}
