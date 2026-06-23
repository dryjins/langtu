import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('index loads the real MVP app module instead of an inline shell', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.match(html, /<div id="app-root"><\/div>/);
  assert.match(html, /type="module"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
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
  assert.match(script, /Repeat the sentence aloud/);
});

test('vocabulary view renders a compact table with examples', () => {
  const script = readFileSync('src/app.js', 'utf8');

  assert.match(script, /function renderVocabularyRow\(/);
  assert.match(script, /function getItemExample\(/);
  assert.match(script, /vocabulary-table/);
  assert.match(script, /Example/);
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
