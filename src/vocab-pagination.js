export const DEFAULT_VOCAB_PAGE_SIZE = 100;

export function paginate({ total, pageSize, page }) {
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || DEFAULT_VOCAB_PAGE_SIZE));
  const totalPages = Math.max(0, Math.ceil(total / safePageSize));

  if (total <= 0) {
    return {
      page: 0,
      pageSize: safePageSize,
      total,
      totalPages: 0,
      startIndex: 0,
      endIndex: 0,
      hasNext: false,
      hasPrev: false
    };
  }

  const requested = Number(page);
  const safePage = Number.isFinite(requested) && requested > 0 ? Math.floor(requested) : 1;
  const finalPage = safePage > totalPages ? totalPages : safePage;

  const startIndex = (finalPage - 1) * safePageSize;
  const endIndex = Math.min(total, startIndex + safePageSize);

  return {
    page: finalPage,
    pageSize: safePageSize,
    total,
    totalPages,
    startIndex,
    endIndex,
    hasNext: finalPage < totalPages,
    hasPrev: finalPage > 1
  };
}

export function sliceVocabularyPage(items, { page, pageSize = DEFAULT_VOCAB_PAGE_SIZE } = {}) {
  const list = Array.isArray(items) ? items : [];
  const layout = paginate({ total: list.length, pageSize, page });
  if (layout.totalPages === 0) return [];
  return list.slice(layout.startIndex, layout.endIndex);
}
