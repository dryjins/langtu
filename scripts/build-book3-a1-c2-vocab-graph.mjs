import fs from 'node:fs/promises';
import path from 'node:path';

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_INDEX = new Map(LEVELS.map((level, index) => [level, index]));

const MATCH_CONFIDENCE = {
  exact: 1,
  'surface-accented': 0.9,
  'stem-fallback': 0.7,
};

const CLI_DEFAULTS = {
  inputBible: 'data/bible-kids-03.json',
  inputVocab: 'data/openrussian-vocab-a1-c2.json',
  output: 'data/bible-kids-03-a1-c2-vocab-graph.json',
  minConfidence: 0.85,
  reviewTestsPerChapter: 3,
  includeStemFallback: false,
};

const TOKEN_RE = /[\p{L}]+(?:[-ʼ'’][\p{L}]+)*/gu;

function normalizeBare(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/\u0450/g, '\u0435')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ʼ'’`´]/g, '')
    .trim();
}

function normalizeWithStress(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/\u0450/g, '\u0435')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[ʼ'’`´]/g, '')
    .trim();
}

export function tokenizeWithSpans(line) {
  const out = [];
  let match;
  while ((match = TOKEN_RE.exec(line)) !== null) {
    out.push({
      surface: match[0],
      start: match.index,
      end: match.index + match[0].length,
      normalized: normalizeBare(match[0]),
    });
  }

  return out;
}

function makeNodeId(level, wordId) {
  return `${level}:${wordId}`;
}

function buildLevelSets(vocabularyNodes) {
  const byLevel = new Map();
  const cumulativeByLevel = new Map();
  let running = new Set();

  for (const level of LEVELS) {
    const filtered = vocabularyNodes.filter((node) => node.level === level);
    byLevel.set(level, filtered);
    for (const node of filtered) {
      running = new Set([...running, node.id]);
    }
    cumulativeByLevel.set(level, new Set(running));
  }

  return { byLevel, cumulativeByLevel };
}

function stemFallbackCandidates(token) {
  const suffixes = [
    'ами',
    'ями',
    'ого',
    'ому',
    'ему',
    'ые',
    'ими',
    'ого',
    'его',
    'ой',
    'ей',
    'ою',
    'ею',
    'ом',
    'ем',
    'ах',
    'ях',
    'ая',
    'яя',
    'е',
    'ы',
    'и',
    'а',
    'я',
    'у',
    'ю',
    'ь',
    'ть',
    'ти',
    'еть',
    'ать',
    'ить',
    'ешь',
    'ют',
    'ите',
    'ала',
    'али',
    'алось',
    'еться',
    'илась',
    'ился',
  ];

  const out = new Set([token]);

  for (const suffix of suffixes) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      out.add(token.slice(0, token.length - suffix.length));
    }
  }

  return [...out].filter((candidate) => candidate.length >= 2);
}

export function buildVocabLookups(vocabData) {
  const vocabularyNodes = [];
  const exactByKey = new Map();
  const accentByKey = new Map();

  for (const level of LEVELS) {
    const items = Array.isArray(vocabData?.itemsByLevel?.[level]) ? vocabData.itemsByLevel[level] : [];
    for (const item of items) {
      if (!item || item.wordId == null || !item.bare) {
        continue;
      }

      const exactKey = normalizeBare(item.bare);
      const accentKey = normalizeWithStress(item.accented || item.bare);
      const node = {
        id: makeNodeId(level, item.wordId),
        word: item.bare,
        normalized: exactKey,
        level,
        wordId: item.wordId,
        matchKeys: {
          exact: [exactKey],
          accent: [accentKey],
        },
      };

      vocabularyNodes.push(node);

      if (!exactByKey.has(exactKey)) {
        exactByKey.set(exactKey, []);
      }
      exactByKey.get(exactKey).push(node);

      if (!accentByKey.has(accentKey)) {
        accentByKey.set(accentKey, []);
      }
      accentByKey.get(accentKey).push(node);
    }
  }

  return { vocabularyNodes, exactByKey, accentByKey };
}

