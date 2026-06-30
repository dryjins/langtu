import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVELS, normalizeBundle } from '../src/bundle.js';

test('LEVELS no longer includes the pre-A1 stage', () => {
  assert.equal(LEVELS.includes('A0'), false);
  assert.deepEqual(LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
});

function makeBundle(overrides = {}) {
  return {
    version: 1,
    title: 'Private John study bundle',
    verses: [
      {
        id: 'john.1.1',
        reference: 'John 1:1',
        russianText: 'Учебный русский текст.',
        englishText: 'Artificial English study text.'
      }
    ],
    vocabulary: [
      {
        id: 'v.slovo',
        level: 'A1',
        lemma: 'слово',
        forms: ['слово'],
        meaning: 'word',
        linkedVerseIds: ['john.1.1'],
        grammarTags: ['g.neuter-noun'],
        expressionTags: ['e.study-phrase']
      }
    ],
    grammar: [
      {
        id: 'g.neuter-noun',
        level: 'A1',
        name: 'Neuter noun recognition',
        explanation: 'Recognize a basic neuter noun form.',
        linkedVerseIds: ['john.1.1']
      }
    ],
    expressions: [
      {
        id: 'e.study-phrase',
        level: 'A1',
        phrase: 'учебный текст',
        meaning: 'study text',
        linkedVerseIds: ['john.1.1']
      }
    ],
    ...overrides
  };
}

test('normalizes vocabulary, grammar, and expression entries into learning items', () => {
  const bundle = normalizeBundle(makeBundle());

  assert.equal(bundle.title, 'Private John study bundle');
  assert.equal(bundle.verses.length, 1);
  assert.equal(bundle.items.length, 3);
  assert.deepEqual(
    bundle.items.map((item) => item.type).sort(),
    ['expression', 'grammar', 'vocabulary']
  );
  assert.equal(bundle.items.find((item) => item.id === 'v.slovo').level, 'A1');
});

test('rejects entries that link to a missing verse', () => {
  const broken = makeBundle({
    vocabulary: [
      {
        id: 'v.broken',
        level: 'A1',
        lemma: 'нет',
        meaning: 'no',
        linkedVerseIds: ['john.9.99']
      }
    ]
  });

  assert.throws(() => normalizeBundle(broken), /missing verse john\.9\.99/);
});

test('rejects duplicate learning item ids across skill types', () => {
  const broken = makeBundle({
    grammar: [
      {
        id: 'v.slovo',
        level: 'A1',
        name: 'Duplicate id',
        linkedVerseIds: ['john.1.1']
      }
    ]
  });

  assert.throws(() => normalizeBundle(broken), /duplicate item id v\.slovo/);
});
