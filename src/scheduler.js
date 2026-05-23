const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PASS_THRESHOLDS = {
  vocabulary: 0.9,
  grammar: 0.85,
  expression: 0.85
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

export function getLevelGateStatus(bundle, progress, level) {
  const vocabulary = getTypeGateStatus(bundle, progress, level, 'vocabulary');
  const grammar = getTypeGateStatus(bundle, progress, level, 'grammar');
  const expression = getTypeGateStatus(bundle, progress, level, 'expression');

  return {
    level,
    passed: vocabulary.passed && grammar.passed && expression.passed,
    vocabulary,
    grammar,
    expression
  };
}

export function getTypeGateStatus(bundle, progress, level, type) {
  const items = bundle.items.filter((item) => item.level === level && item.type === type);
  const mastered = items.filter((item) => {
    const record = progress.items[item.id];
    return record && (record.state === 'known' || record.state === 'retired');
  });
  const ratio = items.length === 0 ? 1 : mastered.length / items.length;
  const requiredRatio = PASS_THRESHOLDS[type];

  return {
    type,
    total: items.length,
    mastered: mastered.length,
    ratio,
    requiredRatio,
    passed: ratio >= requiredRatio
  };
}

export function advanceLevelIfGatePassed(bundle, progress, now = new Date().toISOString()) {
  const currentLevel = progress.currentLevel ?? 'A0';
  const gate = getLevelGateStatus(bundle, progress, currentLevel);

  if (!gate.passed) {
    throw new Error(`${currentLevel} gate is blocked`);
  }

  const nextLevel = getNextLevel(currentLevel);

  if (!nextLevel) {
    return {
      ...progress,
      updatedAt: now
    };
  }

  return {
    ...progress,
    currentLevel: nextLevel,
    updatedAt: now
  };
}

function getNextLevel(level) {
  const levels = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  return levels[levels.indexOf(level) + 1] ?? null;
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
