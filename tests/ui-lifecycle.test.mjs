import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import ts from 'typescript';

// Execute the application's callbacks, rather than a second implementation of its save logic.
const source = readFileSync(new URL('../components/learning-app.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('learning-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map(), variables = new Map(), effects = [], snapshotStatements = [];
function walk(node, visitor) { visitor(node); ts.forEachChild(node, child => walk(child, visitor)); }
walk(ast, node => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) variables.set(node.name.text, node);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isArrowFunction(node.initializer)) functions.set(node.name.text, node.initializer);
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') effects.push(node);
  if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression)) {
    const left = node.expression.left;
    if (ts.isPropertyAccessExpression(left) && ts.isIdentifier(left.expression) && ['draftSnapshot', 'examSnapshot', 'latestUser'].includes(left.expression.text) && left.name.text === 'current' && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) snapshotStatements.push(node);
  }
});
function calls(node, name) {
  let found = false;
  walk(node, child => { if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && child.expression.text === name) found = true; });
  return found;
}
function references(node, name) {
  let found = false;
  walk(node, child => { if (ts.isIdentifier(child) && child.text === name) found = true; });
  return found;
}
const effectNodes = {
  exam: effects.find(node => calls(node.arguments[0], 'saveExam') && calls(node.arguments[0], 'setTimeout')),
  draft: effects.find(node => calls(node.arguments[0], 'act') && calls(node.arguments[0], 'setSaveStatus')),
  expiry: effects.find(node => calls(node.arguments[0], 'refresh') && references(node.arguments[0], 'expiredHandled')),
};
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const clientFlow = createContext({ exports: {} });
runInContext(compile(readFileSync(new URL('../lib/client-flow.ts', import.meta.url), 'utf8')), clientFlow);
const { createWriteQueue, RequestError } = clientFlow.exports;
const callbackCode = [...functions].filter(([name]) => ['setExamAnswer', 'stampExam', 'stampDraft', 'applyState', 'begin', 'end', 'refresh', 'flushDraft', 'navigate', 'act', 'submitAnswer', 'saveExam'].includes(name)).map(([name, value]) => `var ${name} = ${value.getText(ast)};`).join('\n');
const derivedExamCode = ['examAnswerKey', 'examAnswer', 'examFlags'].map(name => `var ${variables.get(name).getText(ast)};`).join('\n');
const snapshotsCode = snapshotStatements.map(node => node.getText(ast)).join('\n');
const settle = () => new Promise(resolve => setImmediate(resolve));

test('HOME-02: browsing other directions never changes the learner profile',()=>{
  const writes=[],view={};
  const context=createContext({requestGeneration:{current:0},setTrack:v=>view.track=v,setTopicId:v=>view.topic=v,setEditedTopic:()=>{},setTasks:()=>{},setSaveStatus:()=>{},act:v=>writes.push(v),state:{profile:{learningMode:'school',grade:'7',track:'base'}}});
  runInContext(compile(`var changeTrack=${functions.get('changeTrack').getText(ast)};changeTrack('profile');`),context);
  assert.equal(view.track,'profile');assert.equal(writes.length,0);assert.equal(context.state.profile.learningMode,'school');assert.equal(context.state.profile.track,'base');
});