export function findMatchesForToken(token, lookups, includeStemFallback = false) {
  const matches = new Map();
  const bareToken = normalizeBare(token);
  const exactMatches = lookups.exactByKey.get(bareToken) || [];
  if (exactMatches.length > 0) {
    for (const node of exactMatches) {
      matches.set(`${node.id}:exact`, {
        node,
        matchMethod: 'exact',
        matchConfidence: MATCH_CONFIDENCE.exact,
      });
    }
    return [...matches.values()];
  }

  const accentMatches = lookups.accentByKey.get(normalizeWithStress(token)) || [];
  for (const node of accentMatches) {
    matches.set(`${node.id}:surface-accented`, {
      node,
      matchMethod: 'surface-accented',
      matchConfidence: MATCH_CONFIDENCE['surface-accented'],
    });
  }

  if (!includeStemFallback || accentMatches.length > 0) {
    return [...matches.values()];
  }

  for (const candidate of stemFallbackCandidates(bareToken)) {
    for (const node of lookups.exactByKey.get(candidate) || []) {
      matches.set(`${node.id}:stem-fallback`, {
        node,
        matchMethod: 'stem-fallback',
        matchConfidence: MATCH_CONFIDENCE['stem-fallback'],
      });
    }
  }

  return [...matches.values()];
}

