// Cloudflare Pages Function: AnimeOnsen token-refresh relay.
// Routes GET /api/animeonsen?id=<contentId>&ep=<episode> -> { stream, subtitles }
import { resolveAnimeOnsenStream } from '../../shared/animeonsen-relay'

export const onRequestGet: PagesFunction = async ({ request }) => {
  const u = new URL(request.url)
  const contentId = u.searchParams.get('id') || ''
  const episode = Number(u.searchParams.get('ep') || 1)
  return resolveAnimeOnsenStream(contentId, episode)
}
