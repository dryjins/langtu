import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(scriptDir);
const sourceIndex = join(projectDir, 'index.html');
const sourceSrc = join(projectDir, 'src');
const targetDir = join(projectDir, 'www');

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

cpSync(sourceIndex, join(targetDir, 'index.html'));
cpSync(sourceSrc, join(targetDir, 'src'), { recursive: true });
