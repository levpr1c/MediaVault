# new-features — Полный план

Создан: 2026-06-16
Ветка: `new-features` (от `master`)

---

## 1. Перенос идей

- `docs/ideas/ideas.md` → разделы ниже (SQLite-шифрование отложено, thumbnail debug уже реализовано, удаление `tags` — выполнено в 3-1)
- `docs/ideas/batch-card-overlay.md` → отложено (UI-улучшение без приоритета)

---

## 2. Дорожная карта

### 2.1 Исправление багов

#### 3-1 Аудит таблиц `tags` и `batch_scan`
- Проверить, какие функции создают/пишут/читают эти таблицы
- `tags` — уже удалена (была dead, только INSERT без SELECT)
- `batch_scan` — есть 745 строк, проверить кто пишет
- Если таблицы не нужны — удалить CREATE TABLE и все обращения из кода
- Если нужны — переписать под существующие таблицы
- VACUUM после удаления

#### 3-2 Аудит кеша (разрастание .cache браузера)
- MV раздаёт медиа с `Cache-Control: public, max-age=86400, immutable`
- Браузер(Hellium) кеширует на диск — `.cache` растёт
- Варианты: уменьшить `max-age`, убрать `immutable`, добавить `no-cache`
- Проверить что `POST /api/clear_browser_cache` + `&cb=N` реально сбрасывает кеш

#### 3-3 `fanart` category=meta source=auto — баг
- `fanart` не должен быть auto-тегом (auto = тип файла, ratio, звук/анимация)
- Проблема: маппинг Danbooru-категорий в наши meta-теги
- Аудит `_has_non_meta_tags()`, `_COMMON_META_TAGS`, логики присвоения `auto`/`meta`
- Исправить чтобы fanart не попадал в meta

#### 3-4 source manual при рекатегоризации
- source должен быть: название сайта (danbooru/rule34/nhentai), `auto` или `manual`
- `manual` — только если тег добавлен вручную через панель добавления
- При переносе тега в другую категорию (drag/typing) source НЕ МЕНЯЕТСЯ
- При рекатегоризации через API source сохраняет原始ное значение
- Аудит `POST /api/categories`, `PUT /api/categories`, `POST /api/assign_tag`

#### 3-5 Убрать удаление/добавление тегов для обычных юзеров из лайтбокса
- Проверить текущую реализацию (@auth_required vs @admin_required)
- В lightbox теги — только просмотр для обычных юзеров
- Управление тегами (добавление/удаление) — только admin

### 2.2 Архитектура

#### 4-1 Система подпапок (folder_type)
- `media_dir/Gallery/` — показывается в MV/gallery, работа с файлами
- `media_dir/Comics/` — показывается в comics-браузере (отдельно от gallery)
- Файлы без подпапки → Gallery
- Файлы с сайтов → `gallery/{site}/` или `comics/{site}/{title}/`
- Интерфейс выбора папок через xdg-desktop-portal (или zenity/kdialog)
- В админ-панели: каждая папка в отдельный ряд, выбор через `api_pick_folder`
- Comics Picker: выбор источника — Gallery/ или Comics/

#### 4-2 Выбор бекенда fetch тегов
- К каждому сайту привязан backend (ApiRawBackend, GalleryDlBackend)
- Графический интерфейс выбора бекенда для каждого сайта
- Иконки сайтов рядом
- Привязка API keys/login/user_id к каждому сайту

#### 4-3 Очистка кеша (аудит)
- Проверить что `POST /api/clear_thumb_cache` реально чистит:
  - `DELETE FROM thumb_cache` (БД)
  - VACUUM (сжатие БД)
  - Физические файлы (если есть)
- `POST /api/clear_browser_cache` — инкрементит `cache_buster`
- Проверить что `&cb=N` применяется ко всем URL

#### 4-4 Редизайн страниц
- Tagfetch: унифицировать CSS с admin.css (14px radius, 24px padding, backdrop-filter)
- Gallery: переделать под DESING.md (--radius: 8px, --surface, --surface2, --accent)
- Проверить что HTML-шаблоны не сломаны, классы соответствуют CSS

#### 4-5 Иконки сайтов
- Rule34 — inline SVG (grid icon)
- Danbooru — inline SVG (target icon)
- NHentai — inline SVG
- Kemono/Coomer — inline SVG
- Единый дизайн, вписывающийся в цветовую схему

