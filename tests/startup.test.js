import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeBundle } from '../src/bundle.js';
import { buildStartupState, defaultStartupMessage, getDefaultBundleMeta, loadDefaultBundleContent, buildStartupStateAsync } from '../src/startup.js';
import { DEFAULT_CONTENT_META } from '../src/default-bundle-meta.js';
import { DEFAULT_CONTENT } from '../src/default-bundle.js';
import { getInventoryItems } from '../src/scheduler.js';

const DEFAULT_BUNDLE = DEFAULT_CONTENT;

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
        id: 'v.saved.a1',
        level: 'A1',
        lemma: 'check',
        meaning: 'check',
        linkedVerseIds: ['v.saved.1']
      },
      {
        id: 'v.saved.a2',
        level: 'A2',
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
    progress: { currentLevel: 'A1' },
    message: 'from local storage',
    storedAt: now
  };

  const state = buildStartupState({ savedState, content: bundle, now });

  assert.equal(state.bundle.title, 'Saved private study bundle');
  assert.equal(state.progress.currentLevel, 'A1');
  assert.equal(state.progress.items['v.saved.a1'].state, 'new');
  assert.equal(state.message, 'from local storage');
});

test('default startup state uses curated default bundle when no saved state exists', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState({ savedState: null, content: DEFAULT_BUNDLE, now });

  assert.equal(state.message, defaultStartupMessage);
  assert.equal(state.bundle.title, DEFAULT_BUNDLE.title);
  assert.equal(state.progress.currentLevel, 'A1');
  assert.equal(state.progress.createdAt, now);
  assert.equal(state.progress.updatedAt, now);
  assert.ok(state.progress.items && typeof state.progress.items === 'object');
  assert.equal(Object.keys(state.progress.items).length, state.bundle.items.length);
  assert.ok(state.progress.verseProgress && typeof state.progress.verseProgress === 'object');
  assert.equal(Object.keys(state.progress.verseProgress).length, state.bundle.verses.length);
});

test('default startup state seeds every book3 verse in verseProgress', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState({ savedState: null, content: DEFAULT_BUNDLE, now });

  const verseIds = state.bundle.verses.map((verse) => verse.id);
  for (const verseId of verseIds) {
    assert.equal(state.progress.verseProgress[verseId].state, 'new');
    assert.equal(state.progress.verseProgress[verseId].correctStreak, 0);
  }
});

test('default startup bundle exposes all vocabulary in full inventory view', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState({ savedState: null, content: DEFAULT_BUNDLE, now });

  const allVocabulary = getInventoryItems(state.bundle, state.progress, {
    level: 'all',
    type: 'vocabulary',
    state: 'all'
  });

  assert.equal(allVocabulary.length, state.bundle.vocabulary.length);
});

test('default startup bundle includes all OpenRussian vocab entries by level', async () => {
  const dataPath = path.resolve(process.cwd(), 'data/openrussian-vocab-a1-c2.json');
  const rawSource = JSON.parse(await fs.readFile(dataPath, 'utf8'));
  const state = buildStartupState({ savedState: null, content: DEFAULT_BUNDLE, now: '2026-01-01T00:00:00.000Z' });

  const sourceByLevel = {};
  let expectedTotal = 0;
  for (const [level, items] of Object.entries(rawSource?.itemsByLevel || {})) {
    if (!Array.isArray(items)) continue;
    sourceByLevel[level] = items.length;
    expectedTotal += items.length;
  }

  const actualByLevel = state.bundle.vocabulary.reduce((acc, item) => {
    acc[item.level] = (acc[item.level] || 0) + 1;
    return acc;
  }, {});

  assert.equal(state.bundle.vocabulary.length, expectedTotal);
  for (const [level, expectedCount] of Object.entries(sourceByLevel)) {
    assert.equal(actualByLevel[level], expectedCount);
  }
});

