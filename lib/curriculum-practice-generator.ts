/** Build-time authoring only. No provider calls, invented textbook provenance,
 * or changes to the existing lesson, diagnosis and exam snapshots. */
// @ts-expect-error Native Node verification uses explicit extensions.
import {topics,generateReviewTask,validateGeneratedTask,reviewCapacity,type Task as AuthoredTask} from './content.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {schoolTopics} from './school-content.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {schoolExtensionTopics,generateSchoolExtensionPractice} from './school-extension-content.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {schoolAdvancedTopics,generateSchoolAdvancedPractice} from './school-advanced-content.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {generateSchoolReviewTask,validateSchoolReviewTask,schoolReviewCapacity} from './school-review-content.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {calculate,type Task,type LocalText} from './engine.ts';
// @ts-expect-error Native Node verification uses explicit extensions.
import {editCurriculumPractice} from './curriculum-editorial.ts';

export const curriculumPracticeVersion='author-practice-2026-10-09.2';
export const practiceTopics=[...topics,...schoolTopics,...schoolExtensionTopics,...schoolAdvancedTopics];
const b=(ru:string,kk:string):LocalText=>({ru,kk});
type Level=1|2|3;
export type PracticeOrigin={kind:'authored';author:'ENT Math';verification:'computed';editorialReview:'pending';version:string};
export type CurriculumPracticeTask=Task&{
 curriculumPractice:{version:string;serial:number;level:Level};
 practiceOrigin:PracticeOrigin;purpose:'practice';subtopic:{id:string;title:LocalText};
 methodFamily:string;skillIds:string[];reviewReserved:boolean;
};
export function curriculumPracticeCapacity(topicId:string,level:Level):number{
 if(!practiceTopics.some(t=>t.id===topicId)||![1,2,3].includes(level))return 0;
 if(topicId==='numbers'&&level===3)return 25;
 if(schoolReviewCapacity(topicId,level))return schoolReviewCapacity(topicId,level);
 if(topicId.startsWith('school-'))return 25;
 return reviewCapacity(topicId,level);
}
function operationOrder(serial:number):AuthoredTask{
 const n=serial+5,answer=4*n+4;
 const expression=`((${n+3})^2-(${n-1})^2)/4+2*(${n+1})`;
 if(calculate(expression)!==answer)throw Error('Independent operation order check failed');
 return {id:`order-${serial}`,topicId:'numbers',level:3,type:'number',answer:String(answer),
  prompt:b(`Вычисли ((${n+3})² − (${n-1})²) : 4 + 2 · (${n+1}).`,
   `((${n+3})² − (${n-1})²) : 4 + 2 · (${n+1}) мәнін есепте.`),
  solution:{ru:[`В скобках сначала степени: ${n+3}²=${(n+3)**2}, ${n-1}²=${(n-1)**2}.`,
   `Разность ${(n+3)**2}−${(n-1)**2}=${8*n+8}; делим на 4: ${2*n+2}.`,
   `Отдельно 2·${n+1}=${2*n+2}; складываем: ${answer}.`],
   kk:[`Жақшада алдымен дәрежелер: ${n+3}²=${(n+3)**2}, ${n-1}²=${(n-1)**2}.`,
    `Айырымы ${(n+3)**2}−${(n-1)**2}=${8*n+8}; 4-ке бөлеміз: ${2*n+2}.`,
    `Бөлек 2·${n+1}=${2*n+2}; қосамыз: ${answer}.`]},
  hints:{ru:['Отметь самую внешнюю операцию: две части в конце нужно сложить.',
   'В первой части сначала вычисли обе степени и разность внутри скобок.',
   'Раздели первую часть на 4, во второй выполни умножение. Затем сложи.'],
   kk:['Ең сыртқы амалды белгіле: соңында екі бөлікті қосу керек.',
    'Бірінші бөлікте алдымен екі дәрежені және жақша ішіндегі айырманы есепте.',
    'Бірінші бөлікті 4-ке бөл, екіншісінде көбейтуді орында. Кейін қос.']},
  skill:b('Несколько уровней скобок, степени и порядок действий','Бірнеше деңгейлі жақша, дәреже және амалдар реті'),
  commonError:b('Не выполняй внешнее деление, пока не закончены действия в скобках.',
   'Жақша ішіндегі амалдар аяқталмай, сыртқы бөлуді орындама.')};
}
export function makeCurriculumPractice(topicId:string,serial:number,level:Level,reserved=false):CurriculumPracticeTask|null{
 if(!Number.isSafeInteger(serial)||serial<1||serial>curriculumPracticeCapacity(topicId,level))return null;
 const topic=practiceTopics.find(t=>t.id===topicId);if(!topic)return null;
 let raw:AuthoredTask|null=null,kind='parameter';
 if(topicId==='numbers'&&level===3){raw=operationOrder(serial);kind='nested-order';}
 else if(schoolReviewCapacity(topicId,level)){
  raw=generateSchoolReviewTask(topicId,serial,level);
  if(raw&&!validateSchoolReviewTask(raw).valid)return null;
 }else if(topicId.startsWith('school-')){
  raw=generateSchoolExtensionPractice(topicId,serial,level)??generateSchoolAdvancedPractice(topicId,serial,level);
 }else{
  raw=generateReviewTask(topicId,serial,level);
  if(raw&&!validateGeneratedTask(raw).valid)return null;
 }
 if(!raw)return null;
 raw=editCurriculumPractice(raw,serial,level);
 // Matching exercises need their actual givens in the condition. A generic
 // heading alone can look identical to a worked lesson example.
 if(raw.type==='matching'&&raw.pairs){
  const givens=raw.pairs.map(pair=>pair.left).join('; ');
  if(!raw.prompt.ru.includes(givens))raw.prompt=b(`${raw.prompt.ru} Данные: ${givens}.`,`${raw.prompt.kk} Берілгені: ${givens}.`);
 }
 kind=raw.generation?.kind??kind;
 const methodFamily=`${topicId}:authored-${level}-${kind}`;
 const skill=typeof raw.skill==='object'?raw.skill:topic.title;
 // Public skill labels must never contain a worked step or the answer key.
 const subtopic={id:methodFamily,title:skill};
 // Do not reuse review/exam IDs or their provenance after changing the ID.
 const {generation:unusedGeneration,...content}=raw;void unusedGeneration;
 const solution=structuredClone(raw.solution);
 for(const lang of ['ru','kk'] as const){
  const answer=Array.isArray(raw.answer)?raw.answer.join('; '):raw.answer;
  if(solution[lang].length<3)solution[lang].push(`${lang==='ru'?'Ответ':'Жауап'}: ${answer}${raw.unit?' '+raw.unit:''}.`);
 }
 return {...content,id:`practice-v1-${topicId}-${level}-${serial}`,difficulty:level,units:raw.unit,
  solution,skill,subtopic,methodFamily,skillIds:[methodFamily],modelExample:false,reviewReserved:reserved,
  purpose:'practice',version:curriculumPracticeVersion,reviewStatus:'math-checked-translation-pending',
  curriculumPractice:{version:curriculumPracticeVersion,serial,level},
  practiceOrigin:{kind:'authored',author:'ENT Math',verification:'computed',editorialReview:'pending',version:curriculumPracticeVersion}};
}
export function validateCurriculumPractice(raw:unknown):{valid:boolean;errors:string[]}{
 if(!raw||typeof raw!=='object')return{valid:false,errors:['Missing authored practice task']};
 const task=raw as CurriculumPracticeTask,meta=task.curriculumPractice;
 if(meta?.version!==curriculumPracticeVersion)return{valid:false,errors:['Unknown authored practice provenance']};
 try{
  const canonical=makeCurriculumPractice(task.topicId,meta.serial,meta.level,Boolean(task.reviewReserved));
  return canonical&&JSON.stringify(canonical)===JSON.stringify(task)?{valid:true,errors:[]}:
   {valid:false,errors:['Condition, key, translation, method or verification changed']};
 }catch(error){return{valid:false,errors:[String(error)]};}
}
