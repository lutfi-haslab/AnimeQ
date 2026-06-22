"""AnimeQ local relay server.

Serves the built frontend and a same-origin proxy that the SPA uses to reach
cross-origin anime providers. Running locally on the user's machine means a
residential egress IP (no datacenter-IP blocks) and no CORS issues.

Endpoints (mirrors `vite/proxy-plugin.ts` and the old Cloudflare Function):
    GET  /api/proxy?url=<encoded>&headers=<encoded JSON>  -> streams upstream
    POST /api/proxy   body: {url, method?, headers?, body?}  -> JSON result
    GET  /api/animeonsen?id=<contentId>&ep=<episode>  -> {stream, subtitles}

HLS manifests (.m3u8) are rewritten so sub-playlists / segments route back
through the proxy with the required headers.
"""

from __future__ import annotations

import base64
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlencode

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)
CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "*",
}

VIDEO_BASE = "https://api.animeonsen.xyz/v4/content"


def create_app(frontend_dir: Path | None = None) -> FastAPI:
    app = FastAPI(title="AnimeQ Relay")

    # ---- CORS preflight ----
    @app.options("/api/{path:path}")
    async def _preflight(path: str) -> Response:
        return Response(status_code=204, headers=CORS_HEADERS)

    # ---- AnimeOnsen token-refresh relay ----
    @app.get("/api/animeonsen")
    async def animeonsen(request: Request) -> Response:
        params = request.query_params
        content_id = params.get("id", "")
        ep = max(1, int(params.get("ep") or 1))
        if not content_id:
            return JSONResponse({"error": "Missing id"}, status_code=400, headers=CORS_HEADERS)

        try:
            async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
                # 1) Refresh bearer from the watch page `ao.session` cookie.
                watch_url = f"https://www.animeonsen.xyz/watch/{content_id}?episode={ep}"
                wr = await client.get(
                    watch_url,
                    headers={
                        "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                        "user-agent": UA,
                    },
                )
                token = _decode_ao_session(_parse_ao_session(wr.headers.get_list("set-cookie")))
                if not token:
                    return JSONResponse(
                        {"error": "Could not obtain AnimeOnsen bearer token"},
                        status_code=502,
                        headers=CORS_HEADERS,
                    )

                # 2) Fetch video metadata with the fresh token.
                video_url = f"{VIDEO_BASE}/{content_id}/video/{ep}"
                vr = await client.get(
                    video_url,
                    headers={
                        "accept": "application/json",
                        "authorization": f"Bearer {token}",
                        "origin": "https://www.animeonsen.xyz",
                        "referer": "https://www.animeonsen.xyz/",
                        "user-agent": UA,
                    },
                )
                body = vr.json()
                stream = (body.get("uri") or {}).get("stream")
                if not stream:
                    return JSONResponse({"error": "No stream URL"}, status_code=502, headers=CORS_HEADERS)
                subs = (body.get("uri") or {}).get("subtitles", {}).get("en-us")
                return JSONResponse(
                    {"stream": stream, "subtitles": subs}, status_code=200, headers=CORS_HEADERS
                )
        except Exception as e:  # noqa: BLE001
            return JSONResponse({"error": str(e)}, status_code=502, headers=CORS_HEADERS)

    # ---- Generic proxy (POST: JSON) ----
    @app.post("/api/proxy")
    async def proxy_post(request: Request) -> Response:
        try:
            payload: dict[str, Any] = await request.json()
        except Exception:  # noqa: BLE001
            return JSONResponse("Invalid JSON body", status_code=400, headers=CORS_HEADERS)
        url = payload.get("url")
        if not url:
            return JSONResponse("Missing url", status_code=400, headers=CORS_HEADERS)
        method = (payload.get("method") or "POST").upper()
        headers = payload.get("headers") or {}
        body = payload.get("body")
        return await _relay(url, method, headers, body, None)

    # ---- Generic proxy (GET: query, with HLS rewriting + streaming) ----
    @app.get("/api/proxy")
    async def proxy_get(request: Request) -> Response:
        params = request.query_params
        url = params.get("url")
        if not url:
            return JSONResponse("Missing url", status_code=400, headers=CORS_HEADERS)
        headers_raw = params.get("headers")
        headers: dict[str, str] = {}
        if headers_raw:
            try:
                headers = json.loads(headers_raw)
            except Exception:  # noqa: BLE001
                pass
        return await _relay(url, "GET", headers, None, headers_raw)

    async def _relay(url: str, method: str, headers: dict[str, str], body: Any, headers_param: str | None) -> Response:
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                req_headers = {"user-agent": UA, **headers}
                resp = await client.request(
                    method,
                    url,
                    headers=req_headers,
                    content=body if isinstance(body, str) else None,
                )
        except Exception as e:  # noqa: BLE001
            return JSONResponse({"error": str(e)}, status_code=502, headers=CORS_HEADERS)

        ctype = resp.headers.get("content-type", "")
        is_manifest = "mpegurl" in ctype.lower()

        if is_manifest and method == "GET":
            text = _rewrite_manifest(resp.text, url, headers_param)
            hdrs = {"content-type": "application/vnd.apple.mpegurl", **CORS_HEADERS}
            return Response(text, status_code=resp.status_code, headers=hdrs)

        # Stream the body verbatim (works for .ts/.m4s/.mp4 + JSON).
        media_type = ctype or "application/octet-stream"

        async def gen():
            async for chunk in resp.aiter_raw():
                yield chunk

        return StreamingResponse(gen(), status_code=resp.status_code, media_type=media_type, headers=CORS_HEADERS)

    # ---- Serve the frontend (SPA) ----
    if frontend_dir is not None:
        from fastapi.staticfiles import StaticFiles
        # Single-page fallback handled below.

        @app.get("/{full_path:path}")
        async def spa(full_path: str) -> Response:
            candidate = (frontend_dir / full_path).resolve()
            try:
                candidate.relative_to(frontend_dir.resolve())
            except ValueError:
                candidate = frontend_dir / "index.html"
            if candidate.is_file():
                import mimetypes
                media, _ = mimetypes.guess_type(str(candidate))
                if not media:
                    if candidate.suffix == ".html":
                        media = "text/html"
                    elif candidate.suffix == ".js":
                        media = "application/javascript"
                    elif candidate.suffix == ".css":
                        media = "text/css"
                    elif candidate.suffix == ".svg":
                        media = "image/svg+xml"
                return Response(candidate.read_bytes(), media_type=media)
            # SPA fallback for client-side routes.
            index = frontend_dir / "index.html"
            if index.is_file():
                return Response(index.read_bytes(), media_type="text/html")
            return JSONResponse("Frontend not built", status_code=404, headers=CORS_HEADERS)

    return app


