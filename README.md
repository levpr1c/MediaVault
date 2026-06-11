# MediaVault

[![RU](https://img.shields.io/badge/lang-RU-blue.svg)](README.ru.md)

Local web tool for collecting, tagging and viewing media files with Rule34/Danbooru tag support, comics reader, gallery with lightbox. Two subapps: **Tagfetch** (tag search) + **MediaVault** (media tagger with gallery and comics reader).

## Quick start

### AUR (Arch Linux)

```bash
yay -S mediavault-bin
# or
paru -S mediavault-bin
mediavault
# → http://localhost:5050
```

FFmpeg and GNOME Keyring are handled automatically by the package.

### Manual (any distro)

```bash
git clone https://github.com/levpr1c/MediaVault
cd MediaVault
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/python src/web_app.py
# → http://localhost:5050
```

FFmpeg required for video thumbnails: `sudo apt install ffmpeg` (Linux) or `brew install ffmpeg` (macOS).

Optional — `python3-keyring` for storing API keys in system keychain (GNOME Keyring / KDE KWallet in future): `sudo apt install python3-keyring` (Linux). Falls back to plain text in settings.json if unavailable.

## Features

| Feature | Description |
|---------|-------------|
| **🔍 Tagfetch** | Find tags on Rule34 & Danbooru via MD5 hash. Manual (single file) and Auto (batch with SSE progress) |
| **🖼️ Gallery** | Masonry/Grid/List layouts, search by name and tags, filtering |
| **💡 Lightbox** | Fullscreen viewer with zoom, navigation, tag editor |
| **📚 Comics** | Create collections, read in Scroll (webtoon) or Lightbox mode |
| **🏷️ Tags** | Danbooru-style categories with colors, auto-tags (photo/video/animated/sound), aspect-ratio tags |
| **👥 Users** | Admin (full access) and user (read-only) roles |
| **🌙 Theme** | Dark/light, switches without page reload |
| **🌐 i18n** | English + Russian, switches on the fly |
| **🎨 Three.js BG** | Animated shader background on home & login pages, runs on GPU |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Server | Python / Flask (single file, ~3640 lines) |
| Database | SQLite (`~/.local/share/MediaVault/MediaVaultDataBase.db`) |
| Templates | Jinja2 (13 files) |
| Frontend | Vanilla JS (25 modules) |
| Styles | CSS (6 files) |
| Thumbnails | AVIF (Pillow for images, FFmpeg for video) |

## Architecture highlights

- **Decorator order matters**: `@app.route` → `@admin_required` → `@api_error_handler` (wrong order breaks auth)
- **User/admin separation**: templates use `{% if session.role == 'admin' %}`; backend enforces via `@admin_required` (33 endpoints)
- **Shared JS utilities**: `Shared.hexToRgba()`, `Shared.parseTags()`, `Shared.getColumnCount()`, `Shared.reorderGalleryDOM()`, `Shared.getVisualOrder()` — single source of truth
- **Two-level logging**: `log_debug()`/`log_info()`/`log_error()` with ANSI colors + optional file in `--debug` mode
- **@api_error_handler**: unified error handling on all 53 API endpoints — consistent JSON responses

## Documentation

| Document | Description |
|----------|-------------|
| [📖 User guide](docs/user-guide.md) (Russian) | How to use everything |
| [🔧 Code guide](docs/code-guide.md) | For developers: architecture, components, patterns |
| [📗 Glossary](docs/GLOSSARY.md) | Terms explained in plain language |
| [❓ FAQ](docs/FAQ.md) | Frequently asked questions |
| [🆘 Troubleshooting](docs/TROUBLESHOOTING.md) | Fix common problems |
| [🎨 Design system](DESING.md) | Colors, typography, spacing, animations |
| [🤖 Build agent notes](AGENTS.md) | Project conventions and refactoring plan |

## Build binary

```bash
# Install build deps (one-time)
venv/bin/pip install pyinstaller

# Build
venv/bin/pyinstaller mediavault.spec --clean --noconfirm

# Run
./dist/mediavault/mediavault
```

FFmpeg is **not** bundled — install system-wide: `sudo apt install ffmpeg`.
Data location is the same as source run (`~/.config/MediaVault/`, `~/.local/share/MediaVault/`).

## Arch Linux (AUR)

Install from AUR (`mediavault-bin`):

```bash
yay -S mediavault-bin
# or
paru -S mediavault-bin
```

The package depends on `ffmpeg` and optionally `gnome-keyring` for API key encryption.

### Release workflow

```bash
# 1. Build binary
venv/bin/pyinstaller mediavault.spec --clean --noconfirm

# 2. Rename for release
mv dist/mediavault dist/mediavault-linux-amd64

# 3. Compute checksum
sha256sum dist/mediavault-linux-amd64

# 4. Create GitHub Release v1.0.0 with dist/mediavault-linux-amd64 attached
# 5. Update PKGBUILD in packaging/aur/mediavault-bin/ with new sha256sum and pkgver
# 6. Push to AUR
```

## Data locations

| Data | Path |
|------|------|
| Database (tags, cache, comics) | `~/.local/share/MediaVault/MediaVaultDataBase.db` |
| Settings (theme, media_dir, API keys) | `~/.config/MediaVault/settings.json` |
| Debug log (when using --debug) | `~/.local/share/MediaVault/debug.log` |

## Verify

```bash
venv/bin/python check.py
# → 68 syntax checks + 3 smoke tests (Flask start, page load, API auth)
```
