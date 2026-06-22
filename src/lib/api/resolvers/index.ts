import { resolveAnimeOnsen } from '@/lib/api/resolvers/animeonsen'
import { resolveAnimex } from '@/lib/api/resolvers/animex'
import { resolveKickAssAnime } from '@/lib/api/resolvers/kickassanime'
import type { SourceProvider, VideoSource } from '@/types'

export interface ResolveRequest {
  malId?: number
  title?: string
  titleEnglish?: string
  titleJapanese?: string
  episode: number
  dub?: boolean
}

/** Provider priority order — Animex first (most reliable), others optional. */
export const PROVIDER_ORDER: SourceProvider[] = ['animex', 'animeonsen', 'kickassanime']

export const PROVIDER_LABELS: Record<SourceProvider, string> = {
  animex: 'Animex',
  animeonsen: 'AnimeOnsen',
  kickassanime: 'KickAssAnime',
}

/**
 * Resolve sources for a SINGLE provider on demand. Every returned source is a
 * DIRECT stream (.m3u8/.mpd/.mp4) played via hls.js / dash.js — never an iframe.
 */
export async function resolveProvider(
  provider: SourceProvider,
  req: ResolveRequest,
  signal?: AbortSignal,
): Promise<VideoSource[]> {
  const titles = [req.titleEnglish, req.title, req.titleJapanese].filter(
    (t): t is string => !!t && t.trim().length > 0,
  )
  if (!titles.length && !req.malId) return []

  switch (provider) {
    case 'animex':
      // Animex shares the MAL id — match exactly by malId first.
      return resolveAnimex(titles, req.episode, signal, req.malId)
    case 'animeonsen':
      // AnimeOnsen has its own id system — title match only.
      return resolveAnimeOnsen(titles, req.episode, signal)
    case 'kickassanime':
      return resolveKickAssAnime(titles, req.episode, req.dub, signal)
    default:
      return []
  }
}

export { resolveAnimeOnsen, resolveAnimex, resolveKickAssAnime }
