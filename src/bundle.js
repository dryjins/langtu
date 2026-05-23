export const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const SKILL_SPECS = {
  vocabulary: {
    sourceKey: 'vocabulary',
    labelKey: 'lemma',
    fallbackLabelKey: 'meaning'
  },
  grammar: {
    sourceKey: 'grammar',
    labelKey: 'name',
    fallbackLabelKey: 'explanation'
  },
  expression: {
    sourceKey: 'expressions',
    labelKey: 'phrase',
    fallbackLabelKey: 'meaning'
  }
};

export function normalizeBundle(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('study bundle must be an object');
  }

  const verses = normalizeVerses(input.verses);
  const verseIds = new Set(verses.map((verse) => verse.id));
  const itemIds = new Set();
  const items = [];

  for (const [type, spec] of Object.entries(SKILL_SPECS)) {
    const sourceItems = Array.isArray(input[spec.sourceKey]) ? input[spec.sourceKey] : [];

    for (const rawItem of sourceItems) {
      const item = normalizeLearningItem(rawItem, type, spec);

      if (itemIds.has(item.id)) {
        throw new Error(`duplicate item id ${item.id}`);
      }

      for (const verseId of item.linkedVerseIds) {
        if (!verseIds.has(verseId)) {
          throw new Error(`${item.id} links to missing verse ${verseId}`);
        }
      }

      itemIds.add(item.id);
      items.push(item);
    }
  }

  return {
    version: input.version ?? 1,
    title: stringOrDefault(input.title, 'Untitled study bundle'),
    importedAt: input.importedAt ?? null,
    verses,
    items,
    vocabulary: items.filter((item) => item.type === 'vocabulary'),
    grammar: items.filter((item) => item.type === 'grammar'),
    expressions: items.filter((item) => item.type === 'expression')
  };
}

function normalizeVerses(rawVerses) {
  if (!Array.isArray(rawVerses) || rawVerses.length === 0) {
    throw new Error('study bundle must include at least one verse');
  }

  const ids = new Set();

  return rawVerses.map((rawVerse, index) => {
    if (!rawVerse || typeof rawVerse !== 'object') {
      throw new Error(`verse at index ${index} must be an object`);
    }

    const id = requiredString(rawVerse.id, `verse at index ${index} requires id`);

    if (ids.has(id)) {
      throw new Error(`duplicate verse id ${id}`);
    }

    ids.add(id);

    return {
      id,
      reference: stringOrDefault(rawVerse.reference, id),
      russianText: requiredString(rawVerse.russianText, `${id} requires russianText`),
      englishText: rawVerse.englishText ? String(rawVerse.englishText) : '',
      notes: rawVerse.notes ? String(rawVerse.notes) : ''
    };
  });
}

function normalizeLearningItem(rawItem, type, spec) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error(`${type} item must be an object`);
  }

  const id = requiredString(rawItem.id, `${type} item requires id`);
  const level = requiredString(rawItem.level, `${id} requires level`);

  if (!LEVELS.includes(level)) {
    throw new Error(`${id} has unsupported level ${level}`);
  }

  const label = stringOrDefault(rawItem[spec.labelKey], rawItem[spec.fallbackLabelKey]);

  return {
    ...rawItem,
    id,
    type,
    level,
    label: stringOrDefault(label, id),
    linkedVerseIds: normalizeStringArray(rawItem.linkedVerseIds),
    grammarTags: normalizeStringArray(rawItem.grammarTags),
    expressionTags: normalizeStringArray(rawItem.expressionTags)
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function requiredString(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
  return value.trim();
}

function stringOrDefault(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  return '';
}
