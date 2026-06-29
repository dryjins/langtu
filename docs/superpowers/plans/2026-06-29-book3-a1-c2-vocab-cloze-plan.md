# Book3 A1~C2 Vocab Cloze Revisit Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable precompute script that generates `data/bible-kids-03-a1-c2-vocab-graph.json` with N:M chapter-word edges and chapter-level cloze test stimuli for revisits.

**Architecture:** Parse existing Book 3 text and A1~C2 vocabulary, build canonical match index (exact + accented + optional stem fallback), aggregate edges/coverage, then derive cloze review items per chapter from high-priority matched word locations. Keep script deterministic and testable by exposing core functions for unit tests while keeping CLI execution behavior intact.

**Tech Stack:** Node.js ES modules, `node:test`, `node:assert/strict`, `node:fs/promises`, no new third-party dependencies.

---

### Task 1: Implement graph build core

**Files: 
- Create: `scripts/build-book3-a1-c2-vocab-graph.mjs`**

- [ ] **Step 1: Write script-level parser and matcher helpers with explicit data contracts**

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export function normalizeTextToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0435/g, '\u0435')
    .replace(/\u0451/g, '\u0435')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[’'`´]/g, '')
    .trim();
}

export function tokenizeWithSpans(line) {
  const tokenRegex = /[\p{L}]+(?:-[\p{L}]+)*/gu;
  const out = [];
  let match;
  while ((match = tokenRegex.exec(line)) !== null) {
    out.push({
      surface: match[0],
      start: match.index,
      end: match.index + match[0].length,
      normalized: normalizeTextToken(match[0])
    });
  }
  return out;
}

export function normalizeWord(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}
```

- [ ] **Step 2: Implement vocabulary index + fallback matcher + edge builder that emits deterministic chapter-word edges**

```javascript
const matchConf = {
  exact: 1,
  'surface-accented': 0.9,
  'stem-fallback': 0.7
};

export function buildVocabLookups(vocabData) {
  const byExact = new Map();
  const byAccent = new Map();
  const allWords = [];

  for (const level of LEVELS) {
    const items = Array.isArray(vocabData?.itemsByLevel?.[level]) ? vocabData.itemsByLevel[level] : [];
    for (const item of items) {
      const id = `${level}:${item.wordId}`;
      const node = {
        id,
        word: item.bare,
        normalized: normalizeWord(item.bare),
        level,
        wordId: item.wordId,
        matchKeys: {
          exact: normalizeWord(item.bare),
          accent: normalizeWord(item.accented || item.bare)
        }
      };
      allWords.push(node);
      const exactKey = node.matchKeys.exact;
      const accentKey = normalizeTextToken(item.accented || item.bare);

      if (!byExact.has(exactKey)) byExact.set(exactKey, []);
      if (!byAccent.has(accentKey)) byAccent.set(accentKey, []);
      byExact.get(exactKey).push(node);
      byAccent.get(accentKey).push(node);
    }
  }

  return { byExact, byAccent, allWords };
}

