import { LEVELS } from './bundle.js';
import { clearAppState, loadAppState, saveAppState } from './db.js';
import {
  applyScreeningAnswer,
  buildDailyQueue,
  getInventoryItems,
  summarizeInventoryCounts
} from './scheduler.js';
import { buildStartupState, defaultStartupMessage } from './startup.js';
import {
  DEFAULT_UI,
  VALID_LIST_STATES,
  VALID_LIST_TYPES,
  normalizeAppState,
  sanitizeValue
} from './app-state.js';
import { buildSentenceTruthChallenge } from './sentence-practice.js';
import {
  applyVerseAnswer,
  groupVersesByChapter,
  selectVerseForPractice,
  summarizeVerseStats
} from './verse-state.js';

const root = document.getElementById('app-root');
const APP_NAME = 'GosRU';

const VALID_LEVEL_FILTERS = ['all', ...LEVELS];

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

  if (appState.ui.view === 'sentences') {
    root.innerHTML = renderSentencesView();
    return;
  }

  if (appState.ui.view === 'verse-drill') {
    root.innerHTML = renderVerseDrillView();
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
            <button class="button secondary" type="button" data-action="open-sentences">Sentences</button>
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
        <h2>Today's core sentence</h2>
        <p class="muted">Learn more vocabulary before this flow is available.</p>
      </article>
    `;
  }

  const truth = challenge.options.find((entry) => entry.isCorrect)?.text || '';

  return `
    <article class="card panel sentence-card">
      <div class="panel-header">
        <h2>Today's core sentence</h2>
        <span class="hint-level">Level ${escapeHtml(challenge.focusLevel || '')}</span>
      </div>
      <p class="muted">Select whether the sentence matches the reference sentence.</p>
        <p class="sentence-quote">${escapeHtml(challenge.verseReference || challenge.verseId || 'Sentence')}</p>
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
        <h3>Vocabulary hints</h3>
        <p class="muted">No related learned vocabulary is linked to this sentence yet.</p>
      </article>
    `;
  }

  return `
    <article class="card panel sentence-hints-card">
      <h3>Vocabulary hints</h3>
      <ul class="sentence-hint-list">
        ${items.map((item) => `
          <li class="sentence-hint-item">
            <div>
              <span class="hint-level">${escapeHtml(item.level || '')}</span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(formatHintKind(item.type))} · ${escapeHtml(getItemMeaning(item))}</small>
            </div>
            <button class="mini-button" type="button" data-action="speak" data-text="${escapeAttribute(item.label)}">Speak</button>
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
        <colgroup>
          <col class="col-state">
          <col class="col-word">
          <col class="col-meaning">
          <col class="col-example">
          <col class="col-state-badge">
          <col class="col-action">
        </colgroup>
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

function findVerseById(bundle, verseId) {
  return bundle.verses.find((verse) => verse.id === verseId) ?? null;
}

function getVerseStateLabel(state, record) {
  if (!record || record.state === 'new' || record.state === 'screening') return 'New';
  if (record.state === 'known') return 'Known';
  if (record.state === 'weak' || record.state === 'learning') return 'Weak';
  return state || 'New';
}

function getVerseStateKey(record) {
  if (!record) return 'new';
  if (record.state === 'known') return 'known';
  if (record.state === 'weak' || record.state === 'learning') return 'weak';
  return 'new';
}

function renderSentencesView() {
  const { bundle, progress } = appState;
  const verseProgress = progress?.verseProgress ?? {};
  const stats = summarizeVerseStats(verseProgress, bundle);
  const groups = groupVersesByChapter(bundle.verses);

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Verses through John</p>
          <h1>Sentences</h1>
          <p class="muted">Read every Book 3 line, listen aloud, and mark whether you can say it back without help.</p>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" type="button" data-action="open-session">Back to queue</button>
        </div>
      </header>

      <section class="card panel">
        <div class="meta-grid">
          <span class="badge">${stats.total} verses</span>
          <span class="badge">new ${stats.new}</span>
          <span class="badge">weak ${stats.weak}</span>
          <span class="badge">known ${stats.known}</span>
        </div>
      </section>

      <section class="card panel">
        <h2>Verses</h2>
        <p class="muted">Tap any verse to open the drill view, or use Quick practice to let the app pick the next unlearned line.</p>
        <div class="verse-actions-row">
          <button class="button primary" type="button" data-action="start-verse-drill" data-verse-id="">Quick practice</button>
        </div>
        ${groups.map((group) => renderVerseChapterGroup(group, verseProgress)).join('')}
      </section>
    </main>
  `;
}

function renderVerseChapterGroup(group, verseProgress) {
  return `
    <details class="verse-chapter" open>
      <summary class="verse-chapter-heading">Chapter ${group.chapter}</summary>
      <ul class="verse-list">
        ${group.verses.map((verse) => renderVerseRow(verse, verseProgress)).join('')}
      </ul>
    </details>
  `;
}

function renderVerseRow(verse, verseProgress) {
  const record = verseProgress[verse.id];
  const label = getVerseStateLabel(verse, record);
  const stateKey = getVerseStateKey(record);
  return `
    <li class="verse-row verse-${stateKey}">
      <div class="verse-row-text">
        <span class="verse-row-bar" aria-hidden="true"></span>
        <div>
          <p class="verse-row-reference">${escapeHtml(verse.reference)}</p>
          <p class="verse-row-russian">${escapeHtml(verse.russianText)}</p>
        </div>
      </div>
      <div class="verse-row-actions">
        <button class="mini-button" type="button" data-action="verse-answer-known" data-verse-id="${escapeAttribute(verse.id)}">Know it</button>
        <button class="mini-button" type="button" data-action="verse-answer-uncertain" data-verse-id="${escapeAttribute(verse.id)}">Almost</button>
        <button class="mini-button danger" type="button" data-action="verse-answer-unknown" data-verse-id="${escapeAttribute(verse.id)}">Forget</button>
        <button class="mini-button" type="button" data-action="speak" data-text="${escapeAttribute(verse.russianText)}">Speak</button>
        <button class="mini-button" type="button" data-action="start-verse-drill" data-verse-id="${escapeAttribute(verse.id)}">Drill</button>
        <span class="badge">${escapeHtml(label)}</span>
      </div>
    </li>
  `;
}

function renderVerseDrillView() {
  const { bundle, progress } = appState;
  const requestedId = appState.ui.verseDrillId;
  const verse = requestedId ? findVerseById(bundle, requestedId) : null;
  const resolvedVerse = verse ?? selectVerseForPractice(progress?.verseProgress ?? {}, bundle, {
    level: progress.currentLevel,
    now: new Date().toISOString()
  });

  if (!resolvedVerse) {
    return `
      <main class="app study-layout">
        <header class="topbar">
          <div>
            <p class="eyebrow">Verse drill</p>
            <h1>No verses to drill</h1>
            <p class="muted">Add at least one Book 3 verse to the bundle to start a drill.</p>
          </div>
          <div class="topbar-actions">
            <button class="button ghost" type="button" data-action="open-sentences">Back to sentences</button>
          </div>
        </header>
      </main>
    `;
  }

  const record = progress.verseProgress?.[resolvedVerse.id] ?? { state: 'new', correctStreak: 0 };
  const stateLabel = getVerseStateLabel(resolvedVerse, record);
  const stateKey = getVerseStateKey(record);

  return `
    <main class="app study-layout">
      <header class="topbar">
        <div>
          <p class="eyebrow">Verse drill</p>
          <h1>${escapeHtml(resolvedVerse.reference)}</h1>
          <p class="muted">Read the line aloud, hide it, then mark whether you can reproduce it.</p>
        </div>
        <div class="topbar-actions">
          <button class="button ghost" type="button" data-action="open-sentences">Back to sentences</button>
        </div>
      </header>

      <section class="card panel verse-drill-card">
        <div class="verse-drill-state verse-${stateKey}">
          <span class="badge">${escapeHtml(stateLabel)}</span>
          <span class="muted">streak ${record.correctStreak ?? 0}</span>
        </div>
        <div class="verse-card drill-verse">
          <div class="verse-heading">
            <strong>${escapeHtml(resolvedVerse.reference)}</strong>
            <button class="icon-button" type="button" data-action="speak" data-text="${escapeAttribute(resolvedVerse.russianText)}">Speak</button>
          </div>
          <p class="russian">${escapeHtml(resolvedVerse.russianText)}</p>
          ${resolvedVerse.englishText ? `<p class="translation">${escapeHtml(resolvedVerse.englishText)}</p>` : ''}
        </div>
        <p class="muted">When you are ready, click an answer below. "I can say it" marks the verse known after a 7-day review interval. "Almost" or "Forget" pushes it back to weak review.</p>
        <div class="answer-grid">
          <button class="button primary" type="button" data-verse-id="${escapeAttribute(resolvedVerse.id)}" data-action="verse-answer-known">I can say it</button>
          <button class="button secondary" type="button" data-verse-id="${escapeAttribute(resolvedVerse.id)}" data-action="verse-answer-uncertain">Almost</button>
          <button class="button danger" type="button" data-verse-id="${escapeAttribute(resolvedVerse.id)}" data-action="verse-answer-unknown">Forget</button>
        </div>
      </section>
    </main>
  `;
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
    appState.ui.listType = 'all';
    appState.ui.listState = 'all';
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'open-sentences') {
    appState.ui.view = 'sentences';
    appState.ui.verseDrillId = null;
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'start-verse-drill') {
    const requested = String(target.dataset.verseId || '');
    if (requested) {
      appState.ui.verseDrillId = requested;
    } else {
      appState.ui.verseDrillId = null;
    }
    appState.ui.view = 'verse-drill';
    appState.ui.sentenceChallenge = null;
    render();
    return;
  }

  if (target.dataset.action === 'verse-answer-known' || target.dataset.action === 'verse-answer-uncertain' || target.dataset.action === 'verse-answer-unknown') {
    await recordVerseAnswer(target.dataset.verseId || appState.ui.verseDrillId || '', target.dataset.action.replace('verse-answer-', ''));
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

async function recordVerseAnswer(verseId, answer) {
  if (!verseId) {
    appState.message = 'Verse id is missing.';
    render();
    return;
  }

  let updatedVerseProgress;
  try {
    updatedVerseProgress = applyVerseAnswer(appState.progress.verseProgress, verseId, answer, new Date().toISOString());
  } catch (error) {
    appState = {
      ...appState,
      message: error.message
    };
    render();
    return;
  }

  appState = {
    ...appState,
    progress: {
      ...appState.progress,
      verseProgress: updatedVerseProgress,
      updatedAt: new Date().toISOString()
    },
    message: answer === 'known'
      ? 'Marked known. Next review in 7 days.'
      : answer === 'uncertain'
        ? 'Marked as almost. Stay alert in review.'
        : 'Marked as forgotten. Will return at the next review.'
  };

  if (appState.ui.view === 'verse-drill') {
    const nextVerse = selectVerseForPractice(appState.progress.verseProgress, appState.bundle, {
      level: appState.progress.currentLevel,
      now: appState.progress.updatedAt
    });
    appState.ui.verseDrillId = nextVerse?.id ?? null;
    if (!nextVerse) {
      appState.ui.view = 'sentences';
    }
  }

  render();

  try {
    await saveAppState(appState);
  } catch (error) {
    appState.message = `Verse answer saved in memory, but browser storage failed: ${error.message}`;
    render();
  }
}

async function handleSentenceChallenge(isCorrect) {
  const challenge = appState.ui.sentenceChallenge;
  if (!challenge?.itemId) {
    appState.message = 'Sentence challenge data is unavailable.';
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
    message: isCorrect ? 'Correct. The example sentence matches.' : 'Incorrect. Listen again and try again.'
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