#### 4-6 Новые таблицы тегов / параметры
- site_id, last_updated, data в tag_category_members (сделано)
- Поддержка комиксов с разных сайтов (r34, danbooru, nhentai)
- Аудит: проверить что миграция работает, данные не теряются

### 2.3 Рефакторинг API

#### 4.x API-система
- Оценка целесообразности: fetch по API keys + login + id user
- Единый интерфейс для всех backend'ов
- Credential store: выбор Keyring / Plain Text для каждого сайта
- Привязка учётных данных к сайту, а не глобально

### 2.4 Новые библиотеки

- gallery-dl (уже установлен) — для Kemono/Coomer
- pysqlcipher3 — опционально (шифрование БД) — отложено
- node-fetch / playwright — для сложных сайтов — отложено

### 2.5 Новые фичи

#### 5-1 Поиск тегов для комиксов/манги с NHentai
- Сделано: `/nhentai-search`, `/api/nhentai/search`
- GalleryDlBackend (через gallery-dl Python API)
- Кнопки на главный экран / в comics-раздел

#### 5-2 Drag-to-tag для комиксов
- Сделано: NHentai tag chips draggable
- Click-to-copy
- «Add all tags» button
- Кнопки для новых сайтов на главный экран

#### 5-3 Страница поиска по франшизе/автору/персонажу
- Новая страница (или подраздел gallery/comics)
- Ввод тега → результаты с сайта-источника
- Кнопка «Поискать ещё»: Rule34, Danbooru, NHentai
- Интеграция с Similar page (пересечение тегов)

#### 5-4 Kemono/Coomer с проверкой URL
- Сделано: GalleryDlBackend, `/kemono-import`, `/api/kemono/info`, `/api/kemono/download`
- Нужно: проверка актуальных зеркал (domains могут меняться)
- Получение списка зеркал с их сайта/GitHub
- Auto-scan после загрузки

---

## 3. Статус выполнения

| Пункт | Статус | Примечание |
|-------|--------|-----------|
| 3-1 tags + batch_scan аудит | 🔴 | tags удалена, batch_scan нужен аудит |
| 3-2 cache audit | 🔴 | Нужен аудит и исправление |
| 3-3 fanart meta bug | 🔴 | Нужен аудит и исправление |
| 3-4 source manual bug | 🔴 | Нужен аудит и исправление |
| 3-5 lightbox non-admin | 🟢 | Сделано (коммит 2982c04) |
| 4-1 folder system | 🟡 | Базовая реализация есть, нужен UI + выбор папок |
| 4-2 backend selection | 🟡 | Backend'ы есть, UI выбора нет |
| 4-3 cache cleanup audit | 🟡 | Код есть, нужна верификация |
| 4-4 redesign | 🟡 | CSS изменён, HTML возможно сломан |
| 4-5 site icons | 🟡 | Rule34/Danbooru есть, остальные нужны |
| 4-6 tag tables redesign | 🟢 | Выполнено (коммит 81d0238) |
| API refactoring | 🔴 | Не начато |
| 5-1 NHentai search | 🟢 | Выполнено (коммит 0de40a5) |
| 5-2 Drag-to-tag | 🟢 | Выполнено (коммит 5522974) |
| 5-3 Franchise search | 🔴 | Не начато |
| 5-4 Kemono/Coomer | 🟢 | Базово выполнено (коммит a7c9d9a) |

🔴 Не сделано  🟡 Частично  🟢 Сделано

---

## 4. Зависимости

```
3-1 → (нет)
3-2 → 4-3
3-3 → 4-6
3-4 → 4-6
3-5 → (нет)
4-1 → 5-3 (нужна folder-система для нового контента)
4-2 → 5-1, 5-2, 5-3, 5-4 (бекенды для всех сайтов)
4-3 → 3-2
4-4 → 5-1, 5-2 (UI для новых страниц)
4-5 → (нет)
4-6 → 3-3, 3-4 (структура тегов)
API ref → 4-2
5-1 → 4-2, 4-4, 4-5
5-2 → 5-1
5-3 → 4-1, 4-2, 5-1
5-4 → 4-1, 4-2
```
