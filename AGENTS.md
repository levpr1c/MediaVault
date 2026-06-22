# MediaVault

Flask single-file (`src/web_app.py`, 4861 строк, 96 роутов, 49 `@admin_required`, 5 `@auth_required`, 70 `@api_error_handler`) + `src/credential_store.py` (122). Три под-приложения: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`).

## Команды

```bash
venv/bin/python src/web_app.py             # http://0.0.0.0:5050
venv/bin/python src/web_app.py --debug     # авто-релоад + verbose
venv/bin/python src/web_app.py --bind 127.0.0.1
venv/bin/python test.py                    # syntax + locale + dead + func
venv/bin/python test.py --check py/js/css/locale/func/dead/smoke
venv/bin/python test.py --fix              # удаление неиспользуемых i18n ключей
venv/bin/pyinstaller mediavault.spec --clean --noconfirm   # onefile
```

Deps: `flask`, `requests`, `Pillow`, `gallery-dl` — в `venv/`. FFmpeg нужен для видео-превью + `ffprobe`.

## Критические конвенции

- **Decorator order**: `@app.route` → `@admin_required` → `@api_error_handler`. Нарушение ломает auth (403→всегда 500).
- **`if data is None:`** — пустой `{}` falsy в Python. Все API так.
- **ES module timing**: `{% block content %}` рендерится **до** `{% block scripts %}` в Jinja. Модульные скрипты в `content` load/defer раньше. **Top-level ошибка в ES-модуле блокирует ВСЕ остальные скрипты**. Любой `new Lightbox(...)` — в try-catch.
- **`Lightbox.close()`** — всегда guard `_el('Media')` на null перед `querySelector('video')`. Без этого `close()` до `open()` кидает TypeError. `shared/lightbox.js:279`.
- **Icons**: inline SVG. **Нет emoji**. SVG sun/moon для темы, текст RU/EN.
- **CSS loading order**: `shared.css` → (content.css / content-search.css / admin.css / tagfetch.css / settings.css) → `mediavault.css` **последний** (специфичность без `!important`).
- **Header**: inline в `base.html`. Desktop `.hdr-desktop` + mobile `.hdr-mobile` через CSS media (768px). **Нет `window.innerWidth` в JS**.
- **Desktop-only**: `.desktop-only` скрыт на mobile CSS. Mobile **не получает HTML** для sidebar, search panel, toolbar.
- **SPA страницы**: `content-mgmt/*`, `settings`, `admin` — extend `base.html`, контент через JS. **Standalone**: `login.html`. `popular_tags`, `view` — suppress header blocks.
- **localStorage keys**: `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`, `mediavault_lang`.
- **Auth**: Flask сессии. `@admin_required` → 403 JSON. `@auth_required` → 401 JSON. `@api_error_handler` → 500 JSON.
- **`_has_users_cached`** — in-memory флаг, сбрасывается при add/remove user.
- **`clear_thumb_cache`** — удаляет SQLite BLOBs только (файлов нет).
- **`browser_cache`** (default/reduced/nocache) → `Cache-Control` на `/api/media` и `/api/thumbnail`.
- **`load_settings()`** — `setdefault()` для всех новых ключей.
- **`_has_non_meta_tags(tag_str)`** — false если только META_TAGS или aspect-ratio (`^\d+:\d+$`).
- **Thumbnail constants**: `_THUMB_LARGE = 360`, `_THUMB_XL = 600`, `_THUMB_RATIO_LIMIT = 21/9`.

## SQLite / БД

- **DB path**: `~/.local/share/MediaVault/MediaVaultDataBase.db`. **WAL mode** (`PRAGMA journal_mode=WAL`) + `PRAGMA busy_timeout=5000` устанавливаются на каждом соединении в `_db_conn()`.
- **Все `DROP TABLE` запрещены** — exclusive lock даже в WAL. Использовать `DELETE FROM`. `VACUUM` → `PRAGMA wal_checkpoint(TRUNCATE)`.
- **`_quick_scan(force=False)`** — конкурентно-безопасна через `_scan_lock = threading.Lock()` c `blocking=False`. Флаг `_scan_in_progress` читается в `api_scan_folder` для быстрой проверки. Любой ранний return внутри `try` идёт через `finally`, который отпускает lock.
- Фоновые сканы (после download, после clear_all) запускаются через `threading.Thread(target=_quick_scan, daemon=True).start()`.

## JS модули (32 файла, 9189 строк без lib/)

| Паттерн | Файлы |
|---------|-------|
| **IIFE + `window.*`** | `shared/` (7), `mediavault/` (4), `tagfetch/` (2), `admin/` (1) |
| **ES modules** | `content/` (7), `shared/home-bg.js`, `shared/grid-renderer.js` |

### CM SPA lifecycle (`static/content/main.js`)
Секции: `tags`, `files`, `comics`, `nhentai`, `contentSearch`, `comicsTags`. Каждая — `render(destroy?)` + `destroy()`. Роутинг по `location.pathname` через `switch`.

### Shared grid-renderer (`static/shared/grid-renderer.js`)
ES-модуль, используемый `comics-tags.js` и `tags-manage.js`. Содержит: `buildLeftPanelHtml()`, `renderLeftTags()`, `setupDragEvents()`, `comicCardHTML()`, `buildComicsGridHTML()`.

## CSS (8 файлов, 2269 строк)

| Файл | Строк | Что |
|------|-------|------|
| `shared.css` | 281 | CSS vars, темы, base, header, fonts |
| `content.css` | 676 | CM: tags, files, comics, picker, drag-to-tag |
| `content-search.css` | 294 | Content search page |
| `admin.css` | 424 | Admin SPA |
| `mediavault.css` | 228 | Gallery, lightbox, sidebar, mobile (последний!) |
| `tagfetch.css` | 170 | Tagfetch panels |
| `settings.css` | 128 | Settings tabs |
| `shared-grid.css` | 68 | Shared masonry/grid for CM |

## i18n

- Сервер: `LOCALE` dict (строки 159-1127, ~490 пар en/ru), `_()` в Jinja2
- Клиент: `_i18nData` в `base.html`, `_t('key')` в JS
- `Shared.toggleLang()` — без перезагрузки
- `--check locale` + `--fix` в test.py

## Тестирование

`test.py` (781 строка) — кастомный CLI-раннер, **не pytest**:

| Флаг | Проверка |
|------|----------|
| `--check py` | `python -m py_compile src/*.py` |
| `--check js` | `node --check static/**/*.js` |
| `--check css` | CSS непустые |
| `--check locale` | AST-парсинг LOCALE: en↔ru parity, JS sync, дубликаты |
| `--check dead` | AST (Python) + regex (JS) — неиспользуемые публичные функции |
| `--check func` | Инжект Python в subprocess — хелперы |
| `--check smoke` | Flask на :15050, GET /login (200) + /api/gallery (401) |

**Без флагов** → syntax + locale + dead + func. **Smoke исключён.**

Конвенции:
- Нет `tests/` — есть `test/` (ед.ч.)
- Нет pytest, conftest, CI/CD, Docker, Makefile, ruff, flake8, pyproject.toml
- Dead code detection — кастомная (regex), false positives возможны
- `test/test_comics_pages.py` — Playwright E2E (standalone, через `sys.path.insert(0, '~/.agents/skills/webapp-testing')`)

## Key JS files

- `static/shared/utils.js` — `Shared.hexToRgba()`, `parseTags()`, `getColumnCount()`, `getVisualOrder()`, `toggleTheme()`, `toggleLang()`, `applyI18n()`, `_cbSuffix()`
- `static/admin/admin.js` — `_saveSettings()`, `_scanFolder()`, `_rescanFolder()`, 5 секций
- `static/shared/icons.js` — `SiteIcons.getIcon(site)`
- `static/shared/lightbox.js` — shared Lightbox класс
- `static/shared/grid-renderer.js` — shared grid компоненты для CM

## gallery-dl backend (`src/backends/gallerydl.py`, 407 строк)

- subprocess (CLI), не Python API
- `is_available()` → `gallery-dl --version`
- `get_info(url)` → `--list-urls`
- `download(url, dest)` → `--directory`
- NHentai search: параллельные запросы через `ThreadPoolExecutor(max_workers=8)` — sequential 25 запросов упирались в 30s timeout
- gallery-dl CLI в `PATH` (не только в venv)
- `src/backends/api_raw.py` (210 строк) — второй бэкенд (raw API, для NHentai)

## Docs

| Файл | О чём |
|------|-------|
| `docs/code-guide.md` | Архитектура, backend, frontend, все роуты |
| `docs/new-features-summary.md` | Сводка новых фич + чеклист тестирования |
| `docs/user-guide.md` | Руководство пользователя |
| `DESING.md` | Дизайн-система: цвета, шрифты, компоненты |
| `docs/FAQ.md` | Частые вопросы |
| `docs/GLOSSARY.md` | Словарь терминов |
| `docs/TROUBLESHOOTING.md` | Решение проблем |
| `roadmap/roadmap.md` | Роадмап проекта |
