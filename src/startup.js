import { createInitialProgress } from './scheduler.js';
import { DEMO_BUNDLE } from './demo-bundle.js';
import { LEVELS, normalizeBundle } from './bundle.js';

export const defaultStartupMessage = 'Default artificial demo bundle loaded for quick testing.';

const normalizedDefaultBundle = normalizeBundle(DEMO_BUNDLE);
const validLevels = new Set(LEVELS);

function sanitizeLevel(level) {
  return validLevels.has(level) ? level : 'A0';
}

export function buildStartupState(savedState, now = new Date().toISOString()) {
  if (savedState?.bundle && savedState?.progress) {
    const bundle = normalizeBundle(savedState.bundle);
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
