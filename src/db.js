const DB_NAME = 'langtu-mvp';
const DB_VERSION = 2;
const APP_STATE_STORE = 'app-state';
const CONTENT_BUNDLE_STORE = 'content-bundle';
const CONTENT_VERSION_STORE = 'content-version';
const APP_STATE_KEY = 'current';
const CONTENT_BUNDLE_KEY = 'current';
const CONTENT_VERSION_KEY = 'current';

const DEFAULT_BACKEND = 'indexeddb';

function createIndexedDbBackend() {
  return {
    name: 'indexeddb',
    loadAppState: () => loadAppStateFromIndexedDb(),
    saveAppState: (state) => saveAppStateToIndexedDb(state),
    clearAppState: () => clearAppStateFromIndexedDb(),
    loadContentBundle: () => loadContentBundleFromIndexedDb(),
    saveContentBundle: (content) => saveContentBundleToIndexedDb(content),
    clearContentBundle: () => clearContentBundleFromIndexedDb(),
    loadContentVersion: () => loadContentVersionFromIndexedDb(),
    saveContentVersion: (version) => saveContentVersionToIndexedDb(version),
    clearContentVersion: () => clearContentVersionFromIndexedDb()
  };
}

function assertBackendApi(backend) {
  if (!backend || typeof backend !== 'object') {
    throw new Error('storage backend must be an object');
  }
  const required = ['loadAppState', 'saveAppState', 'clearAppState', 'loadContentBundle', 'saveContentBundle', 'clearContentBundle', 'loadContentVersion', 'saveContentVersion', 'clearContentVersion'];
  for (const fn of required) {
    if (typeof backend[fn] !== 'function') {
      throw new Error(`storage backend must implement ${fn}`);
    }
  }
  if (backend.name == null) {
    throw new Error('storage backend must include a name');
  }
}

function legacyBackendToV2(legacy) {
  if (!legacy) return legacy;
  if (legacy.load && !legacy.loadAppState) return legacy;
  return legacy;
}

let storageBackend = createStorageBackend(DEFAULT_BACKEND);

export function createStorageBackend(name = DEFAULT_BACKEND) {
  if (name === 'indexeddb') {
    return createIndexedDbBackend();
  }
  throw new Error(`unsupported storage backend: ${name}`);
}

export function getStorageBackend() {
  return storageBackend;
}

export function setStorageBackend(backend) {
  const resolved = typeof backend === 'string' ? createStorageBackend(backend) : backend;
  assertBackendApi(resolved);
  storageBackend = resolved;
  return storageBackend;
}

export function getDbVersion() {
  return DB_VERSION;
}

export { APP_STATE_STORE, CONTENT_BUNDLE_STORE, CONTENT_VERSION_STORE };

export async function loadAppState() {
  return storageBackend.loadAppState();
}

export async function saveAppState(state) {
  return storageBackend.saveAppState(state);
}

export async function clearAppState() {
  return storageBackend.clearAppState();
}

export async function loadContentBundle() {
  return storageBackend.loadContentBundle();
}

export async function saveContentBundle(content) {
  return storageBackend.saveContentBundle(content);
}

export async function clearContentBundle() {
  return storageBackend.clearContentBundle();
}

export async function loadContentVersion() {
  return storageBackend.loadContentVersion();
}

export async function saveContentVersion(version) {
  return storageBackend.saveContentVersion(version);
}

export async function clearContentVersion() {
  return storageBackend.clearContentVersion();
}

async function loadAppStateFromIndexedDb() {
  const db = await openDatabase();
  return requestToPromise(db.transaction(APP_STATE_STORE, 'readonly').objectStore(APP_STATE_STORE).get(APP_STATE_KEY));
}

async function saveAppStateToIndexedDb(state) {
  const db = await openDatabase();
  const tx = db.transaction(APP_STATE_STORE, 'readwrite');
  tx.objectStore(APP_STATE_STORE).put({ ...state, id: APP_STATE_KEY });
  await transactionToPromise(tx);
}

async function clearAppStateFromIndexedDb() {
  const db = await openDatabase();
  const tx = db.transaction(APP_STATE_STORE, 'readwrite');
  tx.objectStore(APP_STATE_STORE).delete(APP_STATE_KEY);
  await transactionToPromise(tx);
}

async function loadContentBundleFromIndexedDb() {
  const db = await openDatabase();
  return requestToPromise(db.transaction(CONTENT_BUNDLE_STORE, 'readonly').objectStore(CONTENT_BUNDLE_STORE).get(CONTENT_BUNDLE_KEY));
}

async function saveContentBundleToIndexedDb(content) {
  const db = await openDatabase();
  const tx = db.transaction(CONTENT_BUNDLE_STORE, 'readwrite');
  tx.objectStore(CONTENT_BUNDLE_STORE).put({ ...content, id: CONTENT_BUNDLE_KEY });
  await transactionToPromise(tx);
}

async function clearContentBundleFromIndexedDb() {
  const db = await openDatabase();
  const tx = db.transaction(CONTENT_BUNDLE_STORE, 'readwrite');
  tx.objectStore(CONTENT_BUNDLE_STORE).delete(CONTENT_BUNDLE_KEY);
  await transactionToPromise(tx);
}

async function loadContentVersionFromIndexedDb() {
  const db = await openDatabase();
  return requestToPromise(db.transaction(CONTENT_VERSION_STORE, 'readonly').objectStore(CONTENT_VERSION_STORE).get(CONTENT_VERSION_KEY));
}

async function saveContentVersionToIndexedDb(version) {
  const db = await openDatabase();
  const tx = db.transaction(CONTENT_VERSION_STORE, 'readwrite');
  tx.objectStore(CONTENT_VERSION_STORE).put({ ...version, id: CONTENT_VERSION_KEY });
  await transactionToPromise(tx);
}

async function clearContentVersionFromIndexedDb() {
  const db = await openDatabase();
  const tx = db.transaction(CONTENT_VERSION_STORE, 'readwrite');
  tx.objectStore(CONTENT_VERSION_STORE).delete(CONTENT_VERSION_KEY);
  await transactionToPromise(tx);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_STATE_STORE)) {
        db.createObjectStore(APP_STATE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONTENT_BUNDLE_STORE)) {
        db.createObjectStore(CONTENT_BUNDLE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONTENT_VERSION_STORE)) {
        db.createObjectStore(CONTENT_VERSION_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const _internal = { legacyBackendToV2 };
