/** Author's course map, checked against Kazakhstan Order 399 on 2026-10-06.
 * No runtime content import: the school map can be used by both UI and engine. */
export type SchoolBilingual = { ru:string; kk:string };
export type SchoolCoverage = 'available'|'partial'|'missing';
export type SchoolModule = { id:string; title:SchoolBilingual; topicIds:string[]; coverage:SchoolCoverage; gaps:SchoolBilingual[]; appendices:number[] };
export type SchoolPathway='natural-math'|'humanitarian';
export type SchoolCourse = { grade:number; title:SchoolBilingual; description:SchoolBilingual; modules:SchoolModule[]; gaps:SchoolBilingual[]; coverage:'partial'; appendices:number[] };
const b=(ru:string,kk:string):SchoolBilingual=>({ru,kk});
export const schoolProgramVersion={
 order:'399',orderDate:'2022-09-16',checkedAt:'2026-10-06',contentVersion:'school-2026.1',
 sourceRu:'https://old.adilet.zan.kz/rus/docs/V2200029767',sourceKk:'https://old.adilet.zan.kz/kaz/docs/V2200029767',
 amendment:'https://old.adilet.zan.kz/rus/docs/V2200030654',
 appendices:{math:52,algebra:53,geometry:54,analysisNatural:104,analysisHumanitarian:105,geometryNatural:106,geometryHumanitarian:107},
 coverage:'partial',editorialStatus:'Author map and RU/KK materials await independent teacher review',
};
const schoolModule=(id:string,ru:string,kk:string,topicIds:string[],appendices:number[],gaps:SchoolBilingual[]=[],coverage:SchoolCoverage='partial'):SchoolModule=>({id,title:b(ru,kk),topicIds,appendices,gaps,coverage});
const course=(grade:number,modules:SchoolModule[],gaps:SchoolBilingual[],appendices:number[]):SchoolCourse=>({grade,title:b(`${grade} класс`,`${grade}-сынып`),description:b('Школьный маршрут по доступным урокам. Покрытие программы частичное; недостающие навыки перечислены ниже.','Қолжетімді сабақтар бойынша мектеп бағыты. Бағдарлама ішінара қамтылған; жетіспейтін дағдылар төменде көрсетілген.'),modules,gaps,coverage:'partial',appendices});

