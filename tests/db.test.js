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
  assert.equal(typeof backend.loadAppState, 'function');
  assert.equal(typeof backend.saveAppState, 'function');
  assert.equal(typeof backend.clearAppState, 'function');
  assert.equal(typeof backend.loadContentBundle, 'function');
  assert.equal(typeof backend.saveContentBundle, 'function');
  assert.equal(typeof backend.loadContentVersion, 'function');
});

test('createStorageBackend rejects unknown backend names', () => {
  assert.throws(() => {
    createStorageBackend('rxdbo');
  }, /unsupported storage backend/);
});

test('setStorageBackend validates backend contracts', () => {
  assert.throws(() => {
    setStorageBackend({ loadAppState: async () => ({}) });
  }, /storage backend must implement/);
});

test('loadAppState/saveAppState/clearAppState delegate to active backend', async () => {
  const originalBackend = getStorageBackend();
  const log = [];

  setStorageBackend({
    name: 'memory',
    loadAppState: async () => {
      log.push('load');
      return { demo: 'state' };
    },
    saveAppState: async () => {
      log.push('save');
    },
    clearAppState: async () => {
      log.push('clear');
    },
    loadContentBundle: async () => null,
    saveContentBundle: async () => {},
    clearContentBundle: async () => {},
    loadContentVersion: async () => null,
    saveContentVersion: async () => {},
    clearContentVersion: async () => {}
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

test('db exposes getDbVersion constant and content store names', async () => {
  const { getDbVersion, CONTENT_BUNDLE_STORE, CONTENT_VERSION_STORE } = await import('../src/db.js');
  assert.equal(typeof getDbVersion, 'function');
  assert.equal(CONTENT_BUNDLE_STORE, 'content-bundle');
  assert.equal(CONTENT_VERSION_STORE, 'content-version');
  assert.ok(getDbVersion() >= 2);
});
