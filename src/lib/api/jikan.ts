import { JIKAN_BASE } from '@/lib/constants'
import { createRateLimiter } from '@/lib/utils'
import type { Anime, Paginated } from '@/types'

// Jikan free tier: ~3 req/s sustained, 60 req/min. We serialize all requests
// through a single queue (spacing starts by ~400ms) and add a short-lived
// in-memory cache so navigation never re-hits the API for the same data.
const limit = createRateLimiter(400)
const MAX_RETRIES = 3 // keep failover fast — retries here delay app fallbacks
const CACHE_TTL = 5 * 60 * 1000
const cache = new Map<string, { at: number; value: unknown }>()
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function jikanFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.value as T
  }

  return limit(async () => {
    let lastErr: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      let res: Response
      try {
        res = await fetch(`${JIKAN_BASE}${path}`, {
          signal,
          headers: { Accept: 'application/json' },
        })
      } catch (e) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        lastErr = e
        await sleep(600 * (attempt + 1))
        continue
      }

      // 429 / 5xx — back off and retry (serialized by queue). 5xx (504 gateway)
      // means the upstream is down; cap retries low + short backoff so the app's
      // fallback endpoints engage quickly instead of hanging.
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('Retry-After') || '')
        const backoff = retryAfter ? retryAfter * 1000 : 600 * (attempt + 1)
        await sleep(Math.min(backoff, 2000))
        lastErr = new Error(`Jikan ${res.status}`)
        continue
      }

      if (!res.ok) throw new Error(`Jikan ${res.status}`)

      const body = (await res.json()) as T & { status?: number }
      // Some upstream proxies return 200 with an error envelope — treat 5xx /
      // 429 envelopes as retryable (transient MAL/Jikan gateway errors).
      if (typeof body?.status === 'number' && (body.status === 429 || body.status >= 500)) {
        await sleep(600 * (attempt + 1))
        lastErr = new Error(`Jikan envelope ${body.status}`)
        continue
      }
      cache.set(path, { at: Date.now(), value: body })
      return body
    }
    throw lastErr instanceof Error ? lastErr : new Error('Jikan request failed')
  })
}

/** Clear the in-memory cache (e.g. after pull-to-refresh). */
export function clearJikanCache() {
  cache.clear()
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface BrowseFilters {
  q?: string
  type?: string
  genres?: string // comma separated ids
  genres_exclude?: string
  order_by?: string
  sort?: 'asc' | 'desc'
  status?: string
  season?: string
  sfw?: boolean
  min_score?: number
  max_score?: number
  start_date?: string
  end_date?: string
  page?: number
  limit?: number
  letter?: string
  producers?: number
}

export const jikan = {
  topAnime(
    filter: 'airing' | 'upcoming' | 'bypopularity' | 'favorite' | undefined = 'bypopularity',
    page = 1,
    limit = 24,
    signal?: AbortSignal,
  ): Promise<Paginated<Anime>> {
    return jikanFetch(`/top/anime${qs({ filter, page, limit })}`, signal)
  },

  seasonNow(signal?: AbortSignal): Promise<Paginated<Anime>> {
    return jikanFetch(`/seasons/now${qs({ limit: 24 })}`, signal)
  },

  season(year: number, season: string, signal?: AbortSignal): Promise<Paginated<Anime>> {
    return jikanFetch(`/seasons/${year}/${season}${qs({ limit: 24 })}`, signal)
  },

  /** Currently airing schedule, optionally filtered by weekday (monday…sunday). */
  schedules(day?: string, page = 1, limit = 25, signal?: AbortSignal): Promise<Paginated<Anime>> {
    return jikanFetch(
      `/schedules${qs({ filter: day, page, limit, sfw: true })}`,
      signal,
    )
  },

  seasonsList(signal?: AbortSignal): Promise<Paginated<{ year: number; seasons: string[] }>> {
    return jikanFetch(`/seasons`, signal)
  },

  search(filters: BrowseFilters, signal?: AbortSignal): Promise<Paginated<Anime>> {
    const { limit = 24, ...rest } = filters
    return jikanFetch(`/anime${qs({ limit, ...rest })}`, signal)
  },

  byId(id: number, signal?: AbortSignal): Promise<Anime> {
    // Note: `/anime/{id}/full` returns `data` as a SINGLE object, not an array.
    return jikanFetch(`/anime/${id}/full`, signal) as Promise<Anime>
  },

  /**
   * Resilient detail fetch: tries `/full` first (richer data) and falls back
   * to the plain `/anime/{id}` endpoint when `/full` errors. Both return
   * `data` as a single object.
   */
  async byIdSafe(id: number, signal?: AbortSignal): Promise<Anime | null> {
    try {
      const full = (await jikanFetch<{ data: Anime }>(`/anime/${id}/full`, signal)) as {
        data?: Anime
      }
      if (full?.data?.mal_id) return full.data
    } catch {
      // fall through to the plain endpoint
    }
    try {
      const plain = (await jikanFetch<{ data: Anime }>(`/anime/${id}`, signal)) as {
        data?: Anime
      }
      return plain?.data ?? null
    } catch {
      return null
    }
  },

  recommendations(id: number, signal?: AbortSignal): Promise<
    Paginated<{ entry: Anime; mal_id: number }>
  > {
    return jikanFetch(`/anime/${id}/recommendations`, signal)
  },

  relations(id: number, signal?: AbortSignal): Promise<Paginated<unknown>> {
    return jikanFetch(`/anime/${id}/relations`, signal)
  },

  episodes(id: number, page = 1, signal?: AbortSignal): Promise<
    Paginated<{
      mal_id: number
      title: string
      aired: string | null
      filler: boolean
      recap: boolean
    }>
  > {
    return jikanFetch(`/anime/${id}/episodes${qs({ page })}`, signal)
  },

  random(signal?: AbortSignal): Promise<Anime> {
    return jikanFetch(`/random/anime`, signal) as Promise<Anime>
  },

  genres(signal?: AbortSignal): Promise<Paginated<{ mal_id: number; name: string; count: number }>> {
    return jikanFetch(`/genres/anime${qs({ order_by: 'count', sort: 'desc' })}`, signal)
  },
}
