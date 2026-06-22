/**
 * CORS-safe HTTP transport for provider resolvers.
 *
 * PRIMARY (production): same-origin Cloudflare Pages Function at `/api/proxy`
 * (see `functions/api/proxy.ts`). Because it's same-origin, the browser never
 * issues a cross-origin preflight, so POST + custom headers work cleanly. This
 * is an edge function deployed with the static site — not a long-running server.
 *
 * FALLBACK (local `vite` dev, or if the function is unavailable): a list of
 * public CORS proxies. These can't reliably forward custom headers, so dev
 * playback may be limited — run `wrangler pages dev` for full parity.
 *
 * OVERRIDE: a self-hosted Cloudflare Worker URL via `setProxyBase()` / Settings.
 */

interface FetchOpts {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string | null
  signal?: AbortSignal
}

function getOverride(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem('animeq:proxyBase')
}

export function setProxyBase(base: string | null) {
  if (typeof window === 'undefined') return
  if (base) window.localStorage.setItem('animeq:proxyBase', base)
  else window.localStorage.removeItem('animeq:proxyBase')
}

/**
 * Whether the same-origin proxy is available. It always is: in dev it's served
 * by the Vite plugin (`vite/proxy-plugin.ts`); in production by the Cloudflare
 * Pages Function (`functions/api/proxy.ts`). A user-supplied worker override
 * takes priority via the override path.
 */

const PUBLIC_PREFIX_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
]

/**
 * Fetch a provider URL. Uses the same-origin function proxy when available
 * (forwards method + headers + body); otherwise tries public proxies.
 */
export async function proxiedFetch<T>(
  url: string,
  opts: FetchOpts = {},
): Promise<{ data: T; status: number }> {
  const method = opts.method || 'GET'
  const override = getOverride()
  // The override base is treated as a FULL relay endpoint that accepts the same
  // POST {url, method, headers, body} contract (deploy the same logic on a
  // non-blocked host — streaming providers IP-block Cloudflare egress).
  const relayEndpoint = override || '/api/proxy'

  try {
    const res = await fetch(relayEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        method,
        headers: opts.headers || {},
        body: opts.body ?? null,
      }),
      signal: opts.signal,
    })
    // A real HTTP response (any status) from the relay is authoritative —
    // surface it so callers can react to 401/403. Only fall through to public
    // proxies on a network/relay failure (catch below).
    const text = await res.text()
    try {
      return { data: JSON.parse(text) as T, status: res.status }
    } catch {
      return { data: text as unknown as T, status: res.status }
    }
  } catch {
    // fall through to public proxies
  }

  // Fallback: public prefix proxies (GET-friendly, no header forwarding).
  const errors: string[] = []
  for (const prefix of PUBLIC_PREFIX_PROXIES) {
    const target = `${prefix}${encodeURIComponent(url)}`
    try {
      const res = await fetch(target, { signal: opts.signal })
      if (!res.ok) {
        errors.push(`${res.status}`)
        continue
      }
      const text = await res.text()
      try {
        return { data: JSON.parse(text) as T, status: res.status }
      } catch {
        return { data: text as unknown as T, status: res.status }
      }
    } catch (e) {
      errors.push(String((e as Error).message || e))
    }
  }
  throw new Error(`All proxies failed: ${errors.join(' | ')}`)
}

/**
 * Wrap a direct stream URL for hls.js playback. Uses the same-origin function
 * proxy so segment requests carry the required Referer/Origin headers.
 */
export function proxiedMediaUrl(
  url: string,
  headers?: Record<string, string>,
): string {
  const params = new URLSearchParams({ url })
  if (headers && Object.keys(headers).length) {
    params.set('headers', JSON.stringify(headers))
  }
  const qs = params.toString()
  // Override relay (self-hosted on a non-blocked IP) or same-origin Pages
  // Function / Vite plugin — both expose the GET /api/proxy?url=&headers= contract.
  const override = getOverride()
  if (override) {
    const base = override.replace(/\/api\/proxy\/?$/, '').replace(/\/$/, '')
    return `${base}/api/proxy?${qs}`
  }
  return `/api/proxy?${qs}`
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

export const COMMON_HEADERS = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': UA,
}
