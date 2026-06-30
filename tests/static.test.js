import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('index loads the real MVP app module instead of an inline shell', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.match(html, /<div id="app-root"><\/div>/);
  assert.match(html, /type="module"/);
  assert.match(html, /src="\.\/src\/app\.js(\?[^"]*)?"/);
  assert.doesNotMatch(html, /John corpus shell/);
});

test('app renders before waiting for browser storage', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /async function init\(\) \{\n  render\(\);/);
});

test('app exposes vocabulary inventory and sentence drill modes', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /function renderVocabularyView\(\)/);
  assert.match(script, /data-action="open-vocabulary"/);
  assert.match(script, /function renderDrillView\(\)/);
  assert.match(script, /judge-sentence/);
});

test('app does not expose bundle file import controls', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.doesNotMatch(script, /bundle-file/);
  assert.doesNotMatch(script, /loadBundle\(/);
  assert.doesNotMatch(script, /Import study bundle/);
  assert.doesNotMatch(script, /Replace bundle/);
});

test('app does not show quick study action panel', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.doesNotMatch(script, /Quick study action/);
  assert.doesNotMatch(script, /topVerseControls/);
  assert.doesNotMatch(script, /Practice this item/);
});

test('session view is no longer strict gate based', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.doesNotMatch(script, /Strict gate/);
  assert.doesNotMatch(script, /advance-level/);
  assert.doesNotMatch(script, /getLevelGateStatus/);
});

test('session UI includes sentence challenge flow', () => {
  const script = readFileSync('src/app.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(script, /buildSentenceTruthChallenge/);
  assert.match(script, /handleSentenceChallenge/);
  assert.match(script, /data-action="judge-sentence"/);
  assert.match(script, /option\.isCorrect/);
  assert.match(styles, /\.sentence-option/);
  assert.match(styles, /\.hint-level/);
});

test('sentence challenge UI text stays in English', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.doesNotMatch(script, /오늘의 핵심 문장/);
  assert.doesNotMatch(script, /학습된 단어가 더 필요합니다/);
  assert.doesNotMatch(script, /문장이 원문과 같은지 선택해 주세요/);
  assert.doesNotMatch(script, /단어 힌트/);
  assert.doesNotMatch(script, /음성/);
  assert.doesNotMatch(script, /오늘의 문장 데이터가 없습니다/);
  assert.doesNotMatch(script, /정답입니다/);
  assert.doesNotMatch(script, /오답입니다/);
});

test('app exposes a Sentences view with verse drill flow', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /data-action="open-sentences"/);
  assert.match(script, /function renderSentencesView\(/);
  assert.match(script, /function renderVerseDrillView\(/);
  assert.match(script, /data-action="start-verse-drill"/);
  assert.match(script, /data-action="verse-answer-known"/);
  assert.match(script, /data-action="verse-answer-uncertain"/);
  assert.match(script, /data-action="verse-answer-unknown"/);
});

test('app wires the sentences view into the topbar for both empty and study layouts', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /ui\.view === 'sentences'/);
  assert.match(script, /root\.innerHTML = renderSentencesView\(\)/);
});

test('app-state supports the sentences and verse-drill views', () => {
  const stateScript = readFileSync('src/app-state.js', 'utf8');

  assert.match(stateScript, /'sentences'/);
  assert.match(stateScript, /'verse-drill'/);
  assert.match(stateScript, /verseDrillId/);
});

test('app exposes dedicated Grammar and Expressions skill views separate from Vocabulary', () => {
  const script = readFileSync('src/app.js', 'utf8');
  const stateScript = readFileSync('src/app-state.js', 'utf8');

  assert.match(script, /ui\.view === 'grammar'/);
  assert.match(script, /ui\.view === 'expressions'/);
  assert.match(script, /data-action="open-grammar"/);
  assert.match(script, /data-action="open-expressions"/);
  assert.match(script, /function renderSkillListView\(/);
  assert.match(script, /function renderVocabularyTable\(/);
  assert.doesNotMatch(script, /<option value="all"[^>]*>\s*All item types/);
  assert.doesNotMatch(stateScript, /listType:\s*'all'/);
  assert.match(stateScript, /listType:\s*'vocabulary'/);
  assert.match(stateScript, /'grammar'/);
  assert.match(stateScript, /'expression'/);
});

test('vocabulary view renders a compact table with examples', () => {
  const script = readFileSync('src/app.js', 'utf8');
  const stateScript = readFileSync('src/app-state.js', 'utf8');

  assert.match(stateScript, /selectedLevel:\s*'all'/);
  assert.match(stateScript, /listType:\s*'vocabulary'/);
  assert.match(script, /<option value="all"/);
  assert.match(script, /All levels/);
  assert.match(script, /function renderVocabularyRow\(/);
  assert.match(script, /function getItemExample\(/);
  assert.match(script, /vocabulary-table/);
  assert.match(script, /Example/);
  assert.doesNotMatch(script, /vocab-page-prev/);
  assert.doesNotMatch(script, /vocab-page-next/);
  assert.doesNotMatch(script, /sliceVocabularyPage/);
});

test('opening vocabulary resets filters to full level coverage', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /appState\.ui\.view = 'vocabulary'/);
  assert.match(script, /appState\.ui\.selectedLevel = 'all'/);
  assert.match(script, /appState\.ui\.listState = 'all'/);
  assert.doesNotMatch(script, /appState\.ui\.listType = 'all'/);
});

test('vocabulary table styles include compact layout and state colors', () => {
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(styles, /\.vocabulary-table-wrap/);
  assert.match(styles, /\.vocab-state-bar/);
  assert.match(styles, /\.vocab-known/);
  assert.match(styles, /\.vocab-unknown/);
  assert.match(styles, /\.vocab-not-learned/);
  assert.match(styles, /\.vocab-weak/);
});

test('vocabulary table uses fixed column widths with example taking the largest share', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  const html = readFileSync('src/app.js', 'utf8');

  assert.match(styles, /\.vocabulary-table\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(styles, /\.vocabulary-table col\.col-state\s*\{[^}]*width:\s*8px/);
  assert.match(styles, /\.vocabulary-table col\.col-word\s*\{[^}]*width/);
  assert.match(styles, /\.vocabulary-table col\.col-meaning\s*\{[^}]*width/);
  assert.match(styles, /\.vocabulary-table col\.col-example\s*\{[^}]*width/);
  assert.match(styles, /\.vocabulary-table col\.col-state-badge\s*\{[^}]*width/);
  assert.match(styles, /\.vocabulary-table col\.col-action\s*\{[^}]*width/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(html, /<col class="col-state"/);
  assert.match(html, /<col class="col-word"/);
  assert.match(html, /<col class="col-meaning"/);
  assert.match(html, /<col class="col-example"/);
  assert.match(html, /<col class="col-state-badge"/);
  assert.match(html, /<col class="col-action"/);
});

test('app loads the content bundle through the IndexedDB cache, not direct import', () => {
  const script = readFileSync('src/app.js', 'utf8');
  const startupScript = readFileSync('src/startup.js', 'utf8');
  const dbScript = readFileSync('src/db.js', 'utf8');

  assert.doesNotMatch(script, /from\s+['"]\.\/default-bundle\.js['"]/);
  assert.doesNotMatch(startupScript, /from\s+['"]\.\/default-bundle\.js['"]/);
  assert.match(script, /loadContentBundle|loadCachedContent|content-cache/);
  assert.match(dbScript, /content-bundle/);
});
