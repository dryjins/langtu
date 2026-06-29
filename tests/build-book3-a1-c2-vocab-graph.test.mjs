import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildVocabGraph,
  buildVocabLookups,
  tokenizeWithSpans,
  findMatchesForToken,
} from '../scripts/build-book3-a1-c2-vocab-graph.mjs';

function makeFixtureBible() {
  return {
    source: 'fixture',
    chapters: [
      {
        chapter: 1,
        title: 'Первый',
        textLines: ['В лес есть дом и дом.', 'Дом большой и лес.'],
      },
      {
        chapter: 2,
        title: 'Второй',
        textLines: ['Дом и лес встречаются.', 'Дом снова упомянут.'],
      },
    ],
  };
}

function makeFixtureVocab() {
  return {
    source: 'fixture',
    levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    itemsByLevel: {
      A1: [
        {
          wordId: 1,
          bare: 'дом',
          accented: 'до\'м',
          level: 'A1',
        },
      ],
      A2: [
        {
          wordId: 2,
          bare: 'лестница',
          accented: 'лестница',
          level: 'A2',
        },
      ],
      B1: [
        {
          wordId: 3,
          bare: 'лес',
          accented: 'л\'ес',
          level: 'B1',
        },
      ],
      B2: [],
      C1: [],
      C2: [],
    },
  };
}

test('tokenizeWithSpans extracts tokens with spans', () => {
  const tokens = tokenizeWithSpans('В лесу есть дом.');
  assert.equal(tokens.length, 4);
  assert.equal(tokens[0].surface, 'В');
  assert.equal(tokens[0].start, 0);
  assert.equal(tokens[0].end, 1);
  assert.equal(tokens[1].surface, 'лесу');
  assert.equal(tokens[1].start, 2);
});

test('findMatchesForToken uses exact and stem fallback rules', () => {
  const lookups = buildVocabLookups(makeFixtureVocab());

  const direct = findMatchesForToken('дом', lookups);
  assert.equal(direct.length, 1);
  assert.equal(direct[0].matchMethod, 'exact');
  assert.equal(direct[0].node.level, 'A1');

  const stem = findMatchesForToken('домом', lookups);
  assert.equal(stem.length, 0);

  const stemWithFallback = findMatchesForToken('домом', lookups, true);
  assert.equal(stemWithFallback.length, 1);
  assert.equal(stemWithFallback[0].matchMethod, 'stem-fallback');
  assert.equal(stemWithFallback[0].node.level, 'A1');
});

test('buildVocabGraph builds chapter-word edges and cloze stimuli', () => {
  const bibleData = makeFixtureBible();
  const vocabData = makeFixtureVocab();
  const graph = buildVocabGraph({
    bibleData,
    vocabData,
    minConfidence: 0.85,
    reviewTestsPerChapter: 2,
  });

  assert.equal(graph.nodes.chapters.length, 2);
  assert.equal(graph.nodes.vocabulary.length, 3);
  assert.equal(graph.edges.length > 0, true);

  const chapterOneEdges = graph.edges.filter((edge) => edge.sourceChapter === 1);
  const houseA1 = chapterOneEdges.find((edge) => edge.targetWord === 'A1:1');
  const forest = chapterOneEdges.find((edge) => edge.targetWord === 'B1:3');

  assert.equal(houseA1.count, 3);
  assert.equal(forest.count, 2);
  assert.equal(graph.globalCoverage.levels.A1.coveredUniqueWords >= 1, true);
  assert.equal(chapterOneEdges.every((edge) => edge.level.length === 2), true);

  const chapterOneStimuli = graph.reviewStimuli.byChapter.find((entry) => entry.chapter === 1).tests;
  const chapterTwoStimuli = graph.reviewStimuli.byChapter.find((entry) => entry.chapter === 2).tests;

  assert.equal(chapterOneStimuli.length, 2);
  assert.equal(chapterTwoStimuli.length, 2);
  assert.equal(new Set(chapterOneStimuli.map((testCase) => testCase.lineIndex)).size, chapterOneStimuli.length);
  assert.equal(chapterTwoStimuli[0].type, 'cloze');
  assert.equal(chapterOneStimuli[0].sentence.includes('____'), true);
});

test('low confidence matches are filtered by minConfidence threshold', () => {
  const bibleData = {
    source: 'fixture',
    chapters: [
      {
        chapter: 1,
        title: '감점 테스트',
        textLines: ['Домом'],
      },
    ],
  };

  const vocabData = {
    source: 'fixture',
    itemsByLevel: {
      A1: [
        {
          wordId: 10,
          bare: 'дом',
          level: 'A1',
        },
      ],
      A2: [],
      B1: [],
      B2: [],
      C1: [],
      C2: [],
    },
  };

  const noFallback = buildVocabGraph({
    bibleData,
    vocabData,
    includeStemFallback: true,
    minConfidence: 0.85,
  });

  assert.equal(noFallback.edges.some((edge) => edge.matchConfidence < 0.85), true);
  assert.equal(noFallback.chapterCoverageByLevel[0].levelCoverage.A1.coveredUnique, 0);

  const withLowThreshold = buildVocabGraph({
    bibleData,
    vocabData,
    includeStemFallback: true,
    minConfidence: 0.7,
  });

  assert.equal(withLowThreshold.chapterCoverageByLevel[0].levelCoverage.A1.coveredUnique, 1);
});
