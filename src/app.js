import { LEVELS, normalizeBundle } from './bundle.js';
import { clearAppState, loadAppState, saveAppState } from './db.js';
import {
  advanceLevelIfGatePassed,
  applyScreeningAnswer,
  buildDailyQueue,
  createInitialProgress,
  getLevelGateStatus
} from './scheduler.js';
import { buildStartupState, defaultStartupMessage } from './startup.js';

const root = document.getElementById('app-root');

let appState = {
  bundle: null,
  progress: null,
  message: ''
};

init().catch((error) => {
  root.innerHTML = `<main class="app error"><h1>Langtu</h1><p>${escapeHtml(error.message)}</p></main>`;
});

async function init() {
  render();
  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);

  try {
    const savedState = await loadAppState();
    const hasSavedProgress = savedState?.bundle && savedState?.progress;

    appState = buildStartupState(savedState, new Date().toISOString());
    render();

    if (!hasSavedProgress) {
      await persistStartupState('Could not persist startup bundle to browser storage.');
    }
  } catch (error) {
    appState = buildStartupState(null, new Date().toISOString());
    appState.message = `Browser storage unavailable: ${error.message}`;
    render();
    return;
  }
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
  root.innerHTML = appState.bundle ? renderStudyApp() : renderEmptyState();
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

async function handleClick(event) {
  const target = event.target.closest('button, a, label');
  if (!target) return;

  if (target.dataset.action === 'clear-data') {
    appState = buildStartupState(null, new Date().toISOString());
    appState.message = 'Local data cleared and demo bundle reloaded.';
    render();

    try {
      await clearAppState();
      await persistStartupState('Could not persist cleared startup state to browser storage');
    } catch (error) {
      appState.message = `Could not clear browser storage: ${error.message}`;
      render();
    }
  }

  if (target.dataset.action === 'advance-level') {
    advanceLevel();
  }

  if (target.dataset.action === 'speak') {
    speakRussian(target.dataset.text || '');
  }

  if (target.dataset.answer && target.dataset.itemId) {
    await answerItem(target.dataset.itemId, target.dataset.answer);
  }
}

async function handleChange(event) {
  if (event.target.id !== 'bundle-file') return;
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
  appState = { bundle, progress, message };
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
  appState = {
    ...appState,
    progress,
    message: answer === 'known' ? 'Marked known. It leaves the normal queue.' : 'Marked weak. It stays prioritized.'
  };
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
