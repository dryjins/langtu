import { buildStartupState } from './startup.js';

export const VALID_VIEWS = ['session', 'vocabulary', 'drill', 'sentences', 'verse-drill'];
export const VALID_LEVEL_FILTERS = ['all', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const VALID_LIST_TYPES = ['all', 'vocabulary', 'grammar', 'expression'];
export const VALID_LIST_STATES = ['all', 'new', 'screening', 'learning', 'weak', 'known', 'retired', 'audit_due'];

export const DEFAULT_UI = {
  view: 'session',
  listType: 'all',
  listState: 'all',
  selectedLevel: 'all',
  drillItemId: null,
  verseDrillId: null,
  sentenceChallenge: null
};

export function sanitizeValue(value, validValues, fallback) {
  return validValues.includes(value) ? value : fallback;
}

export function normalizeAppState(rawState, now = new Date().toISOString()) {
  const startup = buildStartupState(rawState, now);
  const sourceUi = rawState?.ui || {};

  return {
    ...startup,
    ui: {
      ...DEFAULT_UI,
      sentenceChallenge: null,
      view: sanitizeValue(sourceUi.view, VALID_VIEWS, DEFAULT_UI.view),
      listType: 'all',
      listState: sanitizeValue(sourceUi.listState, VALID_LIST_STATES, DEFAULT_UI.listState),
      selectedLevel: 'all',
      drillItemId: typeof sourceUi.drillItemId === 'string' ? sourceUi.drillItemId : null,
      verseDrillId: typeof sourceUi.verseDrillId === 'string' ? sourceUi.verseDrillId : null
    }
  };
}