export function findMatches(surface, lookups) {
  const normalized = normalizeWord(surface);
  const byExact = lookups.byExact.get(normalized) || [];
  if (byExact.length) return byExact.map((node) => ({ ...node, matchMethod: 'exact', confidence: matchConf.exact }));

  const byAccent = lookups.byAccent.get(normalizeTextToken(surface)) || [];
  if (byAccent.length) return byAccent.map((node) => ({ ...node, matchMethod: 'surface-accented', confidence: matchConf['surface-accented'] }));

  return [];
}
```

- [ ] **Step 3: Implement `buildVocabGraph` and coverage + cloze review-stimulus derivation with explicit output schema**

```javascript
export function buildVocabGraph({ bibleData, vocabData, minConfidence = 0.85, clozePerChapter = 3 }) {
  const lookups = buildVocabLookups(vocabData);
  const chapterMap = new Map();
  const wordMap = new Map();
  const chapterTokenCounts = new Map();

  for (const chapter of bibleData.chapters) {
    const chapterId = String(chapter.chapter);
    chapterTokenCounts.set(chapterId, 0);
    chapterMap.set(chapterId, new Map());
    let tokenIndex = 0;

    for (const [lineIndex, line] of chapter.textLines.entries()) {
      const tokens = tokenizeWithSpans(line);
      chapterTokenCounts.set(chapterId, chapterTokenCounts.get(chapterId) + tokens.length);
      tokens.forEach((token, tokenInLineIndex) => {
        const matches = findMatches(token.normalized, lookups);
        for (const m of matches) {
          const edgeKey = `${chapterId}|${m.id}`;
          const edgeMap = chapterMap.get(chapterId);
          if (!edgeMap.has(m.id)) {
            edgeMap.set(m.id, {
              sourceChapter: Number(chapter.chapter),
              targetWord: m.id,
              level: m.level,
              count: 0,
              matchConfidence: 0,
              locations: []
            });
          }
          const edge = edgeMap.get(m.id);
          edge.count += 1;
          edge.matchConfidence = (edge.matchConfidence * (edge.locations.length - (edge.count > 1 ? 1 : 0)) + m.confidence) / edge.count;
          edge.locations.push({ chapter: Number(chapter.chapter), lineIndex, tokenIndex, tokenInLineIndex, surface: token.surface, matchMethod: m.matchMethod, confidence: m.confidence });
        }
        tokenIndex += 1;
      });
      void edgeKey;
    }

    for (const edge of chapterMap.get(chapterId).values()) {
      if (!wordMap.has(edge.targetWord)) {
        const node = lookups.allWords.find((item) => item.id === edge.targetWord);
        if (node) wordMap.set(node.id, node);
      }
    }
  }

  const edges = [];
  const nodesChapters = [];
  for (const chapter of bibleData.chapters) {
    const chapterId = String(chapter.chapter);
    nodesChapters.push({
      id: Number(chapter.chapter),
      chapter: Number(chapter.chapter),
      title: chapter.title,
      lineCount: chapter.textLines.length,
      tokenCount: chapterTokenCounts.get(chapterId)
    });
    const sortedEdges = [...chapterMap.get(chapterId).values()].sort((a, b) => (a.targetWord > b.targetWord ? 1 : -1));
    for (const edge of sortedEdges) edges.push(edge);
  }

  const nodesVocabulary = [...wordMap.values()].sort((a, b) => (a.level > b.level ? 1 : a.level < b.level ? -1 : a.id > b.id ? 1 : -1));

  const chapterCoverageByLevel = [];
  for (const chapter of nodesChapters) {
    const coverageByLevel = {};
    let cumulative = new Set();
    for (const level of LEVELS) {
      for (const v of nodesVocabulary) {
        if (LEVELS.indexOf(v.level) <= LEVELS.indexOf(level)) {
          cumulative.add(v.id);
        }
      }
      const covered = new Set();
      let coveredTokenCount = 0;
      for (const edge of chapterMap.get(String(chapter.chapter)).values()) {
        if (cumulative.has(edge.targetWord) && edge.matchConfidence >= minConfidence) {
          covered.add(edge.targetWord);
          coveredTokenCount += edge.count;
        }
      }
      const totalLevelWords = cumulative.size;
      const coveredUnique = covered.size;
      const missingUnique = Math.max(totalLevelWords - coveredUnique, 0);
      const tokenTotal = chapter.tokenCount || 1;
      const coveredTokenRate = (100 * coveredTokenCount) / tokenTotal;
      coverageByLevel[level] = {
        coveredUnique,
        missingUnique,
        coveredTokenRate: Number(coveredTokenRate.toFixed(2)),
        missingTokenRate: Number((100 - coveredTokenRate).toFixed(2))
      };
    }
    chapterCoverageByLevel.push({ chapter: chapter.chapter, levelCoverage: coverageByLevel });
  }

  const reviewStimuli = buildClozeStimuli({
    bibleData,
    chapterMap,
    minConfidence,
    clozePerChapter,
    levelOrder: LEVELS
  });

  return {
    metadata: {
      sourceBible: bibleData.source,
      sourceVocab: vocabData.source,
      generatedAt: new Date().toISOString(),
      levelOrder: LEVELS,
      minConfidence,
      clozePerChapter
    },
    nodes: {
      chapters: nodesChapters,
      vocabulary: nodesVocabulary
    },
    edges,
    chapterCoverageByLevel,
    globalCoverage: {
      byLevel: calculateGlobalCoverage({ edges, nodesVocabulary, minConfidence, chapterTokenCounts })
    },
    reviewStimuli
  };
}
```

- [ ] **Step 4: Add CLI run path and CLI options (`--input-bible`, `--input-vocab`, `--output`, `--min-confidence`)**

```javascript
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bibleData = JSON.parse(await fs.readFile(args.inputBible, 'utf8'));
  const vocabData = JSON.parse(await fs.readFile(args.inputVocab, 'utf8'));
  const output = buildVocabGraph({
    bibleData,
    vocabData,
    minConfidence: args.minConfidence,
    clozePerChapter: args.reviewTestsPerChapter
  });
  await fs.mkdir(path.dirname(args.output), { recursive: true });
  await fs.writeFile(args.output, JSON.stringify(output, null, 2));
  process.stdout.write(`Wrote ${path.resolve(args.output)}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
```

- [ ] **Step 5: Run the script once to confirm it creates `data/bible-kids-03-a1-c2-vocab-graph.json`**

Run:

```bash
npm run build:book3-a1-c2-vocab-graph -- --input-bible data/bible-kids-03.json --input-vocab data/openrussian-vocab-a1-c2.json --output data/bible-kids-03-a1-c2-vocab-graph.json
```

Expected: JSON output file created with `metadata`, `nodes.chapters`, `nodes.vocabulary`, `edges`, `chapterCoverageByLevel`, and `reviewStimuli.byChapter`.

### Task 2: Add focused tests for matcher, coverage, and cloze outputs

**Files:**
- Create: `tests/build-book3-a1-c2-vocab-graph.test.mjs`

- [ ] **Step 1: Add matcher fixture tests: exact + accented normalization + tokenization**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { findMatches, tokenizeWithSpans, normalizeWord, buildVocabGraph } from '../scripts/build-book3-a1-c2-vocab-graph.mjs';

test('normalizeWord makes ё/e and stress marks deterministic', () => {
  assert.equal(normalizeWord("Э'тим"), 'этим');
});

test('findMatches supports exact and accent-stripped secondary keys', () => {
  const fixtures = buildVocabLookups({ itemsByLevel: {
    A1: [{ wordId: 1, bare: 'это', accented: "э'то", level: 'A1' }],
    A2: [], B1: [], B2: [], C1: [], C2: []
  }});
  const exact = findMatches('это', fixtures);
  assert.equal(exact[0].matchMethod, 'exact');
});
```

- [ ] **Step 2: Add graph/coverage test on compact synthetic chapter and assert deterministic fields**

```javascript
test('buildVocabGraph creates N:M edges and chapter coverage with cloze candidates', () => {
  const bibleData = {
    source: 'fixture',
    chapters: [
      { chapter: 1, title: 'Chapter 1', textLines: ['Я люблю читать книгу.', 'Он сказал: «Это книга.»'] },
      { chapter: 2, title: 'Chapter 2', textLines: ['День был хорош.'] }
    ]
  };
  const vocabData = {
    source: 'fixture-vocab',
    itemsByLevel: {
      A1: [
        { wordId: 1, bare: 'книга', accented: 'книга', level: 'A1' },
        { wordId: 2, bare: 'это', accented: "э'то", level: 'A1' }
      ],
      A2: [], B1: [], B2: [], C1: [], C2: []
    }
  };

  const graph = buildVocabGraph({ bibleData, vocabData, minConfidence: 0.85, clozePerChapter: 2 });
  assert.equal(graph.edges.length > 0, true);
  assert.equal(graph.nodes.chapters.length, 2);
  assert.equal(graph.nodes.vocabulary.length, 2);
  assert.equal(graph.chapterCoverageByLevel[0].levelCoverage.A1.coveredUnique >= 0, true);
  assert.equal(graph.reviewStimuli.byChapter[0].tests.length >= 1, true);
});
```

- [ ] **Step 3: Run tests to verify failures then fixes**

Run:

```bash
npm test tests/build-book3-a1-c2-vocab-graph.test.mjs
```

Expected: PASS for at least matcher and graph shape tests.

### Task 3: Wire script into NPM scripts and quick runtime verification

**Files:**
- Update: `package.json`

- [ ] **Step 1: Add npm script for local generation**

```json
"build:book3-a1-c2-vocab-graph": "node ./scripts/build-book3-a1-c2-vocab-graph.mjs --input-bible data/bible-kids-03.json --input-vocab data/openrussian-vocab-a1-c2.json --output data/bible-kids-03-a1-c2-vocab-graph.json"
```

- [ ] **Step 2: Run focused test + full test**

```bash
npm run build:book3-a1-c2-vocab-graph
npm test
```

Expected: build writes file and full suite passes.

### Task 4: Commit and verify file changes

- [ ] **Step 1: Stage and commit only relevant files**

```bash
git add scripts/build-book3-a1-c2-vocab-graph.mjs tests/build-book3-a1-c2-vocab-graph.test.mjs package.json data/bible-kids-03-a1-c2-vocab-graph.json docs/superpowers/plans/2026-06-29-book3-a1-c2-vocab-cloze-plan.md
git commit -m "feat: build book3 vocab graph with cloze review stimuli"
```

- [ ] **Step 2: Verify and summarize**
  - `git status` clean for modified paths
  - confirm generated graph file includes `reviewStimuli.byChapter` and `edges` with `locations`

## Execution options

Two options:

1. Subagent-Driven (recommended) - dispatch per task and review each checkpoint.
2. Inline Execution - run all tasks in this session using `superpowers:executing-plans`.
