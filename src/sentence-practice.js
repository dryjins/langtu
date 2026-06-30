import { getInventoryItems } from './scheduler.js';

const WORD_RE = /[A-Za-zА-Яа-яЁё]+/g;

const LEARNED_STATES = new Set(['known', 'retired']);

function normalizeWord(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-zа-яё]+/giu, '');
}

function extractWords(text) {
  return String(text ?? '').match(WORD_RE) ?? [];
}

function escapeString(value) {
  return String(value ?? '');
}

function isLearnedState(state) {
  return LEARNED_STATES.has(state);
}

function itemByProgress(item, progressItems) {
  return progressItems?.[item.id];
}

function pickTargetWord(baseSentence, knownLabels) {
  const words = extractWords(baseSentence);
  if (words.length === 0) return null;

  const knownLookup = new Map(
    knownLabels
      .filter((value) => value)
      .map((value) => [normalizeWord(value), value])
  );

  for (const word of words) {
    const normalized = normalizeWord(word);
    if (knownLookup.has(normalized)) {
      continue;
    }
    if (normalized.length > 0) {
      return word;
    }
  }

  return words[0] ?? null;
}

function pickReplacementWord(baseWord, knownLabels, existingSentenceWords) {
  const avoid = normalizeWord(baseWord);
  const candidates = knownLabels
    .map((label) => String(label))
    .filter((label) => normalizeWord(label).length > 0 && normalizeWord(label) !== avoid)
    .filter((label) => !existingSentenceWords.includes(normalizeWord(label)) || existingSentenceWords.length < 1);

  return candidates[0] ?? null;
}

function replaceFirstWord(sentence, targetWord, replacementWord) {
  const normalizedTarget = normalizeWord(targetWord);
  let replacement = escapeString(replacementWord);

  for (const match of String(sentence).matchAll(WORD_RE)) {
    if (normalizeWord(match[0]) === normalizedTarget) {
      const start = match.index;
      const end = start + match[0].length;
      return `${sentence.slice(0, start)}${replacement}${sentence.slice(end)}`;
    }
  }

  return null;
}

function normalizeSentence(sentence) {
  return String(sentence)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildSentenceHints(bundle, progress, verseId) {
  if (!bundle?.items) return [];
  const progressItems = progress?.items ?? {};

  const hintedItems = bundle.items
    .filter((item) => Array.isArray(item.linkedVerseIds) && item.linkedVerseIds.includes(verseId))
    .filter((item) => isLearnedState(itemByProgress(item, progressItems)?.state));

  const uniqueById = new Map();

  for (const item of hintedItems) {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  }

  return [...uniqueById.values()]
    .filter((item) => item.type === 'vocabulary' || item.type === 'grammar' || item.type === 'expression')
    .sort((a, b) => {
      if (a.level !== b.level) return a.level.localeCompare(b.level);
      return a.type.localeCompare(b.type);
    });
}

function getFocusItem(bundle, progress, { level, todayItem }) {
  if (todayItem) {
    return todayItem;
  }

  return getInventoryItems(bundle, progress, {
    level,
    type: 'all',
    state: 'all'
  })[0]?.item ?? null;
}

function findVerseFromItem(bundle, item) {
  const verseId = item?.linkedVerseIds?.[0];
  if (!verseId) return null;
  return bundle?.verses?.find((verse) => verse.id === verseId) ?? null;
}

export function buildSentenceTruthChallenge(bundle, progress, options = {}) {
  const level = options.level ?? progress?.currentLevel ?? 'A1';
  const now = options.now ?? new Date().toISOString();
  const focusItem = getFocusItem(bundle, progress, { level, todayItem: options.todayItem });

  if (!bundle?.verses || !focusItem) {
    return null;
  }

  const verse = findVerseFromItem(bundle, focusItem);
  if (!verse?.russianText) {
    return null;
  }

  const learnedVocabulary = getInventoryItems(bundle, progress, {
    level,
    type: 'vocabulary',
    state: 'all'
  })
    .map((entry) => ({
      id: entry.item.id,
      label: entry.item.label,
      record: itemByProgress(entry.item, progress?.items)
    }))
    .filter((entry) => isLearnedState(entry.record?.state));

  const learnedLabels = [...new Set(learnedVocabulary.map((entry) => entry.label))];
  if (learnedLabels.length < 2) {
    return null;
  }

  const targetWord = pickTargetWord(verse.russianText, learnedLabels);
  if (!targetWord) {
    return null;
  }

  const replacementWord = pickReplacementWord(targetWord, learnedLabels, extractWords(verse.russianText).map(normalizeWord));
  if (!replacementWord) {
    return null;
  }

  const falseSentence = replaceFirstWord(verse.russianText, targetWord, replacementWord);
  if (!falseSentence) {
    return null;
  }

  const truth = verse.russianText;
  const lie = falseSentence;
  if (normalizeSentence(truth) === normalizeSentence(lie)) {
    return null;
  }

  const optionsFromStatements = [
    { text: truth, isCorrect: true },
    { text: lie, isCorrect: false }
  ];

  const hints = buildSentenceHints(bundle, progress, verse.id);

  return {
    itemId: focusItem.id,
    verseId: verse.id,
    focusLevel: focusItem.level,
    focusType: focusItem.type,
    focusLabel: focusItem.label,
    promptAt: now,
    verseReference: verse.reference,
    options: optionsFromStatements,
    hints,
  };
}
