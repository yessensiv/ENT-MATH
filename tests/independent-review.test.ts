import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{independentReviewCoverage}from'../lib/material-review.ts';
test('CMS-03: author cannot approve own mathematics; three approvals require two people',()=>{
 const records=['math','methodology','kazakh'].map(discipline=>({discipline,verdict:'approved',note:JSON.stringify({hash:'v1'}),createdAt:'2026-10-06',reviewerId:'author'}));
 assert.equal(independentReviewCoverage(records,'v1','author').complete,false);
 assert.equal(independentReviewCoverage(records.map(r=>({...r,reviewerId:'other'})),'v1','author').complete,false);
 assert.equal(independentReviewCoverage(records.map(r=>({...r,reviewerId:r.discipline==='math'?'math-reviewer':'language-reviewer'})),'v1','author').complete,true);
 assert.equal(independentReviewCoverage(records,'v2','author').complete,false);
});
