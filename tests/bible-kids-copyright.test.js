import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('bible kids dataset includes copyright attribution metadata', () => {
  const payload = JSON.parse(readFileSync('data/bible-kids-03.json', 'utf8'));

  assert.equal(payload.source, 'https://bible.by/kids/book/3/');
  assert.equal(typeof payload.copyright, 'object');
  assert.equal(typeof payload.copyright.holder, 'string');
  assert.equal(typeof payload.copyright.statement, 'string');
  assert.match(payload.copyright.holder, /Библейская миссия/);
  assert.match(payload.copyright.statement, /©\s*2022/);
  assert.match(payload.copyright.sourceUrl, /^https:\/\/bible\.by/);

  const firstChapter = payload.chapters?.[0];
  const lastChapter = payload.chapters?.[payload.chapters.length - 1];

  assert.ok(firstChapter && lastChapter);
  assert.equal(firstChapter.chapter, 1);
  assert.equal(lastChapter.chapter, 102);

  assert.equal(typeof firstChapter.copyright, 'object');
  assert.equal(firstChapter.copyright.holder, payload.copyright.holder);
});
