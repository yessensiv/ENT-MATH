export type LessonWork={stage:number;exampleIndex:number;simple:boolean;answer:string;steps:string;updatedAt:number};
export function validateLessonWork(input:Record<string,unknown>):LessonWork {
 const {stage,exampleIndex,simple,answer,steps,updatedAt}=input;
 if(!Number.isInteger(stage)||Number(stage)<0||Number(stage)>3||!Number.isInteger(exampleIndex)||Number(exampleIndex)<0||Number(exampleIndex)>3||typeof simple!=='boolean'||typeof answer!=='string'||answer.length>300||typeof steps!=='string'||steps.length>4000||!Number.isSafeInteger(updatedAt)||Number(updatedAt)<0)throw Error('INVALID_LESSON_WORK');
 return {stage:Number(stage),exampleIndex:Number(exampleIndex),simple,answer,steps,updatedAt:Number(updatedAt)};
}
export function saveLessonWork(existing:Record<string,LessonWork>,topicId:string,draft:LessonWork){
 const prior=existing[topicId];if(prior&&prior.updatedAt>=draft.updatedAt)return false;existing[topicId]=draft;return true;
}
