import {readFileSync,writeFileSync} from 'node:fs';
import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
import {sourceExercises} from '../lib/source-exercises.ts';
import {promotedExercises} from '../lib/promoted-exercises.ts';
const root=new URL('../content/source-library/',import.meta.url);
const index=JSON.parse(readFileSync(new URL('crawl-index.json',root),'utf8'));
const all=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
// Section-level suggestions only. A mixed section is never assigned wholesale
// to a skill, and suggestions cannot affect mastery or select practice tasks.
const rules=[
 [/Order_of_Operations|Language_of_Algebra/i,'numbers brackets'],
 [/Whole_Numbers|Add_and_Subtract_Whole/i,'numbers'],
 [/Integers/i,'negatives'],[/Absolute_Value/i,'school-absolute-value school-absolute-equations'],
 [/Factors|Multiples|Prime_Factor/i,'school-divisibility school-gcd-lcm'],
 [/Fractions/i,'fractions'],[/Mixed_Numbers/i,'school-mixed-numbers'],[/Decimals/i,'school-decimals school-rounding'],
 [/Percent/i,'percentages'],[/Ratio|Proportion|Variation/i,'proportions dependencies'],
 [/Metric|Measurement|Measure_Weight/i,'units'],[/Real_Numbers|Properties_of_Real/i,'numbers brackets'],
 [/Multiply_Polynomials|Special_Products/i,'identities school-polynomials'],[/Monomials/i,'school-monomials'],
 [/Factor/i,'factoring'],[/Divide_Polynomials|Division_of_Polynomials/i,'school-polynomial-division'],
 [/Rational_Expressions/i,'algebra-fractions'],[/Properties_of_Exponents|Scientific_Notation/i,'powers'],
 [/Roots_and_Radicals|Simplify.*Root|Rational_Exponents/i,'radicals'],
 [/Linear_Equations|General_Strategy_for_Solving/i,'linear school-first-equations'],
 [/Quadratic_Equations|Quadratic_Formula|Completing_the_Square/i,'quadratic'],
 [/Rational_Equations/i,'rational'],[/Radical_Equations/i,'irrational'],
 [/Exponential_Equations/i,'exponential'],[/Logarithmic_Equations/i,'log-equations'],[/Logarithm/i,'logarithms'],
 [/Transformations_of_Functions/i,'transformations'],[/Functions_and_Function|Relations_and_Functions|Domain_and_Range|Composition_of_Functions/i,'functions'],
 [/Linear_Functions|Modeling_with_Linear/i,'functions dependencies'],
 [/Trigonometric_Functions|Unit_Circle|Angles_and_Radian/i,'trig-circle'],
 [/Trigonometric_Identities|Sum_and_Difference|Double.Angle|Product.to.Sum|Sum.to.Product/i,'trig-identities'],
 [/Trigonometric_Equations/i,'trig-equations'],[/Inverse_Trigonometric/i,'school-inverse-trig'],
 [/Law_of_Sines|Law_of_Cosines/i,'school-sine-cosine-laws'],[/Right_Triangle/i,'school-right-triangle-trig'],
 [/Systems_of_Linear|Substitution|Elimination/i,'linear-systems'],
 [/Nonlinear.*Systems|Systems.*Nonlinear/i,'nonlinear-systems school-graphical-systems'],
 [/Graph.*Systems/i,'school-graphical-systems'],[/Graph.*Inequalities|Inequalities.*Two_Variables/i,'school-two-variable-regions'],
 [/Linear_Inequalities/i,'linear-inequalities'],[/Compound_Inequalities/i,'linear-inequality-systems inequality-systems'],
 [/Rational_Inequalities/i,'rational-inequalities'],[/Quadratic_Inequalities/i,'quadratic-inequalities'],
 [/Arithmetic_Sequences/i,'arithmetic'],[/Geometric_Sequences/i,'geometric'],[/Sequences_and.*Notation/i,'patterns'],
 [/Induction|Recurs/i,'school-recurrence-induction'],[/Limits/i,'school-limits'],[/Derivatives/i,'derivative'],
 [/Maximum|Minimum|Extrema|Optimization/i,'extrema'],[/Integral|Antiderivative/i,'integral'],
 [/Uniform_Motion|Distance.*Rate|Rate.*Time/i,'motion'],[/Work_Applications/i,'work'],[/Mixture/i,'mixtures'],
 [/Math_Models|Translate.*Equation|Problem.Solving/i,'word-models'],
 [/Points.*Lines.*Planes/i,'angles school-basic-angles'],[/Angles/i,'angles school-basic-angles'],
 [/Triangles/i,'triangles'],[/Congruen/i,'school-triangle-congruence'],[/Similar/i,'similarity'],
 [/Quadrilateral/i,'quadrilaterals'],[/Polygon/i,'school-regular-polygons quadrilaterals'],[/Perimeter/i,'school-perimeter'],
 [/Circle|Circumference/i,'circles'],[/Area/i,'practical-area'],[/Volume_and_Surface/i,'volumes surface solids'],
 [/Volume/i,'volumes'],[/Prism/i,'prisms'],[/Pyramid/i,'pyramids'],[/Cylinder/i,'cylinders'],[/Cone/i,'cones'],[/Sphere/i,'spheres'],
 [/Vectors/i,'plane-vectors'],[/Coordinate_Plane|Rectangular_Coordinate/i,'school-coordinate-plane'],
 [/Circles|Ellipses|Hyperbolas|Parabolas/i,'school-plane-equations'],[/Complex_Numbers/i,'school-complex-numbers'],
 [/Sets|Venn/i,'school-sets'],[/Logic|Truth_Table|Equivalent_Statements/i,'logic'],
 [/Multiplication_Rule_for_Counting|Permutations|Combinations|Counting_Principles/i,'school-combinatorics'],
 [/Probability/i,'probability'],[/Visualizing_Data|Graphs|Histograms/i,'charts school-histograms'],
 [/Frequency|Organizing_Data/i,'school-frequency-tables'],[/Sampling|Data_Collection/i,'school-sampling'],
 [/Mean|Median|Mode|Standard_Deviation|Measures_of.*Data|Descriptive_Statistics/i,'statistics'],
 [/Random_Variables|Discrete.*Distribution|Expected_Value/i,'school-random-variables'],
];
const valid=new Set(all.map(t=>t.id));
for(const page of index.pages){
 const parts=decodeURIComponent(page.url).split('/');
 const tail=parts.at(-1);const section=/Exercises|Review|Practice|Test|Solutions|Summary|Homework/i.test(tail)?parts.at(-2):tail;
 page.topicIds=[...new Set(rules.filter(([r])=>r.test(section)).flatMap(([,ids])=>ids.split(' ')))];
 for(const id of page.topicIds)if(!valid.has(id))throw Error('Unknown topic '+id);
 page.mappingStatus=page.topicIds.length?'suggested-section':'pending';
}
index.topics=all.map(t=>({id:t.id,title:t.title,sections:index.pages.filter(p=>p.status==='draft'&&p.topicIds.includes(t.id)).length}));
index.blockedSources=[
 {title:'Атамұра: математика, алгебра и геометрия 5–11',url:'https://free.atamura.kz/?page_id=174&lang=ru',reason:'Каталог не задаёт конкретные издания и разрешение на воспроизведение. Требуются выбранные книги и разрешение правообладателя.'},
 {title:'Math Open Reference',url:'https://www.mathopenref.com/',reason:'Справочник, а не выбранный сборник упражнений. Разрешение на массовое копирование не подтверждено.'},
 {title:'Florida State University: mathematical induction',url:'https://www.math.fsu.edu/~mmccurdy/mac1140_sp19/notes/13_4Induction.pdf',reason:'Открытый доступ не подтверждает разрешение на перепубликацию. Сохранена ссылка, полный текст не перенесён.'},
];
index.scopeNote='Полный обход выбранных изданий LibreTexts по оглавлениям и внутренним ссылкам. Исходный текст на английском; разметка кандидатов и темы требуют проверки. Число кандидатов включает примеры и составные упражнения, не является числом готовых задач.';
writeFileSync(new URL('index.json',root),JSON.stringify(index,null,2));
const ready=index.pages.filter(p=>p.status==='draft');
writeFileSync(new URL('../lib/source-library-loaders.ts',import.meta.url),`// Generated by scripts/build-source-library.mjs. Server-only lazy source chapters.\nimport type {SourcePage} from './source-library';\nexport const sourceLibraryLoaders:Record<string,()=>Promise<{default:SourcePage}>>={\n${ready.map(p=>` '${p.id}':()=>import('../content/source-library/${p.id}.json') as Promise<{default:SourcePage}>,`).join('\n')}\n};\n`);
const practiceBank=[...sourceExercises,...promotedExercises];
const authoredCoverage=JSON.parse(readFileSync(new URL('../content/curriculum-practice/report.json',import.meta.url),'utf8'));
const report={...index,summary:{archivedPages:ready.length,candidates:ready.reduce((s,p)=>s+p.candidateCount,0),topicsWithSuggestedSections:index.topics.filter(t=>t.sections).length,readyNewPracticeTasks:promotedExercises.length,readyPracticeTasks:practiceBank.length,readyPracticeTopics:new Set(practiceBank.map(t=>t.topicId)).size,fullPracticeImportComplete:false},practiceByTopic:all.map(t=>({id:t.id,title:t.title,count:practiceBank.filter(task=>task.topicId===t.id).length}))};
report.summary.readyAuthoredPracticeTasks=authoredCoverage.addedTasks;
report.summary.authoredProgramCoverage=authoredCoverage.coveredTopics;
report.summary.authoredCoverageReport='CURRICULUM-PRACTICE-COVERAGE.html';
writeFileSync(new URL('../docs/FULL-SOURCE-IMPORT.json',import.meta.url),JSON.stringify(report,null,2));
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ENT Math — полный импорт источников</title><style>body{font:16px/1.65 system-ui;background:#f5f8f7;color:#173c34;margin:0}main{max-width:1100px;margin:auto;padding:32px}h1{font-size:32px;line-height:1.2}table{border-collapse:collapse;width:100%;background:white}td,th{padding:14px;border-bottom:1px solid #d7e6dd;text-align:left;vertical-align:top}.scroll{overflow:auto}a{color:#126049}input{font:inherit;padding:12px;width:min(95%,600px);border:1px solid #96b7a6;border-radius:10px}.note{padding:20px;background:#fff7de;border-radius:14px}small{display:block}</style><main><h1>Полный импорт учебников: подтверждённый статус</h1><p>${esc(index.generatedAt)} · <b>${ready.length} разделов</b> сохранено. Выделено ${report.summary.candidates} блоков упражнений и примеров. Это предварительная разметка, а не число готовых задач.</p><p class="note"><b>В практику автоматически не опубликовано ни одного непроверенного задания.</b> Полный исходный текст разделов сохранён на английском вместе с общими условиями и ответами источника. Рисунки представлены ссылками и альтернативным текстом; сами изображения ещё не перенесены. Переводы, независимые решения и точная привязка каждого упражнения к навыку остаются в работе. Ранее проверенные ${sourceExercises.length} заданий сохранены. Дополнительно перенесено ${promotedExercises.length} задач с точными вычислениями, русскими и казахскими инструкциями, решениями и подсказками. Итого ${practiceBank.length} задач из источников доступны в практике по ${report.summary.readyPracticeTopics} темам. Перевод и методика ожидают независимой проверки. <b>Полный перенос всех упражнений ещё не завершён.</b></p><h2>Учебники</h2><div class="scroll"><table><thead><tr><th>Издание</th><th>Разделы</th><th>Блоки</th><th>Проверка полноты</th></tr></thead><tbody>${index.books.map(b=>`<tr><td><a href="${esc(b.url)}">${esc(b.title)}</a><small>${esc(b.authors)} · ${esc(b.license||'Лицензии отдельных страниц')}</small></td><td>${b.archivedPages} сохранено; ${b.licenseReviewPages} требуют правовой проверки</td><td>${b.candidateCount}</td><td>${b.crawlComplete?'Все обнаруженные внутренние страницы обойдены':'Обход ограничен лицензией или ошибкой загрузки'}; ошибок загрузки: ${b.failedPages}</td></tr>`).join('')}</tbody></table></div><p>Использованы конкретные издания LibreTexts. Intermediate Algebra и Algebra and Trigonometry здесь — 1e, а не новые 2e из первоначального списка рекомендаций. Нельзя приписывать архиву содержание другого издания. Метки CC BY 4.0 и даты проверки сохранены отдельно для каждой страницы. Для страниц без собственной метки указана лицензия ближайшего раздела; ограничения дочерних страниц не заменяются лицензией книги.</p><h2>Требуют разрешения или уточнения источника</h2><ul>${index.blockedSources.map(s=>`<li><a href="${esc(s.url)}">${esc(s.title)}</a>: ${esc(s.reason)}</li>`).join('')}<li>OpenStax Calculus: на выбранной версии LibreTexts указана CC BY-NC-SA 4.0. Владелец планирует бесплатный и платный доступ. Для переноса в этот проект требуется разрешение на коммерческое использование.</li></ul><h2>Привязка к программе</h2><p>Для ${report.summary.topicsWithSuggestedSections} из ${all.length} тем найдены предварительные соответствия разделам. Это подсказки редактору; они не влияют на практику и освоение. Ноль означает, что соответствие ещё не установлено, а не отсутствие темы в книге.</p><input id="q" aria-label="Поиск темы" placeholder="Название темы на русском или казахском…"><div class="scroll"><table id="topics"><thead><tr><th>Тема</th><th>Предварительно подходящих разделов</th><th>Доступных задач из источников</th></tr></thead><tbody>${index.topics.map(t=>`<tr><td>${esc(t.title.ru)}<small>${esc(t.title.kk)} · ${esc(t.id)}</small></td><td>${t.sections}</td><td>${practiceBank.filter(task=>task.topicId===t.id).length}</td></tr>`).join('')}</tbody></table></div><h2>Что уже работает в практике</h2><p>Новые задания подключены к существующему подбору практики, проверке ответов и тетради ошибок. Ошибка назначает отдельные новые упражнения того же навыка, если они есть в банке. История прошлых занятий и сохранённые условия не заменяются. Для новых задач начните новое занятие после завершения текущего.</p><p>Реестр проверок: <code>content/promoted/verification.json</code>; очередь оставшихся блоков с причинами: <code>content/promoted/pending.json</code>. Число блоков не равно числу уникальных задач: в очереди также есть примеры, составные задания и дубликаты.</p><h2>Где открыть и как повторить импорт</h2><p>На локальном сайте: «Панель редактора» → «Библиотека импортированных учебников». Доступ проверяется на сервере. Поиск работает по английскому названию раздела, фильтры — по книге и предварительной теме. Полный текст можно открыть отдельно от автоматически выделенных блоков.</p><p><code>npm run sources:fetch</code> — продолжить загрузку с сохранённого кэша. <code>npm run sources:index</code> — обновить указатель и этот отчёт. <code>npm run sources:test</code> — проверить импорт. <code>npm run sources:promote</code> — пересобрать проверяемую часть банка (Python + SymPy 1.14.0). <code>npm run sources:verify-practice</code> — независимо проверить ответы и практику. Исходники: <code>content/source-library</code>. Импорт не изменяет базу данных, попытки и прогресс учеников.</p><p>Перед публикацией упражнения: проверить полноту условия и чертёж, подтвердить тему/навык, подготовить русский и казахский варианты, независимо решить задачу, настроить и проверить формат ответа, затем пройти существующий редакторский процесс. Ни ответы учебника, ни факт загрузки сами по себе не подтверждают корректность.</p></main><script>document.getElementById('q').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('#topics tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));});</script></html>`;
writeFileSync(new URL('../docs/FULL-SOURCE-IMPORT.html',import.meta.url),html.replace('<main>',`<main><p class="note"><strong>Практика по всей программе: ${authoredCoverage.coveredTopics} из ${authoredCoverage.totalTopics} тем.</strong> Дополнительно готовы ${authoredCoverage.mainTasks} авторских заданий и ${authoredCoverage.repairReserve} упражнений отдельного закрепления. Число тем с перенесёнными упражнениями учебников ниже относится только к импорту источников. <a href="CURRICULUM-PRACTICE-COVERAGE.html">Показать покрытие всех тем и статус проверки</a>.</p>`));
console.log(JSON.stringify(report.summary));
