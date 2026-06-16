# MediaVault — Backend API, Credentials & Fetch System

> **Сфокусированный документ.** Здесь описаны только: система бэкендов (backend dispatch), хранение API-ключей (credential store), per-site credentials, fetch-логика и gallery-dl как универсальная альтернатива.
>
> Полный справочник API (все эндпоинты, auth, settings, gallery, lightbox, теги, комиксы, админка) — в [`docs/code-guide.md`](code-guide.md).
> Интеграция с внешними сайтами (Rule34, Danbooru, NHentai, Kemono, Coomer) — в [`docs/sites-api-in-MV.md`](sites-api-in-MV.md).

---

## 1. Credentials (хранение API-ключей)

### 1.1 Архитектура

Для хранения API-ключей Rule34, Danbooru, NHentai используется `KeyringStore` (GNOME Keyring) или fallback в `settings.json` (plain text).

Файл: `src/credential_store.py`, класс `KeyringStore`.

**Per-site формат ключей:**

| Сайт | Ключи в Keyring | Описание |
|------|-----------------|----------|
| Rule34 | `api:rule34:uid`, `api:rule34:key` | user_id + api_key |
| Danbooru | `api:danbooru:login`, `api:danbooru:key` | login + api_key |
| NHentai | `api:nhentai:key` | API-ключ |

**Миграция:** старые плоские ключи (`r34_uid`, `r34_key`, `dan_login`, `dan_key`, `nh_key`) автоматически мигрируются в per-site формат при загрузке настроек (в `load_settings()`).

### 1.2 GET /api/credential_status

Возвращает текущий бэкенд хранения ключей:

```json
{"active": "KeyringStore", "available": ["KeyringStore", "plain"]}
```

### 1.3 POST /api/set_credential_backend

Смена бэкенда хранения. Тело: `{"backend": "KeyringStore"}` или `{"backend": "plain"}`.

При смене все ключи мигрируются между хранилищами. Если KeyringStore недоступен — возвращается ошибка 400.

---

## 2. Система бэкендов (backend dispatch)

### 2.1 Архитектура

Единый registry в `src/backends/__init__.py`:

```python
BACKENDS = {
    'api_raw':   ApiRawBackend(),    # Rule34 + Danbooru + NHentai (прямые API)
    'gallerydl': GalleryDlBackend(), # Универсальный (gallery-dl Python API)
}
```

Функции диспатча:

| Функция | Назначение |
|---------|-----------|
| `get_backend(name)` | Получить экземпляр бэкенда по имени |
| `fetch_tags(site, md5, settings)` | Получить теги по MD5 через настроенный бэкенд |
| `search_tags(site, query, page, settings)` | Поиск по тегу/запросу |

Настройка `fetch_backend` (dict в settings.json) определяет, какой бэкенд используется для каждого сайта. Ключи: `rule34`, `danbooru`, `nhentai`, `kemono`, `coomer`.

### 2.2 ApiRawBackend (`src/backends/api_raw.py`)

Прямые HTTP-вызовы к API сайтов. 210 строк.

**Rule34:**
- Endpoint: `/index.php?page=dapi&s=post&q=index`
- Формат: XML
- Авторизация: `user_id` + `api_key` (обязательны с August 2025)
- Поиск: `&tags=query`
- Задержка между ретраями: 1s, 3 попытки

**Danbooru:**
- Endpoint: `/posts.json`
- Формат: JSON
- Авторизация: HTTP Basic Auth (login + api_key)
- Поиск: `?tags=query&page=N&limit=100`
- Задержка между ретраями: 1s, 3 попытки

**NHentai (ApiRawBackend):**
- Endpoint: NHentai API v2 (`/api/v2/galleries/{id}`, `/api/v2/search`)
- Авторизация: header `Authorization: Key <api_key>` + User-Agent
- **Note:** NHentai по умолчанию использует `gallerydl` (gallery-dl), но может использовать `api_raw` если есть API-ключ

### 2.3 GalleryDlBackend (`src/backends/gallerydl.py`)

Обёртка над CLI `gallery-dl`. Для Kemono и Coomer. 338 строк.

- `is_available()` — проверка `gallery-dl --version`
- `get_info(url)` — метаданные поста (через `--list-urls`)
- `download(url, dest_dir)` — загрузка файлов (через `--directory`)
- `get_mirrors()` — статический метод, список зеркал

**Требования:** `gallery-dl` CLI в системе (не только в venv).

### 2.5 Fetch Tags (основной флоу)

`GET /api/fetch_file?path=...` — получить теги для файла с Rule34/Danbooru по MD5.

