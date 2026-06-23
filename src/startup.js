import { createInitialProgress } from './scheduler.js';
import { DEMO_BUNDLE } from './demo-bundle.js';
import { normalizeBundle } from './bundle.js';

export const defaultStartupMessage = 'Default artificial demo bundle loaded for quick testing.';

const normalizedDefaultBundle = normalizeBundle(DEMO_BUNDLE);

export function buildStartupState(savedState, now = new Date().toISOString()) {
  if (savedState?.bundle && savedState?.progress) {
    return savedState;
  }

  return {
    bundle: normalizedDefaultBundle,
    progress: createInitialProgress(normalizedDefaultBundle, now),
    message: defaultStartupMessage
  };
}
