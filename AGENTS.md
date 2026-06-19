# MediaVault

Flask single-file (`src/web_app.py`, 4062 строки, 87 роутов, 52 `@admin_required`, 8 `@auth_required`, 66 `@api_error_handler`) + `src/credential_store.py` (122). Три под-приложения: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`).

## Команды

```bash
venv/bin/python src/web_app.py             # http://0.0.0.0:5050
venv/bin/python src/web_app.py --debug     # авто-релоад + verbose
venv/bin/python src/web_app.py --bind 127.0.0.1
venv/bin/python test.py                    # syntax + locale + dead + func
venv/bin/python test.py --check py/js/css/locale/func/dead/smoke
venv/bin/python test.py --fix              # удаление неиспользуемых i18n ключей
venv/bin/pyinstaller mediavault.spec --clean --noconfirm   # onefile (29 MB)
```

Deps: `flask`, `requests`, `Pillow`, `gallery-dl` — в `venv/`. FFmpeg нужен для видео-превью + `ffprobe`.

## Конвенции (критические)

- **`if data is None:`** — пустой `{}` falsy в Python. Все API так.
- **`window.fnName`** для `onclick` — IIFE модули экспортят глобалы (`Shared.*`, `AdminDashboard.*`, `ContentManager.*`). Проверять шаблон перед переименованием.
- **`_has_non_meta_tags(tag_str)`** — false если только META_TAGS (`sound`, `animated`, `photo`, `video`, `gif`) или aspect-ratio (`^\d+:\d+$`).
- **Thumbnail constants**: `_THUMB_LARGE = 360`, `_THUMB_XL = 600`, `_THUMB_RATIO_LIMIT = 21/9`.
- **Icons**: inline SVG. **Нет emoji**. SVG sun/moon для темы, текст RU/EN.
- **CSS loading order**: `shared.css` → (content.css / content-search.css / admin.css / tagfetch.css / settings.css) → `mediavault.css` **последний** (специфичность без `!important`).
- **Header**: inline в `base.html`, никаких partials. Desktop `.hdr-desktop` + mobile `.hdr-mobile` через CSS media (768px). **Нет `window.innerWidth` в JS**.
- **Desktop-only**: `.desktop-only` скрыт на mobile CSS. Mobile **не получает HTML** для sidebar, search panel, toolbar.
- **SPA страницы**: `content-mgmt/*`, `settings`, `admin` — extend `base.html`, контент через JS. **Standalone** (не extend base): `login.html`. `popular_tags`, `view` — suppress header blocks.
- **localStorage keys**: `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`, `mediavault_lang`.
- **Lightbox position (`lb-pos`)**: визуальный порядок (`getVisualOrder()` → `getBoundingClientRect()` top→left), не data-array порядок.
- **`ComicsPicker`**: единый компонент, `shared/comics/comics.js`. Через `ComicsPicker.openPicker()`. Для ES-модулей CM — `picker-bridge.js`.
- **`comics-list.html`**: один шаблон для MV view (`mode != 'edit'`) и CM редактора (`mode == 'edit'`).
- **Auth**: Flask сессии. `@admin_required` → 403 JSON. `@auth_required` → 401 JSON. `@api_error_handler` → 500 JSON. **Порядок**: `@app.route` → auth → `@api_error_handler`.
- **`three_bg`** — отдельный тоггл от `effects`. `data-three-bg="0"` скрывает Three.js canvas через MutationObserver в `home-bg.js`.
- **`_has_users_cached`** — in-memory флаг, сбрасывается при add/remove user.
- **`clear_thumb_cache`** — удаляет SQLite BLOBs только (файлов нет).
- **`browser_cache`** (default/reduced/nocache) → `Cache-Control` на `/api/media` и `/api/thumbnail`.
- **`load_settings()`** — `setdefault()` для всех новых ключей.
- **`Lightbox.close()`** — **всегда** проверять `_el('Media')` на null перед вызовом `querySelector('video')`. Без этого guard вызов `close()` до `open()` кидает TypeError. См. `shared/lightbox.js:279`.

## ES module timing bug (важно!)

`{% block content %}` рендерится **до** `{% block scripts %}` в Jinja. Модульные скрипты в `content` load/defer раньше обычных в `scripts`. **Top-level ошибка в ES-модуле блокирует ВЕСЬ остальной код** — не только после ошибки, но и все остальные скрипты на странице. Любой `new Lightbox(...)` или другой вызов в модуле должен быть в try-catch.

## Тестирование

### `test.py` (781 строка)

Кастомный CLI-раннер, **не pytest**:

| Флаг | Что проверяет |
|------|---------------|
| `--check py` | `python -m py_compile` на `src/*.py` |
| `--check js` | `node --check` на `static/**/*.js` |
| `--check css` | CSS непустые |
| `--check locale` | AST-парсинг LOCALE: en↔ru parity, JS sync, дубликаты |
| `--check dead` | AST (Python) + regex (JS) — неиспользуемые публичные функции |
| `--check func` | Инжект Python в subprocess — хелперы |
| `--check smoke` | Flask на :15050, GET /login (200) + /api/gallery (401) |

**Без флагов** → syntax + locale + dead + func. **Smoke исключён.**

### Playwright E2E

`test/test_comics_pages.py` — standalone, не встроен. Playwright через `sys.path.insert(0, '~/.agents/skills/webapp-testing')`.

### Конвенции
- Нет `tests/` — есть `test/` (ед.ч.)
- Нет pytest, conftest, CI/CD, Docker, Makefile, ruff, flake8, pyproject.toml
- Dead code detection — кастомная (regex), false positives возможны
- README.md упоминает `check.py` — **файл называется `test.py`**

## JS модули (30 файлов, 8765 строк без lib/)

| Паттерн | Директории |
|---------|-----------|
| **IIFE + `window.*`** | `shared/`, `mediavault/`, `tagfetch/`, `admin/` |
| **ES modules** (`import`/`export`) | `content/` (все 8 файлов), `shared/home-bg.js` |

### CM SPA lifecycle (`static/content/main.js`)
Секции: `tags`, `files`, `comics`, `nhentai`, `contentSearch`, `comicsTags`. Каждая — `render(destroy?)` + `destroy()`. Роутинг по `location.pathname` через `switch`.

## CSS (7 файлов, 2140 строк)

| Файл | Строк | Что |
|------|-------|-----|
| `shared.css` | 303 | CSS vars, темы, base, header, fonts (Unbounded + IBM Plex Sans) |
| `content.css` | 684 | CM: tags, files, comics, picker, drag-to-tag |
| `content-search.css` | 189 | Content search page |
| `admin.css` | 418 | Admin SPA: cards, tables, modals, 5-section nav |
| `mediavault.css` | 242 | Gallery, lightbox, sidebar, mobile (последний!) |
| `tagfetch.css` | 182 | Tagfetch panels |
| `settings.css` | 122 | Settings tabs, cards |

## Шаблоны (17, 1601 строка)

Все кроме `login.html` extend `base.html`. Полный список — `docs/code-guide.md`.

## i18n

- Сервер: `LOCALE` dict (~435 строк, строка 155-590), `_()` в Jinja2
- Клиент: `_i18nData` в `base.html`, `_t('key')` в JS
- `Shared.toggleLang()` — без перезагрузки
- `--check locale` + `--fix` в test.py

## Ключевые JS файлы

- `static/shared/utils.js` — `Shared.hexToRgba()`, `parseTags()`, `getColumnCount()`, `getVisualOrder()`, `toggleTheme()`, `toggleLang()`, `applyI18n()`, `_cbSuffix()`
- `static/admin/admin.js` — `_saveSettings()`, `_errorFallback()`, `_saveCredBackend()`, 5 секций (Users, Database, API Keys, Folders, Backends)
- `static/shared/icons.js` — `SiteIcons.getIcon(site)`, поддерживает rule34, danbooru, nhentai, kemono, coomer
- `static/shared/lightbox.js` — shared Lightbox класс

## gallery-dl backend (`src/backends/gallerydl.py`, 379 строк)

- subprocess (CLI), не Python API
- `is_available()` → `gallery-dl --version`
- `get_info(url)` → `--list-urls`
- `download(url, dest)` → `--directory`
- gallery-dl CLI в `PATH` (не только в venv)
- `src/backends/api_raw.py` (196 строк) — второй бэкенд (raw API)

## Three.js

- Self-hosted: `static/lib/three.module.js` (v0.160.0)
- Importmap: `"three": "/static/lib/three.module.js"`
- `static/shared/home-bg.js` — `initHomeBg(opts)` с `beforeRender` хуком
- Используется в `home.html` и `login.html`

## Архитектура

- **Decorator order**: `@app.route` → `@admin_required` → `@api_error_handler` (нарушение ломает auth)
- **User/admin**: шаблоны `{% if session.role == 'admin' %}`, бэкенд через `@admin_required`
- **Two-level logging**: `log_debug()`/`log_info()`/`log_error()` с ANSI цветами
- **Per-site credentials**: `credentials.rule34.*`, `credentials.danbooru.*` в settings
- **Franchise search**: `/franchise-search`, параллельный dispatch через ThreadPoolExecutor

## Docs

| Файл | О чём |
|------|-------|
| `docs/code-guide.md` | Архитектура, backend, frontend, все роуты, counts |
| `docs/new-features-summary.md` | Сводка новых фич + чеклист тестирования |
| `docs/user-guide.md` | Руководство пользователя |
| `DESING.md` | Дизайн-система: цвета, шрифты, компоненты |
| `docs/FAQ.md` | Частые вопросы |
| `docs/GLOSSARY.md` | Словарь терминов |
| `docs/TROUBLESHOOTING.md` | Решение проблем |
| `roadmap/roadmap.md` | Роадмап проекта |
