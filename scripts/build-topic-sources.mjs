import {writeFileSync} from 'node:fs';
import {topics} from '../lib/content.ts';
import {schoolTopics} from '../lib/school-content.ts';
import {schoolExtensionTopics} from '../lib/school-extension-content.ts';
import {schoolAdvancedTopics} from '../lib/school-advanced-content.ts';
const books={
 I:['OpenStax Intermediate Algebra 2e','https://openstax.org/books/intermediate-algebra-2e/pages/index'],
 W:['OpenStax: движение и совместная работа','https://openstax.org/books/intermediate-algebra-2e/pages/7-5-solve-applications-with-rational-equations'],
 F:['Florida State University: математическая индукция','https://www.math.fsu.edu/~mmccurdy/mac1140_sp19/notes/13_4Induction.pdf'],
 P:['OpenStax Prealgebra 2e','https://openstax.org/books/prealgebra-2e/pages/index'],
 A:['OpenStax Algebra and Trigonometry 2e','https://openstax.org/books/algebra-and-trigonometry-2e/pages/index'],
 C:['OpenStax Calculus Volume 1','https://openstax.org/books/calculus-volume-1/pages/index'],
 D:['OpenStax Calculus Volume 2','https://openstax.org/books/calculus-volume-2/pages/index'],
 V:['OpenStax Calculus Volume 3','https://openstax.org/books/calculus-volume-3/pages/index'],
 M:['OpenStax Contemporary Mathematics','https://openstax.org/books/contemporary-mathematics/pages/index'],
 S:['OpenStax Introductory Statistics 2e','https://openstax.org/books/introductory-statistics-2e/pages/index'],
 G:['Math Open Reference: геометрия','https://www.mathopenref.com/'],
 T:['Math Open Reference: стереометрия','https://www.mathopenref.com/tocs/solidtoc.html'],
 K:['Атамұра: каталог школьных учебников','https://free.atamura.kz/?page_id=174&lang=ru']};
