---
feature: "MediaVault new-features (expanded)"
spec: |
  MediaVault — new-features branch. Восемь областей: баги, архитектура, новые фичи,
  API рефакторинг, редизайн, gallery-dl как универсальная альтернатива, per-site
  credentials, franchise search. Никаких сторонних библиотек — только gallery-dl (уже в венв).
---

## Статус

### Feature 1: Баги (критические)
- [x] 1.1 Удалить мёртвую таблицу tags (CREATE + INSERT + DROP)
- [x] 1.2 Очистить _COMMON_META_TAGS (только file-type + ratio:*)
- [x] 1.3 Исправить бескатегорийные R34 теги (убрать `if cat != 'general':`)
- [x] 1.4 Сохранять source при перемещении тега (SELECT перед INSERT)
- [x] 1.5 Source при добавлении нового тега = 'manual'
- [x] 1.6 Защитить POST /api/tags — @admin_required (уже есть)
- [x] 1.7 Скрыть управление тегами в лайтбоксе для non-admin
- [x] 1.8 Аудит таблицы batch_scan (удалить 3 DROP'а — мёртвый код)
- [x] 1.9 Аудит кеша (browser_cache: default/reduced/nocache + UI + i18n)
- [x] 1.10 fanart category=meta source=auto — UPSERT вместо INSERT OR IGNORE
- [x] 1.11 source manual при рекатегоризации — сохранение source через UPSERT

### Feature 2: Архитектура
- [x] 2.1 POST /api/clear_browser_cache + cache_buster
- [x] 2.2 Cache-Control + ETag на /api/media и /api/thumbnail
- [x] 2.3 VACUUM после деструктивных операций
- [x] 2.4 Settings UI кнопка + i18n + &cb=N во всех JS URLs
- [x] 2.5 Убрать webbrowser.open()
- [x] 2.6 Система подпапок: folder_type колонка + детекция
- [x] 2.7 Бекенды: backends/__init__.py (BACKENDS registry)
- [x] 2.8 Перепроектирование таблиц тегов (site_id, last_updated, data)
- [x] 2.9 Folder system UI в админ-панели (gallery_dir/comics_dir настройки, path-based фильтрация, admin UI)
- [x] 2.10 Backend selection UI — выбор бекенда для каждого сайта + иконки
- [x] 2.11 Redesign verification — inline style → CSS, emoji 🏷️ → SVG, .hidden class
- [x] 2.12 Site icons complete (Rule34/Danbooru/NHentai/Kemono/Coomer, icons.js)

### Feature 3: Новые фичи
- [x] 3.1 NHentai поиск тегов для комиксов
- [x] 3.2 Drag-to-tag для комиксов
- [x] 3.3 Страница "Похожее" (/similar, /api/similar)
- [x] 3.4 Интеграция Kemono/Coomer (GalleryDlBackend)
- [x] 3.5 Кнопка Comics Fetch на home → NHentai search
- [x] 3.7 Kemono URL validation (mirror list, regex .su -> .cr/.cv/.party/.so/.us/.co)
- [x] 3.6 Франчайз-поиск (по тегу: Danbooru + R34 + NHentai) — распараллеливание search_tags()
  → merged into Feature 8
- [x] 3.8 Страница `/content-mgmt/comics-tags` — drag-and-drop тегов на карточки комиксов
- [x] 3.9 Content-search: общий CM header + обработка ошибок (res.ok, Shared.applyI18n guard)
- [x] 3.10 Comics Picker: flexbox сетка (left→right), 6 колонок, 2100px с preview

### Feature 4: API рефакторинг (per-site credentials — DONE)
- [x] 4.1 Per-site credentials — миграция глобальных ключей в per-site формат
- [x] 4.2 Admin UI для per-site ключей (группировка по сайтам с иконками)
- [x] 4.3 Backend dispatch: fetch()/search() получают per-site credentials

### Feature 5: Редизайн (второй проход)
- [x] 5.1 Tagfetch CSS
- [x] 5.2 Gallery CSS
- [x] 5.3 Site icons (partial)
- [x] 5.4 Backend dispatch: fetch_tags() подключен в api_fetch_file() + api_auto_scan()
- [x] 5.5 CMS lightbox save fix (шлёт {path, source: tags}, fallback в backend)

### Feature 6: Gallery-dl как универсальная альтернатива
**Концепция:** gallery-dl (уже в зависимостях) как второй бэкенд для R34/Danbooru/NHentai/Kemono. Не замена raw API/cloudscraper, а альтернатива — пользователь выбирает в UI. gallery-dl сам обходит Cloudflare.

- [ ] 6.1 GalleryDlBackend.fetch() для Rule34 (через gallery-dl Python API)
- [ ] 6.2 GalleryDlBackend.fetch() для Danbooru (через gallery-dl Python API)
- [ ] 6.3 GalleryDlBackend.search() для NHentai (через gallery-dl Python API)
- [ ] 6.4 GalleryDlBackend.search() для Rule34 (через gallery-dl Python API)
- [ ] 6.5 GalleryDlBackend.search() для Danbooru (через gallery-dl Python API)
- [ ] 6.6 Регистрация в BACKENDS registry + UI (2 варианта per-site: raw_api или gallery_dl)
- [ ] 6.7 Тестирование: сравнить результаты fetch/search с raw API

### Feature 7: Per-site credentials
- [x] 7.1 credential_store.py — новый формат ключей (api:site:keyname)
- [x] 7.2 load_settings()/save_settings() — миграция + per-site чтение
- [x] 7.3 api_raw.py — fetch()/search() читают per-site credentials
- [x] 7.4 Admin UI — поля grouped by site with icons
- [x] 7.5 i18n ключи для per-site credential полей
- [x] 7.6 KeyringStore миграция старых ключей в новый формат

### Feature 8: Franchise search ✅ DONE
- [x] 8.1 Роут /franchise-search (page + API /api/franchise/search)
- [x] 8.2 Шаблон franchise_search.html (сервер-сайд рендеринг, parallel dispatch)
- [x] 8.3 Header link + i18n (CM header + 6 ключей franchise*)
