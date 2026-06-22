import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('capacitor config and package scripts are wired', () => {
  const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(config.appId, 'com.dryjins.langtu');
  assert.equal(config.appName, 'Langtu');
  assert.equal(config.webDir, 'www');

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(pkg.scripts['android:sync'], /npx cap sync/);
  assert.match(pkg.scripts['android:assemble'], /gradlew assembleDebug/);
});

test('android capacitor dependency entries exist', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.devDependencies['@capacitor/cli']);
  assert.ok(pkg.dependencies['@capacitor/android']);
  assert.ok(pkg.dependencies['@capacitor/core']);
});
