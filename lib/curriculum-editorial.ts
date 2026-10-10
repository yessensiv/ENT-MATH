import type {Task, Bilingual} from './content';

const b=(ru:string,kk:string):Bilingual=>({ru,kk});
const decimal=(value:number)=>String(Number(value.toFixed(8))).replace('.',',');

/** Authoring corrections apply to new practice, never to stored student snapshots. */
export function editCurriculumPractice(input:Task,serial:number,level:1|2|3):Task{
 const task=structuredClone(input),id=task.topicId;
 if(id==='sections'&&level===2){
  task.prompt.ru=task.prompt.ru.replace('Сечение в 4 единицах от вершины.','Сечение параллельно основанию и находится на расстоянии 4 от вершины, измеренном вдоль высоты.');
  task.prompt.kk=task.prompt.kk.replace('Қима төбеден 4 бірлікте.','Қима табанға параллель. Төбеден қимаға дейінгі биіктік бойымен өлшенген қашықтық 4.');
 }
 if(id==='prisms'&&level===3){
  task.prompt.ru=task.prompt.ru.replace('Параллелепипед имеет рёбра','Прямоугольный параллелепипед имеет рёбра');
  task.prompt.kk=task.prompt.kk.replace('Параллелепипед қырлары','Тікбұрышты параллелепипед қырлары');
 }
 if(id==='factoring'&&level===3){
  task.prompt.ru+=' Реши с помощью разложения многочлена на множители.';
  task.prompt.kk+=' Көпмүшені көбейткіштерге жіктеу арқылы шеш.';
 }
 if(id==='school-rounding'&&level===2&&serial%2===1){
  const n=Math.floor((serial-1)/2)+1;
  let atom=1000*(10+n)+137+23*n;if(atom%10===0)atom++;
  const answer=Math.floor((atom+5)/10)/100;
  // Integer thousandths determine the key; tolerate binary representation
  // at exact half-hundredths in the separate floating-point cross-check.
  if(Math.abs(Math.round((atom/1000+Number.EPSILON*atom)*100)/100-answer)>1e-10)throw Error('Independent hundredths check failed');
  task.prompt=b(`Округли ${decimal(atom/1000)} до сотых.`,`${decimal(atom/1000)} санын жүздікке дейін дөңгелекте.`);
  task.answer=String(answer);
  task.solution={ru:['Сохраняем две цифры после запятой — десятые и сотые.',`Цифра тысячных ${atom%10}: ${atom%10>=5?'увеличиваем сотые на 1':'оставляем сотые без изменения'}.`,`Получаем ${decimal(answer)}.`],
   kk:['Үтірден кейін екі цифрды — ондық пен жүздікті — сақтаймыз.',`Мыңдық цифры ${atom%10}: ${atom%10>=5?'жүздікті 1-ге арттырамыз':'жүздікті өзгертпейміз'}.`,`Нәтиже: ${decimal(answer)}.`]};
 }
 if(id==='school-decimals'&&level===2&&serial%2===1){
  const n=Math.floor((serial-1)/2)+1,mass=(120+7*n)/100,used=(20+3*n)/100;
  const answer=(3*(120+7*n)-(20+3*n))/100;
  if(Math.abs(3*mass-used-answer)>1e-10||answer!==Number(task.answer))throw Error('Independent mass check failed');
  task.prompt=b(`Один пакет крупы весит ${decimal(mass)} кг. Из трёх таких пакетов использовали ${decimal(used)} кг крупы. Сколько килограммов осталось?`,
   `Бір қаптама жарманың массасы ${decimal(mass)} кг. Осындай үш қаптамадан ${decimal(used)} кг жарма пайдаланылды. Неше килограмм қалды?`);
  task.unit='кг';
  task.solution={ru:['Сначала найдём общую массу трёх пакетов.',`${decimal(mass)} · 3 = ${decimal(3*mass)} кг.`,`${decimal(3*mass)} − ${decimal(used)} = ${decimal(answer)} кг.`],
   kk:['Алдымен үш қаптаманың жалпы массасын табамыз.',`${decimal(mass)} · 3 = ${decimal(3*mass)} кг.`,`${decimal(3*mass)} − ${decimal(used)} = ${decimal(answer)} кг.`]};
  task.hints={ru:['Все массы даны в килограммах.','Умножь массу одного пакета на 3.','Вычти использованную массу один раз из общей массы.'],
   kk:['Барлық масса килограммен берілген.','Бір қаптаманың массасын 3-ке көбейт.','Жалпы массадан пайдаланылған массаны бір рет азайт.']};
 }
 if(id==='statistics'&&level===3){
  const n=serial+5,values=[n,n+2,n+4,n+6,n+18],mean=values.reduce((sum,v)=>sum+v,0)/5,median=[...values].sort((a,c)=>a-c)[2],answer=mean-median;
  if(Math.abs(answer-2)>1e-10)throw Error('Independent mean-median check failed');
  task.type='number';task.answer=String(Number(answer.toFixed(8)));
  task.prompt=b(`В ряду ${values.join('; ')} найди, на сколько среднее арифметическое больше медианы. Объясни, как большое последнее значение влияет на эти показатели.`,
   `${values.join('; ')} қатарында орташа арифметикалық мән медианадан қаншаға артық екенін тап. Соңғы үлкен мәннің осы көрсеткіштерге әсерін түсіндір.`);
  task.solution={ru:[`Сумма ${values.reduce((s,v)=>s+v,0)}; среднее ${mean}.`,`Ряд упорядочен; средний, третий элемент — медиана ${median}.`,`Разность ${mean} − ${median} = 2. Последний большой элемент увеличивает среднее, но не меняет центральный элемент.`],
   kk:[`Қосынды ${values.reduce((s,v)=>s+v,0)}; орташа мән ${mean}.`,`Қатар реттелген; ортадағы үшінші элемент — медиана ${median}.`,`Айырмасы ${mean} − ${median} = 2. Соңғы үлкен элемент орташа мәнді арттырады, бірақ орталық элементті өзгертпейді.`]};
  task.hints={ru:['Вычисли два разных показателя для одного ряда.','Для среднего раздели сумму на 5; для медианы возьми третий элемент упорядоченного ряда.','Вычти медиану из среднего. Сравни влияние последнего элемента.'],
   kk:['Бір қатар үшін екі түрлі көрсеткішті есепте.','Орташа мән үшін қосындыны 5-ке бөл; медиана үшін реттелген қатардың үшінші элементін ал.','Орташа мәннен медиананы азайт. Соңғы элементтің әсерін салыстыр.']};
  task.skill=b('Сравнение среднего и медианы при выбросе','Шеткі мән болғанда орташа мән мен медиананы салыстыру');
  task.commonError=b('Среднее и медиана вычисляются разными способами; сначала найди оба показателя.','Орташа мән мен медиана әртүрлі тәсілмен табылады; алдымен екеуін де есепте.');
 }
 if(id==='school-inverse-trig'&&level===3){
  const acute=15*(serial%5+1),angle=360*serial+180+acute;
  const actual=Math.asin(Math.sin(angle*Math.PI/180))*180/Math.PI;
  if(Math.abs(actual+acute)>1e-8)throw Error('Independent negative principal-angle check failed');
  task.prompt=b(`Найди arcsin(sin ${angle}°). Ответ дай в градусах.`, `arcsin(sin ${angle}°) мәнін тап. Жауапты градуспен бер.`);
  task.answer=String(-acute);task.unit='°';
  task.solution={ru:[`Убираем ${serial} полных оборотов: ${180+acute}° — третья четверть.`,`sin(${180+acute}°) = −sin ${acute}°.`,`arcsin возвращает угол из [−90°; 90°]; подходящий угол ${-acute}°. Ответ отличается от исходного угла.`],
   kk:[`${serial} толық айналымды алып тастаймыз: ${180+acute}° — үшінші ширек.`,`sin(${180+acute}°) = −sin ${acute}°.`,`arcsin [−90°; 90°] аралығындағы бұрышты қайтарады; сәйкес бұрыш ${-acute}°. Жауап бастапқы бұрыштан өзгеше.`]};
  task.hints={ru:['Сначала убери полные обороты.','В третьей четверти синус отрицателен.','Выбери отрицательный угол из [−90°; 90°] с тем же синусом.'],
   kk:['Алдымен толық айналымдарды алып таста.','Үшінші ширекте синус теріс.','Синусы бірдей болатын [−90°; 90°] аралығындағы теріс бұрышты таңда.']};
 }
 if(id==='school-sampling'&&level===3){
  task.prompt.ru=task.prompt.ru.replace('учеников класса','учеников школы');
  task.prompt.kk=task.prompt.kk.replace('Сыныптың барлық','Мектептің барлық');
 }
 if(id==='school-combinatorics'&&level===1)task.prompt.ru=task.prompt.ru.replace(/Есть (\d+) разные футболки/,'Есть $1 разных футболок');
 // Typography only: formula operators and decimal separators are untouched.
 for(const value of [task.prompt,task.skill,task.commonError])if(value&&typeof value==='object'){
  value.ru=value.ru.trim();value.kk=value.kk.trim();
 }
 return task;
}
