import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ensureContentCached,
  resolveStoredContent,
  prepareContentCache
} from '../src/content-cache.js';

function fakeBackend(initial = {}) {
  let row = initial ?? null;
  return {
    name: 'memory',
    async load() { return row ? { ...row } : null; },
    async save(next) { row = { ...next }; return { ...next }; },
    async clear() { row = null; }
  };
}

const META = {
  version: 4,
  buildAt: '2026-06-30T00:00:00.000Z',
  title: 'GosRU starter bundle',
  contentHash: 'hash-meta-4'
};

const CONTENT = {
  version: 4,
  buildAt: META.buildAt,
  verses: [{ id: 'book3:c1:l0', reference: 'Book 3, Ch 1:1', russianText: 'В начале', englishText: 'In the beginning' }],
  vocabulary: [
    { id: 'or:A1:1', level: 'A1', lemma: 'и', meaning: 'and', linkedVerseIds: [] }
  ],
  grammar: [{ id: 'g.a1.infinitive', level: 'A1', name: 'Infinitive', linkedVerseIds: [] }],
  expressions: [{ id: 'e.a1.greeting', level: 'A1', phrase: 'Привет', meaning: 'Hi', linkedVerseIds: [] }]
};

test('resolveStoredContent returns null when the store is empty', async () => {
  const backend = fakeBackend();
  const stored = await resolveStoredContent(backend);
  assert.equal(stored, null);
});

test('ensureContentCached installs the content bundle when the store is empty', async () => {
  const backend = fakeBackend();
  const result = await ensureContentCached({ backend, meta: META, content: CONTENT });

  assert.equal(result.installed, true);
  assert.equal(result.content.version, 4);
  assert.equal(result.content.verses.length, 1);
  assert.equal(result.content.vocabulary.length, 1);
  assert.equal(typeof result.contentHash, 'string');

  const stored = await backend.load();
  assert.equal(stored.version, 4);
  assert.equal(stored.contentHash, result.contentHash);
});

test('ensureContentCached skips installation when stored content matches the prepared cache', async () => {
  const backend = fakeBackend();
  const first = await ensureContentCached({ backend, meta: META, content: CONTENT });
  const second = await ensureContentCached({
    backend,
    meta: { ...META, contentHash: first.contentHash },
    content: CONTENT
  });

  assert.equal(second.installed, false);
  assert.equal(second.contentHash, first.contentHash);
});

test('ensureContentCached replaces stale content when meta version differs', async () => {
  const backend = fakeBackend();
  await ensureContentCached({ backend, meta: META, content: CONTENT });

  const newerMeta = { ...META, version: META.version + 1 };
  const result = await ensureContentCached({ backend, meta: newerMeta, content: CONTENT });

  assert.equal(result.installed, true);
  assert.equal(result.content.version, 5);
});

test('ensureContentCached rejects malformed content and stores nothing', async () => {
  const backend = fakeBackend();
  await assert.rejects(
    () => ensureContentCached({ backend, meta: META, content: { version: 4, verses: 'not an array' } }),
    /content bundle must include verses array/
  );
});

test('prepareContentCache requires the caller to provide contentHash; no hashing happens here', () => {
  const noHashMeta = { version: 4, buildAt: '2026-06-30T00:00:00.000Z', title: 'GosRU starter bundle' };
  const prepared = prepareContentCache(noHashMeta, CONTENT);
  assert.equal(prepared.meta.version, 4);
  assert.equal(prepared.payload.version, 4);
  assert.equal(prepared.payload.verses.length, 1);
  assert.equal(prepared.payload.vocabulary.length, 1);
  assert.equal(prepared.payload.grammar.length, 1);
  assert.equal(prepared.payload.expressions.length, 1);
  assert.equal(prepared.contentHash, null);

  const providedMeta = { ...noHashMeta, contentHash: 'builder-supplied-hash' };
  const preparedWithHash = prepareContentCache(providedMeta, CONTENT);
  assert.equal(preparedWithHash.contentHash, 'builder-supplied-hash');
});

test('content-cache module is browser-safe (does not import node: built-ins)', () => {
  const source = readFileSync('src/content-cache.js', 'utf8');
  assert.doesNotMatch(source, /from\s+['"]node:/);
  assert.doesNotMatch(source, /require\(["']node:/);
  assert.doesNotMatch(source, /createHash|node:crypto/);
});
