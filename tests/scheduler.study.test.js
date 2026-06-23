import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeBundle } from '../src/bundle.js';
import {
  applyScreeningAnswer,
  createInitialProgress,
  getInventoryItems,
  summarizeInventoryCounts
} from '../src/scheduler.js';

function makeBundle() {
  return normalizeBundle({
    version: 1,
    title: 'Study inventory fixture',
    verses: [
      {
        id: 'v.j1',
        reference: 'John 1:1',
        russianText: 'В начале было Слово',
        englishText: 'In the beginning was the Word'
      },
      {
        id: 'v.j2',
        reference: 'John 1:2',
        russianText: 'И Бог был Слово',
        englishText: 'And God was the Word'
      }
    ],
    vocabulary: [
      {
        id: 'v.word',
        level: 'A0',
        lemma: 'слово',
        meaning: 'word',
        linkedVerseIds: ['v.j1']
      },
      {
        id: 'v.beginnings',
        level: 'A0',
        lemma: 'начало',
        meaning: 'beginning',
        linkedVerseIds: ['v.j1']
      },
      {
        id: 'v.verse',
        level: 'A1',
        lemma: 'стих',
        meaning: 'verse',
        linkedVerseIds: ['v.j2']
      }
    ],
    grammar: [
      {
        id: 'g.subject-verb',
        level: 'A0',
        name: 'Subject-verb order',
        linkedVerseIds: ['v.j1'],
        explanation: 'Recognize simple subject-verb sequence.'
      }
    ],
    expressions: [
      {
        id: 'e.beginning',
        level: 'A0',
        phrase: 'в начале',
        meaning: 'in the beginning',
        linkedVerseIds: ['v.j1']
      }
    ]
  });
}

test('getInventoryItems returns only items from selected level and filters by type', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-06-23T00:00:00.000Z');

  const a0Vocabulary = getInventoryItems(bundle, progress, {
    level: 'A0',
    type: 'vocabulary',
    state: 'all'
  });

  assert.equal(a0Vocabulary.length, 2);
  assert.equal(a0Vocabulary.map((entry) => entry.item.id).includes('v.word'), true);
  assert.equal(a0Vocabulary.map((entry) => entry.item.id).includes('v.beginnings'), true);
  assert.equal(a0Vocabulary.every((entry) => entry.item.level === 'A0'), true);
});

test('getInventoryItems can return vocabulary across all levels', () => {
  const bundle = makeBundle();
  const progress = createInitialProgress(bundle, '2026-06-23T00:00:00.000Z');

  const vocabulary = getInventoryItems(bundle, progress, {
    level: 'all',
    type: 'vocabulary',
    state: 'all'
  });

  assert.deepEqual(vocabulary.map((entry) => entry.item.id), [
    'v.beginnings',
    'v.word',
    'v.verse'
  ]);
});

test('getInventoryItems filters by state after user answers', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-06-23T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.word', 'known', '2026-06-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.beginnings', 'uncertain', '2026-06-23T00:00:00.000Z');

  const known = getInventoryItems(bundle, progress, {
    level: 'A0',
    state: 'known'
  });

  const weak = getInventoryItems(bundle, progress, {
    level: 'A0',
    state: 'weak'
  });

  assert.equal(known.length, 1);
  assert.equal(known[0].item.id, 'v.word');
  assert.equal(weak.length, 1);
  assert.equal(weak[0].item.id, 'v.beginnings');
});

test('summarizeInventoryCounts reports current state distribution for level items', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-06-23T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.word', 'known', '2026-06-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.beginnings', 'uncertain', '2026-06-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'g.subject-verb', 'unknown', '2026-06-23T00:00:00.000Z');

  const counts = summarizeInventoryCounts(getInventoryItems(bundle, progress, { level: 'A0' }));

  assert.equal(counts.new, 1);
  assert.equal(counts.known, 1);
  assert.equal(counts.weak, 2);
  assert.equal(counts.total, 4);
});

test('applyScreeningAnswer records the last answer category', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-06-23T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.word', 'known', '2026-06-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.beginnings', 'uncertain', '2026-06-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'g.subject-verb', 'unknown', '2026-06-23T00:00:00.000Z');

  assert.equal(progress.items['v.word'].lastAnswer, 'known');
  assert.equal(progress.items['v.beginnings'].lastAnswer, 'uncertain');
  assert.equal(progress.items['g.subject-verb'].lastAnswer, 'unknown');
});
