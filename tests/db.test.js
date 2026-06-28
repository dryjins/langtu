import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createStorageBackend,
  clearAppState,
  getStorageBackend,
  loadAppState,
  saveAppState,
  setStorageBackend
} from '../src/db.js';

test('createStorageBackend builds supported storage adapters', () => {
  const backend = createStorageBackend('indexeddb');

  assert.equal(backend.name, 'indexeddb');
  assert.equal(typeof backend.load, 'function');
  assert.equal(typeof backend.save, 'function');
  assert.equal(typeof backend.clear, 'function');
});

test('createStorageBackend rejects unknown backend names', () => {
  assert.throws(() => {
    createStorageBackend('rxdbo');
  }, /unsupported storage backend/);
});

test('setStorageBackend validates backend contracts', () => {
  assert.throws(() => {
    setStorageBackend({ load: async () => ({}) });
  }, /storage backend must implement load, save, and clear/);
});

test('loadAppState/saveAppState/clearAppState delegate to active backend', async () => {
  const originalBackend = getStorageBackend();
  const log = [];

  setStorageBackend({
    name: 'memory',
    load: async () => {
      log.push('load');
      return { demo: 'state' };
    },
    save: async () => {
      log.push('save');
    },
    clear: async () => {
      log.push('clear');
    }
  });

  const loadedState = await loadAppState();
  await saveAppState({ answer: 'ok' });
  await clearAppState();

  try {
    assert.deepEqual(loadedState, { demo: 'state' });
    assert.equal(log.join(','), 'load,save,clear');
  } finally {
    setStorageBackend(originalBackend);
  }
});
