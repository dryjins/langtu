const DB_NAME = 'langtu-mvp';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';
const STATE_KEY = 'current';

export async function loadAppState() {
  const db = await openDatabase();
  return requestToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(STATE_KEY));
}

export async function saveAppState(state) {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put({ ...state, id: STATE_KEY });
  await transactionToPromise(tx);
}

export async function clearAppState() {
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
