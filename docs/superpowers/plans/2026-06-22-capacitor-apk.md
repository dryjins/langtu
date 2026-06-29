# Android APK via Capacitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing Langtu web MVP as an Android app and generate a debug APK without changing study logic.

**Architecture:** Keep existing web files unchanged and run them inside Capacitor WebView. Add only native shell files and automated sync/build scripts.

**Tech Stack:** Capacitor Core, Capacitor CLI, Capacitor Android, Node.js

---

### Task 1: Capacitor wiring and build scripts

**Files:**
- Modify: `package.json`
- Create: `capacitor.config.json`
- Modify: `.gitignore`
- Add: `scripts/copy-web.mjs`
- Add: `tests/platform.test.js`

- [ ] **Step 1: Write failing tests for wiring expectations**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('capacitor config and package scripts are wired', () => {
  const config = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
  assert.equal(config.appId, 'com.dryjins.langtu');
  assert.equal(config.appName, 'GosRU');
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
```

- [ ] **Step 2: Run tests and confirm failure**
Run: `npm test`

- [ ] **Step 3: Add scripts, config, and copy helper**
  - Add `android:*` scripts to `package.json`.
  - Add `capacitor.config.json` with `appId`, `appName`, and `webDir`.
  - Add `scripts/copy-web.mjs` to mirror `index.html` and `src/` into `www/`.

- [ ] **Step 4: Re-run tests and confirm pass**
Run: `npm test`

### Task 2: Generate Android shell and attempt APK build

**Files:**
- `android/` native project (generated)
- `package-lock.json`

- [ ] **Step 1: Generate platform shell**
Run: `npx cap add android`

- [ ] **Step 2: Sync assets and Capacitor config**
Run: `npm run android:sync`

- [ ] **Step 3: Build debug APK**
Run: `npm run android:assemble`

- [ ] **Step 4: Verify and record build output path**
  - `android/app/build/outputs/apk/debug/app-debug.apk`

### Task 3: Document Android handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Android prerequisite and build command section**
- [ ] **Step 2: Add generated APK path in documentation**
- [ ] **Step 3: Keep repo restrictions explicit (no bundled copyright text/audio)**
