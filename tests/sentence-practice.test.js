import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeBundle } from '../src/bundle.js';
import { applyScreeningAnswer, createInitialProgress } from '../src/scheduler.js';
import { buildSentenceTruthChallenge } from '../src/sentence-practice.js';

function makeBundle() {
  return normalizeBundle({
    version: 1,
    title: 'Practice fixture',
    verses: [
      {
        id: 'verse.1',
        reference: 'Test 1:1',
        russianText: 'Знание помогает читать каждый день.',
        englishText: 'Knowledge helps reading every day.'
      }
    ],
    vocabulary: [
      {
        id: 'v.know',
        level: 'A1',
        lemma: 'знание',
        meaning: 'knowledge',
        linkedVerseIds: ['verse.1']
      },
      {
        id: 'v.read',
        level: 'A1',
        lemma: 'читать',
        meaning: 'to read',
        linkedVerseIds: ['verse.1']
      },
        {
          id: 'v.day',
          level: 'A1',
          lemma: 'день',
          meaning: 'day',
          linkedVerseIds: ['verse.1']
        },
        {
          id: 'v.home',
          level: 'A1',
          lemma: 'дом',
          meaning: 'home',
          linkedVerseIds: ['verse.1']
        }
    ],
    grammar: [
      {
        id: 'g.adv',
        level: 'A1',
        name: 'Adverb placement',
        explanation: 'Recognize adverb placement patterns.',
        linkedVerseIds: ['verse.1']
      }
    ],
    expressions: [
      {
        id: 'e.daily',
        level: 'A1',
        phrase: 'каждый день',
        meaning: 'every day',
        linkedVerseIds: ['verse.1']
      }
    ]
  });
}

test('buildSentenceTruthChallenge builds true and false sentence options', () => {
  const bundle = makeBundle();
  let progress = createInitialProgress(bundle, '2026-06-29T00:00:00.000Z');

  progress = applyScreeningAnswer(progress, 'v.know', 'known', '2026-06-29T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.read', 'known', '2026-06-29T00:00:00.000Z');
  progress = applyScreeningAnswer(progress, 'v.home', 'known', '2026-06-29T00:00:00.000Z');

  const challenge = buildSentenceTruthChallenge(bundle, progress, {
    level: 'A1',
    now: '2026-06-29T01:00:00.000Z'
  });

  assert.notEqual(challenge, null);
  assert.equal(challenge.options.length, 2);
  assert.equal(challenge.options.some((option) => option.isCorrect), true);
  assert.equal(challenge.options.some((option) => option.isCorrect === false), true);
  assert.notEqual(challenge.hints.length, 0);
  assert.equal(challenge.hints.every((item) => ['vocabulary', 'grammar', 'expression'].includes(item.type)), true);
  assert.equal(challenge.itemId === 'v.know' || challenge.itemId === 'v.read' || challenge.itemId === 'v.day' || challenge.itemId === 'v.home', true);
  assert.ok(challenge.verseReference);
  assert.ok(challenge.focusLevel);
});

test('buildSentenceTruthChallenge returns null when cannot build a valid false sentence', () => {
  const bundle = normalizeBundle({
    version: 1,
    title: 'Small fixture',
    verses: [
      {
        id: 'verse.2',
        reference: 'Test 1:2',
        russianText: 'Короткое',
        englishText: 'Short'
      }
    ],
    vocabulary: [
      {
        id: 'v.short',
        level: 'A1',
        lemma: 'коротко',
        meaning: 'short',
        linkedVerseIds: ['verse.2']
      }
    ]
  });

  const progress = createInitialProgress(bundle, '2026-06-29T00:00:00.000Z');

  const challenge = buildSentenceTruthChallenge(bundle, progress, { level: 'A1' });
  assert.equal(challenge, null);
});
