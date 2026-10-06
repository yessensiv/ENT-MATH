import type {Example, Language, Topic} from './content.ts';

export type LessonExampleSelection = {kind:'example'|'life'|'guided'; index?:number; stepIndex?:number};

// Resolve references against published material; learner-supplied solution text is never trusted.
export function lessonTutorExample(topic:Topic|undefined, selection:unknown):{example:Example;stepIndex?:number}|null {
  if(selection===undefined)return null;
  if(!topic||!selection||typeof selection!=='object'||Array.isArray(selection))throw new Error('Invalid lesson example');
  const s=selection as LessonExampleSelection;
  const example=s.kind==='guided'?topic.lesson.guided:s.kind==='life'?topic.lesson.enrichment?.life:
    s.kind==='example'&&Number.isInteger(s.index)&&s.index!>=0?topic.lesson.examples[s.index!]:undefined;
  if(!example||(s.stepIndex!==undefined&&(!Number.isInteger(s.stepIndex)||s.stepIndex<0||s.stepIndex>=example.steps.ru.length)))throw new Error('Invalid lesson example');
  return {example,stepIndex:s.stepIndex};
}

export function lessonTutorReply(topic:Topic, selected:{example:Example;stepIndex?:number}, language:Language, full:boolean):string {
  const {example,stepIndex}=selected,ru=language==='ru';
  if(full)return `${example.problem[language]}\n${example.steps[language].join('\n')}\n${ru?'Ответ':'Жауап'}: ${example.answerText?.[language]??example.answer}`;
  const step=stepIndex??0;
  return [example.problem[language],step>0?`${ru?'Предыдущий шаг':'Алдыңғы қадам'}: ${example.steps[language][step-1]}`:'',
    `${ru?'Разбираем шаг':'Қадамды талдаймыз'} ${step+1}: ${example.steps[language][step]}`,
    `${ru?'Правило и условия':'Ереже және шарттар'}: ${topic.lesson.formula[language]}`,
    topic.lesson.terms[language],
    ru?'Сопоставь этот переход с правилом. Напиши, какое действие непонятно; затем попробуй следующий шаг самостоятельно.':'Осы ауысуды ережемен салыстыр. Қай амал түсініксіз екенін жаз; содан кейін келесі қадамды өзің орындап көр.'].filter(Boolean).join('\n');
}

export function tutorContextKey(topicId:string,taskId?:string){return `${topicId}:${taskId??''}`;}
