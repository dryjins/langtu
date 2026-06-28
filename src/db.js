const DB_NAME = 'langtu-mvp';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'current';

const DEFAULT_BACKEND = 'indexeddb';

function createIndexedDbBackend() {
  return {
    name: 'indexeddb',
    load: loadFromIndexedDb,
    save: saveToIndexedDb,
    clear: clearIndexedDb
  };
}

function assertBackendApi(backend) {
  if (!backend || typeof backend !== 'object') {
    throw new Error('storage backend must be an object');
  }

  if (typeof backend.load !== 'function' || typeof backend.save !== 'function' || typeof backend.clear !== 'function') {
    throw new Error('storage backend must implement load, save, and clear');
  }

  if (backend.name == null) {
    throw new Error('storage backend must include a name');
  }
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

export async function loadAppState() {
  return storageBackend.load();
}

export async function saveAppState(state) {
  return storageBackend.save(state);
}

export async function clearAppState() {
  return storageBackend.clear();
}

async function loadFromIndexedDb() {
  const db = await openDatabase();
  return requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY));
}

async function saveToIndexedDb(state) {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ ...state, id: STATE_KEY });
  await transactionToPromise(tx);
}

async function clearIndexedDb() {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(STATE_KEY);
  await transactionToPromise(tx);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
