import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMath, mathSegments, mathematicalHtml} from '../lib/math-format.ts';
test('parenthesized division in actual lesson becomes a fraction',()=>{
  const segments=mathSegments('(9)/3=3.');
  assert.deepEqual(segments.find(s=>s.math)?.math,{kind:'fraction',children:[{kind:'number',value:'9'},{kind:'number',value:'3'}]});
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
const visible=node=>'value' in node?node.value:node.children.map(visible).join('');
test('embedded fractions, Unicode indices and Kazakh suffixes contain no raw operators',()=>{
  for(const text of ['3/2-ге көбейт','(x²−9)/(x−3)','a/b + c/d = (ad+bc)/(bd)','2^?=8','∫xⁿ dx=xⁿ⁺¹/(n+1)+C','|Ax₀+By₀+Cz₀+D|/√(A²+B²+C²)','sin^2(x)','1/4,1/2,1/4','2^(3+2)','m₁p₁/100+m₂p₂/100']) {
    const formatted=mathSegments(text);
    assert.doesNotMatch(formatted.map(s=>s.math?visible(s.math):s.text).join(''),/[\/^]/,text);
  }
});
test('a comma-separated probability list retains three separate fractions',()=>{
  const fractions=mathSegments('1/4,1/2,1/4').filter(s=>s.math);
  assert.equal(fractions.length,3);
  assert.deepEqual(fractions.map(s=>s.math.children.map(visible)),[['1','4'],['1','2'],['1','4']]);
});
test('downloaded formulas contain real math and escape untrusted text',()=>{
  const html=mathematicalHtml('(x²−1)/(x−1) <img src=x onerror=alert(1)>');
  assert.match(html,/<mfrac>/);assert.match(html,/<msup>/);
  assert.doesNotMatch(html,/<img|onerror="/);
  assert.match(html,/&lt;img/);
});
test('thousands separators stay inside the fraction operands',()=>{
  for(const separator of [' ','\u00a0','\u202f']){
    const node=mathSegments(`Экономия: 5${separator}600/20${separator}000 = 0,28`).find(s=>s.math).math;
    assert.equal(node.kind,'fraction');
    assert.deepEqual(node.children.map(visible),['5600','20000']);
  }
});
