import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.dirname(scriptDir);

const CLI_DEFAULTS = {
  bible: 'data/bible-kids-03.json',
  vocab: 'data/openrussian-vocab-a1-c2.json',
  skills: [
    'data/skill-content-a1.json',
    'data/skill-content-a2.json',
    'data/skill-content-b1.json',
    'data/skill-content-b2.json',
    'data/skill-content-c1.json',
    'data/skill-content-c2.json'
  ],
  outputContent: 'src/default-bundle.js',
  outputMeta: 'src/default-bundle-meta.js',
  chapters: undefined,
  vocabPerLevel: undefined,
  title: 'GosRU starter (curated from public sources and original A1-C2 skill content)',
  version: 1
};

function buildVersesFromBible(bibleData, chapters) {
  const totalChapters = Array.isArray(bibleData.chapters) ? bibleData.chapters.length : 0;
  const limit = typeof chapters === 'number'
    ? Math.max(0, Math.min(chapters, totalChapters))
    : totalChapters;
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
    const picked = typeof vocabPerLevel === 'number' ? items.slice(0, vocabPerLevel) : items;
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

function buildSkillsFromContents(skillDataList) {
  const grammar = [];
  const expressions = [];
  const seenGrammar = new Set();
  const seenExpression = new Set();

  for (const skillData of skillDataList) {
    const sourceFile = skillData?.__source || '<inline>';
    for (const g of Array.isArray(skillData?.grammar) ? skillData.grammar : []) {
      if (seenGrammar.has(g.id)) {
        throw new Error(`duplicate grammar id ${g.id} (in ${sourceFile})`);
      }
      seenGrammar.add(g.id);
      grammar.push({
        ...g,
        linkedVerseIds: Array.isArray(g.linkedVerseIds) ? g.linkedVerseIds : []
      });
    }
    for (const e of Array.isArray(skillData?.expressions) ? skillData.expressions : []) {
      if (seenExpression.has(e.id)) {
        throw new Error(`duplicate expression id ${e.id} (in ${sourceFile})`);
      }
      seenExpression.add(e.id);
      expressions.push({
        ...e,
        linkedVerseIds: Array.isArray(e.linkedVerseIds) ? e.linkedVerseIds : []
      });
    }
  }

  return { grammar, expressions };
}

export function buildDefaultBundleFromSources({ bibleData, vocabData, skillDataList, chapters, vocabPerLevel, title, version = 1 }) {
  const verses = buildVersesFromBible(bibleData, chapters);
  const vocabulary = buildVocabularyFromOpenRussian(vocabData, vocabPerLevel);
  const { grammar, expressions } = buildSkillsFromContents(skillDataList);
  const buildAt = new Date().toISOString();
  const content = {
    version,
    title,
    buildAt,
    sources: [...CLI_DEFAULTS.skills],
    verses,
    vocabulary,
    grammar,
    expressions
  };
  const contentHash = hashContent(content);
  return {
    content,
    meta: { version, title, buildAt, contentHash, sources: content.sources }
  };
}

function serializeBundle(bundle) {
  return `export const DEFAULT_CONTENT = ${JSON.stringify(bundle, null, 2)};\n`;
}

function serializeMeta(meta) {
  return `export const DEFAULT_CONTENT_META = ${JSON.stringify(meta, null, 2)};\n`;
}

function hashContent(payload) {
  const serialized = JSON.stringify({
    verses: payload.verses ?? [],
    vocabulary: payload.vocabulary ?? [],
    grammar: payload.grammar ?? [],
    expressions: payload.expressions ?? []
  });
  return createHash('sha256').update(serialized).digest('hex').slice(0, 16);
}

function parseArgs(argv) {
  const args = { ...CLI_DEFAULTS, skills: [...CLI_DEFAULTS.skills] };
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
        args.skills.push(next);
        i += 1;
        break;
      case 'output':
      case 'output-content':
        if (!hasNext) throw new Error('--output-content requires a value');
        args.outputContent = next;
        i += 1;
        break;
      case 'output-meta':
        if (!hasNext) throw new Error('--output-meta requires a value');
        args.outputMeta = next;
        i += 1;
        break;
      case 'version':
        if (!hasNext) throw new Error('--version requires a number');
        args.version = Number(next);
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
      '--skill path           Source skill content JSON (repeatable; default: A1 + A2 files)',
      '--output-content path  Output content JS (default: src/default-bundle.js)',
      '--output-meta path     Output meta JS (default: src/default-bundle-meta.js)',
      '--version n            Bundle version (default: 1)',
      '--chapters n           Chapter count from start (default: all)',
      '--vocab-per-level n    Top items per level (default: all)',
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
  if (args.chapters !== undefined && (!Number.isFinite(args.chapters) || args.chapters < 0)) {
    throw new Error('--chapters must be a non-negative number');
  }
  if (args.vocabPerLevel !== undefined && (!Number.isFinite(args.vocabPerLevel) || args.vocabPerLevel < 0)) {
    throw new Error('--vocab-per-level must be a non-negative number');
  }
  if (!Array.isArray(args.skills) || args.skills.length === 0) {
    throw new Error('at least one --skill file is required');
  }

  const bible = JSON.parse(await fs.readFile(path.resolve(projectDir, args.bible), 'utf8'));
  const vocab = JSON.parse(await fs.readFile(path.resolve(projectDir, args.vocab), 'utf8'));
  const skillDataList = await Promise.all(
    args.skills.map(async (file) => {
      const parsed = JSON.parse(await fs.readFile(path.resolve(projectDir, file), 'utf8'));
      return { ...parsed, __source: file };
    })
  );

  const built = buildDefaultBundleFromSources({
    bibleData: bible,
    vocabData: vocab,
    skillDataList,
    chapters: args.chapters,
    vocabPerLevel: args.vocabPerLevel,
    title: args.title,
    version: args.version
  });
  const { content, meta } = built;

  const outputContent = path.resolve(projectDir, args.outputContent);
  const outputMeta = path.resolve(projectDir, args.outputMeta);
  await fs.mkdir(path.dirname(outputContent), { recursive: true });
  await fs.mkdir(path.dirname(outputMeta), { recursive: true });
  await fs.writeFile(outputContent, serializeBundle(content));
  await fs.writeFile(outputMeta, serializeMeta(meta));
  process.stdout.write(
    `Wrote ${outputContent} + ${outputMeta} (verses=${content.verses.length}, vocabulary=${content.vocabulary.length}, grammar=${content.grammar.length}, expressions=${content.expressions.length}, version=${content.version}, hash=${meta.contentHash})\n`
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runCli();
}
