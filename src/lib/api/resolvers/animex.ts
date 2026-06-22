import { proxiedFetch, COMMON_HEADERS } from '@/lib/api/proxy'
import {
  bestMatch,
  makeTTLCache,
  normalizeTitle,
  tokenSimilarity,
} from '@/lib/api/matching'
import type { VideoSource } from '@/types'

const SEARCH_ENDPOINT = 'https://graphql.animex.one/graphql'
const SERVERS_ENDPOINT = 'https://pp.animex.one/rest/api/servers'
const SOURCES_ENDPOINT = 'https://pp.animex.one/rest/api/sources'

const queryCache = makeTTLCache<{ animeId: string; title: string }>(3 * 3600_000)

const SEARCH_QUERY = `
query FastSearch($query: String, $limit: Int, $includeAdult: Boolean) {
  catalogAnime(filter: { query: $query, includeAdult: $includeAdult }, limit: $limit) {
    items {
      id
      malId
      titleRomaji
      titleEnglish
      coverImage
      format
      status
      episodeCount
      seasonYear
      season
      genres
    }
  }
}`

interface CatalogItem {
  id: string
  malId?: number
  titleRomaji?: string
  titleEnglish?: string
  episodeCount?: number
}

function jsonHeaders() {
  return {
    ...COMMON_HEADERS,
    'content-type': 'application/json',
    origin: 'https://animex.one',
  }
}

async function searchAnime(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogItem[]> {
  const body = JSON.stringify({
    query: SEARCH_QUERY,
    variables: { query, limit: 20, includeAdult: false },
  })
  const { data } = await proxiedFetch<{
    data?: { catalogAnime?: { items?: CatalogItem[] } }
  }>(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: jsonHeaders(),
    body,
    signal,
  })
  return data?.data?.catalogAnime?.items || []
}

interface ProviderEntry {
  id: string
  tip?: string
  default?: boolean
}

async function getProviders(
  animeId: string,
  episode: number,
  signal?: AbortSignal,
): Promise<{ sub: ProviderEntry[]; dub: ProviderEntry[] }> {
  const url = `${SERVERS_ENDPOINT}?id=${encodeURIComponent(animeId)}&epNum=${episode}`
  const { data } = await proxiedFetch<{
    subProviders?: ProviderEntry[]
    dubProviders?: ProviderEntry[]
  }>(url, { method: 'GET', headers: jsonHeaders(), signal })
  const sub = (data.subProviders || []).filter((p) => /hard\s*sub/i.test(p.tip || ''))
  const dub = data.dubProviders || []
  return { sub, dub }
}

interface RawSource {
  url?: string
  quality?: string
  type?: string
}

async function getSources(
  animeId: string,
  episode: number,
  type: 'sub' | 'dub',
  providerId: string,
  signal?: AbortSignal,
): Promise<RawSource[]> {
  const url = `${SOURCES_ENDPOINT}?id=${encodeURIComponent(animeId)}&epNum=${episode}&type=${type}&providerId=${encodeURIComponent(providerId)}`
  const { data } = await proxiedFetch<{ sources?: RawSource[] }>(url, {
    method: 'GET',
    headers: jsonHeaders(),
    signal,
  })
  return data.sources || []
}

export async function resolveAnimex(
  titles: string[],
  episode: number,
  signal?: AbortSignal,
  malId?: number,
): Promise<VideoSource[]> {
  const query = titles.find(Boolean) || ''
  if (!query && !malId) return []
  const cacheKey = malId ? `mal:${malId}` : normalizeTitle(query)
  const cached = queryCache.get(cacheKey)
  let animeId = cached?.animeId

  if (!animeId) {
    const items = await searchAnime(query, signal)
    if (!items.length) return []
    // Animex items carry the same malId as Jikan/MAL — exact match first
    // (most reliable), then fall back to fuzzy title matching.
    let chosen: CatalogItem | undefined
    if (malId) chosen = items.find((i) => Number(i.malId) === malId)
    if (!chosen) {
      const result = bestMatch(
        items,
        (i) => [i.titleEnglish || '', i.titleRomaji || ''],
        titles,
        tokenSimilarity,
        0.5,
      )
      chosen = result?.item || items[0]
    }
    animeId = chosen?.id
    if (animeId)
      queryCache.set(cacheKey, {
        animeId,
        title: chosen?.titleEnglish || chosen?.titleRomaji || query,
      })
  }
  if (!animeId) return []

  const { sub, dub } = await getProviders(animeId, episode, signal)

  // Animex offers many servers (mimi, lunafly, ...) — sub providers carry a
  // `tip`; "Hard sub" ones are preferred for sub audio. Aggregate sources from
  // every provider (sub hard-sub first, then dub) so the user can pick, instead
  // of stopping at the first.
  const ordered = [
    ...sub.slice(0, 6), // hard-sub sub providers
    ...dub.slice(0, 4), // dub providers
  ]

  const lang = (p: ProviderEntry): 'sub' | 'dub' =>
    dub.some((d) => d.id === p.id) ? 'dub' : 'sub'

  const perProvider = await Promise.all(
    ordered.map(async (provider) => {
      try {
        const sources = await getSources(
          animeId!,
          episode,
          lang(provider),
          provider.id,
          signal,
        )
        return sources
          .filter((s) => !!s.url)
          .map<VideoSource>((s) => {
            const isHls = /\.m3u8(\?|$)/i.test(s.url!)
            return {
              provider: 'animex',
              label: `Animex ${provider.id} ${lang(provider).toUpperCase()}`,
              quality:
                (s.quality || (isHls ? 'auto' : '720p')).replace(/[^\dpk]/gi, '') ||
                '720p',
              url: s.url!,
              embed: false,
              headers: {
                referer: 'https://animex.one/',
                origin: 'https://animex.one',
              },
            }
          })
      } catch {
        return [] as VideoSource[]
      }
    }),
  )

  // De-dup by URL, prefer sub providers first (they're earlier in `ordered`).
  const seen = new Set<string>()
  return perProvider.flat().filter((s) => {
    if (seen.has(s.url)) return false
    seen.add(s.url)
    return true
  })
}
