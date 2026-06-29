import { LEVELS } from './bundle.js';
import { clearAppState, loadAppState, saveAppState } from './db.js';
import {
  applyScreeningAnswer,
  buildDailyQueue,
  getInventoryItems,
  summarizeInventoryCounts
} from './scheduler.js';
import { buildStartupState, defaultStartupMessage } from './startup.js';
import { buildSentenceTruthChallenge } from './sentence-practice.js';

const root = document.getElementById('app-root');
const APP_NAME = 'GosRU';

const VALID_VIEWS = ['session', 'vocabulary', 'drill'];
const VALID_LEVEL_FILTERS = ['all', ...LEVELS];
const VALID_LIST_TYPES = ['all', 'vocabulary', 'grammar', 'expression'];
const VALID_LIST_STATES = ['all', 'new', 'screening', 'learning', 'weak', 'known', 'retired', 'audit_due'];

const DEFAULT_UI = {
  view: 'session',
  listType: 'vocabulary',
  listState: 'all',
  selectedLevel: 'all',
  drillItemId: null,
  sentenceChallenge: null
};

let appState = {
  bundle: null,
  progress: null,
  message: '',
  ui: { ...DEFAULT_UI }
};

init().catch((error) => {
   root.innerHTML = `<main class="app error"><h1>${APP_NAME}</h1><p>${escapeHtml(error.message)}</p></main>`;
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
  const sourceUi = rawState?.ui || {};

  return {
    ...startup,
    ui: {
      ...DEFAULT_UI,
      sentenceChallenge: null,
      view: sanitizeValue(sourceUi.view, VALID_VIEWS, DEFAULT_UI.view),
      listType: sanitizeValue(sourceUi.listType, VALID_LIST_TYPES, DEFAULT_UI.listType),
      listState: sanitizeValue(sourceUi.listState, VALID_LIST_STATES, DEFAULT_UI.listState),
      selectedLevel: 'all',
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
        <h1>${APP_NAME}</h1>
        <p class="lead">The app starts with an offline English-Russian starter bundle and stores all progress in the browser.</p>
        <div class="actions">
          <button class="button primary" type="button" data-action="open-vocabulary">Open vocabulary</button>
          <a class="button ghost" href="README.md">Read design</a>
        </div>
        <p class="notice">${escapeHtml(defaultStartupMessage)}</p>
        <p class="notice">Starter content is complete for all levels and is editable only through the app and browser storage.</p>
      </section>
    </main>
  `;
}

function renderStudyApp() {
  const { bundle, progress, message } = appState;
  const level = progress.currentLevel;
  const challenge = getSessionSentenceChallenge();

  return `
    <main class="app study-layout">
        <header class="topbar">
          <div>
            <p class="eyebrow">Current level ${level}</p>
            <h1>${APP_NAME}</h1>
            <p class="muted">${escapeHtml(bundle.title)}</p>
          </div>
          <div class="topbar-actions">
            <button class="button ghost" type="button" data-action="clear-data">Clear local data</button>
            <button class="button secondary" type="button" data-action="open-vocabulary">Vocabulary</button>
          </div>
        </header>

      ${message ? `<div class="notice">${escapeHtml(message)}</div>` : ''}

      <section class="dashboard sentence-layout">
        ${renderSentenceChallengeCard(challenge)}
        ${renderSentenceHintPanel(challenge ? challenge.hints : [])}
      </section>
    </main>
  `;
}

function getSessionSentenceChallenge() {
  const stored = appState.ui.sentenceChallenge;
  const level = appState.progress.currentLevel;
  if (stored?.level === level) {
    return stored;
  }

  const challenge = buildSentenceTruthChallenge(appState.bundle, appState.progress, {
    level,
    now: new Date().toISOString()
  });

  if (!challenge) {
    appState.ui.sentenceChallenge = null;
    return null;
  }

  const prepared = {
    ...challenge,
    level,
    options: shuffleSentenceOptions(challenge.options)
  };

  appState.ui.sentenceChallenge = prepared;
  return prepared;
}

function shuffleSentenceOptions(options) {
  const output = [...options];

  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }

  return output;
}

function renderSentenceChallengeCard(challenge) {
  if (!challenge) {
    return `
      <article class="card panel sentence-card">
        <h2>오늘의 핵심 문장</h2>
        <p class="muted">학습된 단어가 더 필요합니다. 어휘를 더 익힌 뒤 다시 시도해 주세요.</p>
      </article>
    `;
  }

  const truth = challenge.options.find((entry) => entry.isCorrect)?.text || '';

  return `
    <article class="card panel sentence-card">
      <div class="panel-header">
        <h2>오늘의 핵심 문장</h2>
        <span class="hint-level">레벨 ${escapeHtml(challenge.focusLevel || '')}</span>
      </div>
      <p class="muted">문장이 원문과 같은지 선택해 주세요.</p>
        <p class="sentence-quote">${escapeHtml(challenge.verseReference || challenge.verseId || '문장')}</p>
      <div class="sentence-options">
        ${challenge.options.map((option) => `
          <button class="sentence-option" type="button" data-action="judge-sentence" data-answer="${option.isCorrect}">
            ${escapeHtml(option.text)}
          </button>
        `).join('')}
      </div>
      ${truth ? `<button class="icon-button" type="button" data-action="speak" data-text="${escapeAttribute(truth)}">Listen</button>` : ''}
    </article>
  `;
}

function renderSentenceHintPanel(items) {
  if (!items.length) {
    return `
      <article class="card panel sentence-hints-card">
        <h3>단어 힌트</h3>
        <p class="muted">현재 문장과 연결된 어휘를 아직 학습하지 않았습니다.</p>
      </article>
    `;
  }

  return `
    <article class="card panel sentence-hints-card">
      <h3>단어 힌트</h3>
      <ul class="sentence-hint-list">
        ${items.map((item) => `
          <li class="sentence-hint-item">
            <div>
              <span class="hint-level">${escapeHtml(item.level || '')}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(formatHintKind(item.type))} · ${escapeHtml(getItemMeaning(item))}</small>
            </div>
            <button class="mini-button" type="button" data-action="speak" data-text="${escapeAttribute(item.label)}">음성</button>
          </li>
        `).join('')}
      </ul>
    </article>
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
  const levelCounts = summarizeInventoryCounts(getInventoryItems(bundle, progress, {
    level,
    type: appState.ui.listType,
    state: 'all'
  }));
  const levelLabel = level === 'all' ? 'All levels' : `Level ${level}`;

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">${escapeHtml(levelLabel)} vocabulary</p>
          <h1>Vocabulary list</h1>
          <p class="muted">Scan every word, its status, meaning, and first linked example sentence.</p>
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
              <option value="all" ${level === 'all' ? 'selected' : ''}>All levels</option>
              ${LEVELS.map((value) => `<option value="${value}" ${value === level ? 'selected' : ''}>${value}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="filter-label" for="vocab-type">Type</label>
            <select id="vocab-type" class="select" data-action="set-list-type" data-action-group="vocabulary">
              <option value="all" ${appState.ui.listType === 'all' ? 'selected' : ''}>All item types</option>
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
          <span class="badge">not learned ${levelCounts.new}</span>
          <span class="badge">weak ${levelCounts.weak}</span>
          <span class="badge">known ${levelCounts.known}</span>
          <span class="badge">audit ${levelCounts.audit_due}</span>
        </div>
      </section>

      <section class="card panel">
        <h2>Words and examples</h2>
        ${renderVocabularyTable(levelItems, bundle)}
      </section>
    </main>
  `;
}

function renderVocabularyTable(entries, bundle) {
  if (!entries.length) return '<p class="muted">No items match this filter.</p>';

  return `
    <div class="vocabulary-table-wrap">
      <table class="vocabulary-table">
        <thead>
          <tr>
            <th class="state-heading" aria-label="State color"></th>
            <th>Word</th>
            <th>Meaning</th>
            <th>Example</th>
            <th>State</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((entry) => renderVocabularyRow(entry, bundle)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderVocabularyRow(entry, bundle) {
  const { item, record } = entry;
  const displayState = getDisplayState(record);
  const example = getItemExample(bundle, item);
  const forms = Array.isArray(item.forms) && item.forms.length ? item.forms.join(', ') : '';

  return `
    <tr class="vocab-row vocab-${displayState.key}">
      <td class="vocab-state-bar" aria-label="${escapeAttribute(displayState.label)}"></td>
      <td class="vocab-word-cell">
        <strong class="vocab-word">${escapeHtml(item.label)}</strong>
        <span class="vocab-meta">${escapeHtml(item.type)} / ${escapeHtml(item.level)}</span>
        ${forms ? `<span class="vocab-forms">forms: ${escapeHtml(forms)}</span>` : ''}
      </td>
      <td class="vocab-meaning-cell">${escapeHtml(getItemMeaning(item))}</td>
      <td class="vocab-example-cell">
        <span>${escapeHtml(example.text)}</span>
        ${example.reference ? `<small>${escapeHtml(example.reference)}</small>` : ''}
      </td>
      <td><span class="badge ${displayState.badgeClass}">${escapeHtml(displayState.label)}</span></td>
      <td>
        <div class="vocab-actions">
          <button class="mini-button" type="button" data-action="start-drill" data-item-id="${escapeAttribute(item.id)}">Drill</button>
          <button class="mini-button" type="button" data-answer="known" data-item-id="${escapeAttribute(item.id)}">Known</button>
          <button class="mini-button" type="button" data-answer="uncertain" data-item-id="${escapeAttribute(item.id)}">Unsure</button>
          <button class="mini-button danger" type="button" data-answer="unknown" data-item-id="${escapeAttribute(item.id)}">Unknown</button>
        </div>
      </td>
    </tr>
  `;
}

function getDisplayState(record = {}) {
  if (record.lastAnswer === 'known' || record.state === 'known') {
    return { key: 'known', label: 'Known', badgeClass: 'pass' };
  }

  if (record.lastAnswer === 'unknown') {
    return { key: 'unknown', label: 'Unknown', badgeClass: 'unknown' };
  }

  if (record.state === 'new' || record.state === 'screening') {
    return { key: 'not-learned', label: 'Not learned', badgeClass: 'not-learned' };
  }

  if (record.state === 'retired' || record.state === 'audit_due') {
    return { key: 'audit', label: 'Audit', badgeClass: 'audit' };
  }

  return { key: 'weak', label: 'Weak review', badgeClass: 'weak' };
}

function formatHintKind(type) {
  if (type === 'vocabulary') return 'Vocabulary';
  if (type === 'grammar') return 'Grammar';
  if (type === 'expression') return 'Expression';
  return 'Item';
}

function getItemExample(bundle, item) {
  const verse = findFirstVerse(bundle, item);

  if (!verse) {
    return { text: 'No linked example sentence.', reference: '' };
  }

  return {
    text: verse.russianText,
    reference: verse.reference
  };
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
    appState.ui.selectedLevel = 'all';
    appState.ui.listType = 'vocabulary';
    appState.ui.listState = 'all';
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'open-session') {
    appState.ui.view = 'session';
    appState.ui.drillItemId = null;
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'start-drill') {
    appState.ui.view = 'drill';
    appState.ui.drillItemId = String(target.dataset.itemId || '');
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'speak') {
    speakRussian(target.dataset.text || '');
    return;
  }

  if (target.dataset.action === 'judge-sentence') {
    handleSentenceChallenge(target.dataset.answer === 'true');
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
    const normalized = sanitizeValue(target.value, VALID_LEVEL_FILTERS, appState.ui.selectedLevel);
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

async function handleSentenceChallenge(isCorrect) {
  const challenge = appState.ui.sentenceChallenge;
  if (!challenge?.itemId) {
    appState.message = '오늘의 문장 데이터가 없습니다.';
    render();
    return;
  }

  let progress = appState.progress;

  try {
    progress = applyScreeningAnswer(
      progress,
      challenge.itemId,
      isCorrect ? 'known' : 'unknown',
      new Date().toISOString()
    );
  } catch (error) {
    appState = {
      ...appState,
      ui: {
        ...appState.ui,
        sentenceChallenge: null
      },
      message: error.message
    };
    render();
    return;
  }

  appState = {
    ...appState,
    progress,
    ui: {
      ...appState.ui,
      sentenceChallenge: null
    },
    message: isCorrect ? '정답입니다. 예문이 일치합니다.' : '오답입니다. 다시 들어보고 판단해 보세요.'
  };

  render();

  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `Progress changed in memory, but browser storage failed: ${error.message}`;
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
