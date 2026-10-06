import type{Task}from'./engine.ts';
type Text={ru:string;kk:string};const b=(ru:string,kk:string):Text=>({ru,kk});
function single(task:Task):Task{
 const n=Number(task.answer);if(!Number.isFinite(n))throw Error('Invalid context key');
 const values=[String(task.answer),String(n+1),String(n-1),String(n+2)];
 const shift=[...task.id].reduce((s,c)=>(s*31+c.charCodeAt(0))>>>0,0)%4;
 return{...task,type:'single',options:[...values.slice(shift),...values.slice(0,shift)]};
}
/** Three authored models. Values are fictional givens, not current prices. */
export function examContext(variant:number):Task[]{
 const k=variant+10,family=(variant-1)%3;
 let context:Text,questions:Text[],answers:number[],topicIds:string[],steps:Text[],units:string[];
 if(family===0){
  const count=12+variant,price=300+20*variant,discount=15,delivery=500+10*variant;
  const total=count*price,saved=total*discount/100,net=total-saved,all=net+delivery;
  context=b(`Класс заказывает ${count} учебных наборов по ${price} ₸. Скидка на наборы — ${discount}%, доставка — ${delivery} ₸ без скидки. Расходы делят поровну между ${count} учениками.`,`Сынып әрқайсысы ${price} ₸ тұратын ${count} оқу жиынтығына тапсырыс берді. Жиынтықтарға ${discount}% жеңілдік бар, жеткізуге жеңілдік жоқ: ${delivery} ₸. Шығын ${count} оқушыға тең бөлінеді.`);
  questions=[b('Сколько стоят все наборы до скидки?','Жеңілдікке дейін барлық жиынтық қанша тұрады?'),b('Какова сумма скидки?','Жеңілдік сомасы қанша?'),b('Сколько стоят наборы после скидки, без доставки?','Жеңілдіктен кейін, жеткізусіз жиынтықтардың құны қанша?'),b('Сколько нужно заплатить с доставкой?','Жеткізумен бірге қанша төлеу керек?'),b('Какова доля одного ученика в общей сумме? Округли до сотых тенге.','Жалпы сомада бір оқушының үлесі қанша? Теңгенің жүздік үлесіне дейін дөңгелекте.')];
  answers=[total,saved,net,all,Math.round(all/count*100)/100];topicIds=['numbers','percentages','percentages','numbers','fractions'];units=Array(5).fill('₸');
  steps=[b(`Стоимость наборов: ${count}·${price}=${total} ₸.`,`Жиынтықтардың құны: ${count}·${price}=${total} ₸.`),b(`Скидка: ${total}·${discount}/100=${saved} ₸.`,`Жеңілдік: ${total}·${discount}/100=${saved} ₸.`),b(`Наборы после скидки: ${total}−${saved}=${net} ₸.`,`Жеңілдіктен кейін: ${total}−${saved}=${net} ₸.`),b(`Общий расход: ${net}+${delivery}=${all} ₸.`,`Жалпы шығын: ${net}+${delivery}=${all} ₸.`),b(`Доля ученика: ${all}/${count}≈${answers[4]} ₸.`,`Оқушының үлесі: ${all}/${count}≈${answers[4]} ₸.`)];
 }else if(family===1){
  const a=k+4,c=k,side=2,bagsize=7,price=600;
  const outer=a*c,inner=(a-2*side)*(c-2*side),path=outer-inner,bags=Math.ceil(path/bagsize),cost=bags*price;
  context=b(`Прямоугольная площадка ${a}×${c} м. Внутри вдоль всех четырёх сторон оставляют дорожку шириной ${side} м, а оставшуюся часть засевают травой. Один мешок покрытия рассчитан на ${bagsize} м² дорожки и стоит ${price} ₸; покупают только целые мешки.`,`Тіктөртбұрышты алаңның өлшемі ${a}×${c} м. Ішкі жағынан төрт қабырғаның бойына ені ${side} м жол қалдырып, қалған бөлікке шөп егеді. Бір қап жабын жолдың ${bagsize} м² ауданына жетеді және ${price} ₸ тұрады; тек бүтін қап сатып алынады.`);
  questions=[b('Чему равна площадь всей площадки?','Бүкіл алаңның ауданы қанша?'),b('Какова длина большей стороны участка с травой?','Шөп егілетін бөліктің үлкен қабырғасының ұзындығы қанша?'),b('Какова площадь участка с травой?','Шөп егілетін бөліктің ауданы қанша?'),b('Какова площадь дорожки?','Жолдың ауданы қанша?'),b('Сколько стоит минимальное достаточное количество мешков покрытия?','Жеткілікті болатын ең аз қап санының құны қанша?')];
  answers=[outer,a-2*side,inner,path,cost];topicIds=['quadrilaterals','numbers','quadrilaterals','quadrilaterals','numbers'];units=['м²','м','м²','м²','₸'];
  steps=[b(`Общая площадь: ${a}·${c}=${outer} м².`,`Жалпы аудан: ${a}·${c}=${outer} м².`),b(`Дорожка с двух сторон: внутренние стороны ${a}−2·${side}=${a-2*side} и ${c}−2·${side}=${c-2*side} м.`,`Жол екі жақта да бар: ішкі қабырғалар ${a}−2·${side}=${a-2*side} және ${c}−2·${side}=${c-2*side} м.`),b(`Площадь травы: ${a-2*side}·${c-2*side}=${inner} м².`,`Шөп ауданы: ${a-2*side}·${c-2*side}=${inner} м².`),b(`Дорожка: ${outer}−${inner}=${path} м².`,`Жол: ${outer}−${inner}=${path} м².`),b(`Нужно округлить ${path}/${bagsize} вверх: ${bags} мешков. Стоимость ${bags}·${price}=${cost} ₸.`,`${path}/${bagsize} санын жоғары қарай дөңгелектейміз: ${bags} қап. Құны ${bags}·${price}=${cost} ₸.`)];
 }else{
  const v1=10+variant,v2=6+variant,t1=2,t2=3,pause=1;
  const d1=v1*t1,d2=v2*t2,total=d1+d2,time=t1+t2+pause;
  context=b(`Велосипедист ехал ${t1} ч со скоростью ${v1} км/ч, затем отдыхал ${pause} ч и ещё ${t2} ч ехал со скоростью ${v2} км/ч. Скорость на каждом участке постоянная.`,`Велосипедші ${v1} км/сағ жылдамдықпен ${t1} сағ жүрді, кейін ${pause} сағ демалып, тағы ${v2} км/сағ жылдамдықпен ${t2} сағ жүрді. Әр бөліктегі жылдамдық тұрақты.`);
  questions=[b('Каков путь на первом участке?','Бірінші бөліктегі жол қанша?'),b('Каков путь на втором участке?','Екінші бөліктегі жол қанша?'),b('Сколько времени прошло от начала до конца вместе с отдыхом?','Демалысты қоса алғанда, басынан аяғына дейін қанша уақыт өтті?'),b('Каков весь пройденный путь?','Барлық жүрілген жол қанша?'),b('Какова средняя скорость за всё время, включая отдых? Округли до сотых км/ч.','Демалысты қоса алғандағы бүкіл уақыт бойынша орташа жылдамдық қанша? Км/сағ бірлігіндегі мәнді жүздік үлеске дейін дөңгелекте.')];
  answers=[d1,d2,time,total,Math.round(total/time*100)/100];topicIds=['motion','motion','numbers','motion','motion'];units=['км','км','ч','км','км/ч'];
  steps=[b(`Первый путь: ${v1}·${t1}=${d1} км.`,`Бірінші жол: ${v1}·${t1}=${d1} км.`),b(`Второй путь: ${v2}·${t2}=${d2} км.`,`Екінші жол: ${v2}·${t2}=${d2} км.`),b(`Всё время: ${t1}+${pause}+${t2}=${time} ч.`,`Барлық уақыт: ${t1}+${pause}+${t2}=${time} сағ.`),b(`Весь путь: ${d1}+${d2}=${total} км.`,`Барлық жол: ${d1}+${d2}=${total} км.`),b(`Средняя скорость — весь путь / всё время: ${total}/${time}≈${answers[4]} км/ч. Отдых включён; среднее двух скоростей здесь не подходит.`,`Орташа жылдамдық — барлық жол / барлық уақыт: ${total}/${time}≈${answers[4]} км/сағ. Демалыс кіреді; екі жылдамдықтың орташа арифметикалық мәні бұл жерде жарамайды.`)];
 }
 return questions.map((prompt,i)=>single({id:`exam-2026.1-context-${variant}-${i+1}`,version:'exam-2026.1',topicId:topicIds[i],prompt,context,answer:String(answers[i]),type:'number',difficulty:[1,1,1,2,3][i],units:units[i],precision:i===4&&family!==1?2:undefined,hints:{ru:[],kk:[]},solution:{ru:steps.map(s=>s.ru),kk:steps.map(s=>s.kk)},assessmentTrack:'profile',curriculumSection:family===1?'16-17':'13',skillIds:[`${topicIds[i]}:context-${family}-${i}`],contextFamily:['shared-cost','garden-path','average-speed'][family],purpose:'exam',reviewStatus:'ai-math-reviewed; difficulty-awaits-calibration'}));
}

export function basicMatchingReserve():Task[]{
 const triples:number[][]=[];for(let a=2;a<=8;a++)for(let b=a+1;b<=8;b++)for(let c=b+1;c<=8;c++)triples.push([a,b,c]);
 return triples.slice(0,20).map((values,i)=>({id:`exam-2026.1-square-match-${i+1}`,version:'exam-2026.1',topicId:'powers',type:'matching',difficulty:1,prompt:b(`Сопоставь степени ${values.map(n=>`${n}²`).join(', ')} и их значения.`,`${values.map(n=>`${n}²`).join(', ')} дәрежелерін мәндерімен сәйкестендір.`),pairs:values.map(n=>({left:`${n}²`,right:String(n*n)})),options:values.map(n=>String(n*n)).reverse(),answer:values.map(n=>String(n*n)),hints:{ru:[],kk:[]},solution:{ru:values.map(n=>`${n}²=${n}·${n}=${n*n}.`),kk:values.map(n=>`${n}²=${n}·${n}=${n*n}.`)},skillIds:['powers:evaluate-square'],purpose:'exam',reviewStatus:'ai-math-reviewed'}));
}