export const schoolCourses:SchoolCourse[]=[
 course(5,[
  schoolModule('5-numbers','Числа и порядок действий','Сандар және амалдар реті',['numbers','school-number-ray','school-first-equations','units','patterns'],[52]),
  schoolModule('5-divisibility','Делимость, простые числа, НОД и НОК','Бөлінгіштік, жай сандар, ЕҮОБ және ЕКОЕ',['school-divisibility','school-gcd-lcm'],[52],[], 'available'),
  schoolModule('5-fractions','Обыкновенные дроби','Жай бөлшектер',['fractions','school-mixed-numbers'],[52]),
  schoolModule('5-decimals','Десятичные дроби и округление','Ондық бөлшектер және дөңгелектеу',['school-decimals','school-rounding'],[52],[], 'available'),
  schoolModule('5-sets','Множества и отношения между ними','Жиындар және олардың қатынастары',['school-sets'],[52],[], 'available'),
  schoolModule('5-percentages','Проценты','Пайыздар',['percentages'],[52]),
  schoolModule('5-figures','Углы и периметр','Бұрыштар және периметр',['school-basic-angles','school-perimeter'],[52]),
  schoolModule('5-data','Таблицы и диаграммы','Кестелер және диаграммалар',['charts'],[52]),
  schoolModule('5-space','Куб, параллелепипед и развёртки','Текше, параллелепипед және жазбалар',['school-nets'],[52],[], 'available'),
 ],[
  b('Построения и развёртки доступны. Ещё нужны самостоятельное рисование диаграмм, физическое складывание развёрток и расширенная работа с буквенными выражениями.','Салулар мен жазбалар қолжетімді. Диаграмманы өз бетімен салу, жазбаны бүктеу және әріпті өрнектермен кеңейтілген жұмыс әлі керек.'),
 ],[52]),
 course(6,[
  schoolModule('6-review','Повторение 5 класса','5-сыныпты қайталау',['fractions','school-decimals','school-gcd-lcm'],[52]),
  schoolModule('6-ratios','Отношения, пропорции и масштаб','Қатынастар, пропорциялар және масштаб',['proportions','percentages'],[52]),
  schoolModule('6-rational','Рациональные числа и модуль','Рационал сандар және модуль',['negatives','school-absolute-value','school-repeating-decimals','school-absolute-equations'],[52]),
  schoolModule('6-expressions','Буквенные выражения и уравнения','Әріпті өрнектер және теңдеулер',['brackets','linear','word-models'],[52]),
  schoolModule('6-inequalities','Неравенства и пересечение промежутков','Теңсіздіктер және аралықтар қиылысуы',['linear-inequalities','linear-inequality-systems'],[52]),
  schoolModule('6-coordinates','Координаты и симметрия','Координаталар және симметрия',['school-coordinate-plane'],[52],[], 'available'),
  schoolModule('6-data','Данные, перебор и зависимости','Деректер, іріктеу және тәуелділіктер',['statistics','dependencies'],[52]),
  schoolModule('6-systems','Линейные системы','Сызықтық жүйелер',['linear-systems'],[52]),
 ],[
  b('Периодические дроби, уравнения с модулем и координатная плоскость доступны. Расширяем неравенства с модулем, графики по таблицам, среднюю скорость и полный перебор.','Периодты бөлшектер, модулі бар теңдеулер және координаталық жазықтық қолжетімді. Модулі бар теңсіздіктерді, кесте бойынша графиктерді, орташа жылдамдық пен толық іріктеуді кеңейтеміз.'),
 ],[52]),
 course(7,[
  schoolModule('7-powers','Степень с целым показателем','Бүтін көрсеткішті дәреже',['powers'],[53]),
  schoolModule('7-polynomials','Выражения, многочлены и тождества','Өрнектер, көпмүшелер және тепе-теңдіктер',['school-monomials','school-polynomials','brackets','identities','factoring'],[53]),
  schoolModule('7-functions','Функции и линейные графики','Функциялар және сызықтық графиктер',['functions','transformations','linear-systems','school-graphical-systems'],[53]),
  schoolModule('7-statistics','Частоты и статистические данные','Жиіліктер және статистикалық деректер',['school-frequency-tables','statistics','charts'],[53]),
  schoolModule('7-fractions','Алгебраические дроби','Алгебралық бөлшектер',['algebra-fractions'],[53]),
  schoolModule('7-lines','Углы и взаимное расположение прямых','Бұрыштар және түзулердің өзара орналасуы',['angles'],[54]),
  schoolModule('7-triangles','Треугольники и их свойства','Үшбұрыштар және олардың қасиеттері',['triangles','school-triangle-congruence'],[54]),
  schoolModule('7-circle','Окружность и построения','Шеңбер және салулар',['circles'],[54]),
 ],[
  b('Одночлены, многочлены, частоты, выборка, графическое решение и признаки равенства доступны. Ещё нужны развёрнутые геометрические доказательства, аксиомы и точные построения только циркулем и линейкой.','Бірмүшелер, көпмүшелер, жиіліктер, таңдама, графиктік шешім мен теңдік белгілері қолжетімді. Толық геометриялық дәлелдеулер, аксиомалар және тек циркуль мен сызғышпен дәл салулар әлі керек.'),
 ],[53,54]),
 course(8,[
  schoolModule('8-roots','Квадратные корни и преобразования','Квадрат түбірлер және түрлендірулер',['radicals'],[53]),
  schoolModule('8-equations','Квадратные и рациональные уравнения','Квадрат және рационал теңдеулер',['quadratic','rational','motion','work'],[53]),
  schoolModule('8-functions','Квадратичная функция','Квадраттық функция',['functions','transformations'],[53]),
  schoolModule('8-data','Статистика и интервалы','Статистика және аралықтар',['statistics','charts','quadratic-inequalities'],[53]),
  schoolModule('8-plane','Четырёхугольники и площади','Төртбұрыштар және аудандар',['quadrilaterals','triangles'],[54]),
  schoolModule('8-trig','Прямоугольный треугольник','Тікбұрышты үшбұрыш',['triangles','school-right-triangle-trig'],[54]),
  schoolModule('8-coordinates','Координаты на плоскости','Жазықтықтағы координаталар',['school-plane-equations','plane-vectors'],[54]),
 ],[
  b('Гистограммы, тригонометрия по сторонам и уравнения прямой/окружности доступны. Ещё расширяем доказательства теоремы Пифагора, свойств четырёхугольников и площадей, построение собственных графиков.','Гистограммалар, қабырғалар арқылы тригонометрия және түзу/шеңбер теңдеулері қолжетімді. Пифагор теоремасы, төртбұрыштар мен аудан қасиеттерінің дәлелдеулерін, өз графигін салуды кеңейтеміз.'),
 ],[53,54]),
 course(9,[
  schoolModule('9-systems','Уравнения и неравенства с двумя переменными','Екі айнымалысы бар теңдеулер мен теңсіздіктер',['school-two-variable-regions','nonlinear-systems','quadratic-inequalities','nonlinear-inequality-systems'],[53]),
  schoolModule('9-counting','Комбинаторика и вероятность','Комбинаторика және ықтималдық',['school-combinatorics','probability','logic'],[53]),
  schoolModule('9-sequences','Последовательности и прогрессии','Тізбектер және прогрессиялар',['arithmetic','geometric','school-recurrence-induction'],[53]),
  schoolModule('9-trig','Тригонометрические преобразования','Тригонометриялық түрлендірулер',['trig-circle','trig-identities'],[53]),
  schoolModule('9-vectors','Векторы и преобразования плоскости','Векторлар және жазықтық түрлендірулері',['plane-vectors','plane-transformations','similarity'],[54]),
  schoolModule('9-triangles','Решение треугольников и окружности','Үшбұрыштарды шешу және шеңберлер',['triangles','circles'],[54]),
 ],[
  b('Области двух переменных, комбинаторика, рекуррентные последовательности, индукция, теоремы синусов/косинусов и многоугольники доступны. Свободные доказательства требуют проверки учителем; нестандартные комбинированные задачи ещё расширяем.','Екі айнымалы облыстары, комбинаторика, рекурренттік тізбектер, индукция, синус/косинус теоремалары мен көпбұрыштар қолжетімді. Еркін дәлелдеулерді мұғалім тексереді; стандартты емес құрама есептерді кеңейтеміз.'),
 ],[53,54]),
 course(10,[
  schoolModule('10-functions','Функции, свойства и графики','Функциялар, қасиеттер және графиктер',['functions','transformations'],[104,105]),
  schoolModule('10-trig','Тригонометрические функции и уравнения','Тригонометриялық функциялар және теңдеулер',['trig-circle','trig-identities','trig-equations','trig-inequalities'],[104,105]),
  schoolModule('10-probability','Вероятность и случайные величины','Ықтималдық және кездейсоқ шамалар',['probability','statistics'],[104,105]),
  schoolModule('10-limits','Предел и непрерывность — ЕМН','Шек және үздіксіздік — ЖМБ',['school-limits'],[104],[], 'available'),
  schoolModule('10-analysis','Производная и её применение','Туынды және оның қолданылуы',['derivative','extrema'],[104,105]),
  schoolModule('10-space','Стереометрия, параллельность и перпендикулярность','Стереометрия, параллельдік және перпендикулярлық',['space-relations','space-distance','solids'],[106,107]),
  schoolModule('10-vectors','Координаты и векторы в пространстве','Кеңістіктегі координаталар мен векторлар',['space-vectors','space-transformations'],[106,107]),
 ],[
  b('ЕМН и ОГН отобраны отдельно. Пределы, деление многочленов, обратные тригонометрические функции, случайные величины, проекции и пространственные уравнения доступны в соответствующем направлении. Требуются расширенные доказательства, схема Горнера и рациональные корни, проверка глубины целей каждого направления.','ЖМБ мен ҚГБ бөлек таңдалған. Шектер, көпмүшелерді бөлу, кері тригонометриялық функциялар, кездейсоқ шамалар, проекциялар мен кеңістіктегі теңдеулер тиісті бағытта қолжетімді. Кеңейтілген дәлелдеулер, Горнер схемасы мен рационал түбірлер, әр бағыт мақсатының тереңдігін тексеру керек.'),
 ],[104,105,106,107]),
 course(11,[
  schoolModule('11-integral','Первообразная и интеграл','Алғашқы функция және интеграл',['integral'],[104,105]),
  schoolModule('11-powers','Степени, корни и иррациональные задачи','Дәрежелер, түбірлер және иррационал есептер',['powers','radicals','irrational','irrational-inequalities'],[104,105]),
  schoolModule('11-exp-log','Показательная и логарифмическая математика','Көрсеткіштік және логарифмдік математика',['logarithms','exponential','log-equations','exponential-inequalities','log-inequalities'],[104,105]),
  schoolModule('11-statistics','Математическая статистика','Математикалық статистика',['school-sampling','statistics'],[104,105]),
  schoolModule('11-complex','Комплексные числа — ЕМН','Комплекс сандар — ЖМБ',['school-complex-numbers'],[104],[], 'available'),
  schoolModule('11-differential','Дифференциальные уравнения — ЕМН','Дифференциалдық теңдеулер — ЖМБ',['school-differential-equations'],[104],[], 'available'),
  schoolModule('11-polyhedra','Многогранники, сечения и поверхности','Көпжақтар, қималар және беттер',['prisms','pyramids','sections'],[106,107]),
  schoolModule('11-rotation','Тела вращения и объёмы','Айналу денелері және көлемдер',['cylinders','cones','spheres','volumes'],[106,107]),
 ],[
  b('Комплексные числа и дифференциальные уравнения ЕМН, выборка и объёмы составных/усечённых тел доступны. Ещё нужны внешние площади сложных комбинаций, развёртки, расширенные применения интеграла и независимая калибровка ЕМН/ОГН.','ЖМБ-дағы комплекс сандар мен дифференциалдық теңдеулер, таңдама және құрамдас/қиық денелер көлемі қолжетімді. Күрделі комбинациялардың сыртқы аудандары, жазбалар, интегралдың кеңейтілген қолданылуы және ЖМБ/ҚГБ тәуелсіз калибрлеуі әлі керек.'),
 ],[104,105,106,107]),
];

