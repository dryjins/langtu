import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANSWER_TO_VERSE_STATE,
  applyVerseAnswer,
  createInitialVerseProgress,
  groupVersesByChapter,
  selectVerseForPractice,
  summarizeVerseCounts,
  summarizeVerseStats
} from '../src/verse-state.js';

const NOW = '2026-06-30T00:00:00.000Z';
const LATER = '2026-06-30T01:00:00.000Z';

const BIBLE_FIXTURE = {
  verses: [
    { id: 'book3:c1:l0', reference: 'Book 3, Ch 1:1', russianText: 'В начале было Слово.', englishText: '' },
    { id: 'book3:c1:l1', reference: 'Book 3, Ch 1:2', russianText: 'И Слово было Бог.', englishText: '' },
    { id: 'book3:c2:l0', reference: 'Book 3, Ch 2:1', russianText: 'Сотворение мира.', englishText: '' }
  ]
};

test('createInitialVerseProgress seeds every verse as new in this level', () => {
  const progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);
  assert.equal(Object.keys(progress).length, 3);
  assert.equal(progress['book3:c1:l0'].state, 'new');
  assert.equal(progress['book3:c2:l0'].state, 'new');
  assert.equal(progress['book3:c1:l0'].correctStreak, 0);
});

test('applyVerseAnswer promotes known and demotes unknown', () => {
  let progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);

  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c1:l1', 'unknown', LATER);
  progress = applyVerseAnswer(progress, 'book3:c2:l0', 'uncertain', LATER);

  assert.equal(progress['book3:c1:l0'].state, 'known');
  assert.equal(progress['book3:c1:l0'].correctStreak, 1);
  assert.equal(progress['book3:c1:l1'].state, 'weak');
  assert.equal(progress['book3:c1:l1'].correctStreak, 0);
  assert.equal(progress['book3:c2:l0'].state, 'weak');
});

test('applyVerseAnswer accumulates the correct streak on consecutive known answers', () => {
  let progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);

  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'unknown', LATER);

  assert.equal(progress['book3:c1:l0'].state, 'weak');
  assert.equal(progress['book3:c1:l0'].correctStreak, 0);
  assert.equal(progress['book3:c1:l0'].lastAnswer, 'unknown');
});

test('applyVerseAnswer rejects unknown verse ids and unsupported answers', () => {
  const progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);

  assert.throws(() => applyVerseAnswer(progress, 'book3:missing', 'known', LATER), /unknown verse/);
  assert.throws(() => applyVerseAnswer(progress, 'book3:c1:l0', 'maybe', LATER), /unsupported/);
});

test('summarizeVerseStats reports known and weak counts per level using verses only', () => {
  let progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);
  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c2:l0', 'unknown', LATER);

  const stats = summarizeVerseStats(progress, BIBLE_FIXTURE);
  assert.equal(stats.total, 3);
  assert.equal(stats.known, 1);
  assert.equal(stats.weak, 1);
  assert.equal(stats.new, 1);
  assert.equal(stats.review, 1);
});

test('summarizeVerseCounts buckets verses for the Sentences view summary', () => {
  let progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);
  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c1:l1', 'unknown', LATER);

  const counts = summarizeVerseCounts(progress, BIBLE_FIXTURE);
  assert.equal(counts.known, 1);
  assert.equal(counts.weak, 1);
  assert.equal(counts.new, 1);
});

test('selectVerseForPractice picks the next new verse first and falls back to weak', () => {
  let progress = createInitialVerseProgress(BIBLE_FIXTURE, NOW);
  progress = applyVerseAnswer(progress, 'book3:c1:l0', 'known', LATER);

  const first = selectVerseForPractice(progress, BIBLE_FIXTURE, { level: 'B1', now: LATER });
  assert.equal(first.id, 'book3:c1:l1');

  progress = applyVerseAnswer(progress, 'book3:c1:l1', 'known', LATER);
  progress = applyVerseAnswer(progress, 'book3:c2:l0', 'unknown', LATER);

  const nextNew = selectVerseForPractice(progress, BIBLE_FIXTURE, { level: 'B1', now: LATER });
  assert.equal(nextNew.id, 'book3:c2:l0');
});

test('selectVerseForPractice returns null when no verses exist', () => {
  const empty = { verses: [] };
  const progress = {};
  const pick = selectVerseForPractice(progress, empty, { level: 'B1', now: NOW });
  assert.equal(pick, null);
});

test('groupVersesByChapter groups verses by their book3 chapter id', () => {
  const groups = groupVersesByChapter(BIBLE_FIXTURE.verses);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].chapter, 1);
  assert.equal(groups[0].verses.length, 2);
  assert.equal(groups[1].chapter, 2);
  assert.equal(groups[1].verses.length, 1);
});

test('ANSWER_TO_VERSE_STATE maps known and weak markers', () => {
  assert.equal(ANSWER_TO_VERSE_STATE.known, 'known');
  assert.equal(ANSWER_TO_VERSE_STATE.uncertain, 'weak');
  assert.equal(ANSWER_TO_VERSE_STATE.unknown, 'weak');
});
