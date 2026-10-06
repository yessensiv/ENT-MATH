/** Immutable scoring release. A later rule requires a NEW id and implementation. */
export const scoring2024={
 id:'ent-p18-2024-02-28.v1',algorithm:'selection-count-v1',singleMax:1,selectionMax:2,
 partial:{'1':{minimumCorrect:1,maximumWrong:1},'2':{minimumCorrect:1,maximumWrong:1},'3':{minimumCorrect:2,maximumWrong:1}},
} as const;
export type ScoringSnapshot=typeof scoring2024;
export type ExamRuleSnapshot={year:number;checkedAt:string;version:string;source:string;trainingMinutes:{profile:number;literacy:number};note:{ru:string;kk:string};scoring?:ScoringSnapshot};
export const EXAM_RULES:ExamRuleSnapshot={
 year:2026,checkedAt:'2026-10-06',version:'Пункт 18, редакция 28.02.2024 № 92',
 source:'https://old.adilet.zan.kz/rus/docs/V1700015173',trainingMinutes:{profile:80,literacy:20},scoring:structuredClone(scoring2024),
 note:{ru:'Время отдельного предмета — настройка платформы. Баллы — по пункту 18 правил ЕНТ. Это авторский тренировочный вариант, не официальный тест НЦТ.',kk:'Жеке пән уақыты — платформаның баптауы. Ұпай ЕНТ ережелерінің 18-тармағымен есептеледі. Бұл авторлық жаттығу нұсқасы, ҰТО-ның ресми тесті емес.'},
};
const signature=(value:unknown):string=>Array.isArray(value)?JSON.stringify(value):value&&typeof value==='object'?JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,signature(v)])):JSON.stringify(value);
const frozenSignature=signature(scoring2024);
for(const row of Object.values(scoring2024.partial))Object.freeze(row);
Object.freeze(scoring2024.partial);Object.freeze(scoring2024);
/** Accept only the known old metadata or the exact registered scoring release. */
export function resolveExamScoring(rules:ExamRuleSnapshot):ScoringSnapshot{
 if(rules.scoring){if(signature(rules.scoring)!==frozenSignature)throw Error('EXAM_SCORING_VERSION_UNSUPPORTED');return structuredClone(scoring2024);}
 if(rules.year===2026&&rules.version==='Пункт 18, редакция 28.02.2024 № 92'&&rules.source==='https://old.adilet.zan.kz/rus/docs/V1700015173')return structuredClone(scoring2024);
 throw Error('EXAM_SCORING_VERSION_UNSUPPORTED');
}
export function selectionCredit(expected:number,hits:number,wrong:number,full:boolean,scoring:ScoringSnapshot){
 if(![1,2,3].includes(expected))throw Error('EXAM_SELECTION_KEY_UNSUPPORTED');
 if(full)return scoring.selectionMax;
 const row=scoring.partial[String(expected) as '1'|'2'|'3'];return hits>=row.minimumCorrect&&wrong<=row.maximumWrong?1:0;
}
export function scoreExplanation(points:number,max:number,hits?:number,wrong?:number){
 if(max===1)return{ru:points?'Выбран верный ответ: 1 балл.':'Верный ответ не выбран: 0 баллов.',kk:points?'Дұрыс жауап таңдалды: 1 балл.':'Дұрыс жауап таңдалмады: 0 балл.'};
 return{ru:`Верных выборов: ${hits??0}, неверных: ${wrong??0}. ${points===2?'Полный верный набор — 2 балла.':points===1?'Часть ответа верна; по пункту 18 начислен 1 балл.':'Недостаточно верных выборов либо два и более неверных — 0 баллов.'} Пропуски не дают верного выбора.`,kk:`Дұрыс таңдаулар: ${hits??0}, қате таңдаулар: ${wrong??0}. ${points===2?'Толық дұрыс жиынтық — 2 балл.':points===1?'Жауаптың бір бөлігі дұрыс; 18-тармақ бойынша 1 балл.':'Дұрыс таңдаулар жеткіліксіз немесе екі не одан көп қате бар — 0 балл.'} Бос жауап дұрыс таңдау болып саналмайды.`};
}
