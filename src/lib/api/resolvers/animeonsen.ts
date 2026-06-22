import { proxiedFetch, COMMON_HEADERS } from '@/lib/api/proxy'
import {
  bestMatch,
  bigramSimilarity,
  makeTTLCache,
  normalizeTitle,
} from '@/lib/api/matching'
import type { VideoSource } from '@/types'

const SEARCH_ENDPOINT = 'https://search.animeonsen.xyz/indexes/content/search'
// AnimeOnsen search bearer — public-ish token sourced from the provider's
// web client. Provide via VITE_ANIMEONSEN_SEARCH_TOKEN (see .env.example) so
// the value is never committed. The video bearer is derived dynamically
// server-side in the relay (shared/animeonsen-relay.ts).
const SEARCH_BEARER = import.meta.env.VITE_ANIMEONSEN_SEARCH_TOKEN
  ? `Bearer ${import.meta.env.VITE_ANIMEONSEN_SEARCH_TOKEN}`
  : ''

const queryCache = makeTTLCache<{ contentId: string; title: string }>(3 * 3600_000)
const episodeCache = makeTTLCache<{ stream: string; subtitles?: string }>(3 * 3600_000)

interface Hit {
  content_id?: string
  content_title?: string
  content_title_en?: string
  content_title_jp?: string
}

async function searchContent(
  query: string,
  signal?: AbortSignal,
): Promise<Hit[]> {
  const body = JSON.stringify({
    q: query,
    attributesToHighlight: ['*'],
    highlightPreTag: '__ais-highlight__',
    highlightPostTag: '__/ais-highlight__',
    limit: 20,
  })
  const { data } = await proxiedFetch<{ hits?: Hit[] }>(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'content-type': 'application/json',
      authorization: SEARCH_BEARER,
      origin: 'https://www.animeonsen.xyz',
      referer: 'https://www.animeonsen.xyz/',
    },
    body,
    signal,
  })
  return data.hits || []
}

async function resolveStream(
  contentId: string,
  episode: number,
  signal?: AbortSignal,
): Promise<{ stream: string; subtitles?: string } | null> {
  // Token refresh + video fetch happen server-side in the relay (it needs
  // cross-origin set-cookie access to decode the dynamic bearer token).
  try {
    const res = await fetch(
      `/api/animeonsen?id=${encodeURIComponent(contentId)}&ep=${episode}`,
      { signal },
    )
    if (!res.ok) return null
    const body = (await res.json()) as { stream?: string; subtitles?: string }
    if (!body.stream) return null
    return { stream: body.stream, subtitles: body.subtitles }
  } catch {
    return null
  }
}

export async function resolveAnimeOnsen(
  titles: string[],
  episode: number,
  signal?: AbortSignal,
): Promise<VideoSource[]> {
  const query = titles.find(Boolean) || ''
  if (!query) return []
  // AnimeOnsen search requires a bearer token (set via env). Without it the
  // provider is skipped gracefully.
  if (!SEARCH_BEARER) return []
  const cacheKey = normalizeTitle(query)
  const cached = queryCache.get(cacheKey)
  let contentId = cached?.contentId
  let matchedTitle = cached?.title

  if (!contentId) {
    const hits = await searchContent(query, signal)
    if (!hits.length) return []
    const result = bestMatch(
      hits,
      (h) => [
        h.content_title_en || '',
        h.content_title || '',
        h.content_title_jp || '',
      ],
      titles,
      bigramSimilarity,
      0.45,
    )
    const chosen = result?.item || hits[0]
    contentId = chosen.content_id
    matchedTitle = chosen.content_title_en || chosen.content_title || query
    if (contentId) queryCache.set(cacheKey, { contentId, title: matchedTitle })
  }

  if (!contentId) return []
  const epKey = `${contentId}:${episode}`
  const epCached = episodeCache.get(epKey)
  const resolved = epCached ?? (await resolveStream(contentId, episode, signal))
  if (!resolved) return []
  if (!epCached) episodeCache.set(epKey, resolved)

  return [
    {
      provider: 'animeonsen',
      label: 'AnimeOnsen',
      quality: '1080p',
      url: resolved.stream,
      embed: false,
      headers: {
        referer: 'https://www.animeonsen.xyz/',
        origin: 'https://www.animeonsen.xyz',
      },
    },
  ]
}
