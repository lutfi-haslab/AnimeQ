import type { Plugin, ViteDevServer } from 'vite'
import { resolveAnimeOnsenStream } from '../shared/animeonsen-relay'

/**
 * Vite dev-server middleware that mirrors `functions/api/proxy.ts`.
 *
 * In production the same logic runs as a Cloudflare Pages Function (edge
 * Worker). In dev (`bun run dev`) there is no Pages runtime, so this plugin
 * makes `/api/proxy` available directly on the Vite server. Because it runs in
 * Node/Bun (server-side, no CORS), it can reach the cross-origin providers and
 * inject the required headers — exactly like the deployed function.
 *
 * Contract (identical to the Pages Function):
 *   GET  /api/proxy?url=<encoded>&headers=<encoded JSON>   -> streams upstream
 *   POST /api/proxy   body: { url, method?, headers?, body? }  -> JSON result
 * HLS manifests are rewritten so child URIs route back through the proxy.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': '*',
}

function setCors(res: import('http').ServerResponse) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)
}

function proxyUrl(absUrl: string, headersParam?: string): string {
  const p = new URLSearchParams({ url: absUrl })
  if (headersParam) p.set('headers', headersParam)
  return `/api/proxy?${p.toString()}`
}

function rewriteManifest(manifest: string, baseUrl: string, headersParam?: string): string {
  return manifest
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (m, raw: string) => {
          try {
            return `URI="${proxyUrl(new URL(raw, baseUrl).toString(), headersParam)}"`
          } catch {
            return m
          }
        })
      }
      try {
        return proxyUrl(new URL(trimmed, baseUrl).toString(), headersParam)
      } catch {
        return line
      }
    })
    .join('\n')
}

function readBody(req: import('http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function proxyApiPlugin(): Plugin {
  return {
    name: 'animeq-proxy-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const reqUrl = req.url || ''

        // AnimeOnsen token-refresh relay (server-side cookie decode).
        if (reqUrl.startsWith('/api/animeonsen')) {
          if (req.method === 'OPTIONS') {
            setCors(res)
            res.statusCode = 204
            res.end()
            return
          }
          try {
            const u = new URL(reqUrl, 'http://localhost')
            const contentId = u.searchParams.get('id') || ''
            const episode = Number(u.searchParams.get('ep') || 1)
            const relayRes = await resolveAnimeOnsenStream(contentId, episode)
            const buf = Buffer.from(await relayRes.arrayBuffer())
            setCors(res)
            res.statusCode = relayRes.status
            res.end(buf)
          } catch (e) {
            setCors(res)
            res.statusCode = 502
            res.end(JSON.stringify({ error: String(e) }))
          }
          return
        }

        if (!reqUrl.startsWith('/api/proxy')) return next()

        try {
          if (req.method === 'OPTIONS') {
            setCors(res)
            res.statusCode = 204
            res.end()
            return
          }

          if (req.method === 'GET') {
            const u = new URL(reqUrl, 'http://localhost')
            const target = u.searchParams.get('url')
            if (!target) {
              res.statusCode = 400
              res.end('Missing url')
              return
            }
            const rawHeaders = u.searchParams.get('headers') || undefined
            let headers: Record<string, string> = {}
            if (rawHeaders) {
              try {
                headers = JSON.parse(rawHeaders)
              } catch {
                /* ignore */
              }
            }
            await relay(target, 'GET', headers, null, res, rawHeaders)
            return
          }

          if (req.method === 'POST') {
            const bodyText = await readBody(req)
            let payload: { url?: string; method?: string; headers?: Record<string, string>; body?: string | null }
            try {
              payload = JSON.parse(bodyText)
            } catch {
              res.statusCode = 400
              res.end('Invalid JSON body')
              return
            }
            const { url, method = 'POST', headers = {}, body = null } = payload
            if (!url) {
              res.statusCode = 400
              res.end('Missing url')
              return
            }
            await relay(url, method, headers, body, res, undefined)
            return
          }

          next()
        } catch (e) {
          setCors(res)
          res.setHeader('content-type', 'application/json')
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

async function relay(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | null,
  res: import('http').ServerResponse,
  rawHeadersParam?: string,
) {
  const upstream = await fetch(url, {
    method,
    headers: { 'user-agent': UA, ...headers },
    body: body ?? undefined,
  })

  const ct = upstream.headers.get('content-type') || ''
  const isManifest = /mpegurl|x-mpegurl|vnd\.apple\.mpegurl/i.test(ct)

  setCors(res)

  if (isManifest && method === 'GET') {
    const text = await upstream.text()
    res.setHeader('content-type', 'application/vnd.apple.mpegurl')
    res.statusCode = upstream.status
    res.end(rewriteManifest(text, url, rawHeadersParam))
    return
  }

  // Pass through content-type + stream the body.
  if (ct) res.setHeader('content-type', ct)
  res.statusCode = upstream.status
  if (upstream.body) {
    const reader = upstream.body.getReader()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  }
  res.end()
}
