import tasks from '../content/curriculum-practice/tasks.json' with {type:'json'};
import type {Task} from './engine';

/** Static, checked practice for every topic. Build-time authoring stays off the client. */
export const curriculumPracticeTasks=tasks as unknown as Task[];