const map=new Map();
const group=(ids,source,section,note='Тематический раздел; упражнения ищите в Section Exercises / Chapter Review.')=>ids.split(' ').forEach(id=>{if(map.has(id))throw Error('Duplicate '+id);map.set(id,{source,section,note});});
group('numbers negatives brackets school-absolute-value school-number-ray','P','Гл. 1–3: числа, порядок действий, знаки и выражения');
group('fractions school-mixed-numbers','P','Гл. 4: действия с дробями и смешанными числами');
group('school-divisibility school-gcd-lcm','P','Гл. 2 и 4: делимость, множители и общие знаменатели');
group('school-decimals school-rounding','P','Гл. 5: десятичные дроби, округление и действия');
group('school-repeating-decimals','A','§1.1: рациональные числа; перевод периодической записи — дополнительная сверка с учебником 6 класса','Общая математическая основа. Точный параграф школьного учебника ещё не сверён.');
group('percentages proportions','P','Гл. 6: проценты, отношения и пропорции');
group('units','M','Гл. 9: измерения и метрические единицы');
group('identities factoring algebra-fractions powers radicals school-monomials school-polynomials','A','Гл. 1: преобразования выражений, степени, корни, многочлены и дроби');
group('linear quadratic rational irrational linear-inequalities school-first-equations school-absolute-equations','A','Гл. 2: линейные, квадратные, другие уравнения и неравенства');
group('functions transformations dependencies school-coordinate-plane','A','Гл. 2–3: координаты, функции и преобразования графиков');
group('logarithms exponential log-equations exponential-inequalities log-inequalities','A','Гл. 6: показательные и логарифмические функции и уравнения','Для неравенств используйте монотонность и ОДЗ; точные школьные наборы дополнительно сверять с учебником 11 класса.');
group('trig-circle school-right-triangle-trig','A','Гл. 7: углы, окружность и тригонометрия прямоугольного треугольника');
group('trig-identities trig-equations trig-inequalities','A','Гл. 9: тождества и тригонометрические уравнения','Неравенства требуют отдельного применения окружности; источник не заменяет проверку школьной рубрики.');
group('school-inverse-trig','A','Гл. 8: обратные тригонометрические функции');
group('school-sine-cosine-laws','A','Гл. 10: теоремы синусов и косинусов');
group('linear-systems nonlinear-systems quadratic-inequalities rational-inequalities inequality-systems linear-inequality-systems rational-inequality-systems nonlinear-inequality-systems school-graphical-systems school-two-variable-regions','A','Гл. 11: системы, графические области и нелинейные неравенства');
group('advanced-systems advanced-inequalities exponential-systems log-systems irrational-systems trig-systems irrational-inequalities exponential-inequality-systems log-inequality-systems','K','Алгебра и начала анализа 10–11: системы соответствующего вида, ОДЗ и неравенства','Каталог и подходящие учебники найдены; точный параграф и номера упражнений пока не проверены. Дополнительная основа: главы 2, 6, 9, 11 OpenStax Algebra and Trigonometry.');
group('arithmetic geometric patterns','A','Гл. 13: последовательности');
group('school-recurrence-induction','F','Метод математической индукции','Для рекурсивных последовательностей дополнительно используйте главу 13 Algebra and Trigonometry; эти материалы выше начального уровня.');
group('derivative extrema school-limits','C','Гл. 2–4: пределы, производные и исследование функций');
group('integral','C','Гл. 4–6: первообразные, определённый интеграл и приложения');
group('school-differential-equations','D','Гл. 4: дифференциальные уравнения и начальные условия');
group('school-complex-numbers','A','§2.4: комплексные числа');
group('school-polynomial-division','A','Гл. 5: деление многочленов');
group('motion work','W','§7.5: задачи на движение и производительность');
group('mixtures','I','§4.3: модели смесей через системы уравнений');
group('word-models','P','Гл. 9: перевод текстового условия в математическую модель');
group('angles triangles quadrilaterals circles similarity plane-transformations geometric-logic school-basic-angles school-triangle-congruence school-constructions school-regular-polygons','G','Указатель: углы, треугольники, многоугольники, окружности, равенство, подобие, построения и преобразования','Интерактивные объяснения. Для большого набора упражнений используйте геометрию 7–9 в каталоге Атамұра.');
group('practical-area school-perimeter','P','Гл. 9: периметр, площадь и геометрические приложения');
group('plane-vectors space-vectors space-distance school-space-equations','V','Гл. 2: векторы, скалярное произведение, прямые и плоскости','Источник включает материал выше школьного уровня: используйте только соответствующий навык.');
group('school-plane-equations','A','Гл. 2 и 12: прямая, расстояние и окружность');
group('solids volumes surface prisms pyramids cylinders cones spheres school-nets school-truncated-solids','T','Указатель тел: призма, пирамида, цилиндр, конус, шар, поверхность и объём','Наглядная геометрическая основа; составные тела и развёртки дополнительно сверять с геометрией 10–11.');
group('space-relations sections space-transformations school-projections','K','Геометрия 10–11: прямые, плоскости, сечения, проекции и преобразования','Каталог и учебники найдены; конкретные параграфы, чертежи и упражнения ещё требуют сверки.');
group('logic school-sets','M','Гл. 1–2: множества и логические рассуждения');
group('charts school-frequency-tables school-histograms school-sampling statistics','S','Гл. 1–2: выборка, таблицы, диаграммы и описательная статистика');
group('probability school-combinatorics','M','Гл. 7: подсчёт исходов, перестановки, сочетания и вероятность');
group('school-random-variables','S','Гл. 4: дискретная случайная величина, ожидание и стандартное отклонение');
const all=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics].filter(t=>t.tasks.length);
const missing=all.filter(t=>!map.has(t.id));if(missing.length)throw Error('Missing: '+missing.map(t=>t.id).join(','));
const rows=all.map(t=>({id:t.id,title:t.title,taskCount:t.tasks.length,...map.get(t.id),book:books[map.get(t.id).source][0],url:books[map.get(t.id).source][1]}));
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const official=[['НЦТ: профильная математика 2026','https://testcenter.kz/wp-content/uploads/2025/10/10_%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D0%BA%D0%B0_%D1%80%D1%83%D1%81.pdf'],['НЦТ: математическая грамотность 2026','https://testcenter.kz/wp-content/uploads/2025/10/08_%D0%9C%D0%B0%D1%82%D0%B5%D0%BC%D0%B0%D1%82%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%B0%D1%8F-%D0%B3%D1%80%D0%B0%D0%BC%D0%BE%D1%82%D0%BD%D0%BE%D1%81%D1%82%D1%8C.pdf']];
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ENT Math — источники по 121 теме</title><style>body{font:16px/1.55 system-ui;margin:0;background:#f5f8f7;color:#153b34}main{max-width:1250px;margin:auto;padding:32px}h1{font-size:32px}input{width:min(600px,95%);padding:14px;border:1px solid #afc9be;border-radius:10px;font:inherit}.table{overflow:auto}table{border-collapse:collapse;width:100%;background:white}th,td{padding:15px;border-bottom:1px solid #dee8e3;text-align:left;vertical-align:top}th{background:#e8f0eb}small{display:block;color:#546e65}a{color:#08755a}li{margin:8px 0}</style><main><h1>Источники по всем темам с задачами</h1><p>Сверено с исходниками ENT Math: <b>${rows.length} тем · ${rows.reduce((n,t)=>n+t.taskCount,0)} статических задач</b>. Поиск источников: 07.10.2026.</p><p>Это рекомендованные материалы для объяснений и упражнений. Существующие задачи платформы авторские: эта таблица не утверждает, что они взяты из указанных книг. Ссылки OpenStax ведут в проверенный предметный указатель; выберите указанную главу, затем Section Exercises. Страницы и номера задач не выдуманы.</p><h2>Казахстанская программа</h2><ul>${official.map(([t,u])=>`<li><a href="${u}">${t}</a> — перечень экзаменационных тем, не сборник задач.</li>`).join('')}<li><a href="${books.K[1]}">Атамұра: официальный каталог</a> — математика 5–6, алгебра и геометрия 7–9, алгебра/анализ и геометрия 10–11. Проверен русский каталог; доступность казахских изданий для каждой книги отдельно не подтверждена.</li></ul><p>Глубина сопоставления: раздел/глава либо каталог — указана в каждой строке. Для смешанных систем и некоторых пространственных тем точный параграф остаётся на сверку. Англоязычные материалы — дополнительные источники, не доказательство соответствия ЕНТ. При переносе текста/изображений в платформу проверяйте лицензию конкретной книги; На текущем сайте OpenStax указана лицензия с ограничением некоммерческого использования. Для перенесённых заданий использованы конкретные старые страницы LibreTexts с явной лицензией CC BY 4.0; см. SOURCE-IMPORT-REPORT.html.</p><input id="q" placeholder="Поиск: тема, қазақша, ID, источник…" aria-label="Поиск темы"><p id="count">Показаны все ${rows.length} тем</p><div class="table"><table><thead><tr><th>Тема / тақырып</th><th>Источник и раздел</th><th>Как использовать</th></tr></thead><tbody>${rows.map(t=>`<tr><td><b>${esc(t.title.ru)}</b><small>${esc(t.title.kk)}<br>${esc(t.id)} · ${t.taskCount} задач</small></td><td><a href="${esc(t.url)}">${esc(t.book)}</a><p>${esc(t.section)}</p></td><td>${esc(t.note)}</td></tr>`).join('')}</tbody></table></div></main><script>const input=document.getElementById('q'),rows=[...document.querySelectorAll('tbody tr')];input.addEventListener('input',()=>{const q=input.value.toLowerCase();let n=0;rows.forEach(r=>{r.hidden=!r.textContent.toLowerCase().includes(q);if(!r.hidden)n++});document.getElementById('count').textContent='Показано тем: '+n});</script></html>`;
writeFileSync(new URL('../docs/TOPIC-SOURCES.html',import.meta.url),html);
writeFileSync(new URL('../docs/TOPIC-SOURCES.json',import.meta.url),JSON.stringify({checkedAt:'2026-10-07',kind:'recommended-references-not-task-provenance',topics:rows},null,2));
console.log(`Mapped ${rows.length} topics; ${rows.reduce((n,t)=>n+t.taskCount,0)} static tasks; no missing IDs.`);
