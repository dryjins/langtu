import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import { join } from 'node:path';

import { ensureLocalProperties, resolveAndroidSdkPath, run } from '../scripts/ensure-android-sdk.mjs';

test('resolveAndroidSdkPath prefers ANDROID_HOME', () => {
  const originalHome = process.env.ANDROID_HOME;
  const originalRoot = process.env.ANDROID_SDK_ROOT;

  process.env.ANDROID_HOME = '/tmp/home-sdk';
  process.env.ANDROID_SDK_ROOT = '/tmp/root-sdk';
  assert.equal(resolveAndroidSdkPath(), '/tmp/home-sdk');

  process.env.ANDROID_HOME = '';
  assert.equal(resolveAndroidSdkPath(), '/tmp/root-sdk');

  if (originalHome === undefined) {
    delete process.env.ANDROID_HOME;
  } else {
    process.env.ANDROID_HOME = originalHome;
  }
  if (originalRoot === undefined) {
    delete process.env.ANDROID_SDK_ROOT;
  } else {
    process.env.ANDROID_SDK_ROOT = originalRoot;
  }
});

test('ensureLocalProperties creates and updates local.properties', () => {
  const projectDir = mkdtempSync(join(os.tmpdir(), 'langtu-android-sdk-test-'));
  const localPropertiesPath = join(projectDir, 'android', 'local.properties');

  try {
    const changed = ensureLocalProperties(projectDir, '/tmp/android-sdk');
    assert.equal(changed, true);
    assert.equal(readFileSync(localPropertiesPath, 'utf8'), 'sdk.dir=/tmp/android-sdk\n');

    const unchanged = ensureLocalProperties(projectDir, '/tmp/android-sdk');
    assert.equal(unchanged, false);

    writeFileSync(localPropertiesPath, 'foo=bar\nsdk.dir=/wrong/sdk\n');
    const updated = ensureLocalProperties(projectDir, '/tmp/android-sdk');
    assert.equal(updated, true);
    assert.equal(readFileSync(localPropertiesPath, 'utf8'), 'foo=bar\nsdk.dir=/tmp/android-sdk\n');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test('run throws when SDK environment variables are missing', () => {
  const originalHome = process.env.ANDROID_HOME;
  const originalRoot = process.env.ANDROID_SDK_ROOT;

  delete process.env.ANDROID_HOME;
  delete process.env.ANDROID_SDK_ROOT;

  const projectDir = mkdtempSync(join(os.tmpdir(), 'langtu-android-sdk-run-'));
  assert.throws(
    () => run(projectDir),
    {
      message: 'ANDROID_HOME and ANDROID_SDK_ROOT are both unset. Set one of them and retry.'
    },
    'expected missing env error'
  );

  if (originalHome === undefined) {
    delete process.env.ANDROID_HOME;
  } else {
    process.env.ANDROID_HOME = originalHome;
  }
  if (originalRoot === undefined) {
    delete process.env.ANDROID_SDK_ROOT;
  } else {
    process.env.ANDROID_SDK_ROOT = originalRoot;
  }
  rmSync(projectDir, { recursive: true, force: true });
});

test('run skips sdk write when env vars are missing but local.properties exists', () => {
  const originalHome = process.env.ANDROID_HOME;
  const originalRoot = process.env.ANDROID_SDK_ROOT;

  delete process.env.ANDROID_HOME;
  delete process.env.ANDROID_SDK_ROOT;

  const projectDir = mkdtempSync(join(os.tmpdir(), 'langtu-android-sdk-run-existing-'));
  const localPropertiesPath = join(projectDir, 'android', 'local.properties');
  mkdirSync(join(projectDir, 'android'), { recursive: true });
  writeFileSync(localPropertiesPath, 'sdk.dir=/existing/sdk\n');
  const result = run(projectDir);
  assert.equal(result, false);

  assert.equal(readFileSync(localPropertiesPath, 'utf8'), 'sdk.dir=/existing/sdk\n');
  if (originalHome === undefined) {
    delete process.env.ANDROID_HOME;
  } else {
    process.env.ANDROID_HOME = originalHome;
  }
  if (originalRoot === undefined) {
    delete process.env.ANDROID_SDK_ROOT;
  } else {
    process.env.ANDROID_SDK_ROOT = originalRoot;
  }
  rmSync(projectDir, { recursive: true, force: true });
});
