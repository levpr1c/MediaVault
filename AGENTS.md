# MediaVault

A Flask SPA (`src/web_app.py`, 5214+ строк, 98+ роутов, 50 `@admin_required`, 9 `@auth_required`, 77 `@api_error_handler`) + `src/credential_store.py` (124). Three sub-applications: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`). 17 Jinja2 templates, 32 JS modules (9778 строк без lib/), 8 CSS files (2585 строк).

## Core Conventions

**Decorator order matters**: `@app.route` → `@admin_required` → `@api_error_handler` (wrong order breaks auth). **API error responses**: `@admin_required → 403 JSON, `@auth_required → 401 JSON, `@api_error_handler → 500 JSON`. **API data pattern**: `if data is None:` — empty `{}` is falsy.

**ES modules**: `{% block content %}` renders before `{% block scripts %}`. Module scripts use load/defer. Top-level errors in ES modules block all remaining scripts.

**Critical bugs to avoid**:
- Wrap `new Lightbox(...)` in try-catch
- `Lightbox.close()` needs guard for `_el('Media')` null before `querySelector('video')` (`shared/lightbox.js:279`)
- CSS loading order: `shared.css` → (content.css, content-search.css, admin.css, tagfetch.css, settings.css) → `mediavault.css` (last, no `!important`)

**Frontend patterns**: Headers inline in `base.html`, Desktop/mobile via `.hdr-desktop`/`.hdr-mobile` (768px). **No `window.innerWidth` in JS**. Mobile `.desktop-only` hidden via CSS media query. Mobile gets no sidebar/search panel/toolbar HTML.

**Application structure**:
- CM SPA lifecycle (`static/content/main.js`): tags/files/comics/nhentai/contentSearch/comicsTags sections, each with `render(destroy?)`/`destroy()`. Routing by `location.pathname`
- `content-mgmt/*`, `settings`, `admin` extend `base.html`, content via JS. `login.html` standalone, `popular_tags`/`view` suppress header blocks

**Persistence**: LocalStorage keys `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`, `mediavault_lang`, `mediavault_folder_filter`.

**Icons**: Inline SVG only (no emoji). `SiteIcons.getIcon` in `static/shared/icons.js`. Theme uses SVG sun/moon.

**Caching**: `BrowserCache` (default/reduced/nocache) → `Cache-Control` on `/api/media` and `/api/thumbnail`. `clear_thumb_cache` removes SQLite BLOBs. `load_settings()` uses `setdefault()` for new keys.

**Search functions**: `_has_non_meta_tags(tag_str)` → false if only META_TAGS or aspect-ratio.

**Database**: SQLite (`~/.local/share/MediaVault/MediaVaultDataBase.db`). WAL + busy_timeout=5000 per connection. **No `DROP TABLE`** (exclusive lock even in WAL). Use `DELETE FROM` or `VACUUM` → `PRAGMA wal_checkpoint(TRUNCATE)`.

**Quick scan**: `_quick_scan(force=False)` uses threading.Lock with blocking=False, ensures lock release in finally. Background scans: `threading.Thread(target=_quick_scan, daemon=True).start()`.

**Background downloads**: `_download_tasks` dict + Lock. `_start_background_task(type, fn, *args)` → daemon thread. `GET /api/content-search/task/<task_id>` polling. `POST .../download-async` single-download, `.../download-manga-async` NHentai (ThreadPoolExecutor 4 workers). `overwrite=True` deletes files before re-download.

**Tags**: NHentai v1.2.0 tags map v2 API types: tag→general, artist→artist, character→character, parody→copyright, group→general, language→meta, category→general. Stored in `tag_category_members` (global) and `comics.tags` (CSV per comic). `file_tags` for MV gallery per-page. `comic_tags` table unused (removed as redundant).

**Function `_has_users_cached`**: In-memory flag reset on add/remove user.

## v1.3 Features (current)

### Design System
- Standardized `.action-btn` CSS (rounded 8px, inline-flex, SVG+text, hover/active/danger states) applied to admin, settings, headers
- Removed 3-dots kebab mobile toolbar and dropdown
- Removed tag-button SVG from comics-edit (-300 lines)
- Popular tags as `.action-btn` in MV header

### MV Gallery Pagination
- Top pagination bar with Prev/Next + page numbers, 12px gap to thumbnails
- Responsive (text hidden on mobile)

### Content-Search
- Grid uses MV `.file-card` style (consistent thumb size/gap)
- Bottom pagination: Prev | 1 | 2 | 3 | 4 | Next, page size 20/30/50
- Fetch formula: page_size × 3 (accumulates from API)
- Removed old Load More + `<`/`>` pagination

### Tags-Manage
- "Files Without Tags" → files with empty/meta-only tags (max 500)
- "Find Originals" → sample_XXX → md5 → Rule34/Danbooru API → download + tag
- Background thread with progress polling for find-originals
- Sample files deleted from disk on download-original (no re-add on rescan)
- Shared module `static/shared/find-originals.js` (IIFE, used by tags-manage + settings)

### Find-Originals Modal
- 90vw/90vh, two-column: left=large sample previews, right=found originals with tags
- Progress bar, Replace All button (disabled during search, enabled on done)
- Sample images clickable → opens shared Lightbox
- Cancel calls cancel API; auto-scroll to new results
- i18n: `replaceAll`, `replaceAllDone`

### Admin Page Layout
- `.admin-header` with `<a>` links (Users/Database/API Keys) — icon + text on desktop, icon-only on mobile
- `.hdr-nav-label { display: none }` globally, `{ display: inline }` at ≥768px
- `loadSection()` in `admin/admin.js:1009` updates `.active` via selector: `.admin-nav-item, .mv-mh-icon[data-section], .admin-header a[data-section]`
- `AdminDashboard.load(name)` aliases `loadSection()` for onclick handlers
- `.admin-header a:focus-visible` uses `box-shadow` instead of `outline` (follows border-radius)
- `.hdr-mobile .admin-header` no longer hidden (REMOVED `display: none` — icons show on mobile too)

### Settings Page
- Tab buttons (Appearance/Database/Account) converted from `<button>` in `hdr_tabs` → `<a>` in `hdr_nav` with `.admin-header` wrapper
- Same styling as admin page via `admin.css`
- `SettingsApp.switchTab()` queries `.settings-tab-btn[data-tab="..."]` — class preserved on `<a>` elements
- Old `.settings-tabs-row` and `.settings-tab-btn` CSS removed from `settings.css`

### CM Header i18n
- All 4 dropdown toggle buttons (TAGFETCH/TAGS/COMICS/SEARCH) have `data-i18n` + `<span>` wrappers with `cmSection*` keys
- All 8 CM dropdown sub-links have `data-i18n` (`manualFetch`, `autoFetch`, `mvManageTags`, `navGroups`, `navEditor`, `comicsTags`, `navImages`, `cmSectionComics`)
- Keys added: `navImages` (en:"Images", ru:"Изображения")
- `navComics` removed (duplicated `mvComics`)

### Mobile Header
- Hamburger button moved from `mv-mh-row1` to `mv-mh-row2` (same row as search), hidden on `/admin` and `/settings`
- `.mv-mh-icon:focus-visible` uses `box-shadow` instead of `outline`
- `.admin-header` visible on mobile (no longer hidden)

### Locale
- 271 keys en/ru (271 each)
- Synced with JS `_i18nData` in `static/shared/utils.js`

### Known Issues
- `AdminDashboard.load()` update needed at `admin.js:1013` — selector must include `.admin-header a[data-section]`
- Settings page: `SettingsApp.switchTab()` in `settings.html` — JS works with `.settings-tab-btn` class
- Key `popularTags` used in HTML but not in LOCALE dict (DB-generated)
- Duplicate values: `navAdmin`/`userRoleAdmin` → "Admin", `cmSectionTags`/`tags` → "TAGS", `contentSearchBtn`/`navSearch` → "Search" — pre-existing

## Development commands

```bash
# Start Flask on port 5050
venv/bin/python src/web_app.py

# Start Flask with auto-reload + verbose
venv/bin/python src/web_app.py --debug

# Start Flask on localhost only
venv/bin/python src/web_app.py --bind 127.0.0.1

# Run all checks (except smoke)
venv/bin/python test.py

# Run specific checks (py=js=css=...=smoke)
venv/bin/python test.py --check py/js/css/locale/func/dead/smoke

# Fix unused LOCALE keys
venv/bin/python test.py --fix

# Create binary distribution
venv/bin/pyinstaller mediavault.spec --clean --noconfirm
```

**No smoke test by default**: Smoke test (`--check smoke`) starts Flask on port 15050 and checks `/login` (200) + `/api/gallery` (401). All other checks run faster by default.

## Key JavaScript files

- `static/shared/utils.js`: Shared.* utility functions (hexToRgba(), parseTags(), getColumnCount(), reorderGalleryDOM(), getVisualOrder()), `_i18nData` locale dict
- `static/shared/lightbox.js`: Lightbox class with arrowNav option
- `static/shared/icons.js`: SiteIcons.getIcon
- `static/admin/admin.js`: 5 sections + scan progress polling; `loadSection()` updates `.active` on nav links
- `static/content/comics-picker.js`: Preview animation
- `static/shared/find-originals.js`: Background thread for finding originals
- `static/shared/grid-renderer.js`: ES-module for comics-tags.js, tags-manage.js (buildLeftPanelHtml, renderLeftTags, setupDragEvents, comicCardHTML, buildComicsGridHTML)

## Frameworks

**Testing**: Custom CLI `test.py` (783+ строки) — not pytest. Includes:
- `--check py`: `python -m py_compile src/*.py`
- `--check js`: `node --check static/**/*.js`
- `--check css`: CSS files exist and non-empty
- `--check locale`: AST-parse LOCALE parity (en↔ru), JS sync, duplicate values
- `--check dead`: AST (Python) + regex (JS) — unused public functions
- `--check func`: Inject Python in subprocess
- `--check smoke`: Flask on :15050, GET /login (200) + /api/gallery (401)

**No pytest, conftest, CI/CD, Docker, Makefile, ruff, flake8, pyproject.toml**. No `test/` directory. Dead code detection custom (regex), possible false positives.

**Package configuration**: package.json has placeholder test script only. No additional npm scripts defined.

**Backend integration**:
- gallery-dl: Python CLI subprocess, not Python API. Use `is_available → gallery-dl --version`, `get_info(url) → --list-urls`, `download(url, dest) → --directory`. NHentai search: ThreadPoolExecutor 8 workers, sequential 25 requests > 30s timeout.
- Raw API: `src/backends/api_raw.py` (351 строка) second backend (NHentai raw API)

## CSS Architecture

### Loading Order
`shared.css` → (content.css, content-search.css, admin.css, tagfetch.css, settings.css) → `mediavault.css` (last)

### Key Selectors
- `.hdr-desktop` / `.hdr-mobile` — breakpoint at 768px
- `.admin-header a` — desktop: `width:auto; padding:7px 14px; gap:6px;`, mobile: `width:32px; height:32px;`
- `.admin-header a.active` — `color:var(--accent); background:var(--accent-glow); font-weight:700;`
- `.admin-header a:focus-visible` — `outline:none; box-shadow:0 0 0 2px var(--accent);`
- `.mv-mh-icon:focus-visible` — same box-shadow pattern
- `.action-btn` — standardized: `border-radius:8px; inline-flex; SVG+text`
- `.settings-tab-btn` — used on `<a>` elements in settings `.admin-header` for JS selection

## Documentation
- `docs/code-guide.md`: Architecture, route information
- `docs/user-guide.md` (Russian): How to use everything
- `DESING.md` (design system): Colors, typography, spacing, animations
- `roadmap/roadmap.md`: Project roadmap
