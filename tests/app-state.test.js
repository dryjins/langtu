import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppState } from '../src/app-state.js';

test('normalizeAppState forces listType to "vocabulary" regardless of saved value', () => {
  const now = '2026-06-29T00:00:00.000Z';
  const rawState = {
    bundle: null,
    progress: null,
    ui: {
      selectedLevel: 'A1',
      listType: 'all',
      listState: 'weak',
      view: 'vocabulary'
    }
  };

  const state = normalizeAppState(rawState, now);

  assert.equal(state.ui.listType, 'vocabulary');
  assert.equal(state.ui.selectedLevel, 'all');
});

test('normalizeAppState defaults listType to "vocabulary" when ui is missing', () => {
  const now = '2026-06-29T00:00:00.000Z';

  const state = normalizeAppState(null, now);

  assert.equal(state.ui.listType, 'vocabulary');
  assert.equal(state.ui.selectedLevel, 'all');
});