const extraSchoolModules=[
 {grade:5,id:'5-constructions',ru:'Построения инструментами',kk:'Құралдармен салу',topics:['school-constructions'],appendices:[52],quarter:4},
 {grade:7,id:'7-sampling',ru:'Выборка и вариационный ряд',kk:'Таңдама және вариациялық қатар',topics:['school-sampling'],appendices:[53],quarter:2},
 {grade:8,id:'8-histograms',ru:'Интервальные данные и гистограммы',kk:'Аралық деректер және гистограммалар',topics:['school-histograms'],appendices:[53],quarter:3},
 {grade:9,id:'9-solving-triangles',ru:'Теоремы и правильные многоугольники',kk:'Теоремалар және дұрыс көпбұрыштар',topics:['school-sine-cosine-laws','school-regular-polygons'],appendices:[54],quarter:3},
 {grade:10,id:'10-polynomial-division',ru:'Деление многочленов — ЕМН',kk:'Көпмүшелерді бөлу — ЖМБ',topics:['school-polynomial-division'],appendices:[104],quarter:3},
 {grade:10,id:'10-inverse-trig',ru:'Обратные тригонометрические функции — ЕМН',kk:'Кері тригонометриялық функциялар — ЖМБ',topics:['school-inverse-trig'],appendices:[104],quarter:1},
 {grade:10,id:'10-random-variables',ru:'Числовые характеристики случайной величины — ЕМН',kk:'Кездейсоқ шаманың сандық сипаттамалары — ЖМБ',topics:['school-random-variables'],appendices:[104],quarter:4},
 {grade:10,id:'10-projections',ru:'Проекции и три перпендикуляра',kk:'Проекциялар және үш перпендикуляр',topics:['school-projections'],appendices:[106,107],quarter:2},
 {grade:10,id:'10-space-equations',ru:'Уравнения в пространстве — ЕМН',kk:'Кеңістіктегі теңдеулер — ЖМБ',topics:['school-space-equations'],appendices:[106],quarter:4},
 {grade:11,id:'11-truncated-solids',ru:'Усечённые и составные тела',kk:'Қиық және құрамдас денелер',topics:['school-truncated-solids'],appendices:[106,107],quarter:3},
] as const;
for(const extra of extraSchoolModules){schoolCourses.find(c=>c.grade===extra.grade)!.modules.push(schoolModule(extra.id,extra.ru,extra.kk,[...extra.topics],[...extra.appendices],[], 'available'));}

