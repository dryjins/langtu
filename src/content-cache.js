function assertValidContent(content) {
  if (!content || typeof content !== 'object') {
    throw new Error('content bundle must be an object');
  }
  if (!Array.isArray(content.verses)) {
    throw new Error('content bundle must include verses array');
  }
  if (!Array.isArray(content.vocabulary)) {
    throw new Error('content bundle must include vocabulary array');
  }
  if (!Array.isArray(content.grammar)) {
    throw new Error('content bundle must include grammar array');
  }
  if (!Array.isArray(content.expressions)) {
    throw new Error('content bundle must include expressions array');
  }
}

export function prepareContentCache(meta, content) {
  assertValidContent(content);

  const version = Number(meta?.version ?? content.version);
  if (!Number.isFinite(version)) {
    throw new Error('meta.version is required');
  }

  const base = {
    version,
    buildAt: meta?.buildAt ?? content.buildAt ?? null,
    title: meta?.title ?? content.title ?? null,
    copyright: meta?.copyright ?? content.copyright ?? null,
    sources: Array.isArray(meta?.sources) ? meta.sources : [],
    contentHash: typeof meta?.contentHash === 'string' && meta.contentHash.length > 0
      ? meta.contentHash
      : null
  };

  const payload = {
    ...base,
    verses: content.verses,
    vocabulary: content.vocabulary,
    grammar: content.grammar,
    expressions: content.expressions
  };

  return {
    meta: base,
    payload,
    contentHash: base.contentHash
  };
}

export async function resolveStoredContent(backend) {
  if (!backend || typeof backend !== 'object') return null;
  const loader = typeof backend.load === 'function'
    ? backend.load
    : (typeof backend.loadContentBundle === 'function' ? backend.loadContentBundle : null);
  if (!loader) return null;
  const stored = await loader();
  if (!stored || !Array.isArray(stored.verses)) return null;
  return stored;
}

function isFresh(stored, meta) {
  if (!stored) return false;
  const storedVersion = Number(stored.version);
  const metaVersion = Number(meta.version);
  if (!Number.isFinite(storedVersion) || !Number.isFinite(metaVersion)) return false;
  return storedVersion === metaVersion && stored.contentHash === meta.contentHash;
}

export async function ensureContentCached({ backend, meta, content }) {
  const prepared = prepareContentCache(meta, content);
  if (!prepared.contentHash) {
    throw new Error('meta.contentHash is required to compare with stored cache');
  }
  const stored = await resolveStoredContent(backend);
  const fresh = isFresh(stored, prepared.meta);

  if (!fresh) {
    const saver = typeof backend.save === 'function'
      ? backend.save
      : (typeof backend.saveContentBundle === 'function' ? backend.saveContentBundle : null);
    if (!saver) {
      throw new Error('storage backend must implement save or saveContentBundle');
    }
    await saver({
      id: 'current',
      ...prepared.payload,
      contentHash: prepared.contentHash,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    installed: !fresh,
    content: prepared.payload,
    contentHash: prepared.contentHash,
    meta: prepared.meta
  };
}
