import { LEVELS, normalizeBundle } from './bundle.js';
import { clearAppState, loadAppState, saveAppState } from './db.js';
import {
  advanceLevelIfGatePassed,
  applyScreeningAnswer,
  buildDailyQueue,
  createInitialProgress,
  getInventoryItems,
  getLevelGateStatus,
  summarizeInventoryCounts
} from './scheduler.js';
import { buildStartupState, defaultStartupMessage } from './startup.js';

const root = document.getElementById('app-root');

const VALID_VIEWS = ['session', 'vocabulary', 'drill'];
const VALID_LIST_TYPES = ['all', 'vocabulary', 'grammar', 'expression'];
const VALID_LIST_STATES = ['all', 'new', 'screening', 'learning', 'weak', 'known', 'retired', 'audit_due'];

const DEFAULT_UI = {
  view: 'session',
  listType: 'all',
  listState: 'all',
  selectedLevel: 'A0',
  drillItemId: null
};

let appState = {
  bundle: null,
  progress: null,
  message: '',
  ui: { ...DEFAULT_UI }
};

init().catch((error) => {
  root.innerHTML = `<main class="app error"><h1>Langtu</h1><p>${escapeHtml(error.message)}</p></main>`;
});

async function init() {
  render();
  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);

  try {
    const now = new Date().toISOString();
    const savedState = await loadAppState();
    const hasSavedProgress = savedState?.bundle && savedState?.progress;

    appState = normalizeAppState(savedState, now);
    render();

    if (!hasSavedProgress) {
      await persistStartupState('Could not persist startup bundle to browser storage.');
    }
  } catch (error) {
    appState = normalizeAppState(null, new Date().toISOString());
    appState.message = `Browser storage unavailable: ${error.message}`;
    render();
    return;
  }
}

function normalizeAppState(rawState, now = new Date().toISOString()) {
  const startup = buildStartupState(rawState, now);
  const level = startup?.progress?.currentLevel || 'A0';
  const sourceUi = rawState?.ui || {};

  return {
    ...startup,
    ui: {
      ...DEFAULT_UI,
      view: sanitizeValue(sourceUi.view, VALID_VIEWS, DEFAULT_UI.view),
      listType: sanitizeValue(sourceUi.listType, VALID_LIST_TYPES, DEFAULT_UI.listType),
      listState: sanitizeValue(sourceUi.listState, VALID_LIST_STATES, DEFAULT_UI.listState),
      selectedLevel: LEVELS.includes(sourceUi.selectedLevel) ? sourceUi.selectedLevel : level,
      drillItemId: typeof sourceUi.drillItemId === 'string' ? sourceUi.drillItemId : null
    }
  };
}

function sanitizeValue(value, validValues, fallback) {
  return validValues.includes(value) ? value : fallback;
}

async function persistStartupState(fallbackMessage) {
  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `${fallbackMessage}: ${error.message}`;
    render();
  }
}

function render() {
  if (!appState.bundle) {
    root.innerHTML = renderEmptyState();
    return;
  }

  if (appState.ui.view === 'vocabulary') {
    root.innerHTML = renderVocabularyView();
    return;
  }

  if (appState.ui.view === 'drill') {
    root.innerHTML = renderDrillView();
    return;
  }

  root.innerHTML = renderStudyApp();
}

function renderEmptyState() {
    return `
      <main class="app">
        <section class="hero card">
          <p class="eyebrow">Russian through John</p>
          <h1>Langtu MVP</h1>
          <p class="lead">Import a private text bundle, screen A0 upward, then study vocabulary, grammar, and expressions through verse context. No restricted text is shipped with the public app.</p>
          <div class="actions">
            <label class="button primary" for="bundle-file">Import study bundle</label>
            <input class="hidden-input" id="bundle-file" type="file" accept=".json,.langtu,application/json">
            <a class="button ghost" href="README.md">Read design</a>
          </div>
          <p class="notice">${escapeHtml(defaultStartupMessage)}</p>
          <p class="notice">The demo uses artificial Russian sentences only. Real NRP or NIV text must be provided by the user as a private local bundle.</p>
        </section>
      </main>
    `;
}

