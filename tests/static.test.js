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
