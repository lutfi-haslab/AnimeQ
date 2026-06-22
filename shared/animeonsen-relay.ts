/**
 * AnimeOnsen stream resolution (runs server-side in the relay: Vite plugin in
 * dev, Cloudflare Pages Function in prod).
 *
 * The video bearer token is dynamic — it's the `ao.session` cookie from the
 * watch page, decoded as: decodeURIComponent → atob(base64) → UTF-8 → Caesar
 * shift each char code +1. Only the relay can read cross-origin `set-cookie`,
 * so the whole token-refresh + video fetch happens here.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const VIDEO_BASE = 'https://api.animeonsen.xyz/v4/content'

interface VideoResponse {
  uri?: { stream?: string; subtitles?: Record<string, string> }
  metadata?: { subtitles?: Record<string, unknown> }
}

function base64ToUtf8(value: string): string {
  const normalized = (value || '').trim()
  if (!normalized) return ''
  try {
    const binary = atob(normalized)
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

/** ao.session cookie value -> bearer token. */
function decodeAoSession(raw: string): string {
  const decoded = decodeURIComponent((raw || '').trim())
  if (!decoded) return ''
  const base = base64ToUtf8(decoded)
  if (!base) return ''
  return base
    .split('')
    .reduce((acc, ch) => acc + String.fromCharCode(ch.charCodeAt(0) + 1), '')
}

/** Extract ao.session from any set-cookie representation. */
function parseAoSession(setCookie: string | string[] | null | undefined): string {
  const lines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  const combined = lines.join(', ')
  const m = combined.match(/(?:^|,\s*)ao\.session=([^;]+)/i)
  return m ? m[1].trim() : ''
}

async function getSetCookie(url: string): Promise<string | string[]> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': UA,
    },
    redirect: 'follow',
  })
  // undici / Workers expose getSetCookie(); fall back to raw header.
  const anyRes = res as Response & { getSetCookie?: () => string[] }
  if (typeof anyRes.getSetCookie === 'function') return anyRes.getSetCookie()
  return res.headers.get('set-cookie') || ''
}

export async function resolveAnimeOnsenStream(
  contentId: string,
  episode: number,
): Promise<Response> {
  const cors = {
    'access-control-allow-origin': '*',
    'content-type': 'application/json',
  }
  const ep = Math.max(1, episode || 1)

  try {
    // 1) Refresh bearer token from watch page cookie.
    const watchUrl = `https://www.animeonsen.xyz/watch/${encodeURIComponent(contentId)}?episode=${encodeURIComponent(String(ep))}`
    const setCookie = await getSetCookie(watchUrl)
    const aoSession = parseAoSession(setCookie)
    const token = decodeAoSession(aoSession)
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Could not obtain AnimeOnsen bearer token' }),
        { status: 502, headers: cors },
      )
    }

    // 2) Fetch video metadata with the fresh token.
    const videoUrl = `${VIDEO_BASE}/${encodeURIComponent(contentId)}/video/${encodeURIComponent(String(ep))}`
    const videoRes = await fetch(videoUrl, {
      headers: {
        accept: 'application/json, text/plain, */*',
        authorization: `Bearer ${token}`,
        origin: 'https://www.animeonsen.xyz',
        referer: 'https://www.animeonsen.xyz/',
        'user-agent': UA,
      },
    })
    const status = videoRes.status
    const body = (await videoRes.json()) as VideoResponse
    const stream = body?.uri?.stream
    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'No stream URL', status }),
        { status: 502, headers: cors },
      )
    }
    const subtitles = body?.uri?.subtitles?.['en-us']
    return new Response(
      JSON.stringify({ stream, subtitles, status }),
      { status: 200, headers: cors },
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: cors,
    })
  }
}
