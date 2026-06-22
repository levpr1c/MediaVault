# MediaVault — New Features Summary (new-features branch)

> Все новые фичи, добавленные в ветке `new-features`, в одном документе.

---

## 1. Backend System (src/backends/)

**Модульная архитектура для получения тегов с разных сайтов.**

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| Registry | `backends/__init__.py` | `BACKENDS` dict (2 бэкенда), `fetch_tags()`, `search_tags()` dispatch |
| ApiRawBackend | `backends/api_raw.py` | Прямой API для Rule34 (XML), Danbooru (JSON) и NHentai (v2) |
| GalleryDlBackend | `backends/gallerydl.py` | Все 6 сайтов через gallery-dl Python API (338 строк) |

**Настройка:** `fetch_backend` dict в settings.json. Пример:
```json
{"rule34": "api_raw", "danbooru": "api_raw", "nhentai": "gallerydl", "ehentai": "gallerydl", "kemono": "gallerydl", "coomer": "gallerydl"}
```

**Dependencies:**
- `gallery-dl` — для Rule34/Danbooru/NHentai/E-Hentai/Kemono/Coomer (установлен в venv, Python API)


---

## 2. Backend Selection UI (Admin Panel)

**Выбор бэкенда в админ-панели для каждого сайта.**

| Сайт | Доступные бэкенды |
|------|------------------|
| Rule34 | api_raw, gallerydl |
| Danbooru | api_raw, gallerydl |
| NHentai | gallerydl, api_raw |
| E-Hentai | gallerydl |
| Kemono | gallerydl |
| Coomer | gallerydl |

**Key files:** `static/admin/admin.js` → `_sections.backends` (строки 195-280)

**i18n keys:** `sectionBackends`, `backendsDesc`, `backendApiRaw`, `backendGallerydl`, `siteRule34`, `siteDanbooru`, `siteNhentai`, `siteEhentai`, `siteKemono`, `siteCoomer`, `navBackends`


---

## 3. Site Icons

**SVG-иконки для Rule34, Danbooru, NHentai, E-Hentai, Kemono, Coomer.**

**Key files:**
- `static/shared/icons.js` — `window.SiteIcons` (IIFE) с методами `getIcon()`, `getIconImg()`, `getIconDataURI()`
- `static/shared/icons/rule34.svg` (и аналоги для других сайтов) — физические SVG файлы (`ehentai.svg`)

**Usage:**
```javascript
window.SiteIcons.getIconImg('rule34', 16) // → <img src="data:..." width="16" height="16">
window.SiteIcons.getIcon('danbooru')       // → data URI (favicon)
window.SiteIcons.getIconDataURI('nhentai') // → data: URI
```


---

## 4. Folder System

**Настройка подпапок для Gallery и Comics в админ-панели.**

**Settings:** `gallery_dir` (по умолч. `Gallery`), `comics_dir` (по умолч. `Comics`)

**Как работает:**
- При сканировании файлов, `folder_type` определяется по первому компоненту пути
- Колонка `folder_type` в таблице `files` (gallery / comics / downloads)
- API `/api/gallery` фильтрует по `?folder=gallery|comics|downloads`

**Key files:**
- `src/web_app.py` — `_quick_scan()` определяет `folder_type`, API фильтрация
- `static/admin/admin.js` → `_sections.folders` (строки 246-276)

**i18n keys:** `adminGalleryDir`, `adminComicsDir`, `navFolders`, `sectionFolders`


---

## 5. Browser Cache Settings

**Управление браузерным кэшированием через UI.**

**Три режима:**
| Режим | Cache-Control | ETag |
|-------|---------------|------|
| Default | `public, max-age=86400, immutable` | Да |
| Reduced | `public, max-age=3600` | Да |
| NoCache | `no-cache` | Да |

**Key files:**
- `src/web_app.py` → `_cache_control_header()` (строка 721), применяется в `/api/media`, `/api/thumbnail`
- `templates/settings.html` → Appearance → Browser Cache `<select>`
- `POST /api/clear_browser_cache` — инкремент `cache_buster`

**Cache buster:** `CONFIG.cacheBuster` → все URL `/api/media?path=...&cb=N` и `/api/thumbnail?path=...&cb=N`