export function buildVocabGraph({
  bibleData,
  vocabData,
  minConfidence = 0.85,
  reviewTestsPerChapter = 3,
  includeStemFallback = false,
}) {
  if (!bibleData || !Array.isArray(bibleData.chapters)) {
    throw new Error('bibleData.chapters must be an array');
  }

  if (!vocabData || !vocabData.itemsByLevel) {
    throw new Error('vocabData.itemsByLevel is required');
  }

  const lookups = buildVocabLookups(vocabData);
  const { cumulativeByLevel } = buildLevelSets(lookups.vocabularyNodes);

  const chapterNodes = [];
  const chapterToEdgeMap = new Map();
  const chapterTokenCounts = new Map();
  const edges = [];

  for (const chapter of bibleData.chapters) {
    const chapterNum = Number(chapter.chapter);
    const chapterKey = String(chapterNum);
    const textLines = Array.isArray(chapter.textLines) ? chapter.textLines : [];
    const edgeByWord = new Map();

    let chapterTokenIndex = 0;
    for (let lineIndex = 0; lineIndex < textLines.length; lineIndex += 1) {
      const line = textLines[lineIndex] || '';
      const tokens = tokenizeWithSpans(line);

      for (let tokenInLineIndex = 0; tokenInLineIndex < tokens.length; tokenInLineIndex += 1) {
        const token = tokens[tokenInLineIndex];
        const matches = findMatchesForToken(token.surface, lookups, includeStemFallback);

        for (const match of matches) {
          const edgeKey = `${chapterKey}|${match.node.id}`;
          if (!edgeByWord.has(edgeKey)) {
            edgeByWord.set(edgeKey, {
              sourceChapter: chapterNum,
              targetWord: match.node.id,
              level: match.node.level,
              count: 0,
              matchConfidence: 0,
              locations: [],
            });
          }

          const edge = edgeByWord.get(edgeKey);
          edge.count += 1;
          edge.locations.push({
            chapter: chapterNum,
            lineIndex,
            tokenIndex: chapterTokenIndex,
            tokenInLineIndex,
            surface: token.surface,
            matchMethod: match.matchMethod,
          });
        }

        if (tokens.length > 0) {
          chapterTokenIndex += 1;
        }
      }
    }

    for (const edge of edgeByWord.values()) {
      const totalConf = edge.locations
        .reduce((acc, location) => {
          const conf = MATCH_CONFIDENCE[location.matchMethod] ?? 0;
          return acc + conf;
        }, 0);
      edge.matchConfidence = Number((totalConf / edge.locations.length).toFixed(3));
      edge.locations.sort((a, b) => a.lineIndex - b.lineIndex || a.tokenIndex - b.tokenIndex);
      edges.push(edge);
    }

    chapterNodes.push({
      id: chapterNum,
      chapter: chapterNum,
      title: chapter.title || chapter.titleText || `Chapter ${chapterNum}`,
      lineCount: textLines.length,
      tokenCount: chapterTokenIndex,
    });
    chapterTokenCounts.set(chapterKey, chapterTokenIndex);
    chapterToEdgeMap.set(chapterKey, edgeByWord);
  }

  const nodesVocabulary = lookups.vocabularyNodes
    .slice()
    .sort((a, b) => {
      if (a.level !== b.level) {
        return LEVEL_INDEX.get(a.level) - LEVEL_INDEX.get(b.level);
      }
      return Number(a.wordId) - Number(b.wordId);
    })
    .map((node) => ({
      ...node,
      matchKeys: {
        exact: [...new Set(node.matchKeys.exact)],
        accent: [...new Set(node.matchKeys.accent)],
      },
    }));

  const chapterCoverageByLevel = chapterNodes.map((chapterNode) => {
    const edgeMap = chapterToEdgeMap.get(String(chapterNode.chapter)) || new Map();
    const levelCoverage = {};

    for (const level of LEVELS) {
      const vocabSet = cumulativeByLevel.get(level) || new Set();
      const coveredUnique = new Set();
      let coveredTokenCount = 0;

      for (const edge of edgeMap.values()) {
        if (edge.matchConfidence < minConfidence) {
          continue;
        }
        if (vocabSet.has(edge.targetWord)) {
          coveredUnique.add(edge.targetWord);
          coveredTokenCount += edge.count;
        }
      }

      const coveredUniqueRate = vocabSet.size > 0 ? (coveredUnique.size / vocabSet.size) * 100 : 0;
      const coveredTokenRate = chapterNode.tokenCount > 0 ? (coveredTokenCount / chapterNode.tokenCount) * 100 : 0;
      const coveredUniqueCount = coveredUnique.size;
      const cumulativeCount = vocabSet.size;

      levelCoverage[level] = {
        coveredUnique: coveredUniqueCount,
        missingUnique: Math.max(cumulativeCount - coveredUniqueCount, 0),
        coveredTokenRate: Number(coveredTokenRate.toFixed(2)),
        missingTokenRate: Number((100 - coveredTokenRate).toFixed(2)),
        coveredUniqueRate: Number(coveredUniqueRate.toFixed(2)),
        missingUniqueRate: Number((100 - coveredUniqueRate).toFixed(2)),
      };
    }

    return {
      chapter: chapterNode.chapter,
      levelCoverage,
    };
  });

  const totalTokens = [...chapterTokenCounts.values()].reduce((acc, value) => acc + value, 0);
  const globalLevels = {};
  let union = {
    totalVocabSize: 0,
    coveredUniqueWords: 0,
    missingUniqueWords: 0,
    coverageUniqueRate: 0,
    missingUniqueRate: 0,
    coveredTokenRate: 0,
    missingTokenRate: 0,
  };

  for (const level of LEVELS) {
    const vocabSet = cumulativeByLevel.get(level) || new Set();
    const covered = new Set();
    let coveredTokenCount = 0;

    for (const edge of edges) {
      if (edge.matchConfidence < minConfidence) {
        continue;
      }
      if (vocabSet.has(edge.targetWord)) {
        covered.add(edge.targetWord);
        coveredTokenCount += edge.count;
      }
    }

    const coveredCount = covered.size;
    const missingCount = Math.max(vocabSet.size - coveredCount, 0);
    const coveredUniqueRate = vocabSet.size > 0 ? (coveredCount / vocabSet.size) * 100 : 0;
    const coveredTokenRate = totalTokens > 0 ? (coveredTokenCount / totalTokens) * 100 : 0;

    globalLevels[level] = {
      cumulativeVocabSize: vocabSet.size,
      coveredUniqueWords: coveredCount,
      missingUniqueWords: missingCount,
      coveredUniqueRate: Number(coveredUniqueRate.toFixed(2)),
      missingUniqueRate: Number((100 - coveredUniqueRate).toFixed(2)),
      coveredTokenRate: Number(coveredTokenRate.toFixed(2)),
      missingTokenRate: Number((100 - coveredTokenRate).toFixed(2)),
    };

    if (level === 'C2') {
      union = {
        totalVocabSize: vocabSet.size,
        coveredUniqueWords: coveredCount,
        missingUniqueWords: missingCount,
        coverageUniqueRate: Number(coveredUniqueRate.toFixed(2)),
        missingUniqueRate: Number((100 - coveredUniqueRate).toFixed(2)),
        coveredTokenRate: Number(coveredTokenRate.toFixed(2)),
        missingTokenRate: Number((100 - coveredTokenRate).toFixed(2)),
      };
    }
  }

  const reviewStimuli = buildReviewStimuli({
    chapterNodes,
    chapterToEdgeMap,
    bibleData,
    lookups,
    minConfidence,
    reviewTestsPerChapter,
  });

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: {
        bible: bibleData.source,
        vocab: vocabData.source,
      },
      levels: LEVELS,
      minConfidence,
      reviewTestsPerChapter,
      includeStemFallback,
    },
    nodes: {
      chapters: chapterNodes,
      vocabulary: nodesVocabulary,
    },
    edges: edges.sort((a, b) => {
      if (a.sourceChapter !== b.sourceChapter) {
        return a.sourceChapter - b.sourceChapter;
      }
      if (a.level !== b.level) {
        return LEVEL_INDEX.get(a.level) - LEVEL_INDEX.get(b.level);
      }
      return a.targetWord.localeCompare(b.targetWord);
    }),
    chapterCoverageByLevel,
    globalCoverage: {
      byLevel: globalLevels,
      levels: globalLevels,
      union,
    },
    reviewStimuli,
  };
}

