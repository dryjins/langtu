import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSentenceQuiz,
  selectDailySentence,
  buildDistractorSentences,
  hasMinimumQuizInputs
} from '../src/sentence-quiz.js';

const BUNDLE = {
  verses: [
    { id: 'v1', reference: 'r1', russianText: 'В начале было Слово.', englishText: '' },
    { id: 'v2', reference: 'r2', russianText: 'В начале был Свет.', englishText: '' },
    { id: 'v3', reference: 'r3', russianText: 'В начале был Мир.', englishText: '' },
    { id: 'v4', reference: 'r4', russianText: 'В начале было Благо.', englishText: '' },
    { id: 'v5', reference: 'r5', russianText: 'В начале было Тишина.', englishText: '' },
    { id: 'v6', reference: 'r6', russianText: 'В иной день было иначе.', englishText: '' },
    { id: 'v7', reference: 'r7', russianText: 'Совсем другая тема.', englishText: '' }
  ],
  items: [],
  vocabulary: [],
  grammar: [],
  expressions: []
};

test('buildSentenceQuiz returns one truth and exactly five options when possible', () => {
  const quiz = buildSentenceQuiz(BUNDLE, { level: 'A1', now: '2026-06-30T00:00:00.000Z' });
  assert.ok(quiz);
  assert.equal(quiz.options.length, 5);
  const truthCount = quiz.options.filter((option) => option.isCorrect).length;
  assert.equal(truthCount, 1);
});

test('buildSentenceQuiz options are unique after normalization', () => {
  const quiz = buildSentenceQuiz(BUNDLE, { level: 'A1' });
  const texts = quiz.options.map((option) => option.text);
  const normalized = texts.map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
  assert.equal(new Set(normalized).size, texts.length);
});

test('buildSentenceQuiz is null when there are fewer than five total verses', () => {
  const tiny = {
    verses: [
      { id: 'a1', reference: 'r1', russianText: 'Привет.', englishText: '' }
    ],
    items: [],
    vocabulary: [],
    grammar: [],
    expressions: []
  };
  const quiz = buildSentenceQuiz(tiny, { level: 'A1' });
  assert.equal(quiz, null);
});

test('buildSentenceQuiz respects the day so the same verse repeats across reloads', () => {
  const day = '2026-06-30T00:00:00.000Z';
  const first = buildSentenceQuiz(BUNDLE, { level: 'A1', now: day });
  const again = buildSentenceQuiz(BUNDLE, { level: 'A1', now: day });
  assert.equal(first.verseId, again.verseId);
});

test('buildSentenceQuiz returns a different verse when the day changes', () => {
  const day1 = buildSentenceQuiz(BUNDLE, { level: 'A1', now: '2026-06-30T00:00:00.000Z' });
  const day2 = buildSentenceQuiz(BUNDLE, { level: 'A1', now: '2026-07-01T00:00:00.000Z' });
  assert.notEqual(day1.verseId, day2.verseId);
});

test('selectDailySentence picks a verse based on the date and current level', () => {
  const pick = selectDailySentence(BUNDLE, { level: 'A1', now: '2026-06-30T00:00:00.000Z' });
  assert.ok(pick);
  assert.equal(typeof pick.id, 'string');
  assert.ok(typeof pick.russianText === 'string' && pick.russianText.length > 0);
});

test('selectDailySentence falls back to the first verse when no level matches', () => {
  const pick = selectDailySentence(BUNDLE, { level: 'C2' });
  assert.ok(pick);
});

test('buildDistractorSentences prefers verses that share the first word and similar length', () => {
  const focus = BUNDLE.verses[0];
  const distractors = buildDistractorSentences(BUNDLE, focus, { now: '2026-06-30T00:00:00.000Z' });
  assert.equal(distractors.length, 4);
  for (const text of distractors) {
    assert.notEqual(text, focus.russianText);
  }
});

test('buildDistractorSentences never returns the focus verse and deduplicates by normalized text', () => {
  const focus = BUNDLE.verses[0];
  const distractors = buildDistractorSentences(BUNDLE, focus, { now: '2026-06-30T00:00:00.000Z' });
  const normalized = distractors.map((t) => t.replace(/\s+/g, ' ').trim().toLowerCase());
  assert.equal(new Set(normalized).size, distractors.length);
});

test('hasMinimumQuizInputs requires at least five verses', () => {
  assert.equal(hasMinimumQuizInputs({ verses: [{}] }), false);
  assert.equal(hasMinimumQuizInputs({ verses: BUNDLE.verses }), true);
});

