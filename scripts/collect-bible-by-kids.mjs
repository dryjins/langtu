const fs = await import('node:fs/promises');

const BASE_URL = 'https://bible.by';
const BOOK_ID = 3;
const BOOK_PATH = `/kids/book/${BOOK_ID}/`;
const AUDIO_PATH = `/kids/audio/${BOOK_ID}/`;
const OUTPUT_PATH = process.argv[2] ?? null;

const COPYRIGHT_METADATA = {
  holder: 'Библейская миссия',
  statement: 'Публикуется с разрешения: «Библейская миссия». © 2022',
  sourceUrl: 'https://bible.by',
  sourceTitle: 'Библейские истории для детей'
};

const NOISE_PATTERNS = [
  /^ТГ /,
  /^Поддержать/,
  /^Дорогие родители!$/,
  /^Публикуется с разрешения:/,
  /^Важно!/, 
  /^Поиск выполняется по/, 
  /Симфония — это список слов/, 
  /Android \/ iOS/,
  /©/, 
  /С любовью и молитвой о вас/, 
  /Библейская миссия/
];

const STOP_PATTERNS = [
  /^Вопросы:/,
  /^Следующая глава:/,
  /^Предыдущая глава:/
];

function normalizeText(value) {
  return value
    .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, (match) => decodeNumericEntity(match))
    .replace(/&[#x][0-9a-fA-F]+;/g, (match) => decodeNumericEntity(match))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeNumericEntity(entity) {
  const match = entity.match(/&#(x?)([0-9a-fA-F]+);/);
  if (!match) return entity;

  const value = match[1] === 'x' ? parseInt(match[2], 16) : parseInt(match[2], 10);
  if (Number.isNaN(value)) return entity;

  return String.fromCodePoint(value);
}

function isNoiseLine(line) {
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

function isStopLine(line) {
  return STOP_PATTERNS.some((pattern) => pattern.test(line));
}

function looksLikeContentLine(line) {
  return /[\u0400-\u04ff]/.test(line) && /[\.!\?]/.test(line) && line.length > 20;
}

function extractTextLines(html) {
  return [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((match) => normalizeText(match[1]))
    .filter(Boolean)
    .map((line) => line.trim());
}

function extractChaptersFromIndex(html) {
  const links = [...html.matchAll(/href="\/kids\/book\/3\/(\d+)\/">([^<]+)<\/a>/g)];
  const chapters = links.map((match) => ({
    num: Number(match[1]),
    titleText: match[2].trim(),
    url: `${BASE_URL}/kids/book/${BOOK_ID}/${match[1]}/`
  }));

  return chapters
    .filter((chapter) => Number.isInteger(chapter.num))
    .sort((a, b) => a.num - b.num);
}

function extractTracks(html) {
  const match = html.match(/const\s+tracks\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error(`Could not locate tracks definition in ${BASE_URL}${AUDIO_PATH}`);
  }

  return JSON.parse(match[1]).reduce((acc, track) => {
    if (track?.num != null) {
      acc[String(track.num)] = {
        title: String(track.title ?? '').trim(),
        src: String(track.src ?? '').trim()
      };
    }
    return acc;
  }, {});
}

function extractBodyLines(lines) {
  const body = [];
  let started = false;

  for (const line of lines) {
    if (isStopLine(line)) {
      break;
    }

    if (isNoiseLine(line)) {
      continue;
    }

    if (!started) {
      if (looksLikeContentLine(line)) {
        started = true;
        body.push(line);
      }
      continue;
    }

    body.push(line);
  }

  return body;
}

async function fetchHtml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function buildBibleDataset() {
  const indexHtml = await fetchHtml(`${BASE_URL}${BOOK_PATH}`);
  const audioHtml = await fetchHtml(`${BASE_URL}${AUDIO_PATH}`);
  const chapters = extractChaptersFromIndex(indexHtml);
  const tracks = extractTracks(audioHtml);

  const collected = [];

  for (const chapter of chapters) {
    const html = await fetchHtml(chapter.url);
    const rawLines = extractTextLines(html);
    const bodyLines = extractBodyLines(rawLines);
    const titleFromHeading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);

    collected.push({
      chapter: chapter.num,
      titleText: chapter.titleText,
      title: titleFromHeading ? normalizeText(titleFromHeading[1]).replace(/^\d+\.\s*/, '') : chapter.titleText,
      textLines: bodyLines,
      reference: `Библейские истории глава ${chapter.num}`,
      sourceUrl: chapter.url,
      audio: tracks[String(chapter.num)]?.src ?? null,
      image: `https://bible.by/data/kids/image/03/in_text/${String(chapter.num).padStart(2, '0')}.jpg`,
      copyright: COPYRIGHT_METADATA
    });
  }

  return {
    source: `${BASE_URL}${BOOK_PATH}`,
    copyright: COPYRIGHT_METADATA,
    collectedAt: new Date().toISOString(),
    bookId: BOOK_ID,
    chapterCount: collected.length,
    chapters: collected
  };
}

const payload = await buildBibleDataset();

if (OUTPUT_PATH) {
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  process.stdout.write(`Saved ${payload.chapterCount} chapters to ${OUTPUT_PATH}\n`);
} else {
  process.stdout.write(JSON.stringify(payload, null, 2));
}