function harness(screen = 'exams') {
  let now = 1_800_000_000_000, sequence = 0, timerId = 0;
  const timers = new Map(), mounted = new Map(), requests = [], notices = [];
  const exam = { id: 'exam-1', startedAt: new Date(now).toISOString(), durationMinutes: 80, flagged: [], answers: {}, questions: [{ id: 'q1', type: 'single' }] };
  const user = { id: 'learner-test' }, profile = { language: 'ru', track: 'profile' };
  let serverState = { user, profile, revision: 0, activeExam: exam };
  const model = { state: serverState, user, screen, busy: false, timeLeft: 4800, examIndex: 0, examAnswerDraft: { key: 'exam-1:0', value: 'A' }, currentTask: { id: 'task-1' }, answer: '42', steps: '2x = 84', hint: 0, reviewId: undefined, feedback: null, diagnosticDone: false, diagnosticAnswers: [], taskIndex: 0, tasks: [{ id: 'task-1' }, { id: 'task-2' }], track: 'profile', saveStatus: '', lang: 'ru', notice: '' };
  const refs = Object.fromEntries(Object.entries({ submitLock: false, submittedTask: '', examLock: false, latestRevision: -1, requestGeneration: 0, expiredHandled: '', draftSnapshot: null, examSnapshot: null, latestUser: user, savedExamSignature: '', savedDraftSignature: '', pending: 0, routeRef: screen, clockOffset: 0, examStamp: { key: '', at: 0 }, draftStamp: { key: '', at: 0 }, optimisticFlags: null }).map(([key, value]) => [key, { current: value }]));
  refs.writeQueue = { current: createWriteQueue() };
  refs.pendingSubmission={current:null};
  refs.lessonSnapshot={current:null};refs.restoredLesson={current:false};
  class ClockDate extends Date { static now() { return now; } }
  const set = key => value => { model[key] = typeof value === 'function' ? value(model[key]) : value; if (key === 'notice') notices.push(model[key]); };
  const api = (url, body) => new Promise((resolve, reject) => requests.push({ url, body: body && structuredClone(body), resolve, reject }));
  const globals = () => ({
    ...model, ...refs, activeExam: model.state.activeExam, question: model.state.activeExam?.questions?.[model.examIndex], questions: model.state.activeExam?.questions ?? [],
    setLessonDrafts:set('lessonDrafts'),setSchoolGrade: set('schoolGrade'), setLessonOrigin: set('lessonOrigin'), setState: set('state'), setExamAnswerDraft: set('examAnswerDraft'), setBusy: set('busy'), setServiceError: set('serviceError'), setSaveStatus: set('saveStatus'), setScreen: set('screen'), setMenu: set('menu'), setOnboard: set('onboard'), setLang: set('lang'), setTrack: set('track'), setLoading: set('loading'), setFeedback: set('feedback'), setExamReview: set('examReview'), setExamIndex: set('examIndex'), setDiagnosticAnswers: set('diagnosticAnswers'), setDiagnosticDone: set('diagnosticDone'), setTaskIndex: set('taskIndex'), setAnswer: set('answer'), setNotice: set('notice'),
    api, RequestError, Date: ClockDate, tr: ru => ru, crypto,
    location: { hash: `#${model.screen}` }, window: { scrollTo() {} },
    setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  let context;
  function render(kind) {
    context = createContext(globals());
    runInContext(compile(derivedExamCode), context);
    runInContext(compile(callbackCode), context);
    runInContext(compile(snapshotsCode), context);
    if (!kind) return;
    const node = effectNodes[kind];
    runInContext(compile(`var dependencies = ${node.arguments[1].getText(ast)}; var effect = ${node.arguments[0].getText(ast)};`), context);
    const previous = mounted.get(kind), deps = Array.from(context.dependencies);
    if (previous && deps.length === previous.deps.length && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
    previous?.cleanup?.();
    mounted.set(kind, { deps, cleanup: context.effect() });
  }
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due; timers.delete(next[0]); next[1].callback();
    }
    now = end;
  }
  function complete(request, extra = {}) {
    const body = request.body;
    if (body?.action === 'exam-answer' && serverState.activeExam) serverState = { ...serverState, activeExam: { ...serverState.activeExam, answers: { ...serverState.activeExam.answers, [body.index]: body.answer } } };
    serverState = { ...serverState, revision: ++sequence, ...extra };
    request.resolve(structuredClone(serverState));
  }
  return { model, refs, requests, notices, render, advance, complete, invoke: (name, ...args) => context[name](...args), get visibleExamAnswer() { return context.examAnswer; }, get now() { return now; }, get timerCount() { return timers.size; } };
}

test('an exam edit made while A is saving is saved as B after the connection completes', async () => {
  const h = harness();
  h.render('exam'); h.advance(900); await settle();
  assert.equal(h.requests[0].body.answer, 'A'); assert.equal(h.refs.examLock.current, true);
  h.invoke('setExamAnswer', 'B'); h.render('exam'); h.advance(900); await settle();
  assert.equal(h.requests.length, 1, 'the second edit waits while the first save is pending');
  h.complete(h.requests[0]); await settle();
  h.render('exam'); h.advance(900); await settle();
  assert.equal(h.requests.length, 2); assert.equal(h.requests[1].body.answer, 'B');
  h.render('exam'); h.complete(h.requests[1]); await settle(); h.render('exam'); h.advance(1800); await settle();
  assert.equal(h.model.state.activeExam.answers['0'], 'B');
  assert.equal(h.requests.length, 2, 'a successfully saved answer does not start an endless save loop');
});

test('leaving an exam during a slow A save queues the latest B answer before the page changes', async () => {
  const h = harness(); h.render('exam'); h.advance(900); await settle();
  h.invoke('setExamAnswer', 'B'); h.render('exam'); h.invoke('navigate', 'map'); h.render('exam');
  assert.equal(h.requests.length, 1, 'the exit save waits behind A in the write queue');
  h.complete(h.requests[0]); await settle();
  assert.equal(h.requests.length, 2); assert.equal(h.requests[1].body.answer, 'B');
  assert.ok(h.requests[1].body.updatedAt > h.requests[0].body.updatedAt);
  h.complete(h.requests[1]); await settle(); h.advance(1800); await settle();
  assert.equal(h.model.state.activeExam.answers['0'], 'B'); assert.equal(h.model.screen, 'map'); assert.equal(h.requests.length, 2);
});

for (const screen of ['practice', 'diagnostic', 'exams']) {
  test(`leaving ${screen} before the debounce flushes the latest answer`, async () => {
    const h = harness(screen);
    h.render(screen === 'exams' ? 'exam' : 'draft');
    h.invoke('navigate', 'map');
    h.render(screen === 'exams' ? 'exam' : 'draft'); h.advance(1800); await settle();
    assert.equal(h.requests.length, 1, 'navigation preserves the pending answer even after effect cleanup');
    const body = h.requests[0].body;
    assert.equal(body.answer, screen === 'exams' ? 'A' : '42');
    assert.equal(body.action, screen === 'exams' ? 'exam-answer' : 'save-draft');
    if (screen !== 'exams') assert.equal(body.kind, screen);
    if (screen === 'practice') assert.equal(body.steps, '2x = 84');
    assert.equal(h.model.screen, 'map');
    h.complete(h.requests[0]); await settle();
  });
}

test('feedback from an earlier task cannot overwrite the newly opened practice', async () => {
  const h = harness('practice'); h.render();
  const pending = h.invoke('submitAnswer'); await settle();
  assert.equal(h.requests[0].body.taskId, 'task-1');
  assert.equal(h.requests[0].body.draftUpdatedAt, h.refs.draftSnapshot.current.updatedAt);
  h.invoke('navigate', 'map'); h.model.currentTask = { id: 'task-2' }; h.model.answer = '17';
  h.render(); h.invoke('navigate', 'practice'); h.render();
  h.complete(h.requests[0], { feedback: { correct: true, taskId: 'task-1' } }); await pending;
  assert.equal(h.model.feedback, null); assert.equal(h.model.saveStatus, '');
  assert.equal(h.model.answer, '17'); assert.equal(h.refs.submitLock.current, false);
});

test('a draft edited in a new practice retries after the earlier task submission unlocks', async () => {
  const h = harness('practice'); h.render();
  const submitting = h.invoke('submitAnswer'); await settle();
  h.invoke('navigate', 'map'); h.model.currentTask = { id: 'task-2' }; h.model.answer = '17';
  h.render(); h.invoke('navigate', 'practice'); h.render('draft'); h.advance(900); await settle();
  assert.equal(h.requests.length, 1, 'the new draft waits for the active submission');
  h.complete(h.requests[0], { feedback: { correct: true, taskId: 'task-1' } }); await submitting;
  h.render('draft'); h.advance(900); await settle();
  assert.equal(h.requests.length, 2, 'unlock must cause a retry rather than silently dropping the new draft');
  assert.equal(h.requests[1].body.action, 'save-draft'); assert.equal(h.requests[1].body.taskId, 'task-2'); assert.equal(h.requests[1].body.answer, '17');
  h.render('draft'); h.complete(h.requests[1]); await settle(); h.render('draft'); h.advance(1800); await settle();
  assert.equal(h.requests.length, 2, 'retrying the new draft must stop after it is saved');
});

test('a normal draft save does not repeat after the busy state returns to idle', async () => {
  const h = harness('practice'); h.model.diagnosticDone = true;
  h.render('draft'); h.advance(900); await settle(); h.render('draft');
  assert.equal(h.requests.length, 1, 'practice remains saveable after a completed diagnostic');
  h.complete(h.requests[0]); await settle(); h.render('draft'); h.advance(2700); await settle();
  assert.equal(h.requests.length, 1, 'an unchanged draft must not cause an endless busy/save cycle');
  assert.equal(h.model.saveStatus, 'draft');
});

test('a stale zero from a previous timer does not expire a newly started exam', () => {
  const h = harness(); h.model.timeLeft = 0; h.render('expiry');
  assert.equal(h.requests.length, 0); assert.equal(h.refs.expiredHandled.current, ''); assert.equal(h.notices.length, 0);
});

test('the expiry message is shown only after the server confirms the timeout', async () => {
  for (const timedOut of [false, true]) {
    const h = harness(); h.model.state.activeExam.startedAt = new Date(h.now - 90 * 60000).toISOString();
    h.model.timeLeft = 0; h.render('expiry');
    assert.equal(h.requests.length, 1); assert.equal(h.requests[0].url, '/api/state');
    h.complete(h.requests[0], { timedOut }); await settle();
    assert.equal(h.notices.length, timedOut ? 1 : 0);
  }
});

test('exam stamps stay stable for identical saves and advance for a changed destination with the same answer', () => {
  const h = harness(); h.render();
  const body = { action: 'exam-answer', examId: 'exam-1', index: 0, answer: 'A', flagged: false };
  const first = h.invoke('stampExam', body);
  h.advance(2000);
  const repeated = h.invoke('stampExam', { ...body });
  assert.equal(repeated.updatedAt, first.updatedAt, 'elapsed time alone must not make a repeated autosave newer');
  const nextOne = h.invoke('stampExam', { ...body, nextIndex: 1 });
  const sameNavigation = h.invoke('stampExam', { ...body, nextIndex: 1 });
  const nextTwo = h.invoke('stampExam', { ...body, nextIndex: 2 });
  assert.ok(nextOne.updatedAt > first.updatedAt, 'manual navigation must have a newer stamp than the previous autosave');
  assert.equal(sameNavigation.updatedAt, nextOne.updatedAt);
  assert.ok(nextTwo.updatedAt > nextOne.updatedAt, 'different destinations must be ordered even in the same millisecond');
  h.refs.clockOffset.current = -100_000;
  const afterClockCorrection = h.invoke('stampExam', { ...body, nextIndex: 3 });
  assert.ok(afterClockCorrection.updatedAt > nextTwo.updatedAt, 'a clock correction must not let an old save replace a new destination');
});

test('exam answers are keyed to their exam and question, with empty defaults for unanswered multiple and matching tasks', () => {
  const h = harness();
  h.model.state.activeExam.questions.push({ id: 'q2', type: 'single' }, { id: 'q3', type: 'multiple' }, { id: 'q4', type: 'matching' });
  h.model.state.activeExam.answers['1'] = 'saved-Q2';
  h.render(); h.invoke('setExamAnswer', 'local-Q1'); h.render();
  assert.equal(h.visibleExamAnswer, 'local-Q1'); assert.equal(h.model.examAnswerDraft.key, 'exam-1:0');
  h.model.examIndex = 1; h.render();
  assert.equal(h.visibleExamAnswer, 'saved-Q2', 'the previous question draft must not cover this question');
  h.model.examIndex = 2; h.render();
  assert.ok(Array.isArray(h.visibleExamAnswer)); assert.equal(h.visibleExamAnswer.length, 0);
  h.invoke('setExamAnswer', ['B', 'D']); h.render();
  assert.deepEqual(Array.from(h.visibleExamAnswer), ['B', 'D']); assert.equal(h.model.examAnswerDraft.key, 'exam-1:2');
  h.model.examIndex = 3; h.render();
  assert.ok(Array.isArray(h.visibleExamAnswer)); assert.equal(h.visibleExamAnswer.length, 0);
  h.model.examIndex = 0;
  h.model.state = { ...h.model.state, activeExam: { ...h.model.state.activeExam, id: 'exam-2', answers: { '0': 'saved-new-exam' } } };
  h.render(); assert.equal(h.visibleExamAnswer, 'saved-new-exam');
  h.invoke('setExamAnswer', 'local-new-exam'); h.render();
  assert.equal(h.visibleExamAnswer, 'local-new-exam'); assert.equal(h.model.examAnswerDraft.key, 'exam-2:0');
  h.model.examAnswerDraft = { key: 'exam-1:0', value: 'late-old-exam' }; h.render();
  assert.equal(h.visibleExamAnswer, 'saved-new-exam', 'an older exam draft must never be displayed in this exam');
});

test('the initial cabinet and a completed exam render safely without an active exam', () => {
  const h = harness('dashboard');
  h.model.state = { ...h.model.state, activeExam: null }; h.render();
  assert.equal(h.visibleExamAnswer, ''); assert.equal(h.refs.examSnapshot.current, null);
});

for (const screen of ['practice', 'diagnostic']) {
  test(`${screen} draft stamps are stable, advance for new content, and stop while inactive`, () => {
    const h = harness(screen); h.render();
    const first = h.refs.draftSnapshot.current;
    h.advance(2000); h.render();
    assert.equal(h.refs.draftSnapshot.current.updatedAt, first.updatedAt, 'rendering an unchanged draft must keep its original version');
    h.model.answer = '43'; h.render();
    const changedAnswer = h.refs.draftSnapshot.current;
    assert.ok(changedAnswer.updatedAt > first.updatedAt);
    if (screen === 'practice') h.model.steps = '2x = 86';
    else h.model.diagnosticAnswers = [{ taskId: 'earlier-question', answer: '7' }];
    h.render();
    const changedContent = h.refs.draftSnapshot.current;
    assert.ok(changedContent.updatedAt > changedAnswer.updatedAt, 'steps and diagnostic history are part of the saved draft');
    h.model.currentTask = { id: 'task-new' }; h.render();
    const nextTask = h.refs.draftSnapshot.current;
    assert.ok(nextTask.updatedAt > changedContent.updatedAt, 'an old pagehide message must remain older than the next task');
    h.model.screen = 'map'; h.advance(2000); h.render();
    assert.equal(h.refs.draftSnapshot.current, null); assert.equal(h.refs.draftStamp.current.at, nextTask.updatedAt);
    h.model.screen = screen;
    if (screen === 'practice') h.model.feedback = { correct: true };
    else h.model.diagnosticDone = true;
    h.render();
    assert.equal(h.refs.draftSnapshot.current, null, 'completed work does not produce another unfinished draft');
    assert.equal(h.refs.draftStamp.current.at, nextTask.updatedAt);
  });
}
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
test('school registration offers every grade without demanding ENT date or score',()=>{
 let onboarding;
 walk(ast,node=>{if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(ast)==='form'&&node.getText(ast).includes("action: 'onboard'"))onboarding=node;});
 assert.ok(onboarding);
 const context=createContext({exports:{},React,ArrowRight:()=>React.createElement("svg")});
 const code=ts.transpileModule(`exports.renderForm=(form,tr,busy,lang,tracks,setForm)=>(${onboarding.getText(ast)});`,{fileName:"school-form.tsx",compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 runInContext(code,context);
 const props={name:'Test',grade:'5',learningMode:'school',track:'base',examDate:'2027-06-01',target:40,dailyMinutes:20};
 const render=mode=>renderToStaticMarkup(context.exports.renderForm({...props,learningMode:mode},ru=>ru,false,'ru',{base:{ru:'Base',kk:'Base'}},()=>{}));
 const school=render('school'),ent=render('ent');
 assert.equal(school.includes('type="date"'),false);assert.equal(school.includes('type="number"'),false);
 assert.ok(ent.includes('type="date"'));assert.ok(ent.includes('type="number"'));
 for(const g of ['5','6','7','8','9','10','11'])assert.ok(school.includes(`value="${g}"`));
});