function buildReviewStimuli({
  chapterNodes,
  chapterToEdgeMap,
  bibleData,
  lookups,
  minConfidence,
  reviewTestsPerChapter,
}) {
  const chapterLookup = new Map();
  for (const chapter of bibleData.chapters || []) {
    chapterLookup.set(chapter.chapter, chapter);
  }

  const vocabById = new Map(lookups.vocabularyNodes.map((node) => [node.id, node]));
  const byChapter = [];

  for (const chapterNode of chapterNodes) {
    const edgeMap = chapterToEdgeMap.get(String(chapterNode.chapter)) || new Map();
    const candidates = [];

    for (const edge of edgeMap.values()) {
      if (edge.matchConfidence < minConfidence) {
        continue;
      }
      for (const location of edge.locations) {
        candidates.push({
          edge,
          location,
          levelPriority: LEVEL_INDEX.get(edge.level) || 99,
          countPriority: edge.count,
        });
      }
    }

    candidates.sort((a, b) => {
      if (a.levelPriority !== b.levelPriority) {
        return a.levelPriority - b.levelPriority;
      }
      if (a.countPriority !== b.countPriority) {
        return b.countPriority - a.countPriority;
      }
      if (a.location.lineIndex !== b.location.lineIndex) {
        return a.location.lineIndex - b.location.lineIndex;
      }
      return a.location.tokenInLineIndex - b.location.tokenInLineIndex;
    });

    const usedLine = new Set();
    const tests = [];
    for (const candidate of candidates) {
      if (tests.length >= reviewTestsPerChapter) {
        break;
      }
      if (usedLine.has(candidate.location.lineIndex)) {
        continue;
      }

      const chapterData = chapterLookup.get(chapterNode.chapter);
      if (!chapterData) {
        continue;
      }

      const lineText = String(chapterData.textLines?.[candidate.location.lineIndex] || '');
      const spans = tokenizeWithSpans(lineText);
      const span = spans[candidate.location.tokenInLineIndex];
      if (!span) {
        continue;
      }

      const sentence = `${lineText.slice(0, span.start)}____${lineText.slice(span.end)}`;
      const wordNode = vocabById.get(candidate.edge.targetWord);
      if (!wordNode) {
        continue;
      }

      const acceptableAnswers = [...new Set([
        wordNode.word,
        wordNode.normalized,
        ...wordNode.matchKeys.exact,
        ...wordNode.matchKeys.accent,
      ].filter(Boolean))];

      usedLine.add(candidate.location.lineIndex);
      tests.push({
        type: 'cloze',
        chapter: chapterNode.chapter,
        lineIndex: candidate.location.lineIndex,
        sentence,
        blankedToken: span.surface,
        answer: wordNode.word,
        acceptableAnswers,
        sourceLevel: candidate.edge.level,
        sourceWordId: candidate.edge.targetWord,
        sourceMatchConfidence: candidate.edge.matchConfidence,
        location: {
          tokenIndex: candidate.location.tokenIndex,
          originalToken: candidate.location.surface,
          matchMethod: candidate.location.matchMethod,
        },
      });
    }

    byChapter.push({
      chapter: chapterNode.chapter,
      title: chapterNode.title,
      tests,
    });
  }

  return {
    byChapter,
    defaults: {
      mode: 'sentence-cloze',
      perChapter: reviewTestsPerChapter,
    },
  };
}

