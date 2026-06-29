import { createInitialProgress } from './scheduler.js';
import { DEFAULT_BUNDLE } from './default-bundle.js';
import { LEVELS, normalizeBundle } from './bundle.js';

export const defaultStartupMessage = 'Default curated bundle loaded from public sources and original A1-C2 skill content.';

const normalizedDefaultBundle = normalizeBundle(DEFAULT_BUNDLE);
const validLevels = new Set(LEVELS);

function sanitizeLevel(level) {
  return validLevels.has(level) ? level : 'A0';
}

export function buildStartupState(savedState, now = new Date().toISOString()) {
  if (savedState?.bundle && savedState?.progress) {
    const rawBundle = savedState.bundle;
    const usesLatestDefaultBundle = rawBundle?.title === DEFAULT_BUNDLE.title;
    const bundle = usesLatestDefaultBundle ? normalizedDefaultBundle : normalizeBundle(rawBundle);
    const baselineProgress = createInitialProgress(bundle, now);
    const repairedProgress = {
      ...baselineProgress,
      ...savedState.progress,
      currentLevel: sanitizeLevel(savedState.progress.currentLevel),
      items: {},
    };

    const savedItems = savedState.progress?.items;

    for (const item of bundle.items) {
      if (!item?.id) continue;
      const existing = savedItems?.[item.id] ?? {};
      repairedProgress.items[item.id] = {
        ...baselineProgress.items[item.id],
        ...existing,
      };
    }

    return {
      ...savedState,
      bundle,
      progress: repairedProgress
    };
  }

  return {
    bundle: normalizedDefaultBundle,
    progress: createInitialProgress(normalizedDefaultBundle, now),
    message: defaultStartupMessage
  };
}
