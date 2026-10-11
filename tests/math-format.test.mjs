import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMath, mathSegments} from '../lib/math-format.ts';
test('parenthesized division in actual lesson becomes a fraction',()=>{
  const segments=mathSegments('(9)/3=3.');
  assert.equal(segments[1].math?.kind,'row');
  assert.deepEqual(segments[1].math && 'children' in segments[1].math ? segments[1].math.children[0] : null,{kind:'fraction',children:[{kind:'number',value:'9'},{kind:'number',value:'3'}]});
  assert.equal(segments.map(s=>s.text).join(''),'(9)/3=3.');
});
test('powers, roots and grouped numerator preserve precedence',()=>{
  assert.equal(parseMath('(x+1)/(x-2)')?.kind,'fraction');
  assert.equal(parseMath('sqrt(9)')?.kind,'root');
  assert.equal(parseMath('2^(3+2)')?.kind,'power');
  assert.equal(parseMath('2^-2')?.kind,'power');
  assert.equal(parseMath('1/2+3/4')?.kind,'row');
  assert.equal(parseMath('(2x+1)/(x-2)')?.kind,'fraction');
});
test('Russian and Kazakh prose, dates and invalid input stay unchanged',()=>{
  for(const text of ['Сегодня 11/10/2026','Алдымен есепті оқы.','<script>alert(1)</script>','(9)/','sqrt(']) {
    assert.equal(mathSegments(text).map(s=>s.text).join(''),text);
    assert.ok(mathSegments(text).every(s=>!s.math));
  }
});
