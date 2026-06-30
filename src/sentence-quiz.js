const WORD_RE = /[A-Za-zА-Яа-яЁё]+/g;

function tokenize(text) {
  return String(text ?? '').match(WORD_RE) ?? [];
}

function daySeed(now) {
  const stamp = new Date(now).getTime();
  if (!Number.isFinite(stamp)) return 0;
  return Math.floor(stamp / (24 * 60 * 60 * 1000));
}

function pickByIndex(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const index = ((seed % list.length) + list.length) % list.length;
  return list[index];
}

function stableStringSeed(value) {
  const str = String(value ?? '');
  let sum = 0;
  for (let i = 0; i < str.length; i += 1) {
    sum = (sum * 31 + str.charCodeAt(i)) | 0;
  }
  return sum;
}

function stableShuffle(list, seed) {
  const output = [...list];
  let s = Math.abs(seed) || 1;
  for (let i = output.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = (s % (i + 1) + (i + 1)) % (i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function selectDailySentence(bundle, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const level = options.level ?? 'A1';
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  if (verses.length === 0) return null;

  const candidates = verses.filter((verse) => {
    if (level === 'all') return true;
    if (verse.level) return verse.level === level;
    return true;
  });
  const pool = candidates.length > 0 ? candidates : verses;
  const seed = daySeed(now) + stableStringSeed(level);
  return pickByIndex(pool, seed);
}

export function buildDistractorSentences(bundle, focusVerse, options = {}) {
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  if (!focusVerse || verses.length < 5) return [];

  const focusTokens = tokenize(focusVerse.russianText);
  const focusFirstWord = focusTokens[0] ?? '';
  const focusLength = focusTokens.length;
  const focusId = focusVerse.id;
  const seed = daySeed(options.now ?? new Date().toISOString()) + stableStringSeed(focusId);

  const scored = [];
  for (const verse of verses) {
    if (verse.id === focusId) continue;
    const tokens = tokenize(verse.russianText);
    if (tokens.length === 0) continue;
    const firstWord = tokens[0] ?? '';
    const lengthDelta = Math.abs(tokens.length - focusLength);
    const sameStart = firstWord.toLowerCase() === focusFirstWord.toLowerCase();
    scored.push({ verse, tokens, sameStart, lengthDelta });
  }

  const sameStartDistractors = scored.filter((entry) => entry.sameStart);
  const lengthMatches = scored.filter((entry) => entry.lengthDelta <= Math.max(2, Math.floor(focusLength * 0.6)));

  const rankSource = sameStartDistractors.length >= 4
    ? sameStartDistractors
    : (lengthMatches.length >= 4 ? lengthMatches : scored);

  rankSource.sort((a, b) => {
    if (a.lengthDelta !== b.lengthDelta) return a.lengthDelta - b.lengthDelta;
    return a.verse.id.localeCompare(b.verse.id);
  });

  const seedOffset = stableStringSeed(`pick:${focusId}:${seed}`);
  const shuffled = stableShuffle(rankSource, seedOffset);

  return shuffled.slice(0, 4).map((entry) => entry.verse.russianText);
}

export function buildSentenceQuiz(bundle, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const level = options.level ?? options.bundle?.currentLevel ?? 'A1';
  const verse = selectDailySentence(bundle, { level, now });
  if (!verse) return null;
  const truth = String(verse.russianText ?? '').trim();
  if (!truth) return null;

  const distractors = buildDistractorSentences(bundle, verse, { now });
  const uniqueDistractors = [];
  const truthKey = truth.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const candidate of distractors) {
    const key = candidate.replace(/\s+/g, ' ').trim().toLowerCase();
    if (key === truthKey) continue;
    if (uniqueDistractors.includes(key)) continue;
    uniqueDistractors.push(key);
  }

  const limited = [];
  for (const key of uniqueDistractors) {
    const text = distractors.find((candidate) => candidate.replace(/\s+/g, ' ').trim().toLowerCase() === key);
    if (text) limited.push({ text, isCorrect: false });
    if (limited.length >= 4) break;
  }

  if (limited.length < 4) return null;

  const options5 = [
    { text: truth, isCorrect: true },
    ...limited
  ];

  const shuffled = stableShuffle(options5, daySeed(now) + stableStringSeed(verse.id));

  return {
    verseId: verse.id,
    verseReference: verse.reference,
    focusLevel: level,
    correctAnswer: truth,
    question: 'Which sentence is the actual reference line for today?',
    options: shuffled,
    promptAt: now
  };
}

export function hasMinimumQuizInputs(bundle) {
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  return verses.length >= 5;
}
