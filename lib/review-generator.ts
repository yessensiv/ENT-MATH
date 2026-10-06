import * as curriculum from './content';
import {generateSchoolReviewTask,schoolReviewCapacity,validateSchoolReviewTask} from './school-review-content';
import type {ReviewGenerator} from './fresh-tasks';
import type {Task} from './content';

// This module stays on the server. Generated keys are checked before storage.
export const reviewGenerator:ReviewGenerator={
 generateReviewTask(topicId,serial,level){return topicId.startsWith('school-')?generateSchoolReviewTask(topicId,serial,level):curriculum.generateReviewTask(topicId,serial,level);},
 reviewCapacity(topicId,level){return topicId.startsWith('school-')?schoolReviewCapacity(topicId,level):curriculum.reviewCapacity(topicId,level);},
 validateGeneratedTask(raw){return typeof raw==='object'&&raw!==null&&'topicId' in raw&&String(raw.topicId).startsWith('school-')?validateSchoolReviewTask(raw):curriculum.validateGeneratedTask(raw as Task);},
};
