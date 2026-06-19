# MediaVault — Сводка изменений (new-features branch)

## Session: 17.06.2026
**Статус:** 7 параллельных агентов ✅ все завершены

---

## 🔴 Удалено

| Файл | Что |
|------|-----|
| `src/backends/nokufind.py` | NokufindBackend класс (целиком) |
| `docs/ideas/batch-card-overlay.md` | Идея (неактуально) |
| `docs/ideas/ideas.md` | Идеи (неактуально) |

## 🔵 Зависимости (requirements)

| Изменение | Детали |
|-----------|--------|
| `cloudscraper` | Убран из `requirements.txt` и `AGENTS.md` deps |

---

## ✏️ Изменено: Бэкенды (src/backends/)

### `__init__.py`
- Убран импорт `NokufindBackend`
- BACKENDS dict: удалён `'nokufind': NokufindBackend()`
- `_DEFAULT_BACKEND['nhentai']` → `'gallerydl'`

### `api_raw.py`
- Удалён `_get_scraper()` (cloudscraper lazy init)
- Удалён `import cloudscraper`
- `_fetch_nhentai()`: `scraper.get()` → `requests.get()`
- `_search_nhentai()`: `scraper.get()` → `requests.get()`
- NHentai методы теперь используют plain `requests` с User-Agent

### `gallerydl.py`
- Добавлены `fetch()` и `search()` для danbooru/rule34/nhentai через gallery-dl Python API
- Исправлен путь к gallery-dl CLI: использует `sys.executable` parent dir (venv)
- `is_available()`: проверяет venv PATH + system PATH
- `get_info()`/`download()`: fallback на venv путь gallery-dl
- Добавлен debug logging (`_log`)

---

## ✏️ Изменено: Сервер (src/web_app.py)

| Что | Детали |
|-----|--------|
| **Franchise Search** (строки 1641-1681) | Route + API endpoint, параллельный dispatch через ThreadPoolExecutor |
| **Backend dispatch** | `fetch_tags()` из `backends/__init__.py` |
| **load_settings()** | `setdefault()` для новых ключей (fetch_backend, browser_cache) |
| **Kemono URL regex** | Добавлены домены .cr/.cv/.party/.so/.us/.co |
| **Per-site credentials** | Чтение из credential_store |
| **Browser cache** | Cache-Control + ETag на /api/media + /api/thumbnail |
| **i18n** | `backendApiRaw` label: `'API Raw (Rule34 / Danbooru)'` → `'API Raw'` |
| **VACUUM** | После деструктивных операций |

---

## ✏️ Изменено: Фронтенд (templates/)

### `nhentai_search.html`
- **Agent A — NHentai Search fix**
- Исправлен loading state (спиннер исчезает после загрузки)
- Detail view: обложка, теги, stats (ID/pages/tag count), admin-card layout
- Color-coded tag chips с category labels

### `franchise_search.html`
- **Agent B — Franchise Search fix**
- Preview fallback: если preview_url пуст, использует file_url/sample_url
- onerror handler: fallback цепочка для изображений
- Debug info: показывает бэкенд + URL для каждого результата
- Исправлен Danbooru preview_url (было `preview_url`, нужно `preview_file_url`)

### `kemono_import.html`
- **Agent C — Kemono gallery-dl fix**
- Исправлен путь к gallery-dl (venv vs system PATH)
- Debug logging добавлен

### `view.html`
- **Agent D — Comics counter fix**
- `_currentPage` scroll handler исправлен
- IntersectionObserver-based tracking
- Счётчик обновляется плавно, без dead zone

### `admin/admin.html`
- **Agent E — Admin Folders→Database**
- Убран nav link для Folders (data-section="folders")

### `settings.html`
- **Agent F — Settings backend selection** ✅
- Database tab: добавлен Backend Selection card с иконками сайтов
- Per-site dropdown (api_raw / gallerydl) для rule34/danbooru/nhentai
- kemono/coomer: только gallerydl
- Save кнопка → POST /api/settings

---

## ✏️ Изменено: Фронтенд (JS)

| Файл | Что |
|------|-----|
| `static/content/nhentai_search.js` | **Agent A** — переработка: loading states, detail view, abort guards |
| `static/admin/admin.js` | **Agent E** — Folders card moved to Database section, router updated |
| `static/shared/utils.js` | `_cbSuffix()`, browser cache helpers |
| `static/content/tags-manage/tags-manage.js` | CMS lightbox fix (source=tags) |
| `static/content/main.js` | Backend dispatch wiring |
| `static/tagfetch/auto/auto.js` | Redesign: emoji → SVG |
| `static/tagfetch/manual/manual.js` | Redesign: emoji → SVG |

---

## ✏️ Изменено: CSS

| Файл | Строк | Что |
|------|-------|-----|
| `static/css/admin.css` | +34 | Админ-панель (Folders card, backend selection) |
| `static/css/mediavault.css` | +11 | Redesign: gallery inline styles → CSS |
| `static/css/content.css` | +4 | Comics picker max-width fix |
| `static/css/tagfetch.css` | +3 | Tagfetch panels |

---

## ✏️ Изменено: Документация

| Файл | Строк | Что |
|------|-------|-----|
| `AGENTS.md` | +162/-4 | Убран cloudscraper из deps, удалена секция cloudscraper, полная документация проекта |
| `docs/code-guide.md` | +627/-160 | NokufindBackend → historical notes, gallery-dl section |
| `docs/FAQ.md` | +33 | Бэкенды описаны без nokufind |
| `docs/user-guide.md` | +53 | Browser cache, folders, gallery-dl |
| `docs/api.md` | Убраны все ссылки nokufind/cloudscraper | BACKENDS dict, per-site dispatch |
| `roadmap/roadmap.md` | +97 | Features 6-8 (gallery-dl, per-site creds, franchise search) |

---

## 🆕 Новые файлы

| Файл | Назначение |
|------|-----------|
| `docs/api.md` | API & Credentials & Fetch system |
| `docs/new-features-summary.md` | Сводка всех 12 фич |
| `docs/new-features.md` | Полный план new-features |
| `docs/sites-api-in-MV.md` | Интеграция с внешними сайтами |
| `static/shared/icons.js` | Site icons (window.SiteIcons) |
| `static/shared/icons/*.svg` | SVG иконки для 5 сайтов |
| `templates/franchise_search.html` | Страница франчайз-поиска |