**i18n keys:** `settingsBrowserCache`, `settingsBrowserCacheDefault`, `settingsBrowserCacheReduced`, `settingsBrowserCacheNoCache`


---

## 6. UPSERT for Source Preservation

**INSERT OR IGNORE → UPSERT для сохранения source при повторном фетче.**

**Key files:** `src/web_app.py`
- Строка 965: `_ensure_categories()` — Danbooru теги
- Строка 1029: `_ensure_r34_categories()` — Rule34 теги

**Изменение SQL:**
```sql
-- Было:
INSERT OR IGNORE INTO tag_category_members (tag_name, category, source, last_updated) VALUES (?, ?, ?, ?)

-- Стало:
INSERT INTO tag_category_members (tag_name, category, source, last_updated) VALUES (?, ?, ?, ?)
ON CONFLICT(tag_name) DO UPDATE SET category = excluded.category, source = excluded.source, last_updated = excluded.last_updated
```


---

## 7. Kemono URL System

**Расширенная поддержка доменов Kemono/Coomer с зеркалами.**

**Поддерживаемые домены:** `.su`, `.cr`, `.cv`, `.party`, `.so`, `.us`, `.co` для kemono и coomer.

**Regex:** `r'(?:kemono|coomer)\.(?:su|cr|cv|party|so|us|co)'`

**Key files:**
- `src/backends/gallerydl.py` — `_KEMONO_DOMAINS`, `get_mirrors()` (14 зеркал)
- `src/web_app.py` — `GET /api/kemono/mirrors`, `GET /api/kemono/info`, `POST /api/kemono/download`

**API:**
| Endpoint | Описание |
|----------|----------|
| `GET /api/kemono/mirrors` | Массив всех известных зеркал |
| `GET /api/kemono/info?url=...` | Метаданные поста (artist, files) |
| `POST /api/kemono/download` | Скачать пост в `media_dir/Downloads/kemono/` |
| `GET /kemono-import` | Страница импорта |


---

## 8. Redesign Fixes

**CSS/HTML/JS рефакторинг: код→стили, emoji→SVG, .hidden класс.**

| Change | Files |
|--------|-------|
| Inline styles → CSS classes | `templates/shared/gallery.html`, `mediavault.css` |
| emoji 🏷️ → SVG | `templates/shared/view.html` |
| `.hidden` class everywhere | Все HTML шаблоны |
| `style.display` → `classList` | Все JS файлы |
| Tagfetch CSS layout fix | `static/css/tagfetch.css` |


---

## 9. Comics Picker + Viewer Fixes

**Исправления UI для ComicsPicker и ридера комиксов.**

| Фикс | Файл | Описание |
|------|------|---------|
| max-width: 95vw | `content.css` → `#modalInner` | Модал не вылезает за экран на мобильных |
| min-height: 0 | `content.css` → `.comic-modal-body` | Убирает лишний отступ |
| _programmaticScroll guard | `templates/shared/view.html` | Счётчик не дёргается при программном скролле |


---

## 10. Admin Dashboard Refactoring

**Расширение админ-панели с 3 до 5 разделов.**

| # | Раздел | Описание |
|---|--------|----------|
| 1 | Users | Управление пользователями (без изменений) |
| 2 | Database | Инструменты БД (без изменений) |
| 3 | API Keys | Ключи Rule34/Danbooru + Credential Backend |
| 4 | Folders | Настройки gallery_dir + comics_dir (новый) |
| 5 | Backends | Выбор бэкенда для каждого сайта (новый) |

**Key files:**
- `static/admin/admin.html` — 5 иконок в навигации, 49 строк
- `static/admin/admin.js` — 727 строк, 5 секций, helper-методы

**DRY helpers:**
- `_saveSettings(data, msg)` — POST /api/settings + toast (неявно, через `_api().then(...)`)
- `_errorFallback(body, e)` — единый показ ошибки (через `.catch`)

**i18n keys (new):** `navFolders`, `navBackends`, `sectionFolders`, `sectionBackends`, `backendsDesc`, `adminGalleryDir`, `adminComicsDir`


---

## 11. NHentai Search (Home Page)

**Кнопка «Comics Fetch» на главной странице → `/nhentai-search`.**

**Changes:**
- `templates/home.html` — кнопка в блоке Content Management
- i18n key: `homeComicsFetch`
- Роут: `/nhentai-search` — поиск по NHentai


