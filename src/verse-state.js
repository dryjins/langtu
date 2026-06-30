export const ANSWER_TO_VERSE_STATE = Object.freeze({
  known: 'known',
  uncertain: 'weak',
  unknown: 'weak'
});

const VERSE_REVIEW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function createInitialVerseProgress(bundle, now = new Date().toISOString()) {
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  const records = {};

  for (const verse of verses) {
    if (!verse?.id) continue;
    records[verse.id] = {
      id: verse.id,
      state: 'new',
      correctStreak: 0,
      lastAnswer: null,
      lastAnswerAt: null,
      nextReviewAt: now,
      failReasons: []
    };
  }

  return records;
}

export function applyVerseAnswer(progress, verseId, answer, now = new Date().toISOString()) {
  const record = progress?.[verseId];
  if (!record) {
    throw new Error(`unknown verse progress record for ${verseId}`);
  }
  const nextState = ANSWER_TO_VERSE_STATE[answer];
  if (!nextState) {
    throw new Error(`unsupported verse answer ${answer}`);
  }

  const isKnown = answer === 'known';
  const nextRecord = {
    ...record,
    state: nextState,
    lastAnswer: answer,
    lastAnswerAt: now,
    correctStreak: isKnown ? record.correctStreak + 1 : 0,
    nextReviewAt: isKnown ? addDays(now, VERSE_REVIEW_DAYS) : now,
    failReasons: isKnown ? [] : record.failReasons?.includes('verse_unknown') ? record.failReasons : [...(record.failReasons ?? []), 'verse_unknown']
  };

  return {
    ...progress,
    [verseId]: nextRecord
  };
}

export function summarizeVerseStats(progress, bundle) {
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  const counts = { total: verses.length, known: 0, weak: 0, new: 0, review: 0 };

  for (const verse of verses) {
    const record = progress?.[verse.id];
    if (!record) {
      counts.new += 1;
      continue;
    }
    if (record.state === 'known') counts.known += 1;
    else if (record.state === 'weak' || record.state === 'learning') {
      counts.weak += 1;
      counts.review += 1;
    } else if (record.state === 'new' || record.state === 'screening') counts.new += 1;
  }

  return counts;
}

export function summarizeVerseCounts(progress, bundle) {
  return summarizeVerseStats(progress, bundle);
}

export function selectVerseForPractice(progress, bundle, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const verses = Array.isArray(bundle?.verses) ? bundle.verses : [];
  if (verses.length === 0) return null;

  const newList = [];
  const weakList = [];
  const restList = [];

  for (const verse of verses) {
    const record = progress?.[verse.id];
    if (!record || record.state === 'new' || record.state === 'screening') {
      newList.push(verse);
    } else if (record.state === 'weak' || record.state === 'learning') {
      weakList.push(verse);
    } else {
      restList.push(verse);
    }
  }

  if (newList.length > 0) return pickByReference(newList);
  if (weakList.length > 0) return pickByReference(weakList);
  if (restList.length > 0) return pickByReference(restList);
  return null;
}

export function groupVersesByChapter(verses = []) {
  const buckets = new Map();
  for (const verse of verses) {
    const match = /c(\d+)/.exec(verse.id ?? '');
    const chapter = match ? Number(match[1]) : 0;
    if (!buckets.has(chapter)) buckets.set(chapter, { chapter, verses: [] });
    buckets.get(chapter).verses.push(verse);
  }
  return [...buckets.values()].map((entry) => ({
    chapter: entry.chapter,
    verses: [...entry.verses].sort((a, b) => a.id.localeCompare(b.id))
  })).sort((a, b) => a.chapter - b.chapter);
}

function pickByReference(verses) {
  return [...verses].sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function addDays(isoDate, days) {
  return new Date(new Date(isoDate).getTime() + days * MS_PER_DAY).toISOString();
}
