import {mkdirSync,writeFileSync,renameSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeCurriculumPractice,curriculumPracticeCapacity,practiceTopics,curriculumPracticeVersion} from '../lib/curriculum-practice-generator.ts';
import {sourceExercises} from '../lib/source-exercises.ts';
import {promotedExercises} from '../lib/promoted-exercises.ts';
import {checkAnswer,taskFingerprint} from '../lib/engine.ts';

const imported=[...sourceExercises,...promotedExercises],tasks=[],rows=[];
const references=JSON.parse(readFileSync(new URL('../docs/TOPIC-SOURCES.json',import.meta.url))).topics;
for(const topic of practiceTopics){
 const seen=new Set([...topic.tasks,...imported.filter(t=>t.topicId===topic.id)].map(taskFingerprint));
 const main=[],reserve=[];
 for(const level of [1,2,3]){
  const candidates=[];
  for(let serial=1;serial<=curriculumPracticeCapacity(topic.id,level);serial++){
   const task=makeCurriculumPractice(topic.id,serial,level);
   if(!task||seen.has(taskFingerprint(task)))continue;
   if(checkAnswer(task,task.answer).status!=='correct')throw Error(`Uncheckable answer ${task.id}`);
   seen.add(taskFingerprint(task));candidates.push(task);
   // Two fresh same-method/type conditions remain outside the main practice.
   if(candidates.length>=7){
    const chosen=candidates.slice(0,5);
    const families=new Set(chosen.map(t=>t.methodFamily+'|'+t.type));
    if([...families].every(f=>candidates.slice(5).filter(t=>t.methodFamily+'|'+t.type===f).length>=2))break;
   }
  }
  if(candidates.length<7)throw Error(`Insufficient practice supply ${topic.id}, level ${level}`);
  const chosen=candidates.slice(0,5),families=new Set(chosen.map(t=>t.methodFamily+'|'+t.type));
  main.push(...chosen);
  for(const family of families){
   const extras=candidates.slice(5).filter(t=>t.methodFamily+'|'+t.type===family).slice(0,2);
   if(extras.length<2)throw Error(`Missing independent repairs ${topic.id}: ${family}`);
   for(const task of extras)reserve.push(makeCurriculumPractice(topic.id,task.curriculumPractice.serial,level,true));
  }
 }
 tasks.push(...main,...reserve);
 const reference=references.find(r=>r.id===topic.id);
 rows.push({id:topic.id,title:topic.title,track:topic.track,prerequisites:topic.prerequisites,
  preparation:topic.spec===null,specification:topic.spec,main:main.length,
  levels:[1,2,3].map(level=>({level,main:main.filter(t=>t.difficulty===level).length,reserve:reserve.filter(t=>t.difficulty===level).length})),
  reserve:reserve.length,methods:[...new Map(main.map(t=>[t.methodFamily,{id:t.methodFamily,title:t.subtopic.title}])).values()],
  sourceExercises:imported.filter(t=>t.topicId===topic.id).length,
  reference:reference?{title:reference.book,url:reference.url,section:reference.section,kind:'recommended-reference-not-exercise-provenance'}:null});
}
if(rows.length!==121||new Set(tasks.map(t=>t.id)).size!==tasks.length)throw Error('Incomplete or duplicate coverage');
const report={checkedAt:'2026-10-09',version:curriculumPracticeVersion,totalTopics:rows.length,coveredTopics:rows.filter(r=>r.main>=15).length,
 addedTasks:tasks.length,mainTasks:tasks.filter(t=>!t.reviewReserved).length,repairReserve:tasks.filter(t=>t.reviewReserved).length,
 sourcedTasks:imported.length,sourcedTopics:rows.filter(r=>r.sourceExercises).length,
 verification:'Independent template arithmetic, substitution, geometry and bounded enumeration; answer checker accepts every key.',
 editorialReview:'Independent mathematics teaching, age/difficulty and RU/KK language review pending.',
 fullTextbookImportComplete:false,topics:rows,
 tasksDigest:createHash('sha256').update(JSON.stringify(tasks)).digest('hex')};
const root=new URL('../content/curriculum-practice/',import.meta.url);mkdirSync(root,{recursive:true});
for(const [file,value]of [['tasks.json',tasks],['report.json',report]]){
 const target=new URL(file,root),temporary=new URL(file+'.tmp',root);writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');renameSync(temporary,target);
}
writeFileSync(new URL('../docs/CURRICULUM-PRACTICE-COVERAGE.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
writeFileSync(new URL('../docs/CURRICULUM-PRACTICE-COVERAGE.html',import.meta.url),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ENT Math — практика по всей программе</title><style>body{font:16px/1.6 system-ui;background:#f4f8f6;color:#183c34;margin:0}main{max-width:1100px;margin:auto;padding:24px}table{border-collapse:collapse;background:white;width:100%}th,td{padding:12px;text-align:left;border-bottom:1px solid #d8e5dd}small{display:block}.scroll{overflow:auto}a{color:#17664f}input{font:inherit;padding:12px;width:min(90%,520px)}.note{background:#fff4d9;padding:18px;border-radius:14px}</style><main><h1>Практика по всем ${rows.length} темам</h1><p>Добавлено ${report.mainTasks} самостоятельных заданий и ${report.repairReserve} заданий отдельного закрепления. Дата вычислительной проверки: ${report.checkedAt}.</p><div class="note">Это авторские задания ENT Math на основе проверяемых учебных шаблонов. Упражнений из источников по-прежнему ${report.sourcedTasks}, в ${report.sourcedTopics} темах. Полный перенос учебников не завершён. Перевод, сложность и методика ожидают независимой редакционной проверки.</div><p>Для каждой темы: пять новых заданий каждого уровня и отдельный запас для двух новых самостоятельных решений после ошибки. Просмотр решения не считается освоением. Незавершённые занятия сохраняют свой набор задач.</p><label>Найти тему <input id="search" placeholder="Название или ID"></label><div class="scroll"><table><thead><tr><th>Тема / навык</th><th>Основные задачи</th><th>Закрепление</th><th>Учебный ориентир</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.title.ru)}<small>${esc(r.title.kk)} · ${esc(r.id)}</small><details><summary>Проверяемые методы</summary>${r.methods.map(m=>`<p>${esc(m.title.ru)}<small>${esc(m.title.kk)}</small></p>`).join('')}</details></td><td>${r.main}<small>${r.levels.map(l=>`Уровень ${l.level}: ${l.main}`).join('<br>')}</small></td><td>${r.reserve}</td><td>${r.reference?`<a href="${esc(r.reference.url)}">${esc(r.reference.title)}</a><small>${esc(r.reference.section)}. Это ориентир по теме, а не источник скопированного условия.</small>`:'Авторский учебный шаблон'}</td></tr>`).join('')}</tbody></table></div><p><a href="FULL-SOURCE-IMPORT.html">Архив источников и статус полного переноса</a></p></main><script>document.getElementById('search').addEventListener('input',e=>{for(const row of document.querySelectorAll('tbody tr'))row.hidden=!row.textContent.toLowerCase().includes(e.target.value.toLowerCase())});</script></html>`);
console.log(JSON.stringify({covered:report.coveredTopics,total:report.totalTopics,main:report.mainTasks,reserve:report.repairReserve,added:report.addedTasks}));