---

## 12. Удалённый мёртвый код

**Очистка от мёртвого кода в batch_scan.**

| Что удалено | Где |
|------------|-----|
| 3 DROP TABLE | `web_app.py`, batch_scan роуты |
| Ссылки на несуществующую таблицу `tags` | `web_app.py` |
| _COMMON_META_TAGS | Убраны дублирующиеся константы |

---

## Итоговая сводка

| # | Фича | Строк кода | Файлов |
|------|-----------|--------|
| 1 | Backend system (2 бэкенда) | 589 | 3 |
| 2 | Backend Selection UI | ~60 | 1 (admin.js) |
| 3 | Site Icons | 30 + SVG | 7 |
| 4 | Folder System | ~50 | 2 |
| 5 | Browser Cache | ~30 | 2 |
| 6 | UPSERT | ~10 | 1 |
| 7 | Kemono URL | ~30 | 2 |

---

## 13. Админ-панель: рефакторинг

**Изменения:**
- API Keys: убран media_dir (был 3-й карточкой), остались только ключи + credential backend
- Folders: добавлен media_dir (редактируемый + Browse + Scan)
- Backends: новая секция (выбор бэкенда per-site + иконки)
- `_saveSettings()` helper — универсальный save+toast (7 мест → 1)
- `_errorFallback()` helper — 4 места → 1
- `_selectBackend` → `_saveCredBackend` (переименован)

**Key files:** `static/admin/admin.js`

---

## 14. Зависимости (текущие библиотеки)

### gallery-dl (v1.32.3+)
- **Назначение:** Универсальный бэкенд для поиска и загрузки (R34/Danbooru/NHentai/E-Hentai/Kemono/Coomer)
- **Установка:** `pip install gallery-dl` (в venv)
- **Используется в:** `src/backends/gallerydl.py` — все 6 сайтов через Python API
- **Особенности:** Python API (`gallery_dl.extractor.find()`, `job.DataJob()`, `job.DownloadJob()`)
- **Требования:** только `pip install gallery-dl` (CLI в PATH не требуется)

**Стратегия (решение от 16.06.2026):** gallery-dl становится единым бэкендом для всех сайтов. Никаких новых библиотек (rule34Py, Pybooru, enma, nhentai-tools) — только gallery-dl. Raw API → legacy/fallback.

---


### Backend system

### Backend Selection UI (Admin)

### Folder system

### Browser Cache

### Kemono/Coomer

### Admin Dashboard

### Redesign

### Comics

---

## 15. Gallery-dl как универсальный бэкенд ✅ (Feature 6 — DONE)

**Решение:** Вместо rule34Py, Pybooru, enma, nhentai-tools — используем gallery-dl (уже в venv) для search() и fetch() на всех сайтах. Два варианта per-site: raw_api (legacy) и gallery_dl.

**Ключевые файлы:**
- `src/backends/gallerydl.py` — расширение до 338 строк: поиск и fetch через Python API для всех 6 сайтов
- `src/backends/__init__.py` — gallerydl зарегистрирован в BACKENDS, дефолт для NHentai/E-Hentai/Kemono/Coomer
- `src/web_app.py` — dispatch обновлён
- `static/admin/admin.js` — gallery_dl опция в Backend Selection UI для всех сайтов
- `NokufindBackend` **удалён** — gallery-dl полностью заменил для NHentai


---

## 16. Сессия 17.06.2026 — Comics-tags, header refactor, content-search, comics picker

### 16.1 Страница Comics Tags (`/content-mgmt/comics-tags`)

**Новый роут + новый JS модуль для drag-to-tag комиксов.**

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| Route | `web_app.py` строка 1680 | `comics_tags_page()`, `@admin_required` |
| JS module | `static/content/comics-tags.js` (171 строка) | ES module: левая панель категорий + правая (грид комиксов, drag-to-tag) |
| Section router | `static/content/main.js` | Добавлена секция `comicsTags`, path detection для `/content-mgmt/comics-tags` |
| Template | `templates/content-mgmt/tags.html` | Использует существующий шаблон с `page='content-mgmt/comics-tags'` |


### 16.2 CM Header Refactor

**Все группы хедера CM используют expandable dropdowns.**

