import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native tests.
import{classifyError}from'../lib/engine.ts';
// @ts-expect-error Native tests.
import{proveLinearEquationStep}from'../lib/algebra-proof.ts';
// @ts-expect-error Native tests.
import{reviewLinearWork}from'../lib/linear-work.ts';
test('AI-04: inspect steps in order instead of choosing a later familiar sign error',()=>{
 const r=classifyError('2x+3=11\n3+2=8\n2x=14');assert.equal(r.category,'calculation');assert.match(r.explanation.ru,/3\+2=8/);
});
test('exact affine transitions: signs, fractions, swapped sides, tiny decimals and domain boundaries',()=>{
 let checked=0;for(let a=-8;a<=8;a++){if(!a)continue;for(let x=-6;x<=6;x++){
  const b=x+9,c=a*x+b,start=`${a}*x+${b}=${c}`;
  assert.equal(proveLinearEquationStep(start,`${a}*x=${c-b}`),'correct');
  assert.equal(proveLinearEquationStep(start,`x=(${c}-${b})/${a}`),'correct');
  assert.equal(proveLinearEquationStep(start,`x=${x+1}`),'incorrect');checked++;
 }}assert.equal(checked,208);
 assert.equal(proveLinearEquationStep('x=0.00000000000000000001','x=0'),'incorrect');
 assert.equal(proveLinearEquationStep('0*x=1','x=1'),'incorrect');
 for(const [a,b]of [['x^2=4','x=2'],['x/x=1','x=1'],['sqrt(x)=2','x=4'],['log(x)=0','x=1'],['x=1; x>2','x=1']])assert.equal(proveLinearEquationStep(a,b),'review');
 assert.equal(classifyError('3x+5=20\n20-5=15\n3x=15').category,'unconfirmed');
});
test('work must be anchored in the current authored task; final answers alone do not establish a cause',()=>{
 assert.equal(reviewLinearWork('Реши 3x+5=20.','x+5/3=20/3\nx=5').status,'correct');
 const wrong=reviewLinearWork('Реши 3x+5=20.','3x=25\nx=25/3');assert.equal(wrong.status,'incorrect');assert.ok(wrong.anchoredSteps?.startsWith('3x+5=20\n'));
 assert.equal(reviewLinearWork('Реши 3x+5=20.','x=7').status,'review');
 assert.equal(reviewLinearWork('Реши 3x+5=20.','это другой способ\nx=5').status,'review');
 assert.equal(reviewLinearWork('Реши x^2=4.','x=2').status,'review');
});
test('AI-04: exact transition review generalizes the balancing rule and accepts alternative methods',()=>{
 assert.equal(classifyError('3x+5=20\n3x=25').category,'method');
 for(const steps of ['3x+5=20\n3x=15\nx=5','3x+5=20\nx+5/3=20/3\nx=5','3(x-2)=12\nx-2=4\nx=6','2x=8\n8=2x\nx=4'])assert.equal(classifyError(steps).category,'unconfirmed',steps);
 assert.equal(classifyError('x=7').category,'unconfirmed');
 assert.equal(classifyError('x^2=4\nx=2').category,'unconfirmed','unsupported quadratic reduction must not be labelled verified');
});