export const schoolQuarterMap:Record<string,1|2|3|4>={
 '5-numbers':1,'5-divisibility':1,'5-fractions':2,'5-decimals':3,'5-sets':4,'5-percentages':4,'5-figures':3,'5-data':4,'5-space':4,
 '6-review':1,'6-ratios':1,'6-rational':2,'6-expressions':3,'6-inequalities':3,'6-coordinates':4,'6-data':4,'6-systems':4,
 '7-powers':1,'7-polynomials':2,'7-functions':2,'7-statistics':1,'7-fractions':4,'7-lines':1,'7-triangles':2,'7-circle':4,
 '8-roots':1,'8-equations':2,'8-functions':3,'8-data':4,'8-plane':1,'8-trig':2,'8-coordinates':4,
 '9-systems':1,'9-sequences':2,'9-trig':3,'9-counting':1,'9-vectors':3,'9-triangles':4,
 '10-functions':1,'10-trig':2,'10-probability':2,'10-limits':3,'10-analysis':3,'10-space':1,'10-vectors':4,
 ...Object.fromEntries(extraSchoolModules.map(m=>[m.id,m.quarter])),
 '11-integral':1,'11-powers':2,'11-exp-log':3,'11-statistics':4,'11-complex':2,'11-differential':4,'11-polyhedra':2,'11-rotation':4,
};
// Quarter pacing is a platform recommendation, not a school's approved calendar.
export function schoolRoute(grade:string|number,pathway:SchoolPathway='natural-math'){
 const course=schoolCourses.find(c=>c.grade===Number(grade));if(!course)return null;
 const modules=course.modules.filter(m=>Number(grade)<10||pathway==='natural-math'||!m.appendices.every(a=>a===104||a===106)).map(m=>({...m,quarter:schoolQuarterMap[m.id]||1,appendices:Number(grade)>=10?m.appendices.filter(a=>pathway==='humanitarian'?a===105||a===107:a===104||a===106):m.appendices}));
 return {...course,modules,pathway,appendices:Number(grade)>=10?(pathway==='humanitarian'?[105,107]:[104,106]):course.appendices};
}
export function schoolTopicIds(grade:string|number,pathway:SchoolPathway='natural-math'):string[]{
 const raw=String(grade).trim();if(!/^(5|6|7|8|9|10|11)$/.test(raw))return [];
 const course=schoolRoute(raw,pathway);return course?[...new Set(course.modules.flatMap(m=>m.topicIds))]:[];
}
