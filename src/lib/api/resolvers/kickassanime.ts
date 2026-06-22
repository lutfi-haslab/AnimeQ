import { proxiedFetch, COMMON_HEADERS } from '@/lib/api/proxy'
import {
  bestMatch,
  makeTTLCache,
  normalizeTitle,
  toSlug,
  tokenSimilarity,
} from '@/lib/api/matching'
import type { VideoSource } from '@/types'

const SEARCH_ENDPOINT = 'https://kaa.lt/api/search'
const EPISODES_ENDPOINT = 'https://kaa.lt/api/show'

const queryCache = makeTTLCache<{ slug: string; title: string }>(3 * 3600_000)
const epCache = makeTTLCache<string>(3 * 3600_000)

function searchHeaders(query: string) {
  return {
    ...COMMON_HEADERS,
    'content-type': 'application/json',
    origin: 'https://kaa.lt',
    referer: `https://kaa.lt/search?q=${encodeURIComponent(query)}`,
    'x-origin': 'kaa.lt',
  }
}

interface RawCandidate {
  title?: string
  name?: string
  en_title?: string
  english_title?: string
  romaji?: string
  anime_title?: string
  slug?: string
  anime_slug?: string
  url?: string
  link?: string
  href?: string
  id?: string | number
  [k: string]: unknown
}

/** Recursively flatten any nested arrays/objects into a flat candidate list. */
function flattenObjects(node: unknown, depth = 0, acc: RawCandidate[] = []): RawCandidate[] {
  if (depth > 4) return acc
  if (Array.isArray(node)) {
    for (const n of node) flattenObjects(n, depth + 1, acc)
  } else if (node && typeof node === 'object') {
    const obj = node as RawCandidate
    const hasStringField = Object.values(obj).some(
      (v) => typeof v === 'string' || typeof v === 'number',
    )
    if (hasStringField) acc.push(obj)
    for (const v of Object.values(obj)) flattenObjects(v, depth + 1, acc)
  }
  return acc
}

function candidateTitle(c: RawCandidate): string {
  return (
    c.title || c.name || c.en_title || c.english_title || c.romaji || c.anime_title || ''
  )
}

function candidateSlug(c: RawCandidate): string | null {
  if (c.slug) return c.slug
  if (c.anime_slug) return c.anime_slug
  const link = c.url || c.link || c.href
  if (typeof link === 'string') {
    try {
      const parts = new URL(link).pathname.split('/').filter(Boolean)
      const idx = parts.indexOf('anime')
      const slug = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1]
      if (slug) return slug
    } catch {
      return null
    }
  }
  return null
}

async function searchAnime(
  query: string,
  signal?: AbortSignal,
): Promise<RawCandidate[]> {
  const { data } = await proxiedFetch<unknown>(SEARCH_ENDPOINT, {
    method: 'POST',
    headers: searchHeaders(query),
    body: JSON.stringify({ query }),
    signal,
  })
  const candidates = flattenObjects(data)
  return candidates.filter((c) => candidateSlug(c) && candidateTitle(c))
}

async function resolveEpisodeSlug(
  slug: string,
  episode: number,
  dub: boolean,
  signal?: AbortSignal,
): Promise<string | null> {
  const lang = dub ? 'en-US' : 'ja-JP'
  let url = `${EPISODES_ENDPOINT}/${slug}/episodes?lang=${lang}`
  const tryFetch = async (u: string) => {
    const { data } = await proxiedFetch<{ result?: Array<{ episode_number?: number; episode_string?: string; slug?: string }> }>(u, {
      method: 'GET',
      headers: { accept: 'application/json, text/plain, */*' },
      signal,
    })
    return data?.result || []
  }
  let episodes = await tryFetch(url)
  if (episodes.length < episode) {
    episodes = await tryFetch(`${url}&ep=${episode}`)
  }
  const hit = episodes.find(
    (e) => Number(e.episode_number) === episode || Number(String(e.episode_string || '').replace(/^0+/, '')) === episode,
  )
  return hit?.slug || null
}

/**
 * Fetch the KAA watch/embed page and extract the direct HLS playlist URL.
 * KAA embeds the stream config in a JSON blob / script tag containing .m3u8.
 */
async function extractStreamUrl(
  embedUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { data } = await proxiedFetch<string>(embedUrl, {
    method: 'GET',
    headers: { ...COMMON_HEADERS, referer: 'https://kaa.lt/' },
    signal,
  })
  const html = typeof data === 'string' ? data : JSON.stringify(data)
  const m = html.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i)
  return m ? m[0] : null
}

export async function resolveKickAssAnime(
  titles: string[],
  episode: number,
  dub = false,
  signal?: AbortSignal,
): Promise<VideoSource[]> {
  const query = titles.find(Boolean) || ''
  if (!query) return []
  const cacheKey = normalizeTitle(query)
  const cached = queryCache.get(cacheKey)
  let slug = cached?.slug

  if (!slug) {
    const candidates = await searchAnime(query, signal)
    if (!candidates.length) return []
    const result = bestMatch(
      candidates,
      (c) => [candidateTitle(c)],
      titles,
      tokenSimilarity,
      0.5,
    )
    const chosen = result?.item || candidates[0]
    slug = candidateSlug(chosen) || undefined
    if (slug) {
      const finalSlug = toSlug(slug)
      queryCache.set(cacheKey, { slug: finalSlug, title: candidateTitle(chosen) })
      slug = finalSlug
    }
  }
  if (!slug) return []

  const epKey = `${slug}:${episode}:${dub ? 'dub' : 'sub'}`
  const cachedEpSlug = epCache.get(epKey)
  let epSlug = cachedEpSlug
  if (!epSlug) {
    epSlug = (await resolveEpisodeSlug(slug, episode, dub, signal)) || undefined
    if (epSlug) epCache.set(epKey, epSlug)
  }
  if (!epSlug) return []

  const epNum = Math.max(1, episode)
  const embedUrl = `https://kaa.lt/${slug}/ep-${epNum}-${epSlug}`
  const streamUrl = await extractStreamUrl(embedUrl, signal)
  if (!streamUrl) return []

  return [
    {
      provider: 'kickassanime',
      label: 'KickAssAnime',
      quality: '1080p',
      url: streamUrl,
      embed: false,
      headers: {
        referer: 'https://kaa.lt/',
        origin: 'https://kaa.lt',
      },
    },
  ]
}
