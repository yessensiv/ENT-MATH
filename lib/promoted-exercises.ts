/** Exact, reproducibly checked source adaptations. Original IDs stay unchanged.
 * The editorial archive itself is never used as a practice bank.
 */
import data from '../content/promoted/tasks.json' with {type:'json'};
import type {Task} from './engine';
export const promotedExercises=data as Task[];