function parseArgs(argv) {
  const args = {
    ...CLI_DEFAULTS,
    includeStemFallback: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    const hasNext = next !== undefined && !next.startsWith('--');

    switch (key) {
      case 'help': {
        args.help = true;
        break;
      }
      case 'input-bible': {
        if (!hasNext) {
          throw new Error('--input-bible requires a value');
        }
        args.inputBible = next;
        i += 1;
        break;
      }
      case 'input-vocab': {
        if (!hasNext) {
          throw new Error('--input-vocab requires a value');
        }
        args.inputVocab = next;
        i += 1;
        break;
      }
      case 'output': {
        if (!hasNext) {
          throw new Error('--output requires a value');
        }
        args.output = next;
        i += 1;
        break;
      }
      case 'min-confidence': {
        if (!hasNext) {
          throw new Error('--min-confidence requires a number');
        }
        args.minConfidence = Number(next);
        i += 1;
        break;
      }
      case 'review-tests-per-chapter': {
        if (!hasNext) {
          throw new Error('--review-tests-per-chapter requires a number');
        }
        args.reviewTestsPerChapter = Number(next);
        i += 1;
        break;
      }
      case 'include-stem-fallback': {
        args.includeStemFallback = hasNext ? (next === 'true' || next === '1') : true;
        if (hasNext) {
          i += 1;
        }
        break;
      }
      default: {
        throw new Error(`Unknown option: ${arg}`);
      }
    }
  }

  return args;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: node ./scripts/build-book3-a1-c2-vocab-graph.mjs [options]',
      '',
      '--input-bible path             Input Book 3 JSON (required)',
      '--input-vocab path             Input openrussian vocab JSON (required)',
      '--output path                  Output graph JSON',
      '--min-confidence value         Minimum confidence for coverage (default: 0.85)',
      '--review-tests-per-chapter n    Number of cloze tests per chapter (default: 3)',
      '--include-stem-fallback bool   Enable stem fallback (default: false)',
      '--help                         Print help',
    ].join('\n') + '\n'
  );
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }

  if (Number.isNaN(args.minConfidence)) {
    throw new Error('--min-confidence must be a number');
  }
  if (Number.isNaN(args.reviewTestsPerChapter) || args.reviewTestsPerChapter < 1) {
    throw new Error('--review-tests-per-chapter must be a positive integer');
  }

  const [bibleRaw, vocabRaw] = await Promise.all([
    fs.readFile(path.resolve(args.inputBible), 'utf8'),
    fs.readFile(path.resolve(args.inputVocab), 'utf8'),
  ]);

  const bibleData = JSON.parse(bibleRaw);
  const vocabData = JSON.parse(vocabRaw);

  const graph = buildVocabGraph({
    bibleData,
    vocabData,
    minConfidence: args.minConfidence,
    reviewTestsPerChapter: args.reviewTestsPerChapter,
    includeStemFallback: args.includeStemFallback,
  });

  await fs.mkdir(path.dirname(path.resolve(args.output)), { recursive: true });
  await fs.writeFile(path.resolve(args.output), JSON.stringify(graph, null, 2));
  process.stdout.write(`Wrote ${path.resolve(args.output)}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await runCli();
}
