/** Shared title-matching helpers for provider resolvers. */

export function normalizeTitle(t: string): string {
  try {
    return t
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return t.toLowerCase().trim()
  }
}

export function toSlug(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const STOPWORDS = new Set([
  'the', 'of', 'and', 'a', 'an', 'season', 'part', 'movie', 'tv', 'ii', 'iii',
])

export function tokens(t: string): string[] {
  return normalizeTitle(t)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
}

/** Token-overlap (Jaccard) similarity, 0..1. */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  return inter / (ta.size + tb.size - inter)
}

/** Bigram Dice similarity, 0..1 — used by AnimeOnsen. */
export function bigramSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a).replace(/\s+/g, '')
  const nb = normalizeTitle(b).replace(/\s+/g, '')
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return na === nb ? 1 : 0
  const bigrams = new Set<string>()
  for (let i = 0; i < na.length - 1; i++) bigrams.add(na.slice(i, i + 2))
  let inter = 0
  let totalB = 0
  for (let i = 0; i < nb.length - 1; i++) {
    totalB++
    if (bigrams.has(nb.slice(i, i + 2))) inter++
  }
  const totalA = na.length - 1
  return (2 * inter) / (totalA + totalB)
}

/** Pick the best candidate by max similarity against any of the provided titles. */
export function bestMatch<T>(
  candidates: T[],
  getTitles: (c: T) => string[],
  queryTitles: string[],
  similarity: (a: string, b: string) => number,
  threshold: number,
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null
  for (const c of candidates) {
    const cTitles = getTitles(c)
    let score = 0
    for (const q of queryTitles) {
      for (const ct of cTitles) {
        score = Math.max(score, similarity(q, ct))
        if (normalizeTitle(q) === normalizeTitle(ct)) score = Math.max(score, 1)
      }
    }
    if (!best || score > best.score) best = { item: c, score }
  }
  if (best && best.score >= threshold) return best
  return best
}

/** Simple TTL cache. */
export function makeTTLCache<T>(ttlMs: number) {
  const map = new Map<string, { value: T; at: number }>()
  return {
    get(key: string): T | undefined {
      const e = map.get(key)
      if (!e) return undefined
      if (Date.now() - e.at > ttlMs) {
        map.delete(key)
        return undefined
      }
      return e.value
    },
    set(key: string, value: T) {
      map.set(key, { value, at: Date.now() })
    },
    clear() {
      map.clear()
    },
  }
}
