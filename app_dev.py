#!/usr/bin/env python3
"""Dev launcher: starts the Vite dev server + the Pytauri app (hot reload).

Mirrors the metdesk-v2 dev workflow. The Vite plugin (`vite/proxy-plugin.ts`)
serves `/api/proxy` same-origin during dev, so no Python relay server is needed.
"""

import os
import subprocess
import sys
import time


def configure_console_encoding() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream and hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")


def main() -> int:
    configure_console_encoding()
    project_root = os.path.dirname(os.path.abspath(__file__))

    print("Starting Vite Dev Server...")
    vite_server = subprocess.Popen(
        ["bun", "run", "dev"],
        cwd=project_root,
        shell=sys.platform == "win32",
    )

    print("Waiting for Vite...")
    time.sleep(5)

    print("Starting PyTauri App...")
    env = os.environ.copy()
    env["DEV_ENV"] = "1"
    env["BUILD_MODE"] = "dev"
    env["PYTHONPATH"] = os.path.join(project_root, "python", "src")

    python_src = os.path.join(project_root, "python", "src")
    try:
        subprocess.run(
            [sys.executable, "-m", "jurigged", "-w", python_src, "-v", "-m", "animeq"],
            cwd=project_root,
            env=env,
        )
    except KeyboardInterrupt:
        pass
    finally:
        print("\nShutting down...")
        vite_server.terminate()
        vite_server.wait()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
