import * as curriculum from './content';
import{examReservations}from'./exam-reservations';
import {generateSchoolReviewTask,schoolReviewCapacity,validateSchoolReviewTask} from './school-review-content';
import type {ReviewGenerator} from './fresh-tasks';
import type {Task} from './content';

// This module stays on the server. Generated keys are checked before storage.
export const reviewGenerator:ReviewGenerator={
 generateReviewTask(topicId,serial,level){if(examReservations.has(`review-${topicId}-${level}-${serial}`))return null;return topicId.startsWith('school-')?generateSchoolReviewTask(topicId,serial,level):curriculum.generateReviewTask(topicId,serial,level);},
 reviewCapacity(topicId,level){return topicId.startsWith('school-')?schoolReviewCapacity(topicId,level):curriculum.reviewCapacity(topicId,level);},
 validateGeneratedTask(raw){return typeof raw==='object'&&raw!==null&&'topicId' in raw&&String(raw.topicId).startsWith('school-')?validateSchoolReviewTask(raw):curriculum.validateGeneratedTask(raw as Task);},
};