На сервере:
1. Вычисляется MD5 файла
2. Определяется бэкенд для каждого сайта из настройки `fetch_backend`
3. Выполняется параллельный запрос к настроенным бэкендам
4. Результаты объединяются, теги категоризируются (Rule34 → general, Danbooru → оригинальные категории)

**Ответ:**

```json
{
  "ok": true,
  "tags": {"rule34": ["tag1", "tag2"], "danbooru": ["tag3", "tag4"]},
  "categories": {"tag1": "general", "tag3": "artist"},
  "has_non_meta": true
}
```

Если теги не найдены: `{"ok": false, "error": "not found"}` (HTTP 200).

**Требуется:** admin.

### 2.6 Auto Scan

`POST /api/auto_scan` — пакетное сканирование: поиск тегов для всех файлов без non-meta тегов.

Параметр `force: false` — только файлы со статусом `no_tags`. `force: true` — перепроверяет даже файлы с найденными тегами.

### 2.7 Per-site dispatch в UI

Admin UI (`/admin`, раздел Backends) позволяет выбрать бэкенд для каждого сайта:
- `api_raw` (Rule34, Danbooru, NHentai)
- `gallerydl` (универсальный, по умолчанию для NHentai, Kemono, Coomer)

---

## 3. Browser Cache (кэширование браузера)

Настройка `browser_cache` в settings.json. Три режима:

| Режим | Cache-Control | Когда нужно |
|-------|---------------|-------------|
| `default` | `public, max-age=86400, immutable` | Обычный режим, кэш на сутки |
| `reduced` | `public, max-age=3600` | Разработка, частые изменения |
| `nocache` | `no-cache` | QA, всегда свежие файлы |

Где применяется: `/api/media`, `/api/thumbnail`.

Дополнительно: каждый ответ содержит `ETag` (mtime + size файла). `POST /api/clear_browser_cache` инкрементирует `cache_buster` в настройках — все URL с `&cb=N` обновляются.

На клиенте `Shared._cbSuffix()` читает `CONFIG.cacheBuster` и добавляет ко всем запросам к `/api/media` и `/api/thumbnail`.

---

## 4. Site Icons

Доступны через `window.SiteIcons` в JS (определены в `static/shared/icons.js`).

```javascript
window.SiteIcons = {
    getIcon(site)          // → data URI
    getIconImg(site, size) // → <img> элемент
    getIconDataURI(site)   // → data: URI
}
```

Поддерживаемые сайты: `rule34`, `danbooru`, `nhentai`, `kemono`, `coomer`.

Иконки используются в:
- Admin Backend Selection UI (каждая строка сайта)
- ComicsPicker (иконки источников)
- Franchise Search (badge результатов)

---

## 5. Gallery-dl как универсальная альтернатива (план)

> **Статус:** запланировано (Feature 6 в roadmap).

### Идея

Вместо 3-х отдельных библиотек (rule34Py, Pybooru, enma/nhentai-tools) — использовать gallery-dl (уже установлен в venv) для `search()` и `fetch()` на всех сайтах. gallery-dl сам обходит Cloudflare, не требует новых dependencies.

### Мотивация

- **Единый интерфейс:** один бэкенд для всех сайтов
- **Cloudflare:** gallery-dl решает JS challenge автоматически
- **Zero deps:** gallery-dl уже в `pip list`, не нужно устанавливать rule34Py/Pybooru
- **Поддержка:** gallery-dl обновляется под изменения API сайтов

### План реализации (6 подзадач)

1. **GalleryDlBackend.fetch()** — реализовать `fetch(site, md5)` используя `gallery_dl.extractor.find()` + `job.DataJob()` для Rule34/Danbooru
2. **GalleryDlBackend.search()** — реализовать `search(site, query)` через gallery-dl extractor
3. **Регистрация** — добавить GalleryDlBackend как валидный бэкенд для Rule34/Danbooru/NHentai в registry и UI selector
4. **NHentai (gallery-dl)** — проверить работу gallery-dl с NHentai (поддержка уже есть в gallery-dl)
5. **UI** — выбрать дефолтный бэкенд: Raw API → fallback, gallery-dl → default
6. **Тесты + документация**

### Технические заметки

 gallery-dl уже в `venv/lib/python3.*/site-packages/`. Для Python API:

```python
import gallery_dl

# Получение extractor
extractor = gallery_dl.extractor.find(site_url)

# Получение данных (search/fetch)
from gallery_dl.job import DataJob
job = DataJob(extractor)
job.run()
```
