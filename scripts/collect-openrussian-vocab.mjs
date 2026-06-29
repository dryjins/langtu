const fs = await import('node:fs/promises');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const PAGE_SIZE = 50;
const TARGET_URL = 'https://en.openrussian.org/list/all';

async function fetchPage(level, start) {
  const url = `${TARGET_URL}?level=${level}&start=${start}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Unable to extract next data from ${url}`);
  }

  const data = JSON.parse(match[1]);
  const entries = data?.props?.pageProps?.entries;
  if (!Array.isArray(entries)) {
    throw new Error(`No entries on page for ${url}`);
  }

  return {
    total: data.props.pageProps.total,
    entries,
  };
}

async function fetchLevel(level) {
  const collected = [];
  let start = 0;
  let total = 0;

  for (;;) {
    const { total: pageTotal, entries } = await fetchPage(level, start);
    if (!total) {
      total = pageTotal;
    }

    collected.push(...entries);

    if (collected.length >= total || entries.length < PAGE_SIZE) {
      break;
    }

    start += PAGE_SIZE;
  }

  return {
    level,
    total,
    collected,
  };
}

async function main() {
  const collected = {};
  const summary = {};

  for (const level of LEVELS) {
    const payload = await fetchLevel(level);
    collected[level] = payload.collected;
    summary[level] = payload.total;
  }

  const output = {
    source: 'en.openrussian.org/list/all',
    levels: LEVELS,
    collectedAt: new Date().toISOString(),
    summary,
    itemsByLevel: collected,
  };

  process.stdout.write(JSON.stringify(output, null, 2));

  return output;
}

await main();