test('stale default bundle saved in storage is upgraded to the latest default items', () => {
  const now = '2026-01-03T00:00:00.000Z';
  const normalizedDefault = normalizeBundle(DEFAULT_BUNDLE);
  const firstVocab = DEFAULT_BUNDLE.vocabulary[0];
  const staleDefaultBundle = {
    version: 1,
    title: DEFAULT_BUNDLE.title,
    verses: DEFAULT_BUNDLE.verses.slice(0, 1),
    vocabulary: [firstVocab],
    grammar: [],
    expressions: []
  };

  const savedState = {
    bundle: staleDefaultBundle,
    progress: {
      currentLevel: 'A1',
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
      items: {
        [firstVocab.id]: {
          id: firstVocab.id,
          type: 'vocabulary',
          level: firstVocab.level,
          state: 'known',
          correctStreak: 3,
          lastAnswer: 'known',
          lastTestedAt: '2025-12-01T00:00:00.000Z',
          nextReviewAt: '2026-01-01T00:00:00.000Z',
          failReasons: []
        }
      }
    },
    message: 'from local storage',
    storedAt: '2025-12-31T00:00:00.000Z'
  };

  const state = buildStartupState({ savedState, content: DEFAULT_BUNDLE, now });

  assert.equal(state.bundle.title, DEFAULT_BUNDLE.title);
  assert.equal(state.bundle.items.length, normalizedDefault.items.length);
  assert.equal(state.progress.currentLevel, 'A1');
  assert.equal(state.progress.items[firstVocab.id].state, 'known');
  assert.equal(state.progress.items[firstVocab.id].correctStreak, 3);
  assert.equal(Object.keys(state.progress.items).length, normalizedDefault.items.length);
  assert.equal(state.message, 'from local storage');
});

test('normalizeBundle can load default startup dataset structure', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const state = buildStartupState({ savedState: null, content: DEFAULT_BUNDLE, now });

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
      currentLevel: 'A2',
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
      items: {
        'v.saved.a1': {
          id: 'v.saved.a1',
          type: 'vocabulary',
          level: 'A1',
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
          level: 'A1',
          state: 'known',
          correctStreak: 1,
          lastAnswer: 'known',
          lastTestedAt: '2025-12-01T00:00:00.000Z',
          nextReviewAt: '2025-12-02T00:00:00.000Z',
          failReasons: []
        }
      },
      verseProgress: {
        [bundle.verses[0].id]: {
          id: bundle.verses[0].id,
          state: 'known',
          correctStreak: 4,
          lastAnswer: 'known',
          lastAnswerAt: '2025-12-15T00:00:00.000Z',
          nextReviewAt: '2025-12-22T00:00:00.000Z',
          failReasons: []
        }
      }
    }
  };

  const state = buildStartupState({ savedState, content: bundle, now });

  assert.equal(state.progress.currentLevel, 'A2');
  assert.equal(state.progress.createdAt, '2025-12-01T00:00:00.000Z');
  assert.equal(state.progress.items['v.saved.a1'].state, 'known');
  assert.equal(state.progress.items['v.saved.a2'].state, 'new');
  assert.equal(Object.hasOwn(state.progress.items, 'orphan.old-item'), false);
  assert.equal(Object.keys(state.progress.items).length, bundle.items.length);
  assert.equal(state.progress.verseProgress[bundle.verses[0].id].state, 'known');
  assert.equal(state.progress.verseProgress[bundle.verses[0].id].correctStreak, 4);
});

test('buildStartupState drops saved verseProgress records that no longer match a verse', () => {
  const now = '2026-01-02T00:00:00.000Z';
  const bundle = makeSavedBundle();

  const savedState = {
    bundle,
    progress: {
      currentLevel: 'A2',
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
      items: {},
      verseProgress: {
        'orphan.verse.id': {
          id: 'orphan.verse.id',
          state: 'known',
          correctStreak: 5,
          lastAnswer: 'known',
          lastAnswerAt: '2025-12-15T00:00:00.000Z',
          nextReviewAt: '2025-12-22T00:00:00.000Z',
          failReasons: []
        }
      }
    }
  };

  const state = buildStartupState({ savedState, content: bundle, now });

  assert.equal(Object.hasOwn(state.progress.verseProgress, 'orphan.verse.id'), false);
  assert.equal(Object.keys(state.progress.verseProgress).length, bundle.verses.length);
});