| Изменение | Детали |
|-----------|--------|
| `CMHeader.toggle(event, id)` | Поддержка множественных dropdowns — закрываются другие при открытии нового |
| Content-search | Теперь использует CM header (условие: `request.path == '/content-search'`) |
| Desktop groups | 4: TAGFETCH | TAGS | COMICS | SEARCH |

**Key files:** `templates/base.html`, CM header JS


### 16.3 Content-search Fixes

**Исправления в `static/content/content-search.js`:**

| Фикс | Описание |
|------|---------|
| Lightbox try-catch | `new Lightbox(...)` обёрнут в try-catch для предотвращения падений |
| HTTP error check | Добавлена `res.ok` проверка перед парсингом JSON |
| Shared guard | Проверка `window.Shared` перед вызовом `Shared.applyI18n()` |


### 16.4 Home Page CM Card

**4 вертикальные секции: TAGFETCH | TAGS | COMICS | SEARCH.**

| Изменение | Детали |
|-----------|--------|
| Layout | 4 колонки side-by-side, каждая с заголовком + стек кнопок |
| Franchise | Удалена из хедера (редирект на content-search) |
| NHentai | Перенесён в секцию SEARCH |
| Comics Tags | Добавлена кнопка в секцию COMICS |

**Key files:** `templates/home.html`


### 16.5 Comics Picker Improvements

**Улучшения модала ComicsPicker:**

| Изменение | Было | Стало |
|-----------|------|-------|
| Modal size | 1380×920px | 2100px с preview (1.5×) |
| Grid layout | CSS columns (top→bottom) | Flexbox wrap (left→right), 6 columns |
| Preview transition | — | `cubic-bezier` transition, `width` вместо `flex-basis` |
| Mobile columns | — | 3 columns |

**Key files:** `static/shared/comics/comics.js`, `static/css/content.css`


### 16.6 Counter Bug Fix

**Исправление счётчика пагинации в `tags-manage.js`:**

- `_currentPage = 1` добавлен в `filesRender()` — сброс счётчика на первый файл при загрузке секции

**Key file:** `static/content/tags-manage/tags-manage.js`


### 16.7 Новые i18n ключи

| Ключ | en | ru |
|------|----|----|
| `cmSectionTagfetch` | Tagfetch | Tagfetch |
| `cmSectionTags` | Tags | Теги |
| `cmSectionComics` | Comics | Комиксы |
| `cmSectionSearch` | Search | Поиск |
| `comicsTags` | Comics Tags | Теги комиксов |

Добавлены в LOCALE обоих языков (`web_app.py`) и JS i18n (`shared/utils.js`).

---

### 16.8 Сессия 18.06.2026 — Content-search lightbox fix, header cleanup, comics-tags UI, home page

#### 16.8.1 Content-search Lightbox fix

| Фикс | Файл | Описание |
|------|------|---------|
| null guard в close() | `shared/lightbox.js:279` | `this._el('Media')` проверка на null перед `.querySelector('video')` |
| try-catch wrapper | `content/content-search.js:101` | `csLightbox.close()` обёрнут в try-catch |

**Проблема:** `new Lightbox()` → `doSearch()` → `Lightbox.close()` падал если `close()` вызывался до `open()` (элементы DOM не созданы). Ошибка распространялась наружу, блокируя весь поиск.

#### 16.8.2 Header cleanup

**COMICS dropdown** (`templates/base.html`):
- Удалены: NHentai, Franchise
- Остались: Editor, Comics Tags

#### 16.8.3 Comics-tags tag UI restructuring

| Изменение | Детали |
|-----------|--------|
| Left panel structure | Использует `.cm-files-left-section` (как tags-manage) |
| Search input wrapper | Правильная обёртка (как в других CM секциях) |

#### 16.8.4 Home page improvements

| Изменение | Детали |
|-----------|--------|
| MV card | `flex:1` (был `flex:0.8`) |
| CM card | `flex:1.5, max-width:520px` (был `flex:2`) |
| Admin card | `flex:1.2, max-width:440px` |
| CM grid class | `.hm-cm-grid` вместо inline style |
| Responsive | 960px wrap, 768px stack, 650px 1-col |
| Account button | padding 8px, 36×36 SVG |


---

## 17. Mount Indicator Improvements (19.06.2026)

**Три изменения, связанные с индикатором монтирования хранилища (blinking dot).**

