// Cloudflare Pages Function: same-origin CORS proxy for provider APIs + media.
//
// Deployed alongside the static site (Cloudflare Pages Functions = edge Workers,
// NOT a long-running server). Because it is same-origin, the browser never
// issues a cross-origin preflight, so POST + custom headers work cleanly. This
// is the browser equivalent of a native (CORS-bypassing) fetch — providers like
// Animex whitelist only their own Origin, so the relay sends that Origin
// server-side.
//
// Contract:
//   GET  /api/proxy?url=<encoded>&headers=<encoded JSON>   -> streams upstream
//   POST /api/proxy   body: { url, method?, headers?, body? }  -> JSON result
//
// For HLS manifests the function rewrites every URI (relative or absolute) so
// each sub-playlist / segment is fetched back through the proxy with the same
// injected headers — this is what makes hls.js playback actually work.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

function corsResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { ...CORS, ...((init.headers as Record<string, string>) || {}) },
  })
}

interface ProxyBody {
  url?: string
  method?: string
  headers?: Record<string, string>
  body?: string | null
}

export const onRequestOptions: PagesFunction = async () => {
  return corsResponse(null, { status: 204 })
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const u = new URL(request.url)
  const target = u.searchParams.get('url')
  if (!target) return corsResponse('Missing url', { status: 400 })
  let headers: Record<string, string> = {}
  const h = u.searchParams.get('headers')
  if (h) {
    try {
      headers = JSON.parse(h)
    } catch {
      /* ignore */
    }
  }
  return forward(target, 'GET', headers, null, h || undefined)
}

export const onRequestPost: PagesFunction = async ({ request }) => {
  let payload: ProxyBody
  try {
    payload = (await request.json()) as ProxyBody
  } catch {
    return corsResponse('Invalid JSON body', { status: 400 })
  }
  const { url, method = 'POST', headers = {}, body = null } = payload
  if (!url) return corsResponse('Missing url', { status: 400 })
  return forward(url, method, headers, body)
}

async function forward(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  rawHeadersParam?: string,
): Promise<Response> {
  let upstream: Response
  try {
    upstream = await fetch(url, {
      method,
      headers: { 'user-agent': UA, ...headers },
      body: body ?? undefined,
    })
  } catch (e) {
    return corsResponse(JSON.stringify({ error: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }

  const ct = upstream.headers.get('content-type') || ''
  const isManifest = /mpegurl|x-mpegurl|vnd\.apple\.mpegurl/i.test(ct)

  // HLS manifest: rewrite URIs so children route back through the proxy.
  if (isManifest && method === 'GET') {
    const text = await upstream.text()
    const rewritten = rewriteManifest(text, url, rawHeadersParam)
    const respHeaders = new Headers()
    respHeaders.set('content-type', 'application/vnd.apple.mpegurl')
    respHeaders.set('access-control-allow-origin', '*')
    return new Response(rewritten, { status: upstream.status, headers: respHeaders })
  }

  // Default: stream the body verbatim (works for .ts/.mp4 segments + JSON).
  const respHeaders = new Headers(upstream.headers)
  respHeaders.set('access-control-allow-origin', '*')
  respHeaders.set('access-control-expose-headers', '*')
  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}

/**
 * Rewrite every URI in an HLS manifest so it points back through /api/proxy
 * with the same headers. Handles relative (against the manifest base URL) and
 * absolute URLs, and #EXT-X-KEY/#EXT-X-MAP URI attributes.
 */
function rewriteManifest(manifest: string, baseUrl: string, headersParam?: string): string {
  const proxy = (absUrl: string): string => {
    const p = new URLSearchParams({ url: absUrl })
    if (headersParam) p.set('headers', headersParam)
    return `/api/proxy?${p.toString()}`
  }

  return manifest
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        // Rewrite URI= attributes inside tags (KEY, MAP, MEDIA, etc.).
        return line.replace(/URI="([^"]+)"/g, (_m, raw: string) => {
          try {
            const abs = new URL(raw, baseUrl).toString()
            return `URI="${proxy(abs)}"`
          } catch {
            return _m
          }
        })
      }
      // Segment / sub-playlist line.
      try {
        const abs = new URL(trimmed, baseUrl).toString()
        return proxy(abs)
      } catch {
        return line
      }
    })
    .join('\n')
}
