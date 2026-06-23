import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartupState, defaultStartupMessage } from '../src/startup.js';

test('saved state is used when bundle and progress exist', () => {
  const now = '2026-01-01T00:00:00.000Z';
  const savedState = {
    bundle: { title: 'Saved user bundle' },
    progress: { currentLevel: 'A0' },
    message: 'from local storage',
    storedAt: now
  };

  const state = buildStartupState(savedState, now);

  assert.deepEqual(state, savedState);
});

test('default startup state uses artificial demo bundle when no saved state exists', () => {
  const now = '2026-01-01T00:00:00.000Z';

  const state = buildStartupState(null, now);

  assert.equal(state.message, defaultStartupMessage);
  assert.equal(state.bundle.title, 'Artificial Langtu demo bundle');
  assert.equal(state.progress.currentLevel, 'A0');
  assert.equal(state.progress.createdAt, now);
  assert.equal(state.progress.updatedAt, now);
  assert.ok(state.progress.items && typeof state.progress.items === 'object');
  assert.equal(Object.keys(state.progress.items).length, state.bundle.items.length);
});
