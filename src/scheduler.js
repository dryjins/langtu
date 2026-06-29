const MS_PER_DAY = 24 * 60 * 60 * 1000;

const INVENTORY_STATES = ['new', 'screening', 'learning', 'weak', 'known', 'retired', 'audit_due'];
const ITEM_TYPE_ORDER = {
  vocabulary: 0,
  grammar: 1,
  expression: 2
};
const LEVEL_ORDER = {
  A0: 0,
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6
};

const ANSWER_TO_STATE = {
  known: 'known',
  uncertain: 'weak',
  unknown: 'weak'
};

export function createInitialProgress(bundle, now = new Date().toISOString()) {
  const items = {};

  for (const item of bundle.items) {
    items[item.id] = {
      id: item.id,
      type: item.type,
      level: item.level,
      state: 'new',
      correctStreak: 0,
      lastAnswer: null,
      lastTestedAt: null,
      nextReviewAt: now,
      failReasons: []
    };
  }

  return {
    currentLevel: 'A0',
    createdAt: now,
    updatedAt: now,
    items
  };
}

export function getInventoryItems(bundle, progress, options = {}) {
  const level = options.level ?? progress?.currentLevel ?? 'A0';
  const typeFilter = options.type ?? 'all';
  const stateFilter = options.state ?? 'all';

  if (!bundle || !Array.isArray(bundle.items) || !progress?.items) {
    return [];
  }

  return bundle.items
    .filter((item) => level === 'all' || item.level === level)
    .map((item) => ({ item, record: progress.items[item.id] }))
    .filter((entry) => entry.record !== undefined)
    .filter((entry) => typeFilter === 'all' || entry.item.type === typeFilter)
    .filter((entry) => stateFilter === 'all' || entry.record.state === stateFilter)
    .sort((a, b) => {
      const levelDelta = (LEVEL_ORDER[a.item.level] ?? 99) - (LEVEL_ORDER[b.item.level] ?? 99);
      if (levelDelta !== 0) return levelDelta;

      const typeDelta = (ITEM_TYPE_ORDER[a.item.type] ?? 99) - (ITEM_TYPE_ORDER[b.item.type] ?? 99);
      if (typeDelta !== 0) return typeDelta;

      return a.item.label.localeCompare(b.item.label);
    });
}

export function summarizeInventoryCounts(items = []) {
  const counts = {
    total: 0,
    new: 0,
    screening: 0,
    learning: 0,
    weak: 0,
    known: 0,
    retired: 0,
    audit_due: 0
  };

  for (const entry of items) {
    counts.total += 1;
    if (INVENTORY_STATES.includes(entry.record?.state)) {
      counts[entry.record.state] += 1;
    }
  }

  return counts;
}

export function applyScreeningAnswer(progress, itemId, answer, now = new Date().toISOString()) {
  const record = progress.items[itemId];

  if (!record) {
    throw new Error(`unknown progress item ${itemId}`);
  }

  const nextState = ANSWER_TO_STATE[answer];

  if (!nextState) {
    throw new Error(`unsupported screening answer ${answer}`);
  }

  const nextProgress = cloneProgress(progress);
  const nextRecord = { ...nextProgress.items[itemId] };
  nextRecord.state = nextState;
  nextRecord.lastAnswer = answer;
  nextRecord.lastTestedAt = now;
  nextRecord.correctStreak = answer === 'known' ? nextRecord.correctStreak + 1 : 0;
  nextRecord.nextReviewAt = answer === 'known' ? addDays(now, 30) : now;
  nextRecord.failReasons = answer === 'known' ? [] : ['word_unknown'];
  nextProgress.items[itemId] = nextRecord;
  nextProgress.updatedAt = now;
  return nextProgress;
}

export function buildDailyQueue(bundle, progress, options = {}) {
  const level = options.level ?? progress.currentLevel ?? 'A0';
  const now = options.now ?? new Date().toISOString();
  const newVocabularyLimit = options.newVocabularyLimit ?? 5;
  const auditLimit = options.auditLimit ?? 2;
  const due = [];
  const newVocabulary = [];
  const newSkills = [];
  const audits = [];

  for (const item of bundle.items) {
    const record = progress.items[item.id];
    if (!record || item.level !== level) continue;

    if (record.state === 'weak' || record.state === 'learning') {
      due.push(makeQueueEntry(item, record, 'review'));
      continue;
    }

    if (record.state === 'new' && item.type === 'vocabulary' && newVocabulary.length < newVocabularyLimit) {
      newVocabulary.push(makeQueueEntry(item, record, 'new'));
      continue;
    }

    if (record.state === 'new' && item.type !== 'vocabulary') {
      newSkills.push(makeQueueEntry(item, record, 'new'));
      continue;
    }

    if (record.state === 'known' && isDue(record.nextReviewAt, now) && audits.length < auditLimit) {
      audits.push(makeQueueEntry(item, record, 'audit'));
    }
  }

  return [...due, ...audits, ...newSkills, ...newVocabulary];
}

function makeQueueEntry(item, record, reason) {
  return {
    reason,
    item,
    record
  };
}

function isDue(nextReviewAt, now) {
  if (!nextReviewAt) return true;
  return new Date(nextReviewAt).getTime() <= new Date(now).getTime();
}

function addDays(isoDate, days) {
  return new Date(new Date(isoDate).getTime() + days * MS_PER_DAY).toISOString();
}

function cloneProgress(progress) {
  return {
    ...progress,
    items: Object.fromEntries(Object.entries(progress.items).map(([id, record]) => [id, { ...record }]))
  };
}
