# MediaVault

Flask single-file (`src/web_app.py`, 3847 строк, 80 роутов, 40 `@admin_required`, 2 `@auth_required`, 61 `@api_error_handler`) + `src/credential_store.py` (67). Три под-приложения: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`).

## Команды

```bash
venv/bin/python src/web_app.py             # http://0.0.0.0:5050
venv/bin/python src/web_app.py --debug     # авто-релоад + verbose
venv/bin/python src/web_app.py --bind 127.0.0.1
venv/bin/python test.py                    # синтаксис + локаль + мёртвый код + тесты
venv/bin/python test.py --check py         # только Python
venv/bin/python test.py --check js         # только JavaScript
venv/bin/python test.py --check css        # только CSS
venv/bin/python test.py --check locale     # только i18n
venv/bin/python test.py --check func       # только функциональные тесты
venv/bin/python test.py --check dead       # только мёртвый код
venv/bin/python test.py --check smoke      # smoke-тест (запуск Flask)
```

```bash
venv/bin/pyinstaller mediavault.spec --clean --noconfirm   # сборка onefile (29 MB)
```

## Релиз (AUR)

```bash
mv dist/mediavault dist/mediavault-linux-amd64
sha256sum dist/mediavault-linux-amd64
# → GitHub Release v1.0.0, загрузить binary как assets
# → обновить sha256sums в packaging/aur/mediavault-bin/PKGBUILD
# → скопировать packaging/aur/mediavault-bin/ → AUR git → push
```

## PKGBUILD

`packaging/aur/mediavault-bin/PKGBUILD` + `mediavault.install` (post_install: gnome-keyring hint). `depends=('ffmpeg')`, `optdepends=('gnome-keyring')`.

Deps: `flask`, `requests`, `Pillow`, `gallery-dl` — в `venv/`. FFmpeg нужен для видео-превью + определения звука (`ffprobe`).

## Конвенции (не очевидные)

- **`if data is None:`** — пустой `{}` falsy в Python. Все API так.
- **`window.fnName`** для `onclick` — IIFE модули экспортят глобалы (`Shared.*`, `AdminDashboard.*`, `ContentManager.*`). Проверять шаблон перед переименованием.
- **`_has_non_meta_tags(tag_str)`** — false если только META_TAGS (`sound`, `animated`, `photo`, `video`, `gif`) или aspect-ratio (`^\d+:\d+$`).
- **Thumbnail constants**: `_THUMB_LARGE = 360`, `_THUMB_XL = 600`, `_THUMB_RATIO_LIMIT = 21/9`.
- **Icons**: inline SVG. **Нет emoji**. SVG sun/moon для темы, текст RU/EN.
- **CSS loading order**: `shared.css` → (content.css / admin.css / tagfetch.css / settings.css) → `mediavault.css` **последний** (специфичность без `!important`).
- **Header**: inline в `base.html`, никаких partials. Блоки: `hdr_brand`, `hdr_tabs`, `hdr_nav`, `hdr_actions`, `hdr_search`, `hdr_drawer`. Desktop `.hdr-desktop` + mobile `.hdr-mobile` скрываются/показываются через CSS media queries (768px). **Нет `window.innerWidth` в JS**.
- **Desktop-only**: `.desktop-only` скрыт на mobile CSS. Mobile **не получает HTML** для sidebar, search panel, toolbar controls.
- **SPA страницы**: `content-mgmt/*`, `settings`, `admin` — extend `base.html`, контент через JS. **Standalone**: `login.html` (не extend base), `popular_tags`, `view` — suppress header blocks.
- **localStorage keys**: `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`, `mediavault_lang`.
- **Lightbox position (`lb-pos`)**: визуальный порядок (`getVisualOrder()` → `getBoundingClientRect()` top→left), не data-array порядок. Важно для column-masonry.
- **`ComicsPicker`**: единый компонент, `shared/comics/comics.js`. Открывается через `ComicsPicker.openPicker()`. В MV mode доступен через `picker-bridge.js` для ES-модулей CM.
- **`comics-list.html`**: один шаблон для двух режимов — MV view (`mode != 'edit'`) и CM редактор (`mode == 'edit'`). Флаг `mode` из роута.
- **Auth**: сессии Flask. `@admin_required` → 403 JSON. `@auth_required` → 401 JSON. `@api_error_handler` → 500 JSON с трассировкой. **Порядок**: `@app.route` → auth → `@api_error_handler`.
- **`three_bg`** — отдельный тоггл от `effects`. `data-three-bg="0"` на `<html>` скрывает Three.js canvas через MutationObserver в `home-bg.js`. Не зависит от `data-no-effects`.
- **`_has_users_cached`** — in-memory флаг существования пользователей (проверка при логине, сбрасывается при add/remove user).
- **`clear_thumb_cache`** — удаляет SQLite BLOBs только (физических файлов нет).
- **`browser_cache`** — настройка (default/reduced/nocache) управляет `Cache-Control` на `/api/media` и `/api/thumbnail`.
- **`load_settings()`** — использует `setdefault()` для всех новых ключей (`fetch_backend`, `browser_cache`, `gallery_dir`, `comics_dir`, `cache_buster`).

## Тестирование

### `test.py` (корень, 782 строки)

Кастомный CLI-раннер, **не pytest**:

| Флаг | Что проверяет |
|------|---------------|
| `--check py` | `python -m py_compile` на всех `src/*.py` |
| `--check js` | `node --check` на всех `static/**/*.js` |
| `--check css` | CSS-файлы непустые |
| `--check syntax` | py + js + css |
| `--check locale` | AST-парсинг LOCALE из web_app.py: en↔ru parity, JS sync, дубликаты |
| `--check dead` | AST (Python) + regex (JS) — неиспользуемые публичные функции |
| `--check func` | Инжект строки Python в subprocess — `_has_non_meta_tags()`, `_get_aspect_ratio_tag()`, `_get_file_type()`, `_is_dir_empty()` |
| `--check smoke` | Запуск Flask на :15050, GET /login (200) + /api/gallery (401) |
| `--watch` | MD5-хуки, авто-перезапуск при изменениях |
| `--fix` | Удаление неиспользуемых i18n ключей из web_app.py + utils.js |

**Без флагов** → syntax + locale + dead + func. **Smoke исключён.**

### Playwright E2E

`test/test_comics_pages.py` — standalone, НЕ встроен в test.py.
Проверяет: вёрстку карточек, грид, ComicsPicker, консольные ошибки.

**Тестовых зависимостей нет** — ни pytest, ни Playwright нет в requirements.txt.
Playwright импортируется через `sys.path.insert(0, '~/.agents/skills/webapp-testing')`.

### Конвенции тестирования
- Нет `tests/` — есть `test/` (ед.ч., один файл)
- Нет conftest.py, фикстур, pytest-конфига
- Нет CI/CD вообще (ни `.github/workflows/`, ни Docker, ни Makefile)
- Dead code detection — кастомная (не coverage), регексы могут давать false positives
- README.md упоминает `check.py` — **файл называется `test.py`**

## Билд и CI

### PyInstaller

```bash
venv/bin/pyinstaller mediavault.spec --clean --noconfirm   # → dist/mediavault (29 MB)
```

Spec: onefile, hidden imports `PIL._tkinter_finder` + `keyring.backends.*`, bundled templates/ + static/.
**requirements.txt НЕ включает pyinstaller** — ставится руками.

### Dev tooling

**Нет вообще**: нет `.editorconfig`, `.eslintrc*`, `.prettierrc*`, `ruff.toml`, `.flake8`, `pyproject.toml`, `Makefile`, `.github/workflows/`, Dockerfile. Единственная автоматизация — `test.py`.

## Three.js (offline)

- Self-hosted: `static/lib/three.module.js` (v0.160.0, 53044 строк)
- Importmap во всех шаблонах: `"three": "/static/lib/three.module.js"`
- Shared модуль: `static/shared/home-bg.js` — `initHomeBg(opts)` с `beforeRender` хуком
- Используется в `home.html` и `login.html`

## Бэкенды (backends)

### gallery-dl (универсальный)

- **Файл:** `src/backends/gallerydl.py` — `GalleryDlBackend`
- **Назначение:** Загрузка файлов с Kemono/Coomer
- **Реализация:** Через subprocess (CLI), не Python API
- **Методы:** `is_available()` → `gallery-dl --version`; `get_info(url)` → `--list-urls`; `download(url, dest)` → `--directory`
- **Требования:** gallery-dl CLI в `PATH` (не только в venv)
- **Ограничения:** Нет метаданных (title/tags/date), нет кук, нет dedup
- **Python API (будущее):** `gallery_dl.extractor.find()`, `job.DataJob()`, `job.DownloadJob()`
- **Установка:** `pip install gallery-dl` (уже в venv)

## Роуты (80)

9 групп. Полный справочник — `docs/code-guide.md` раздел 6.

## JS модули (27 файлов, 7190 строк без lib/)

| Паттерн | Директории |
|---------|-----------|
| **IIFE + `window.*`** | `shared/`, `mediavault/`, `tagfetch/`, `admin/` |
| **ES modules** (`import`/`export`) | `content/`, `shared/home-bg.js` |

Всего 6 файлов с `import`: `content/` (main, tags, files, comics, nhentai_search) + `home-bg.js`.

## CSS (6, 1638 строк)

| Файл | Строк | Что |
|------|-------|-----|
| `shared.css` | 257 | CSS vars, темы, base, header, fonts (Unbounded + IBM Plex Sans self-hosted) |
| `content.css` | 460 | CM: tags, files, comics |
| `admin.css` | 416 | Admin SPA: cards, tables, modals, 5-section nav |
| `mediavault.css` | 244 | Gallery, lightbox, sidebar, mobile (загружается последним) |
| `tagfetch.css` | 129 | Tagfetch panels |
| `settings.css` | 112 | Settings tabs, cards |

## Шаблоны (16, 2175 строк)

Все кроме `login.html` extend `base.html`. См. `docs/code-guide.md` секция 7.

## i18n

- Сервер: `LOCALE` dict (209 en + 210 ru, 435 строк, строка 155-590), `_()` в Jinja2
- Клиент: `_i18nData` в `base.html`, `_t('key')` в JS
- `Shared.toggleLang()` — переключение без перезагрузки

## Shared.* utilities (`static/shared/utils.js`, 903 строки)

`Shared.hexToRgba()`, `Shared.parseTags()`, `Shared.getColumnCount()`, `Shared.reorderGalleryDOM()`, `Shared.getVisualOrder()`, `Shared.toggleTheme()`, `Shared.toggleLang()`, `Shared.applyI18n()`, `Shared.logout()`, `Shared.toggleDropdown()`, `Shared._cbSuffix()` (читает `CONFIG.cacheBuster`).

## Admin JS: DRY helpers (`static/admin/admin.js`, 741 строка)

- `_saveSettings(data, msg)` — POST `/api/settings` + toast (7 мест → 1)
- `_errorFallback(body, e)` — единый показ ошибки в catch (4 места → 1)
- `_saveCredBackend()` — сохранение credential backend (переименован из `_selectBackend`)
- **5 секций:** Users, Database, API Keys, Folders, Backends

## Site Icons (`static/shared/icons.js`, 30 строк + 5 SVG)

- `window.SiteIcons.getIcon(site)` — data URI (favicon)
- `window.SiteIcons.getIconImg(site, size)` — `<img>` с data URI
- `window.SiteIcons.getIconDataURI(site)` — data URI
- Поддерживаемые сайты: rule34, danbooru, nhentai, kemono, coomer

## New Features (branch new-features)

Полная документация — `docs/code-guide.md` раздел 24, `docs/new-features-summary.md`.

| Фича | Ключевые файлы | i18n |
|------|---------------|------|
| Backend system | `src/backends/*.py` | — |
| Backend Selection UI | `static/admin/admin.js` | `sectionBackends`, `backendsDesc`, `backend*`, `site*`, `navBackends` |
| Site Icons | `static/shared/icons.js`, `static/shared/icons/*.svg` | — |
| Folder System | `web_app.py`, `admin.js` | `adminGalleryDir`, `adminComicsDir`, `navFolders`, `sectionFolders` |
| Browser Cache | `web_app.py`, `settings.html` | `settingsBrowserCache*` |
| UPSERT for source | `web_app.py` lines 965, 1029 | — |
| Kemono URL | `gallerydl.py`, `web_app.py` | — |
| Redesign | `gallery.html`, `view.html`, `mediavault.css` | — |
| Comics fixes | `content.css`, `view.html` | — |
| Admin refactoring | `static/admin/admin.js` | `navFolders`, `navBackends` |
| NHentai Search | `home.html` | `homeComicsFetch` |
| Dead code removal | `web_app.py` batch_scan | — |

## Планы на будущее (16.06.2026)

Остался один Feature — Gallery-dl универсальный.

### Per-site credentials ✅ (Feature 7 — done)
- Мигрированы `r34_uid/r34_key/dan_login/dan_key` в per-site формат: `credentials.rule34.*`, `credentials.danbooru.*`
- Admin UI: поля grouped by site с иконками
- KeyringStore: ключи `api:site:keyname` вместо `api:r34_uid`
- load_settings()/save_settings() — миграция + per-site чтение

### Franchise search (Feature 8) ✅ — done
- `/franchise-search` страница + `/api/franchise/search` endpoint
- Сервер-сайд рендеринг (без отдельного JS модуля)
- Параллельный dispatch: ThreadPoolExecutor → search_tags() для rule34, danbooru, nhentai
- Header link + 6 i18n ключей

### Gallery-dl как универсальная альтернатива (Feature 6)
- **НЕ** используем rule34Py, Pybooru, enma, nhentai-tools
- gallery-dl (уже в venv) как второй бэкенд для R34/Danbooru/NHentai
- GalleryDlBackend.fetch() + search() для всех сайтов
- 2 варианта per-site в UI: raw_api или gallery_dl
- gallery-dl сам обходит Cloudflare

## Docs

| Файл | О чём |
|------|-------|
| `docs/code-guide.md` (2846+) | Архитектура, backend, frontend, все роуты, counts, библиотеки, планы |
| `docs/new-features-summary.md` (395+) | Сводка всех новых фич + чеклист тестирования |
| `docs/user-guide.md` (665) | Руководство пользователя |
| `DESING.md` (924) | Дизайн-система: цвета, шрифты, компоненты |
| `docs/FAQ.md` | Частые вопросы |
| `docs/GLOSSARY.md` | Словарь терминов |
| `docs/TROUBLESHOOTING.md` | Решение проблем |
| `roadmap/roadmap.md` | Роадмап проекта |
