import { jikan, type BrowseFilters } from '@/lib/api/jikan'
import type { Anime } from '@/types'

export interface AppFilters {
  q?: string
  genres: number[]
  excludeGenres: number[]
  type: string
  season: string
  year: number | ''
  status: string
  minScore: number
  sortBy: string
  sortDir: 'asc' | 'desc'
}

export function filtersToJikanParams(f: AppFilters): BrowseFilters {
  return {
    order_by: f.sortBy,
    sort: f.sortDir,
    sfw: true,
    min_score: f.minScore || undefined,
    genres: f.genres.length ? f.genres.join(',') : undefined,
    genres_exclude: f.excludeGenres.length ? f.excludeGenres.join(',') : undefined,
    type: f.type || undefined,
    status: f.status || undefined,
    q: f.q || undefined,
  }
}

/** Does the user have any narrowing filter beyond defaults? */
export function hasNarrowingFilters(f: AppFilters): boolean {
  return Boolean(
    f.q ||
      f.genres.length ||
      f.excludeGenres.length ||
      f.type ||
      f.season ||
      f.year ||
      f.status ||
      f.minScore > 0,
  )
}

/** Apply genre/type/status/score constraints client-side (for season results). */
function postFilter(items: Anime[], f: AppFilters): Anime[] {
  const include = new Set(f.genres)
  const exclude = new Set(f.excludeGenres)
  return items.filter((a) => {
    if (f.type && a.type && a.type.toLowerCase() !== f.type.toLowerCase()) return false
    if (f.status) {
      const s = (a.status || '').toLowerCase()
      if (f.status === 'airing' && !a.airing) return false
      if (f.status === 'complete' && !s.includes('finished')) return false
      if (f.status === 'upcoming' && !s.includes('upcoming')) return false
    }
    if (f.minScore > 0 && (a.score || 0) < f.minScore) return false
    const ids = new Set((a.genres || []).map((g) => g.mal_id))
    for (const e of exclude) if (ids.has(e)) return false
    if (include.size) {
      let hit = false
      for (const i of include) if (ids.has(i)) hit = true
      if (!hit) return false
    }
    return true
  })
}

export interface FilteredResult {
  data: Anime[]
  hasNext: boolean
}

/**
 * Resolve filtered results.
 * - No narrowing filters -> reliable `topAnime` endpoint (the `/anime` search
 *   endpoint is chronically slow / 504s on heavy full-catalog queries).
 * - season + year -> dedicated season endpoint (client-filtered by other
 *   constraints, since the season endpoint ignores query params).
 * - otherwise -> search endpoint (supports all filters + pagination).
 * Falls back to top/popular anime if the search endpoint is unavailable.
 */
export async function fetchFiltered(
  f: AppFilters,
  page: number,
  signal?: AbortSignal,
): Promise<FilteredResult> {
  // Season endpoint path.
  if (f.season && f.year) {
    try {
      const res = await jikan.season(Number(f.year), f.season, signal)
      const filtered = postFilter(res.data, f)
      return { data: filtered, hasNext: false }
    } catch {
      // fall through to search fallback
    }
  }

  // No filters -> reliable catalog endpoints, skip the flaky search entirely.
  if (!hasNarrowingFilters(f)) {
    try {
      const res = await jikan.topAnime('bypopularity', Math.max(1, page), 24, signal)
      return { data: res.data, hasNext: res.pagination?.has_next_page ?? false }
    } catch {
      // fall through
    }
  }

  try {
    const res = await jikan.search({ ...filtersToJikanParams(f), page }, signal)
    if (res.data.length || hasNarrowingFilters(f)) {
      return { data: res.data, hasNext: res.pagination?.has_next_page ?? false }
    }
  } catch {
    // fall through to catalog fallback
  }

  // Fallback when search is unavailable and no narrowing filter is set.
  const fallback = await jikan.topAnime('bypopularity', Math.max(1, page), 24, signal)
  return { data: fallback.data, hasNext: fallback.pagination?.has_next_page ?? false }
}
