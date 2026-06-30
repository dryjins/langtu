import { createInitialProgress } from './scheduler.js';
import { DEFAULT_CONTENT_META } from './default-bundle-meta.js';
import { LEVELS, normalizeBundle } from './bundle.js';
import { createInitialVerseProgress } from './verse-state.js';

export const defaultStartupMessage = 'Default curated bundle loaded from public sources and original A1-C2 skill content.';

const validLevels = new Set(LEVELS);

function sanitizeLevel(level) {
  return validLevels.has(level) ? level : 'A1';
}

function pickContent(rawBundleOrNull, defaultContent) {
  if (rawBundleOrNull && Array.isArray(rawBundleOrNull.verses)) {
    return normalizeBundle(rawBundleOrNull);
  }
  if (!defaultContent || !Array.isArray(defaultContent.verses)) {
    return normalizeBundle({ version: 1, title: 'Empty', verses: [], vocabulary: [], grammar: [], expressions: [] });
  }
  return normalizeBundle(defaultContent);
}

export async function loadDefaultBundleContent() {
  const mod = await import('./default-bundle.js');
  return mod.DEFAULT_CONTENT;
}

export async function buildStartupStateAsync({ savedState, content, now = new Date().toISOString() } = {}) {
  const incomingContent = content ?? await loadDefaultBundleContent();
  return buildStartupState({ savedState, content: incomingContent, now });
}

export function buildStartupState({ savedState, content, now = new Date().toISOString() } = {}) {
  const incomingContent = content ?? null;
  if (savedState?.bundle && savedState?.progress) {
    const rawBundle = savedState.bundle;
    const usesLatestDefaultBundle = rawBundle?.title === DEFAULT_CONTENT_META.title;
    const bundle = usesLatestDefaultBundle ? pickContent(null, incomingContent) : normalizeBundle(rawBundle);
    const baselineItemsProgress = createInitialProgress(bundle, now);
    const baselineVerseProgress = createInitialVerseProgress(bundle, now);

    const savedVerseProgress = savedState.progress?.verseProgress ?? {};
    const repairedVerseProgress = { ...baselineVerseProgress };

    for (const verseId of Object.keys(baselineVerseProgress)) {
      const existing = savedVerseProgress[verseId];
      if (existing && typeof existing === 'object') {
        repairedVerseProgress[verseId] = {
          ...baselineVerseProgress[verseId],
          ...existing,
          id: verseId
        };
      }
    }

    const repairedProgress = {
      ...baselineItemsProgress,
      ...savedState.progress,
      currentLevel: sanitizeLevel(savedState.progress.currentLevel),
      items: {},
      verseProgress: repairedVerseProgress
    };

    const savedItems = savedState.progress?.items;

    for (const item of bundle.items) {
      if (!item?.id) continue;
      const existing = savedItems?.[item.id] ?? {};
      repairedProgress.items[item.id] = {
        ...baselineItemsProgress.items[item.id],
        ...existing,
      };
    }

    return {
      ...savedState,
      bundle,
      progress: repairedProgress
    };
  }

  const freshBundle = pickContent(null, incomingContent);
  return {
    bundle: freshBundle,
    progress: {
      ...createInitialProgress(freshBundle, now),
      verseProgress: createInitialVerseProgress(freshBundle, now)
    },
    message: defaultStartupMessage
  };
}

export function getDefaultBundleMeta() {
  return DEFAULT_CONTENT_META;
}
