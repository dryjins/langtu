import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.dirname(scriptDir);

const CLI_DEFAULTS = {
  bible: 'data/bible-kids-03.json',
  vocab: 'data/openrussian-vocab-a1-c2.json',
  skill: 'data/skill-content-a1.json',
  output: 'src/default-bundle.js',
  chapters: 5,
  vocabPerLevel: 10,
  title: 'GosRU starter (curated from public sources and original A1 skill content)'
};

function buildVersesFromBible(bibleData, chapters) {
  const limit = Math.max(0, Math.min(chapters, Array.isArray(bibleData.chapters) ? bibleData.chapters.length : 0));
  const verses = [];
  for (let ci = 0; ci < limit; ci += 1) {
    const chapter = bibleData.chapters[ci];
    const lines = Array.isArray(chapter.textLines) ? chapter.textLines : [];
    for (let li = 0; li < lines.length; li += 1) {
      const russianText = String(lines[li] || '').trim();
      if (!russianText) continue;
      verses.push({
        id: `book3:c${chapter.chapter}:l${li}`,
        reference: `Book 3, Ch ${chapter.chapter}:${li + 1}`,
        russianText,
        englishText: '',
        notes: chapter.title || chapter.titleText || ''
      });
    }
  }
  return verses;
}

function buildVocabularyFromOpenRussian(vocabData, vocabPerLevel) {
  const vocabulary = [];
  const seenIds = new Set();
  for (const level of Object.keys(vocabData?.itemsByLevel || {})) {
    const items = Array.isArray(vocabData.itemsByLevel[level]) ? vocabData.itemsByLevel[level] : [];
    const picked = items.slice(0, vocabPerLevel);
    for (const item of picked) {
      const lemma = String(item.bare || '').trim();
      if (!lemma) continue;
      const id = `or:${level}:${item.wordId}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const meaning = Array.isArray(item.majorTranslations) && item.majorTranslations.length
        ? String(item.majorTranslations[0])
        : Array.isArray(item.translations) && item.translations.length
          ? String(item.translations[0])
          : '';
      vocabulary.push({
        id,
        level,
        lemma,
        forms: [lemma],
        meaning,
        linkedVerseIds: []
      });
    }
  }
  return vocabulary;
}

function buildSkillsFromContent(skillData) {
  const grammar = Array.isArray(skillData?.grammar) ? skillData.grammar : [];
  const expressions = Array.isArray(skillData?.expressions) ? skillData.expressions : [];
  return {
    grammar: grammar.map((g) => ({ ...g, linkedVerseIds: Array.isArray(g.linkedVerseIds) ? g.linkedVerseIds : [] })),
    expressions: expressions.map((e) => ({ ...e, linkedVerseIds: Array.isArray(e.linkedVerseIds) ? e.linkedVerseIds : [] }))
  };
}

export function buildDefaultBundleFromSources({ bibleData, vocabData, skillData, chapters, vocabPerLevel, title }) {
  const verses = buildVersesFromBible(bibleData, chapters);
  const vocabulary = buildVocabularyFromOpenRussian(vocabData, vocabPerLevel);
  const { grammar, expressions } = buildSkillsFromContent(skillData);
  return {
    version: 1,
    title,
    verses,
    vocabulary,
    grammar,
    expressions
  };
}

function serializeBundle(bundle) {
  return `export const DEFAULT_BUNDLE = ${JSON.stringify(bundle, null, 2)};\n`;
}

function parseArgs(argv) {
  const args = { ...CLI_DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const hasNext = next !== undefined && !next.startsWith('--');
    switch (key) {
      case 'help':
        args.help = true;
        break;
      case 'bible':
        if (!hasNext) throw new Error('--bible requires a value');
        args.bible = next;
        i += 1;
        break;
      case 'vocab':
        if (!hasNext) throw new Error('--vocab requires a value');
        args.vocab = next;
        i += 1;
        break;
      case 'skill':
        if (!hasNext) throw new Error('--skill requires a value');
        args.skill = next;
        i += 1;
        break;
      case 'output':
        if (!hasNext) throw new Error('--output requires a value');
        args.output = next;
        i += 1;
        break;
      case 'chapters':
        if (!hasNext) throw new Error('--chapters requires a number');
        args.chapters = Number(next);
        i += 1;
        break;
      case 'vocab-per-level':
        if (!hasNext) throw new Error('--vocab-per-level requires a number');
        args.vocabPerLevel = Number(next);
        i += 1;
        break;
      case 'title':
        if (!hasNext) throw new Error('--title requires a value');
        args.title = next;
        i += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: node ./scripts/build-default-bundle.mjs [options]',
      '',
      '--bible path           Source bible JSON',
      '--vocab path           Source vocab JSON',
      '--skill path           Source skill content JSON',
      '--output path          Output bundle JS (default: src/default-bundle.js)',
      '--chapters n           Chapter count from start (default: 5)',
      '--vocab-per-level n    Top items per level (default: 10)',
      '--title str            Bundle title',
      '--help                 Print help'
    ].join('\n') + '\n'
  );
}

export async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printUsage();
    return;
  }
  if (!Number.isFinite(args.chapters) || args.chapters < 0) {
    throw new Error('--chapters must be a non-negative number');
  }
  if (!Number.isFinite(args.vocabPerLevel) || args.vocabPerLevel < 0) {
    throw new Error('--vocab-per-level must be a non-negative number');
  }

  const bible = JSON.parse(await fs.readFile(path.resolve(projectDir, args.bible), 'utf8'));
  const vocab = JSON.parse(await fs.readFile(path.resolve(projectDir, args.vocab), 'utf8'));
  const skill = JSON.parse(await fs.readFile(path.resolve(projectDir, args.skill), 'utf8'));

  const bundle = buildDefaultBundleFromSources({
    bibleData: bible,
    vocabData: vocab,
    skillData: skill,
    chapters: args.chapters,
    vocabPerLevel: args.vocabPerLevel,
    title: args.title
  });

  const output = path.resolve(projectDir, args.output);
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, serializeBundle(bundle));
  process.stdout.write(
    `Wrote ${output} (verses=${bundle.verses.length}, vocabulary=${bundle.vocabulary.length}, grammar=${bundle.grammar.length}, expressions=${bundle.expressions.length})\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCli();
}