### 17.1 CSS fix: mount styles скопированы в `admin.css`

**Проблема:** стили `.mount-dot`, `.mount-badge`, `@keyframes mountPulse` были только в `settings.css`. Админ-панель загружает `admin.css`, а не `settings.css`, поэтому blinking dot не отображался в `/admin`.

**Фикс:** идентичные стили добавлены в `static/css/admin.css:420-450`.

### 17.2 `admMountStatus` удалён из карточки Folders (admin)

**Что было:** индикатор монтирования дублировался — в хедере админки (`#admMountIndicator`) и внутри карточки Folders (`#admMountStatus`).

**Что стало:** `#admMountStatus` удалён из шаблона секции Folders. Индикатор остаётся только в хедере страницы (`admin.html:35`, рядом с `#adminPageTitle`).

**Key files:**
- `static/admin/admin.js:673-680` — `_checkMount()` больше не пишет в `#admMountStatus`
- `templates/admin/admin.html:35` — `#admMountIndicator` в хедере

### 17.3 `#mountStatus` перемещён в card header (settings)

**Что было:** индикатор монтирования в Settings → Appearance → Media Path находился внизу карточки, после кнопок Save/Scan/Create Folders.

**Что стало:** `#mountStatus` перемещён в `admin-card-header` (строка 48 `settings.html`), рядом с заголовком «Media Path».

**Key files:**
- `templates/settings.html:48` — `#mountStatus` в хедере карточки
- `static/css/settings.css:126` — удалён `margin-top: 8px` у `.mount-badge` (style tweak для нового расположения)


---

#---

## 18. Content-Search Tag Categories (19.06.2026)

**Color-coded tags in content-search lightbox based on Danbooru categories.**

| Изменение | Детали |
|-----------|--------|
| Backend | Both `api_raw.py` and `gallerydl.py` return `tag_artist/character/copyright/general/meta` from Danbooru API |
| Server | Computes `tags_by_category` per result, returns `cat_colors` from local DB |
| Frontend | `showLightbox()` builds tag→category map, wires `_getCatListFn`/`_getTagCategoryNameFn` on lightbox |
| Categories | Artist (red), Character (green), Copyright (blue), General (grey), Meta (dark grey) |

**Key files:**
- `src/web_app.py` — `api_content_search()` computes tags_by_category
- `static/content/content-search.js` — showLightbox() wires categories
- `src/backends/api_raw.py`, `gallerydl.py` — return category data from API


---

## 19. R34-Only AI Filter (19.06.2026)

**Checkbox to exclude AI-generated images from Rule34 search results.**

| Изменение | Детали |
|-----------|--------|
| Frontend | Checkbox `#csAiFilter` triggers search re-run with `&filter_ai=1` |
| Backend | Only appends `-ai_generated -ai -ai_assisted` to Rule34 queries |
| Scope | Danbooru and NHentai are NOT affected |

**Key files:**
- `static/content/content-search.js:109-115` — checkbox handler
- `src/web_app.py:1707-1722` — filter_ai param + query adjustment


---

## 20. Download Button with Site Label (19.06.2026)

**Lightbox download button shows site name instead of just arrow.**

| Изменение | Детали |
|-----------|--------|
| Lightbox option | `downloadLabelFn(file)` in `Lightbox()` constructor |
| Content-search | Uses `_t('contentSearchDownload').replace('{site}', site)` |
| Default | Falls back to `⬇` (unicode arrow) if no `downloadLabelFn` provided |

**Key files:**
- `static/shared/lightbox.js:49,467` — `_downloadLabelFn` option + render
- `static/content/content-search.js:234-237` — downloadLabelFn implementation

**i18n keys:** `contentSearchDownload` — `'Download from {site}'` / `'Скачать с {site}'`


---

## 21. Mount Indicator Improvements (19.06.2026)

**Mount status CSS duplicated to admin.css, indicator removed from Folders card, moved to card header in Settings.**

(см. **17. Mount Indicator Improvements** выше)

---

## 22. NHentai Manga Download (Full Gallery) (19.06.2026)

**Download all pages of an NHentai gallery into `Downloads/nhentai/{gid}/` with tag indexing.**

