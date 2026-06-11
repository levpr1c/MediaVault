# -*- mode: python ; coding: utf-8 -*-
"""MediaVault v1.0.0 — PyInstaller spec."""

from PyInstaller.utils.hooks import collect_submodules

a = Analysis(
    ['src/web_app.py'],
    pathex=['src'],
    binaries=[],
    datas=[
        ('templates', 'templates'),
        ('static', 'static'),
    ],
    hiddenimports=[
        'PIL._tkinter_finder',
    ] + collect_submodules('keyring.backends'),
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='mediavault',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
)
