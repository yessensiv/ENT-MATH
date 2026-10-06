import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Explicit extensions are required by Node's native test runner.
import { topics, tasks, validateContent } from "../lib/content.ts";
// @ts-expect-error Explicit extensions are required by Node's native test runner.
import { grade, makeExam, scoreExamTask, officialSection, isModelExample, type Task, type Topic } from "../lib/engine.ts";

const bank = tasks.map(t => ({ ...t, difficulty: t.level, units: t.unit })) as unknown as Task[];
const program = topics as unknown as Topic[];

test("published bank structural and mathematical checks pass", () => {
  const validation = validateContent(); assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  for (const topic of topics) {
    assert.ok(topic.tasks.length >= 15, topic.id);
    assert.ok(topic.lesson.examples.length >= 3, topic.id);
    for (const language of ["ru", "kk"] as const) {
      assert.ok(topic.lesson.explanation[language].length > 100, topic.id);
      assert.ok(topic.lesson.goal[language], topic.id);
      assert.ok(topic.lesson.guided.steps[language].length >= 2, topic.id);
    }
  }
});

test("server grader accepts every reviewed bank answer", () => {
  const failures = bank.filter(t => !grade(t, t.answer)); assert.deepEqual(failures.map(t => t.id), []);
});

test("five real profile variants meet official structure and score 50 for correct keys", () => {
  const fingerprints = new Set<string>();
  for (let variant = 1; variant <= 5; variant++) {
    const exam = makeExam("profile", variant, program, bank);
    assert.equal(exam.questions.length, 40);
    assert.equal(exam.questions.filter(q => q.context).length, 5);
    assert.equal(exam.questions.filter(q => q.type === "multiple").length, 5);
    assert.equal(exam.questions.filter(q => q.type === "matching").length, 5);
    assert.deepEqual([1, 2, 3].map(d => exam.questions.filter(q => q.difficulty === d).length), [20, 12, 8]);
    assert.ok(exam.questions.every(q => grade(q, q.answer)));
    assert.equal(exam.questions.reduce((sum, q) => sum + scoreExamTask(q, q.answer).points, 0), 50);
    assert.equal(new Set(exam.questions.map(q => q.curriculumSection || officialSection(program.find(t => t.id === q.topicId)))).size, 10);
    assert.ok(exam.questions.every(q => !isModelExample(q, program.find(t => t.id === q.topicId))));
    fingerprints.add(exam.questions.map(q => q.id).join(","));
  }
  assert.equal(fingerprints.size, 5);
});

test("five real literacy variants contain 10 questions and 50/30/20 levels", () => {
  for (let variant = 1; variant <= 5; variant++) {
    const exam = makeExam("literacy", variant, program, bank);
    assert.equal(exam.questions.length, 10);
    assert.deepEqual([1, 2, 3].map(d => exam.questions.filter(q => q.difficulty === d).length), [5, 3, 2]);
    assert.ok(exam.questions.every(q => grade(q, q.answer)));
    assert.equal(exam.questions.reduce((sum, q) => sum + scoreExamTask(q, q.answer).points, 0), 10);
    assert.equal(new Set(exam.questions.map(q => q.topicId)).size, 10);
  }
});