| Изменение | Детали |
|-----------|--------|
| New endpoint | `POST /api/content-search/download-manga` |
| Input | `{gid, media_id, num_pages, title, tags}` |
| Output | `{ok, count, errors, dir}` |
| Storage | `Downloads/nhentai/<gid>/1.jpg` .. `N.jpg` |
| DB | Each page indexed with gallery tags, auto-tags, dimensions |

**Key files:**
- `src/web_app.py:1909-2023` — `api_content_search_download_manga()` endpoint
- `static/content/content-search.js:241-265` — manga download button handler

**i18n keys:** `contentSearchPages` — `'pages'` / `'страниц'`


---

## 23. Content-Search Download Saves Tags to DB (19.06.2026)

**Download endpoint now accepts `tags` + `tags_by_category` and indexes files in DB.**

| Изменение | Детали |
|-----------|--------|
| Download endpoint | `GET/POST /api/content-search/download` accepts `tags` + `tags_by_category` |
| DB save | INSERT or UPDATE in `files` with merged auto-tags + API tags |
| Categories | Danbooru tags trigger `_ensure_categories()` |
| Aspect ratio | Auto-computed from downloaded file dimensions |

**Key files:**
- `src/web_app.py:1792-1906` — `api_content_search_download()`


---

## 24. api_raw Backend Fixes (NHentai v2, R34 count, Danbooru count) (20.06.2026)

**Full rewrite of NHentai search/fetch, fixed R34/Danbooru result counts.**

| Изменение | Детали |
|-----------|--------|
| NHentai search | Switched to API v2 (`/api/v2/search` + `/api/v2/galleries/{id}`) — public, no auth |
| NHentai fetch | Rewritten for API v2 schema (different tag structure, page URLs) |
| R34 count | JSON API returns no count → switched to XML API, parses `<posts count="...">` |
| Danbooru count | `x-total-count` header missing for anonymous → fallback to `/counts/posts.json?tags=...` |

**Key files:**
- `src/backends/api_raw.py` — `_search_rule34`, `_search_danbooru`, `_search_nhentai`, `_fetch_nhentai`


---

## 25. NHentai Multi-Page Manga Viewer (20.06.2026)

**Book-style spread viewer for NHentai galleries in content-search lightbox.**

| Изменение | Детали |
|-----------|--------|
| Spread layout | 2 pages side by side, up to 1400px wide lightbox |
| Lazy loading | First 10 pages (5 spreads), more on demand as user navigates |
| Page counter | Shows `"1-2 / 200"` (left-right / total) |
| `onRenderMedia` | Gallery fetch fires per-item (not just first), lazy-load + category update |
| Keyboard | PgUp/PgDn for spreads (avoids lightbox Arrow conflict) |

**Key files:**
- `static/content/content-search.js` — `onRenderMedia`, `loadSpreads`, `updateNhCategories`


---

## 26. "Open Source" Button in Lightbox Toolbar (20.06.2026)

**Toolbar button to open source page on the original site.**

| Изменение | Детали |
|-----------|--------|
| `_onOpenSource` | Lightbox option — callback for custom open-source action |
| Fallback | MV standalone view URL if no callback provided |
| Per-site URLs | NHentai → `nhentai.net/g/{id}/`, Danbooru → `danbooru.donmai.us/posts/{id}`, Rule34 → `rule34.xxx/index.php?page=post&s=view&id={id}`, E-Hentai → `e-hentai.org/g/{gid}/{token}/` |
| Separate row | Download button moved to separate row below `.lb-header` |

**Key files:**
- `static/shared/lightbox.js` — `_onOpenSource`, `OpenSourceBtn` in toolbar
- `static/content/content-search.js` — `_sourceUrl` per site, `onOpenSource` callback

**i18n keys:** none (uses generic button)


---

## 27. Comics Reader Spread Mode Redesign (21.06.2026)

**Полный редизайн ридера комиксов — spread-режим вместо скролла.**

| Изменение | Детали |
|-----------|--------|
| Spread по умолчанию | 2 страницы рядом на весь экран, `display:flex` + `object-fit:contain` |
| Без скролла | `height: calc(100vh - 44px)`, `overflow: hidden` |
| Все экраны | Убран `@media` — работает на desktop и mobile |
| Навигация | ← → / PgUp/PgDn — по спредам (2 страницы); в lightbox — по 1 странице |
| Счётчик | `"1-2 / 200"` для спреда, номера страниц |
| Lightbox toggle | F — переключение spread ↔ lightbox, корректный возврат |

