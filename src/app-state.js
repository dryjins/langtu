import { buildStartupState, loadDefaultBundleContent } from './startup.js';

export const VALID_VIEWS = ['session', 'vocabulary', 'grammar', 'expressions', 'drill', 'sentences', 'verse-drill'];
export const VALID_LEVEL_FILTERS = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const VALID_LIST_TYPES = ['vocabulary', 'grammar', 'expression'];
export const VALID_LIST_STATES = ['all', 'new', 'screening', 'learning', 'weak', 'known', 'retired', 'audit_due'];

export const DEFAULT_UI = {
  view: 'session',
  listType: 'vocabulary',
  listState: 'all',
  selectedLevel: 'all',
  drillItemId: null,
  verseDrillId: null,
  sentenceChallenge: null,
  quizState: null
};

export function sanitizeValue(value, validValues, fallback) {
  return validValues.includes(value) ? value : fallback;
}

export function buildEmptyStartupFallback() {
  return {
    bundle: null,
    progress: null,
    message: ''
  };
}

export function listTypeForView(view) {
  if (view === 'grammar') return 'grammar';
  if (view === 'expressions') return 'expression';
  return 'vocabulary';
}

export async function normalizeAppStateAsync(rawState, now = new Date().toISOString(), incomingContent = null) {
  let startup;
  try {
    const content = incomingContent ?? (rawState?.bundle ? null : await loadDefaultBundleContent());
    startup = await buildStartupStateAsync({ savedState: rawState, content, now });
  } catch (error) {
    startup = buildEmptyStartupFallback();
  }
  const sourceUi = rawState?.ui || {};
  const view = sanitizeValue(sourceUi.view, VALID_VIEWS, DEFAULT_UI.view);
  const listType = listTypeForView(view);

  return {
    ...startup,
    ui: {
      ...DEFAULT_UI,
      sentenceChallenge: null,
      view,
      listType,
      listState: sanitizeValue(sourceUi.listState, VALID_LIST_STATES, DEFAULT_UI.listState),
      selectedLevel: 'all',
      drillItemId: typeof sourceUi.drillItemId === 'string' ? sourceUi.drillItemId : null,
      verseDrillId: typeof sourceUi.verseDrillId === 'string' ? sourceUi.verseDrillId : null,
      quizState: sourceUi.quizState && typeof sourceUi.quizState === 'object' ? sourceUi.quizState : null
    }
  };
}

export function normalizeAppState(rawState, now = new Date().toISOString(), bundle = null, progress = null, message = null) {
  let startup;
  if (bundle && progress) {
    startup = { bundle, progress, message: message || rawState?.message || '' };
  } else {
    try {
      startup = buildStartupState({ savedState: rawState, content: null, now });
    } catch (error) {
      startup = buildEmptyStartupFallback();
    }
  }
  const sourceUi = rawState?.ui || {};
  const view = sanitizeValue(sourceUi.view, VALID_VIEWS, DEFAULT_UI.view);
  const listType = listTypeForView(view);

  return {
    ...startup,
    ui: {
      ...DEFAULT_UI,
      sentenceChallenge: null,
      view,
      listType,
      listState: sanitizeValue(sourceUi.listState, VALID_LIST_STATES, DEFAULT_UI.listState),
      selectedLevel: 'all',
      drillItemId: typeof sourceUi.drillItemId === 'string' ? sourceUi.drillItemId : null,
      verseDrillId: typeof sourceUi.verseDrillId === 'string' ? sourceUi.verseDrillId : null,
      quizState: sourceUi.quizState && typeof sourceUi.quizState === 'object' ? sourceUi.quizState : null
    }
  };
}
