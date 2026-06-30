import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sliceVocabularyPage, paginate, DEFAULT_VOCAB_PAGE_SIZE } from '../src/vocab-pagination.js';

test('sliceVocabularyPage returns the requested page window', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `row-${i}` }));

  assert.deepEqual(
    sliceVocabularyPage(items, { page: 1, pageSize: 10 }).map((entry) => entry.id),
    Array.from({ length: 10 }, (_, i) => `row-${i}`)
  );
  assert.deepEqual(
    sliceVocabularyPage(items, { page: 3, pageSize: 10 }).map((entry) => entry.id),
    Array.from({ length: 5 }, (_, i) => `row-${i + 20}`)
  );
});

test('sliceVocabularyPage clamps out-of-range pages to the last available slice', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ id: `item-${i}` }));

  const pageOne = sliceVocabularyPage(items, { page: 1, pageSize: 25 });
  const farPage = sliceVocabularyPage(items, { page: 99, pageSize: 25 });

  assert.equal(pageOne.length, 12);
  assert.deepEqual(farPage.map((entry) => entry.id), pageOne.map((entry) => entry.id));
});

test('sliceVocabularyPage returns an empty slice when there are no items', () => {
  assert.deepEqual(sliceVocabularyPage([], { page: 1, pageSize: 25 }), []);
});

test('paginate reports page counts and clamps the current page', () => {
  const layout = paginate({ total: 230, pageSize: 50, page: 5 });

  assert.equal(layout.pageSize, 50);
  assert.equal(layout.page, 5);
  assert.equal(layout.totalPages, 5);
  assert.equal(layout.startIndex, 200);
  assert.equal(layout.endIndex, 230);
});

test('paginate clamps requested page to last available page', () => {
  const layout = paginate({ total: 7, pageSize: 25, page: 99 });

  assert.equal(layout.totalPages, 1);
  assert.equal(layout.page, 1);
  assert.equal(layout.startIndex, 0);
  assert.equal(layout.endIndex, 7);
});

test('paginate handles empty inventories without producing a page', () => {
  const layout = paginate({ total: 0, pageSize: 25, page: 5 });

  assert.equal(layout.page, 0);
  assert.equal(layout.totalPages, 0);
  assert.equal(layout.startIndex, 0);
  assert.equal(layout.endIndex, 0);
});

test('default page size is a positive integer', () => {
  assert.ok(Number.isInteger(DEFAULT_VOCAB_PAGE_SIZE));
  assert.ok(DEFAULT_VOCAB_PAGE_SIZE > 0);
});