**Key files:**
- `templates/shared/view.html` — CSS + JS для spread-режима


---

## 28. WebP Comics Auto-Creation (20.06.2026)

**Comics auto-creation теперь принимает любые файлы (не только `.jpg`).**

| Изменение | Детали |
|-----------|--------|
| Убран фильтр | `_IMAGE_EXTS` включает `.webp`; comics-creation без расширения |
| Fix `import re` | `import re` перенесён выше `re.sub()` — исправлен `UnboundLocalError` |
| Dead code | Удалён мёртвый `search_tags('nhentai', '', 1, settings)` (вызывал 500) |

**Key files:**
- `src/web_app.py` — `api_content_search_nhentai_gallery` (dead code), `api_content_search_download_manga` (import re)

---

## Итоговая сводка (обновлённая)

| # | Фича | Строк кода | Файлов |
|---|------|-----------|--------|
| 1 | Backend system (2 бэкенда) | 589 | 3 |
| 2 | Backend Selection UI | ~60 | 1 (admin.js) |
| 3 | Site Icons | 30 + SVG | 7 |
| 4 | Folder System | ~50 | 2 |
| 5 | Browser Cache | ~30 | 2 |
| 6 | UPSERT | ~10 | 1 |
| 7 | Kemono URL | ~30 | 2 |
| 8 | Comics Tags page | 171 (JS) | 3 |
| 9 | Content-search | 259 (JS) | 5 |
| 10 | Comics Picker | ~30 (CSS) | 2 |
| 11 | Content-search lightbox fix | +4 (lightbox.js) | 2 |
| 12 | Home page polish | ~20 (home.html + CSS) | 2 |
| 13 | Mount indicator improvements | +34 (CSS) + JS tweaks | 4 |
| 14 | Tag categories (Danbooru) | ~40 | 3 |
| 15 | AI filter (R34-only) | ~10 | 2 |
| 16 | Download label + manga download | ~130 (server + JS) | 3 |
| 17 | api_raw fixes (NHentai v2, R34/Danbooru count) | ~120 | 1 |
| 18 | Multi-page manga viewer | ~210 | 1 (content-search.js) |
| 19 | Open source button | ~83 | 2 |
| 20 | Comics reader spread redesign | ~159 | 1 (view.html) |
| 21 | WebP comics + fixes | ~97 | 1 |

---


### Content-Search Tag Categories

### AI Filter

### NHentai Manga Download

### Download with Tags

### Download Label

### Mount Indicator

---

## v1.1.2 — Background downloads, NHentai v2, overwrite support, folder filter

### Added
- **Background download system**: Async endpoints (`/download-async`, `/download-manga-async`) return task_id immediately; frontend polls `GET /task/<id>` every 2s until completed/failed
- **NHentai v2 API**: Uses `api/v2/galleries/{gid}` for correct page extensions (jpg/png/webp) instead of guessing `.webp`→`.jpg`
- **Concurrent page download**: `ThreadPoolExecutor(max_workers=4)` for parallel manga download
- **Overwrite re-download**: `overwrite=True` deletes existing files before re-download; frontend shows `confirm()` dialog via `check-manga-dir` endpoint
- **Comics dedup**: `source_id` check before creating comics entry — if already exists, reuses existing `comics_id`
- **Gallery default folder filter**: `localStorage['mediavault_folder_filter']` — per-user, applied at gallery init
- **Settings UI**: "Фильтр папок по умолчанию" checkboxes (Gallery/Comics/DL) in Appearance tab
- **BgTask logging**: Per-page progress logs (`[BgTask] manga gid=X: page N/M downloaded (K/M)`)
- **i18n**: 11 new keys: downloadStarted/Running/Completed/Failed/Exists/Overwrite/Cancelled, settingsDefaultFolderFilter, settingsFolderFilterDesc

### Changed
- `content-search.js`: Download flow uses async endpoint + polling instead of blocking
- `gallery.js`: `init()` reads `mediavault_folder_filter`, `_toggleFolder()` saves it
- `settings.html`: New folder filter UI in Appearance tab
- `utils.js`: `_i18nData` updated with 11 new keys



---
