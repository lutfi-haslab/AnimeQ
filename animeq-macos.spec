# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for AnimeQ (macOS). Adapt for Windows/Linux by copying this
# file, changing the EXE/BUNDLE names, and dropping the BUNDLE (.app) step.

import os
import site
import sys

# Add the Python package source to the path.
sys.path.insert(0, os.path.join(os.path.abspath("."), "python/src"))

# Locate pytauri_wheel dist-info to bundle its native libs.
site_packages = None
for path in site.getsitepackages():
    if "site-packages" in path and os.path.exists(path):
        site_packages = path
        break
if not site_packages:
    site_packages = site.getsitepackages()[0]

import glob  # noqa: E402

dist_info_dirs = glob.glob(os.path.join(site_packages, "pytauri_wheel-*.dist-info"))
dist_info_path = dist_info_dirs[0] if dist_info_dirs else os.path.join(site_packages, "pytauri_wheel-0.6.0.dist-info")
dist_info_name = os.path.basename(dist_info_path)

a = Analysis(
    ["python/src/animeq/main.py"],
    pathex=[os.path.join(os.path.abspath("."), "python/src")],
    binaries=[],
    datas=[
        ("python/src/animeq/frontend", "animeq/frontend"),
        ("python/src/animeq/icons", "animeq/icons"),
        ("python/src/animeq/capabilities", "animeq/capabilities"),
        ("python/src/animeq/tauri.conf.json", "animeq"),
        (dist_info_path, dist_info_name),
    ],
    hiddenimports=[
        "sniffio",
        "pytauri",
        "pytauri_wheel",
        "pytauri_wheel.ext_mod",
        "pytauri_plugins.notification",
        "importlib_metadata",
        "uvicorn.logging",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="animeq-macos",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="animeq-macos",
)

app = BUNDLE(
    coll,
    name="AnimeQ.app",
    icon="python/src/animeq/icons/icon.icns",
    bundle_identifier="com.animeq.app",
    info_plist={
        "CFBundleName": "AnimeQ",
        "CFBundleDisplayName": "AnimeQ",
        "CFBundleVersion": "1.0.0",
        "CFBundleShortVersionString": "1.0.0",
        "NSHighResolutionCapable": True,
        "LSUIElement": False,
        "NSAppTransportSecurity": {"NSAllowsArbitraryLoads": True},
        "CFBundleExecutable": "animeq-macos",
    },
)
