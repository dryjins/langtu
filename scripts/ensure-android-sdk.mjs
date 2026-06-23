import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizePath(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveAndroidSdkPath() {
  return normalizePath(process.env.ANDROID_HOME) || normalizePath(process.env.ANDROID_SDK_ROOT) || '';
}

function localPropertiesPath(projectDir = process.cwd()) {
  return join(projectDir, 'android', 'local.properties');
}

function hasSdkDir(value, sdkPath) {
  return value.split(/\r?\n/).some((line) => line === `sdk.dir=${sdkPath}`);
}

function currentSdkPath(value) {
  const entry = value
    .split(/\r?\n/)
    .find((line) => line.startsWith('sdk.dir='));
  if (!entry) {
    return '';
  }
  return normalizePath(entry.slice('sdk.dir='.length));
}

export function ensureLocalProperties(projectDir = process.cwd(), sdkPath) {
  const actualSdkPath = normalizePath(sdkPath);
  if (!actualSdkPath) {
    throw new Error('ANDROID_HOME and ANDROID_SDK_ROOT are both unset. Set one of them and retry.');
  }

  const propertiesPath = localPropertiesPath(projectDir);
  const desired = `sdk.dir=${actualSdkPath}`;

  const current = existsSync(propertiesPath) ? readFileSync(propertiesPath, 'utf8') : '';
  if (hasSdkDir(current, actualSdkPath)) {
    return false;
  }

  const lines = current
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('sdk.dir='));
  lines.push(desired);
  mkdirSync(dirname(propertiesPath), { recursive: true });
  writeFileSync(propertiesPath, `${lines.join('\n')}\n`);
  return true;
}

export function run(projectDir = process.cwd()) {
  const sdkPath = resolveAndroidSdkPath();
  const propertiesPath = localPropertiesPath(projectDir);
  if (!sdkPath) {
    const current = existsSync(propertiesPath) ? readFileSync(propertiesPath, 'utf8') : '';
    if (currentSdkPath(current)) {
      return false;
    }
    throw new Error('ANDROID_HOME and ANDROID_SDK_ROOT are both unset. Set one of them and retry.');
  }

  return ensureLocalProperties(projectDir, sdkPath);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  run();
}
