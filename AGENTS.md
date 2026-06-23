# MediaVault

Flask SPA (`src/web_app.py`, 5214 строк, 98 роутов, 50 `@admin_required`, 9 `@auth_required`, 77 `@api_error_handler`) + `src/credential_store.py` (124). Три под-приложения: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`). 17 Jinja2-шаблонов, 32 JS-модуля (9778 строк без lib/), 8 CSS-файлов (2585 строк).

## Команды

```bash
venv/bin/python src/web_app.py                        # http://0.0.0.0:5050
venv/bin/python src/web_app.py --debug                # авто-релоад + verbose
venv/bin/python src/web_app.py --bind 127.0.0.1
venv/bin/python test.py                               # py + js + css + locale + dead + func
venv/bin/python test.py --check py/js/css/locale/func/dead/smoke
venv/bin/python test.py --fix                         # удаление неиспользуемых i18n ключей
venv/bin/pyinstaller mediavault.spec --clean --noconfirm
```

Без флагов `test.py` запускает всё кроме smoke. Smoke стартует Flask на :15050.

## Критические конвенции

- **Decorator order**: `@app.route` → `@admin_required` → `@api_error_handler`. Иначе 403→500.
- **`if data is None:`** — пустой `{}` falsy. Все API так.
- **ES module timing**: `{% block content %}` рендерится **до** `{% block scripts %}`. Модульные скрипты в content load/defer раньше. **Top-level ошибка в ES-модуле блокирует ВСЕ остальные скрипты**. Любой `new Lightbox(...)` — в try-catch.
- **`Lightbox.close()`** — guard `_el('Media')` на null перед `querySelector('video')`. Без этого `close()` до `open()` кидает TypeError. `shared/lightbox.js:279`.
- **CSS loading order**: `shared.css` → (content.css / content-search.css / admin.css / tagfetch.css / settings.css) → `mediavault.css` **последний** (специфичность без `!important`).
- **Header**: inline в `base.html`. Desktop `.hdr-desktop` + mobile `.hdr-mobile` через CSS media (768px). **Нет `window.innerWidth`** в JS.
- **Desktop-only**: `.desktop-only` скрыт на mobile CSS. Mobile **не получает HTML** для sidebar, search panel, toolbar.
- **SPA**: `content-mgmt/*`, `settings`, `admin` — extend `base.html`, контент через JS. **Standalone**: `login.html`. `popular_tags`, `view` — suppress header blocks.
- **localStorage keys**: `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`, `mediavault_lang`, `mediavault_folder_filter`.
- **Auth**: Flask сессии. `@admin_required` → 403 JSON. `@auth_required` → 401 JSON. `@api_error_handler` → 500 JSON.
- **Icons**: inline SVG. **Нет emoji**. SVG sun/moon для темы, текст RU/EN.
- **`_has_users_cached`** — in-memory флаг, сбрасывается при add/remove user.
- **`clear_thumb_cache`** — удаляет SQLite BLOBs (файлов нет).
- **`browser_cache`** (default/reduced/nocache) → `Cache-Control` на `/api/media` и `/api/thumbnail`.
- **`load_settings()`** — `setdefault()` для всех новых ключей.
- **`_has_non_meta_tags(tag_str)`** — false если только META_TAGS или aspect-ratio.

## SQLite / БД

- **~/.local/share/MediaVault/MediaVaultDataBase.db**. WAL + busy_timeout=5000 на каждом соединении в `_db_conn()`.
- **Нет `DROP TABLE`** — exclusive lock даже в WAL. `DELETE FROM`. `VACUUM` → `PRAGMA wal_checkpoint(TRUNCATE)`.
- **`_quick_scan(force=False)`** — threading.Lock c blocking=False. Любой return внутри try → finally отпускает lock.
- Фоновые сканы — `threading.Thread(target=_quick_scan, daemon=True).start()`.
- **`_scan_progress`** — dict с полями status/current_folder/total_folders/folders_done/error. АPI: `GET /api/admin/scan-progress`.

## JS модули (32, 9778 строк)

| Паттерн | Файлы |
|---------|-------|
| **IIFE + `window.*`** | `shared/` (7), `mediavault/` (4), `tagfetch/` (2), `admin/` (1) |
| **ES modules** | `content/` (7), `shared/home-bg.js`, `shared/grid-renderer.js` |

**CM SPA lifecycle** (`static/content/main.js`): секции tags/files/comics/nhentai/contentSearch/comicsTags. Каждая `render(destroy?)` + `destroy()`. Роутинг по `location.pathname`.

**Shared grid-renderer** (`static/shared/grid-renderer.js`): ES-модуль для comics-tags.js, tags-manage.js. Содержит buildLeftPanelHtml/renderLeftTags/setupDragEvents/comicCardHTML/buildComicsGridHTML.

**Background downloads**: `_download_tasks` dict + Lock. `_start_background_task(type, fn, *args)` → daemon thread. `GET /api/content-search/task/<task_id>` — поллинг. `POST .../download-async` — одительный, `.../download-manga-async` — NHentai (ThreadPoolExecutor 4 workers). `overwrite=True` удаляет файлы перед перезагрузкой.

## gallery-dl backend (`src/backends/gallerydl.py`, 455 строк)

CLI subprocess (не Python API). `is_available` → `gallery-dl --version`. `get_info(url)` → `--list-urls`. `download(url, dest)` → `--directory`. NHentai search: ThreadPoolExecutor 8 workers (sequential 25 запросов > 30s timeout). gallery-dl в PATH. `api_raw.py` (351 строка) — второй бэкенд (raw API для NHentai).

## NHentai tags (v1.2.0)

Типы из API v2 маппятся в категории: tag→general, artist→artist, character→character, parody→copyright, group→general, language→meta, category→general. Теги сохраняются в `tag_category_members` (глобальный реестр для левой панели) + `comics.tags` (CSV для комикса). `file_tags` — для MV gallery per-page. `comic_tags` таблица **не используется** (удалена как избыточная).

## Тестирование

`test.py` (783 строки) — кастомный CLI, **не pytest**:

| Флаг | Проверка |
|------|----------|
| `--check py` | `python -m py_compile src/*.py` |
| `--check js` | `node --check static/**/*.js` |
| `--check css` | CSS непустые |
| `--check locale` | AST-парсинг LOCALE: en↔ru parity, JS sync, дубликаты |
| `--check dead` | AST (Python) + regex (JS) — неиспользуемые публичные функции |
| `--check func` | Инжект Python в subprocess |
| `--check smoke` | Flask на :15050, GET /login (200) + /api/gallery (401) |

Нет pytest, conftest, CI/CD, Docker, Makefile, ruff, flake8, pyproject.toml. `test/` директории нет на диске. Dead code detection — кастомная (regex), возможны false positives.

## Технические детали

- **Thumbnails**: AVIF (Pillow для изображений, FFmpeg для видео). Константы: `_THUMB_LARGE=360`, `_THUMB_XL=600`, `_THUMB_RATIO_LIMIT=21/9`.
- **Key JS files**: `static/shared/utils.js` (Shared.*), `static/shared/lightbox.js` (Lightbox класс с arrowNav опцией), `static/shared/icons.js` (SiteIcons.getIcon), `static/admin/admin.js` (5 секций + scan progress polling), `static/content/comics-picker.js` (preview animation).
- **Документация**: `docs/code-guide.md` (архитектура, роуты), `docs/user-guide.md` (пользовательская), `DESING.md` (дизайн-система), `roadmap/roadmap.md`.
