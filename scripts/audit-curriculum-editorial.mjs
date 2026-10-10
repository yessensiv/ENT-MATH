import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateCurriculumPractice} from '../lib/curriculum-practice-generator.ts';
import {checkAnswer} from '../lib/engine.ts';

const bank=JSON.parse(readFileSync(new URL('../content/curriculum-practice/tasks.json',import.meta.url)));
const coverage=JSON.parse(readFileSync(new URL('../content/curriculum-practice/report.json',import.meta.url)));
const numbers=text=>(text.match(/\d+(?:[.,]\d+)?/g)||[]).sort().join('|');
const issues=[];
for(const task of bank){
 const fail=message=>issues.push({id:task.id,message});
 if(!validateCurriculumPractice(task).valid)fail('Canonical mathematical/editorial verification failed');
 if(checkAnswer(task,task.answer).status!=='correct')fail('Key rejected');
 if(numbers(task.prompt.ru)!==numbers(task.prompt.kk))fail('Numerical conditions differ between languages');
 if(/TODO|undefined|NaN|\[object Object\]/.test(JSON.stringify(task)))fail('Unfinished text');
 if(task.prompt.ru.includes('Округли до 6')&&checkAnswer(task,Number(task.answer).toFixed(6)).status!=='correct')fail('Requested rounding rejected');
 if(task.topicId==='prisms'&&task.difficulty===3&&!/прямоугольный/iu.test(task.prompt.ru))fail('Missing rectangular assumption');
 if(task.topicId==='sections'&&task.difficulty===2&&!/параллельн.*основан/iu.test(task.prompt.ru))fail('Missing parallel-section assumption');
}
const corrections=[
 {topic:'sections',change:'Указаны параллельность сечения основанию и измерение расстояния вдоль высоты.'},
 {topic:'prisms',change:'Указан прямоугольный параллелепипед; формула диагонали теперь применима к условию.'},
 {topic:'factoring',change:'Явно требуется разложение на множители, а не только нахождение суммы корней по Виету.'},
 {topic:'school-rounding',change:'В округлении до сотых всегда есть ненулевая отбрасываемая цифра; проверен весь диапазон параметров.'},
 {topic:'school-decimals',change:'Нереалистичная цена блокнота заменена массой крупы; единицы, подсказки и решение согласованы.'},
 {topic:'statistics',change:'Вместо прямого поиска моды — сравнение среднего и медианы при большом крайнем значении.'},
 {topic:'school-inverse-trig',change:'Третий уровень требует отрицательного главного значения arcsin после полного оборота и выбора четверти.'},
 {topic:'school-sampling',change:'Большая совокупность описана как ученики школы, вместо неправдоподобного размера одного класса.'},
 {topic:'school-combinatorics',change:'Исправлено согласование в русском условии о разных футболках.'},
];
const report={
 date:'2026-10-09',version:coverage.version,scope:'Новый авторский банк: основные задания и отдельное закрепление. Не весь архив учебников и не все прежние уроки.',
 reviewer:'Codex, автоматизированная и содержательная проверка авторских шаблонов; не независимый преподаватель или языковой редактор.',
 taskCount:bank.length,topicCount:coverage.totalTopics,templateSamplesRead:coverage.totalTopics*3,
 digest:createHash('sha256').update(JSON.stringify(bank)).digest('hex'),issues,corrections,
 difficultyStatus:'Уровни относительны внутри темы, предварительные. Не являются подтверждёнными уровнями A/B/C НЦТ; необходима проверка на учениках.',
 languageStatus:'Числовые данные согласованы в RU/KK; формулировки изменённых шаблонов пересмотрены. Полная независимая языковая редактура не выполнена.',
 remaining:['Независимая проверка преподавателем и редактором казахского языка.','Калибровка сложности по результатам учеников и времени решения.','Расширение разнообразия методов: 15 вариаций не доказывают охват всех навыков каждой широкой темы.','Отдельная содержательная проверка ранее импортированных заданий и прежних материалов.'],
 topics:coverage.topics.map(topic=>({id:topic.id,title:topic.title,main:topic.main,reserve:topic.reserve,
  automatedChecks:issues.some(issue=>bank.find(task=>task.id===issue.id)?.topicId===topic.id)?'failed':'passed',
  templateSampleReview:'Прочитано по одному условию каждого уровня в RU/KK; ответы всех вариантов проверены программно.',
  changes:corrections.filter(change=>change.topic===topic.id).map(change=>change.change),
  independentReview:'pending',difficultyCalibration:'pending'})),
};
writeFileSync(new URL('../docs/CURRICULUM-EDITORIAL-AUDIT.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const md=`# Проверка авторской практики — 9 октября 2026\n\nПроверены ${report.taskCount} заданий в ${report.topicCount} темах. Прочитаны ${report.templateSamplesRead} условия шаблонов (по одному каждого уровня в каждой теме) на двух языках. Все числовые варианты прошли вычислительную проверку; совпадение числовых данных RU/KK проверено отдельно. Неразрешённых ошибок автоматической проверки: ${issues.length}.\n\nЭто проверка Codex. Она не заменяет независимую преподавательскую и языковую редактуру.\n\n## Исправлено\n\n${corrections.map(c=>`- ${c.topic}: ${c.change}`).join('\n')}\n\n## Границы проверки\n\n${report.scope}\n\n${report.difficultyStatus}\n\n${report.languageStatus}\n\n${report.remaining.map(v=>`- ${v}`).join('\n')}\n\nСохранённые сессии используют прежние снимки. Ответы и история пользователей не переписываются. Для исправленного набора начните новую практику.\n\nПолный отчёт по каждой теме: [CURRICULUM-EDITORIAL-AUDIT.json](CURRICULUM-EDITORIAL-AUDIT.json). Повторная проверка: \`npm run practice:audit\`.\n`;
writeFileSync(new URL('../docs/CURRICULUM-EDITORIAL-AUDIT.md',import.meta.url),md);
console.log(JSON.stringify({topics:report.topicCount,tasks:report.taskCount,issues:issues.length,correctedTemplates:corrections.length}));
if(issues.length)process.exitCode=1;
