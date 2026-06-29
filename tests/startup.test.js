import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, normalizeBundle } from '../src/bundle.js';
import { buildStartupState, defaultStartupMessage } from '../src/startup.js';

function makeSavedBundle() {
  return normalizeBundle({
    version: 1,
    title: 'Saved private study bundle',
    verses: [
      {
        id: 'v.saved.1',
        reference: 'Saved 1:1',
        russianText: 'A seed sentence for local-state repair.',
        englishText: 'Fixture verse for startup state repair.'
      }
    ],
    vocabulary: [
      {
        id: 'v.saved.a0',
        level: 'A0',
        lemma: 'check',
        meaning: 'check',
        linkedVerseIds: ['v.saved.1']
      },
      {
        id: 'v.saved.a1',
        level: 'A1',
        lemma: 'satisfaction',
        meaning: 'satisfaction',
        linkedVerseIds: ['v.saved.1']
      }
    ],
    grammar: [],
    expressions: []
  });
}

test('saved state is used when bundle and progress exist', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const bundle = makeSavedBundle();
  const savedState = {
    bundle,
    progress: { currentLevel: 'A0' },
    message: 'from local storage',
    storedAt: now
  };

  const state = buildStartupState(savedState, now);

  assert.equal(state.bundle.title, 'Saved private study bundle');
  assert.equal(state.progress.currentLevel, 'A0');
  assert.equal(state.progress.items['v.saved.a0'].state, 'new');
  assert.equal(state.message, 'from local storage');
});

test('default startup state uses artificial demo bundle when no saved state exists', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState(null, now);

  assert.equal(state.message, defaultStartupMessage);
  assert.equal(state.bundle.title, 'Artificial GosRU demo bundle');
  assert.equal(state.progress.currentLevel, 'A0');
  assert.equal(state.progress.createdAt, now);
  assert.equal(state.progress.updatedAt, now);
  assert.ok(state.progress.items && typeof state.progress.items === 'object');
  assert.equal(Object.keys(state.progress.items).length, state.bundle.items.length);
});

test('default startup bundle includes vocabulary for every supported level', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState(null, now);
  const byLevel = Object.fromEntries(LEVELS.map((level) => [level, 0]));

  for (const item of state.bundle.vocabulary) {
    byLevel[item.level] += 1;
  }

  for (const level of LEVELS) {
    assert.ok(byLevel[level] > 0, `missing vocabulary for ${level}`);
  }
});

test('normalizeBundle can load default startup dataset structure', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const state = buildStartupState(null, now);

  const normalized = normalizeBundle({
    ...state.bundle,
    items: undefined
  });

  assert.equal(normalized.version, 1);
  assert.equal(normalized.verses.length > 0, true);
  assert.equal(Array.isArray(normalized.vocabulary), true);
});

test('buildStartupState repairs saved progress to match the current bundle', () => {
  const now = '2026-01-02T00:00:00.000Z';
  const bundle = makeSavedBundle();

  const savedState = {
    bundle,
    progress: {
      currentLevel: 'A1',
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
      items: {
        'v.saved.a0': {
          id: 'v.saved.a0',
          type: 'vocabulary',
          level: 'A0',
          state: 'known',
          correctStreak: 2,
          lastAnswer: 'known',
          lastTestedAt: '2025-12-01T00:00:00.000Z',
          nextReviewAt: '2025-12-02T00:00:00.000Z',
          failReasons: []
        },
        'orphan.old-item': {
          id: 'orphan.old-item',
          type: 'vocabulary',
          level: 'A0',
          state: 'known',
          correctStreak: 1,
          lastAnswer: 'known',
          lastTestedAt: '2025-12-01T00:00:00.000Z',
          nextReviewAt: '2025-12-02T00:00:00.000Z',
          failReasons: []
        }
      }
    }
  };

  const state = buildStartupState(savedState, now);

  assert.equal(state.progress.currentLevel, 'A1');
  assert.equal(state.progress.createdAt, '2025-12-01T00:00:00.000Z');
  assert.equal(state.progress.items['v.saved.a0'].state, 'known');
  assert.equal(state.progress.items['v.saved.a1'].state, 'new');
  assert.equal(Object.hasOwn(state.progress.items, 'orphan.old-item'), false);
  assert.equal(Object.keys(state.progress.items).length, bundle.items.length);
});