function renderStudyApp() {
  const { bundle, progress, message } = appState;
  const level = progress.currentLevel;
  const gate = getLevelGateStatus(bundle, progress, level);
  const queue = buildDailyQueue(bundle, progress, { level, now: new Date().toISOString() });
  const activeEntry = queue.at(0);
  const topVerseControls = activeEntry
    ? `<button class="button secondary" type="button" data-action="open-drill" data-item-id="${escapeAttribute(activeEntry.item.id)}">Practice this item</button>`
    : `<button class="button secondary" type="button" data-action="open-vocabulary">Open vocabulary</button>`;

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Current level ${level}</p>
          <h1>Langtu MVP</h1>
          <p class="muted">${escapeHtml(bundle.title)}</p>
        </div>
        <div class="topbar-actions">
          <label class="button secondary" for="bundle-file">Replace bundle</label>
          <input class="hidden-input" id="bundle-file" type="file" accept=".json,.langtu,application/json">
          <button class="button ghost" type="button" data-action="clear-data">Clear local data</button>
          <button class="button secondary" type="button" data-action="open-vocabulary">Vocabulary</button>
        </div>
      </header>

      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}

      <section class="dashboard">
        ${renderGatePanel(gate)}
        ${renderQueuePanel(queue)}
      </section>

      <section class="workbench">
        ${activeEntry ? renderActiveCard(activeEntry, bundle) : renderEmptyQueue(gate)}
        ${renderVerseBrowser(bundle)}
      </section>

      <section class="card panel">
        <div class="panel-header">
          <h2>Quick study action</h2>
        </div>
        ${topVerseControls}
      </section>
    </main>
  `;
}

function renderGatePanel(gate) {
  return `
    <article class="card panel">
      <div class="panel-header">
        <h2>Strict gate</h2>
        <strong class="badge ${gate.passed ? 'pass' : 'wait'}">${gate.passed ? 'pass' : 'blocked'}</strong>
      </div>
      <div class="meter-list">
        ${renderMeter('Vocabulary', gate.vocabulary)}
        ${renderMeter('Grammar', gate.grammar)}
        ${renderMeter('Expression', gate.expression)}
      </div>
      ${gate.passed ? renderAdvanceButton(gate.level) : '<p class="muted">All three areas must pass before the next level opens.</p>'}
    </article>
  `;
}

function renderAdvanceButton(level) {
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
  if (!nextLevel) return '<p class="muted">C2 gate passed. All configured levels are complete.</p>';
  return `<button class="button primary wide" type="button" data-action="advance-level">Advance to ${nextLevel}</button>`;
}

function renderMeter(label, status) {
  const percentage = Math.round(status.ratio * 100);
  return `
    <div class="meter-row">
      <div class="meter-label"><span>${label}</span><span>${status.mastered}/${status.total}</span></div>
      <div class="meter"><span style="width: ${percentage}%"></span></div>
    </div>
  `;
}

function renderQueuePanel(queue) {
  return `
    <article class="card panel">
      <div class="panel-header">
        <h2>Today queue</h2>
        <strong class="badge">${queue.length}</strong>
      </div>
      <p class="muted">Weak, uncertain, due, and new items are prioritized. Known items stay out unless an audit is due.</p>
      <div class="queue-list">
        ${queue.slice(0, 6).map((entry) => `<span class="queue-chip">${entry.reason}: ${entry.item.type}</span>`).join('') || '<span class="queue-chip">empty</span>'}
      </div>
    </article>
  `;
}

function renderActiveCard(entry, bundle) {
  const item = entry.item;
  const verse = findFirstVerse(bundle, item);

  return `
    <article class="card active-card">
      <p class="eyebrow">${escapeHtml(item.type)} · ${escapeHtml(item.level)} · ${escapeHtml(entry.reason)}</p>
      <h2>${escapeHtml(item.label)}</h2>
      <p class="meaning">${escapeHtml(getItemMeaning(item))}</p>
      ${verse ? renderVerseCard(verse) : '<p class="muted">No linked verse.</p>'}
      ${renderItemNote(item)}
      <div class="answer-grid">
        <button class="button primary" type="button" data-answer="known" data-item-id="${escapeAttribute(item.id)}">I know this</button>
        <button class="button secondary" type="button" data-answer="uncertain" data-item-id="${escapeAttribute(item.id)}">Not sure</button>
        <button class="button danger" type="button" data-answer="unknown" data-item-id="${escapeAttribute(item.id)}">I do not know</button>
      </div>
    </article>
  `;
}

function renderVerseCard(verse) {
  return `
    <div class="verse-card">
      <div class="verse-heading">
        <strong>${escapeHtml(verse.reference)}</strong>
        <button class="icon-button" type="button" data-action="speak" data-text="${escapeAttribute(verse.russianText)}">Speak</button>
      </div>
      <p class="russian">${escapeHtml(verse.russianText)}</p>
      ${verse.englishText ? `<p class="translation">${escapeHtml(verse.englishText)}</p>` : ''}
      ${verse.notes ? `<p class="muted">${escapeHtml(verse.notes)}</p>` : ''}
    </div>
  `;
}

function renderItemNote(item) {
  const text = item.explanation || item.meaning || item.phrase || '';
  if (!text) return '';
  return `<p class="note">${escapeHtml(text)}</p>`;
}

function renderEmptyQueue(gate) {
  return `
    <article class="card active-card">
      <p class="eyebrow">Queue empty</p>
      <h2>${gate.passed ? 'Level gate passed' : 'Nothing due right now'}</h2>
      <p class="muted">Import richer data or wait until audits become due. If the gate passed, advance to the next level.</p>
      ${gate.passed ? renderAdvanceButton(gate.level) : ''}
    </article>
  `;
}

function renderVerseBrowser(bundle) {
  return `
    <aside class="card panel verse-browser">
      <h2>Verse browser</h2>
      <div class="verse-list">
        ${bundle.verses.map((verse) => `
          <button class="verse-list-item" type="button" data-action="speak" data-text="${escapeAttribute(verse.russianText)}">
            <strong>${escapeHtml(verse.reference)}</strong>
            <span>${escapeHtml(verse.russianText)}</span>
          </button>
        `).join('')}
      </div>
    </aside>
  `;
}

function renderVocabularyView() {
  const { bundle, progress } = appState;
  const level = appState.ui.selectedLevel;
  const levelItems = getInventoryItems(bundle, progress, {
    level,
    type: appState.ui.listType,
    state: appState.ui.listState
  });
  const levelCounts = summarizeInventoryCounts(getInventoryItems(bundle, progress, { level }));

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Level ${escapeHtml(level)} vocabulary</p>
          <h1>Vocabulary list</h1>
          <p class="muted">Filter by type and state and mark items to shape today&apos;s queue.</p>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" type="button" data-action="open-session">Back to queue</button>
        </div>
      </header>

      <section class="card panel">
        <div class="filter-row">
          <div>
            <label class="filter-label" for="vocab-level">Level</label>
            <select id="vocab-level" class="select" data-action="set-selected-level" data-action-group="vocabulary">
              ${LEVELS.map((value) => `<option value="${value}" ${value === level ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="filter-label" for="vocab-type">Type</label>
            <select id="vocab-type" class="select" data-action="set-list-type" data-action-group="vocabulary">
              <option value="all" ${appState.ui.listType === 'all' ? 'selected' : ''}>All</option>
              <option value="vocabulary" ${appState.ui.listType === 'vocabulary' ? 'selected' : ''}>Vocabulary</option>
              <option value="grammar" ${appState.ui.listType === 'grammar' ? 'selected' : ''}>Grammar</option>
              <option value="expression" ${appState.ui.listType === 'expression' ? 'selected' : ''}>Expression</option>
            </select>
          </div>
          <div>
            <label class="filter-label" for="vocab-state">State</label>
            <select id="vocab-state" class="select" data-action="set-list-state" data-action-group="vocabulary">
              <option value="all" ${appState.ui.listState === 'all' ? 'selected' : ''}>All</option>
              <option value="new" ${appState.ui.listState === 'new' ? 'selected' : ''}>New</option>
              <option value="screening" ${appState.ui.listState === 'screening' ? 'selected' : ''}>Screening</option>
              <option value="learning" ${appState.ui.listState === 'learning' ? 'selected' : ''}>Learning</option>
              <option value="weak" ${appState.ui.listState === 'weak' ? 'selected' : ''}>Weak</option>
              <option value="known" ${appState.ui.listState === 'known' ? 'selected' : ''}>Known</option>
              <option value="retired" ${appState.ui.listState === 'retired' ? 'selected' : ''}>Retired</option>
              <option value="audit_due" ${appState.ui.listState === 'audit_due' ? 'selected' : ''}>Audit due</option>
            </select>
          </div>
        </div>
        <div class="meta-grid">
          <span class="badge">${levelItems.length} shown</span>
          <span class="badge">${levelCounts.total} total</span>
          <span class="badge">new ${levelCounts.new}</span>
          <span class="badge">weak ${levelCounts.weak}</span>
          <span class="badge">known ${levelCounts.known}</span>
          <span class="badge">audit ${levelCounts.audit_due}</span>
        </div>
      </section>

      <section class="card panel">
        <h2>Items</h2>
        <div class="inventory-grid">
          ${levelItems.length ? levelItems.map(renderInventoryItem).join('') : '<p class="muted">No items match this filter.</p>'}
        </div>
      </section>
    </main>
  `;
}

function renderInventoryItem(entry) {
  const { item, record } = entry;
  const stateClass = `state-${record.state}`;

  return `
    <article class="inventory-item card ${stateClass}">
      <div class="inventory-main">
        <div>
          <p class="inventory-type">${escapeHtml(item.type)} / ${escapeHtml(item.level)}</p>
          <h3>${escapeHtml(item.label)}</h3>
          <p class="muted">${escapeHtml(getItemMeaning(item))}</p>
        </div>
        <span class="badge">${escapeHtml(record.state || 'new')}</span>
      </div>
      <p class="inventory-actions">
        <button class="button secondary" type="button" data-action="start-drill" data-item-id="${escapeAttribute(item.id)}">Practice</button>
        <button class="button primary" type="button" data-answer="known" data-item-id="${escapeAttribute(item.id)}">Known</button>
        <button class="button secondary" type="button" data-answer="uncertain" data-item-id="${escapeAttribute(item.id)}">Uncertain</button>
        <button class="button danger" type="button" data-answer="unknown" data-item-id="${escapeAttribute(item.id)}">Unknown</button>
      </p>
    </article>
  `;
}

function renderDrillView() {
  const { bundle, progress } = appState;
  const requestedId = appState.ui.drillItemId;

  const item = requestedId ? findItemById(bundle, requestedId) : null;
  const resolvedItem = item ?? findItemForCurrentLevel(bundle, progress);
  if (!resolvedItem) {
    return `
      <main class="app study-layout">
        <header class="topbar">
          <div>
            <p class="eyebrow">Drill mode</p>
            <h1>No item selected</h1>
            <p class="muted">This level has no available items to practice.</p>
          </div>
          <div class="topbar-actions">
            <button class="button ghost" type="button" data-action="open-session">Back to session</button>
          </div>
        </header>
      </main>
    `;
  }

  const verse = findFirstVerse(bundle, resolvedItem);
  const record = progress.items[resolvedItem.id] || {};

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Drill mode</p>
          <h1>${escapeHtml(resolvedItem.label)}</h1>
          <p class="muted">${escapeHtml(resolvedItem.type)} / ${escapeHtml(resolvedItem.level)} · ${escapeHtml(record.state || 'new')}</p>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" type="button" data-action="open-session">Back to session</button>
        </div>
      </header>

      <section class="card panel">
        <div class="panel">
          <p class="meaning">${escapeHtml(getItemMeaning(resolvedItem))}</p>
          <p class="muted">Repeat the sentence aloud, listen again if needed, then mark whether you can recall it.</p>
          ${resolvedItem.explanation ? `<p class="muted">${escapeHtml(resolvedItem.explanation)}</p>` : ''}
          ${verse ? renderVerseCardForDrill(verse) : '<p class="muted">No linked verse in this bundle.</p>'}
          <div class="answer-grid">
            <button class="button primary" type="button" data-answer="known" data-item-id="${escapeAttribute(resolvedItem.id)}">I can say it</button>
            <button class="button secondary" type="button" data-answer="uncertain" data-item-id="${escapeAttribute(resolvedItem.id)}">I need review</button>
            <button class="button danger" type="button" data-answer="unknown" data-item-id="${escapeAttribute(resolvedItem.id)}">I cannot</button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderVerseCardForDrill(verse) {
  return `
    <div class="verse-card drill-verse">
      <div class="verse-heading">
        <strong>${escapeHtml(verse.reference)}</strong>
        <button class="icon-button" type="button" data-action="speak" data-text="${escapeAttribute(verse.russianText)}">Speak</button>
      </div>
      <p class="russian">${escapeHtml(verse.russianText)}</p>
      ${verse.englishText ? `<p class="translation">${escapeHtml(verse.englishText)}</p>` : ''}
    </div>
  `;
}

function findItemForCurrentLevel(bundle, progress) {
  if (!bundle || !progress?.items) return null;

  const queue = buildDailyQueue(bundle, progress, {
    level: progress.currentLevel,
    now: new Date().toISOString()
  });

  if (queue.length > 0) {
    return queue[0]?.item ?? null;
  }

  const candidates = getInventoryItems(bundle, progress, {
    level: progress.currentLevel,
    type: 'all',
    state: 'all'
  });

  return candidates.length > 0 ? candidates[0].item : null;
}

function findItemById(bundle, itemId) {
  return bundle.items.find((item) => item.id === itemId) ?? null;
}

async function handleClick(event) {
  const target = event.target.closest('button, a, label');
  if (!target) return;

  if (target.dataset.action === 'clear-data') {
    appState = normalizeAppState(buildStartupState(null, new Date().toISOString()), new Date().toISOString());
    appState.message = 'Local data cleared and demo bundle reloaded.';
    render();

    try {
      await clearAppState();
      await persistStartupState('Could not persist cleared startup state to browser storage');
    } catch (error) {
      appState.message = `Could not clear browser storage: ${error.message}`;
      render();
    }
    return;
  }

  if (target.dataset.action === 'open-vocabulary') {
    appState.ui.view = 'vocabulary';
    render();
    return;
  }

  if (target.dataset.action === 'open-session') {
    appState.ui.view = 'session';
    appState.ui.drillItemId = null;
    render();
    return;
  }

  if (target.dataset.action === 'start-drill') {
    appState.ui.view = 'drill';
    appState.ui.drillItemId = String(target.dataset.itemId || '');
    render();
    return;
  }

  if (target.dataset.action === 'open-drill') {
    appState.ui.view = 'drill';
    appState.ui.drillItemId = target.dataset.itemId || '';
    if (!appState.ui.drillItemId) {
      appState.ui.drillItemId = null;
    }
    render();
    return;
  }

  if (target.dataset.action === 'advance-level') {
    advanceLevel();
    return;
  }

  if (target.dataset.action === 'speak') {
    speakRussian(target.dataset.text || '');
    return;
  }

  if (target.dataset.answer && target.dataset.itemId) {
    await answerItem(target.dataset.itemId, target.dataset.answer);
    return;
  }
}

async function handleChange(event) {
  const { target } = event;

  if (target.dataset.action === 'set-selected-level') {
    const normalized = sanitizeValue(target.value, LEVELS, appState.progress.currentLevel);
    appState.ui.selectedLevel = normalized;
    appState.ui.view = 'vocabulary';
    render();
    return;
  }

  if (target.dataset.action === 'set-list-type') {
    appState.ui.listType = sanitizeValue(target.value, VALID_LIST_TYPES, appState.ui.listType);
    appState.ui.view = 'vocabulary';
    render();
    return;
  }

  if (target.dataset.action === 'set-list-state') {
    appState.ui.listState = sanitizeValue(target.value, VALID_LIST_STATES, appState.ui.listState);
    appState.ui.view = 'vocabulary';
    render();
    return;
  }

  if (target.id !== 'bundle-file') return;
  const file = event.target.files?.item(0);
  if (!file) return;

  try {
    const text = await file.text();
    const rawBundle = JSON.parse(text);
    await loadBundle(rawBundle, `${file.name} imported into this browser.`);
  } catch (error) {
    appState.message = `Import failed: ${error.message}`;
    render();
  }
}

async function loadBundle(rawBundle, message) {
  const bundle = normalizeBundle(rawBundle);
  const progress = createInitialProgress(bundle, new Date().toISOString());
  appState = normalizeAppState({ bundle, progress, message }, new Date().toISOString());
  appState.message = message;
  appState.ui.view = 'session';
  render();

  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `Loaded in memory, but browser storage failed: ${error.message}`;
    render();
  }
}

async function answerItem(itemId, answer) {
  const progress = applyScreeningAnswer(appState.progress, itemId, answer, new Date().toISOString());
  const isFromDrill = appState.ui.view === 'drill';
  appState = {
    ...appState,
    progress,
    message: answer === 'known' ? 'Marked known. It leaves the normal queue.' : 'Marked weak. It stays prioritized.'
  };

  if (isFromDrill) {
    appState.ui.view = 'session';
    appState.ui.drillItemId = null;
  }

  render();

  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `Progress changed in memory, but browser storage failed: ${error.message}`;
    render();
  }
}

async function advanceLevel() {
  const previousLevel = appState.progress.currentLevel;

  try {
    const progress = advanceLevelIfGatePassed(appState.bundle, appState.progress, new Date().toISOString());
    appState = {
      ...appState,
      progress,
      message: progress.currentLevel === previousLevel ? 'All configured levels are complete.' : `Advanced to ${progress.currentLevel}.`
    };
  } catch (error) {
    appState = {
      ...appState,
      message: error.message
    };
  }

  render();

  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `Level changed in memory, but browser storage failed: ${error.message}`;
    render();
  }
}

function speakRussian(text) {
  if (!text) return;
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    appState.message = 'Web Speech API is unavailable in this browser.';
    render();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  utterance.rate = 0.82;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function findFirstVerse(bundle, item) {
  const verseId = item.linkedVerseIds.at(0);
  return bundle.verses.find((verse) => verse.id === verseId) ?? null;
}

function getItemMeaning(item) {
  return item.meaning || item.explanation || item.phrase || item.name || '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
