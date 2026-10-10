import {test} from 'node:test';import assert from 'node:assert/strict';import {solutionText} from '../lib/solution-text.ts';
test('existing bilingual final answers appear once and an omitted answer includes its units',()=>{
 assert.equal(solutionText(['15²=225. Ответ: 15.'],'15','ru'),'15²=225. Ответ: 15.');
 assert.equal(solutionText(['Есептейміз.','Жауабы: 4.'],'4','kk'),'Есептейміз.\n\nЖауабы: 4.');
 assert.equal(solutionText(['3 · 180 − 100 = 440.'],'440','ru','₸'),'3 · 180 − 100 = 440.\n\nОтвет: 440 ₸.');
});
