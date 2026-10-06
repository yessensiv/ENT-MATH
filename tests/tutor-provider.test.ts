import{test}from'node:test';import assert from'node:assert/strict';
// @ts-expect-error Native Node tests.
import{tutorProvider}from'../lib/tutor-provider.ts';
test('Gemini uses official HTTPS endpoint and requires an explicit Gemini model',()=>{
 const p=tutorProvider({TUTOR_PROVIDER:'gemini',TUTOR_MODEL:'gemini-test-model',TUTOR_BASE_URL:'https://example.invalid'});assert.equal(p.url.href,'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');assert.equal(p.model,'gemini-test-model');
 assert.throws(()=>tutorProvider({TUTOR_PROVIDER:'gemini'}),/MODEL/);assert.throws(()=>tutorProvider({TUTOR_PROVIDER:'gemini',TUTOR_MODEL:'gpt-test'}),/MODEL/);
 assert.equal(tutorProvider({TUTOR_PROVIDER:'gemini',TUTOR_MODEL:'gemini-text',TUTOR_VISION_MODEL:'gemini-vision'},true).model,'gemini-vision');
});
test('existing compatible providers remain supported; unsafe configurations are rejected',()=>{
 assert.equal(tutorProvider({}).url.href,'https://api.openai.com/v1/chat/completions');assert.equal(tutorProvider({TUTOR_BASE_URL:'https://example.invalid/v1///',TUTOR_MODEL:'test'}).model,'test');
 for(const url of ['http://example.invalid','https://user:secret@example.invalid','https://example.invalid/?key=secret','https://example.invalid/#x'])assert.throws(()=>tutorProvider({TUTOR_BASE_URL:url}));
 assert.throws(()=>tutorProvider({TUTOR_PROVIDER:'unknown'}));
});