# ---- AnimeOnsen cookie decode (decodeURIComponent -> base64 -> Caesar +1) ----
def _parse_ao_session(set_cookie_list: list[str]) -> str:
    combined = ", ".join(set_cookie_list or [])
    m = re.search(r"(?:^|,\s*)ao\.session=([^;]+)", combined, re.I)
    return m.group(1).strip() if m else ""


def _decode_ao_session(raw: str) -> str:
    if not raw:
        return ""
    try:
        decoded_cookie = _url_unquote(raw)
        base_text = base64.b64decode(decoded_cookie).decode("utf-8", errors="ignore")
    except Exception:  # noqa: BLE001
        return ""
    return "".join(chr(ord(c) + 1) for c in base_text)


def _url_unquote(s: str) -> str:
    from urllib.parse import unquote

    return unquote(s)


# ---- HLS manifest rewriting ----
_URI_ATTR_RE = re.compile(r'URI="([^"]+)"')


def _proxy_url(abs_url: str, headers_param: str | None) -> str:
    params = {"url": abs_url}
    if headers_param:
        params["headers"] = headers_param
    return "/api/proxy?" + urlencode(params)


def _rewrite_manifest(manifest: str, base_url: str, headers_param: str | None) -> str:
    out_lines = []
    for line in manifest.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            # Rewrite URI= attributes inside tags (KEY, MAP, MEDIA).
            def _sub(m: re.Match[str]) -> str:
                try:
                    abs_url = urljoin(base_url, m.group(1))
                    return f'URI="{_proxy_url(abs_url, headers_param)}"'
                except Exception:  # noqa: BLE001
                    return m.group(0)

            out_lines.append(_URI_ATTR_RE.sub(_sub, line))
            continue
        try:
            abs_url = urljoin(base_url, stripped)
            out_lines.append(_proxy_url(abs_url, headers_param))
        except Exception:  # noqa: BLE001
            out_lines.append(line)
    return "\n".join(out_lines)
