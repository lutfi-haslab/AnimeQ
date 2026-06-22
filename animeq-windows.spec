# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for AnimeQ (Windows). Build on Windows with:
#   python -m PyInstaller animeq-windows.spec --noconfirm

import os
import site
import sys
import glob

# Add the Python package source to the path.
sys.path.insert(0, os.path.join(os.path.abspath('.'), 'python/src'))

# Locate site-packages (handles venv + system python).
site_packages = None
for path in site.getsitepackages():
    if 'site-packages' in path and os.path.exists(path):
        site_packages = path
        break
if not site_packages:
    if hasattr(sys, 'real_prefix') or (hasattr(sys, 'base_prefix') and sys.base_prefix != sys.prefix):
        if sys.platform == 'win32':
            site_packages = os.path.join(sys.prefix, 'Lib', 'site-packages')
        else:
            site_packages = os.path.join(sys.prefix, 'lib', 'python{}.{}'.format(*sys.version_info[:2]), 'site-packages')
    else:
        site_packages = site.getsitepackages()[0]

dist_info_dirs = glob.glob(os.path.join(site_packages, 'pytauri_wheel-*.dist-info'))
dist_info_path = dist_info_dirs[0] if dist_info_dirs else os.path.join(site_packages, 'pytauri_wheel-0.6.0.dist-info')
dist_info_name = os.path.basename(dist_info_path)

a = Analysis(
    ['python/src/animeq/main.py'],
    pathex=[os.path.join(os.path.abspath('.'), 'python/src')],
    binaries=[],
    datas=[
        ('python/src/animeq/frontend', 'animeq/frontend'),
        ('python/src/animeq/icons', 'animeq/icons'),
        ('python/src/animeq/capabilities', 'animeq/capabilities'),
        ('python/src/animeq/tauri.conf.json', 'animeq'),
        (dist_info_path, dist_info_name),
    ],
    hiddenimports=[
        'sniffio',
        'pytauri',
        'pytauri_wheel',
        'pytauri_wheel.ext_mod',
        'pytauri_plugins.notification',
        'importlib_metadata',
        'uvicorn.logging',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
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
    upx=True,
    console=False,  # GUI app — no console window
    disable_windowed_traceback=False,
    argv_emulation=True,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    target_arch=None,
    codesign_identity=None,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='AnimeQ.exe',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=True,
    target_arch=None,
    codesign_identity=None,
    icon='python/src/animeq/icons/icon.ico',
    version=None,
)
