import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeBundle } from '../src/bundle.js';
import {
  advanceLevelIfGatePassed,
  applyScreeningAnswer,
  buildDailyQueue,
  createInitialProgress,
  getLevelGateStatus
} from '../src/scheduler.js';

function makeBundle() {
  return normalizeBundle({
    version: 1,
    title: 'Private John study bundle',
    verses: [
      {
        id: 'john.1.1',
        reference: 'John 1:1',
        russianText: 'Учебный русский текст.',
        englishText: 'Artificial English study text.'
      }
    ],
    vocabulary: [
      {
        id: 'v.slovo',
        level: 'A0',
        lemma: 'слово',
        meaning: 'word',
        linkedVerseIds: ['john.1.1']
      },
      {
        id: 'v.tekst',
        level: 'A0',
        lemma: 'текст',
        meaning: 'text',
        linkedVerseIds: ['john.1.1']
      }
    ],
    grammar: [
      {
        id: 'g.neuter-noun',
        level: 'A0',
        name: 'Neuter noun recognition',
        linkedVerseIds: ['john.1.1']
      }
    ],
    expressions: [
      {
        id: 'e.study-phrase',
        level: 'A0',
        phrase: 'учебный текст',
        meaning: 'study text',
        linkedVerseIds: ['john.1.1']
      }
    ]
  });
}

test('creates independent progress records for every learning item', () => {
  const bundle = makeBundle();
  const progress = createInitialProgress(bundle, '2026-05-23T00:00:00.000Z');

  assert.equal(Object.keys(progress.items).length, 4);
  assert.equal(progress.items['v.slovo'].type, 'vocabulary');
  assert.equal(progress.items['g.neuter-noun'].type, 'grammar');
  assert.equal(progress.items['e.study-phrase'].type, 'expression');
  assert.equal(progress.items['v.slovo'].state, 'new');
});

test('screening keeps known items out of the daily learning queue', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-05-23T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.slovo', 'known', '2026-05-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.tekst', 'unknown', '2026-05-23T00:00:00.000Z');

  const queue = buildDailyQueue(bundle, progress, {
    level: 'A0',
    now: '2026-05-24T00:00:00.000Z',
    newVocabularyLimit: 5,
    auditLimit: 1
  });

  assert.equal(queue.some((entry) => entry.item.id === 'v.slovo'), false);
  assert.equal(queue.some((entry) => entry.item.id === 'v.tekst'), true);
});

test('daily queue includes new grammar and expression skills for strict gates', () => {
  const bundle = makeBundle();
  const progress = createInitialProgress(bundle, '2026-05-23T00:00:00.000Z');

  const queue = buildDailyQueue(bundle, progress, {
    level: 'A0',
    now: '2026-05-24T00:00:00.000Z',
    newVocabularyLimit: 5,
    auditLimit: 1
  });

  assert.equal(queue.some((entry) => entry.item.id === 'g.neuter-noun'), true);
  assert.equal(queue.some((entry) => entry.item.id === 'e.study-phrase'), true);
});

test('strict gate requires vocabulary, grammar, and expression mastery', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-05-23T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.slovo', 'known', '2026-05-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.tekst', 'known', '2026-05-23T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'g.neuter-noun', 'known', '2026-05-23T00:00:00.000Z');

  const blocked = getLevelGateStatus(bundle, progress, 'A0');
  assert.equal(blocked.passed, false);
  assert.equal(blocked.expression.passed, false);

  progress = applyScreeningAnswer(progress, 'e.study-phrase', 'known', '2026-05-23T00:00:00.000Z');

  const passed = getLevelGateStatus(bundle, progress, 'A0');
  assert.equal(passed.passed, true);
});

test('level advancement is rejected unless the strict gate passes', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-05-23T00:00:00.000Z');

  assert.throws(
    () => advanceLevelIfGatePassed(bundle, progress, '2026-05-23T00:00:00.000Z'),
    /A0 gate is blocked/
  );

  for (const item of bundle.items.filter((entry) => entry.level === 'A0')) {
    progress = applyScreeningAnswer(progress, item.id, 'known', '2026-05-23T00:00:00.000Z');
  }

  const advanced = advanceLevelIfGatePassed(bundle, progress, '2026-05-23T00:00:00.000Z');
  assert.equal(advanced.currentLevel, 'A1');
});
