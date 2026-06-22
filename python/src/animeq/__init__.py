"""AnimeQ Pytauri entry point.

Starts the local relay server (frontend + proxy) on 127.0.0.1:8788, then builds
and runs the Tauri window pointed at it. The webview and the proxy share an
origin, so the SPA's relative `/api/proxy` calls work same-origin.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import uvicorn
from anyio import create_task_group
from anyio.from_thread import start_blocking_portal
from pytauri_wheel.lib import builder_factory, context_factory

from .server import create_app

import sys

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    SRC_TAURI_DIR = Path(sys._MEIPASS) / "animeq"
else:
    SRC_TAURI_DIR = Path(__file__).parent.absolute()

SERVER_PORT = int(os.environ.get("ANIMEQ_PORT", "8788"))
DEV_ENV = os.environ.get("DEV_ENV") == "1"

# The frontend lives next to this module after `vite build`.
FRONTEND_DIR = SRC_TAURI_DIR / "frontend"


def _start_server() -> None:
    """Run the relay server in a background daemon thread, then block until it
    is accepting connections so the webview never loads into a dead port
    (which renders as a blank/black window)."""
    import socket
    import time

    app = create_app(frontend_dir=FRONTEND_DIR if FRONTEND_DIR.is_dir() else None)
    config = uvicorn.Config(app, host="127.0.0.1", port=SERVER_PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    # Wait for the port to accept TCP connections (max ~20s).
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", SERVER_PORT), timeout=0.5):
                return
        except OSError:
            time.sleep(0.15)
    raise RuntimeError(f"Relay server did not start on port {SERVER_PORT}")


def main() -> int:
    """Run the Tauri app."""
    # In dev, the frontend + proxy are served by Vite (with its proxy plugin),
    # so the Python relay server isn't needed. Only start it in production.
    if not DEV_ENV:
        _start_server()

    with (
        start_blocking_portal("asyncio") as portal,
        portal.wrap_async_context_manager(portal.call(create_task_group)) as tg,
    ):  # noqa: BLE001
        build_mode = os.environ.get("BUILD_MODE", os.environ.get("APP_ENV", "prod")).lower()
        enable_devtools = build_mode == "dev"

        frontend_dist = (
            f"http://127.0.0.1:1420"
            if DEV_ENV
            else f"http://127.0.0.1:{SERVER_PORT}"
        )

        # Build a COMPLETE Tauri config so the runtime override is authoritative
        # (a partial config can fall back to the empty ./frontend asset dir →
        # blank window). Disable CSP so dev-server (http) scripts execute.
        config_data = {
            "productName": "AnimeQ",
            "version": "1.0.0",
            "identifier": "com.animeq.app",
            "build": {"frontendDist": frontend_dist},
            "app": {
                "withGlobalTauri": True,
                "windows": [
                    {
                        "label": "main",
                        "title": "AnimeQ",
                        "url": frontend_dist,
                        "visible": True,
                        "devtools": enable_devtools,
                    }
                ],
                "security": {"csp": None},
            },
            "bundle": {"icon": ["icons/icon.png", "icons/icon.ico"]},
        }

        app = builder_factory().build(
            context=context_factory(SRC_TAURI_DIR, tauri_config=json.dumps(config_data)),
            invoke_handler=None,
        )
        return app.run_return()


if __name__ == "__main__":
    raise SystemExit(main())
