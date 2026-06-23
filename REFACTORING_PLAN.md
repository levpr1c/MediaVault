# План рефакторинга JS кода (v1.1.2 → v1.2.0)

> ⚠️ **План рефакторинга JS. Багфиксы v1.2.0 завершены.**
> Рефакторинг JS не начат — будет после тестов текущих изменений.

---

## Сводка

| Метрика | Значение |
|---------|----------|
| Всего JS файлов | 33 (без lib/) |
| Всего строк | ~9 594 |
| Мёртвый код (можно удалить) | ~1 100 строк, ~55 функций |
| Дублирующийся код (можно вынести в shared) | ~250 строк, ~12 паттернов |
| Файлов для документирования (JSDoc) | 33 |

## Статус тестирования

- ✅ `venv/bin/python test.py` — теперь включает smoke (изменено 22.06)
- 📋 `TESTING.md` — отформатирован в `- [ ]`, ждёт простановки `[x]`
- ⚠️ `A[]` маркер автотестов потерял пробел (`A[ ]` → `A[]`) — поправить при рефакторинге

---

## Выполнено (23.06.2026) — багфиксы v1.2.0 без рефакторинга JS

Все изменения ниже — это багфиксы и UX-улучшения, выполненные в текущей сессии. Рефакторинг JS не начинался.

- ✅ NHentai tags: теги сохраняются в `tag_category_members` + `comics.tags` + `file_tags`
- ✅ Admin Import: добавлен диалог выбора файла
- ✅ Comics-tags: фильтр по источнику (backend `?sources=` + фронт)
- ✅ Mobile gallery: паддинг между карточками уменьшен
- ✅ Content-search header: унифицирован с CM
- ✅ Lightbox: стрелочки навигации вместо зон (gallery mode)
- ✅ Manga viewer: 3 режима (single/spread/scroll) + mobile default single
- ✅ Поиск комиксов: на comics-tags и comics editor
- ✅ Home: 3-я CM карточка для user + хедер admin/user
- ✅ Home mobile: рефакторинг responsive
- ✅ Content-search auto-fill: подгрузка страниц до заполнения экрана

---

## 1. МЁРТВЫЙ КОД — можно удалить

### 1.1 Целый файл: `static/tagfetch/manual/manual.js` (611 строк)

Полностью заменён на `manual-v2.js`. Не загружается ни в одном шаблоне. 
22 функции, все мертвы: `isMediaFile`, `getFileIcon`, `renderDbTags`, `tagChip`, `renderDanTags`, `setFilter`, `applyFilter`, `toggleDateSort`, `_sortBrowserItems`, `loadBrowser`, `selectFile`, `updateFileStatus`, `fetchTags`, `fetchAllFiles`, `cancelFetchAll`, `saveFetchResult`, `clearCurrentCache`, `saveFile`, `openSaveAllModal`, `closeSaveAllModal`, `executeSaveAll`, `getCurrentBrowsePath`, `init`.

### 1.2 `static/mediavault/utils.js` — весь файл (45 строк, 6 функций)

Никто не использует `MediaVaultUtils`:
- `MediaVaultUtils.formatBytes`  
- `MediaVaultUtils.isMediaFile`
- `MediaVaultUtils.getFileIcon`
- `MediaVaultUtils.isVideo`
- `MediaVaultUtils.hexToRgba`
- `MediaVaultUtils.parseTags`

### 1.3 `static/mediavault/api.js` — 3 функции

- `MediaVaultAPI.browse` (не используется)
- `MediaVaultAPI.fileinfo` (не используется)
- `MediaVaultAPI.fetchFile` (не используется)

### 1.4 `static/mediavault/db.js` — 6 функций

- `setDbPath`, `getDbPath`, `importDB`, `exportDB`, `getCategories`, `getPopularTags`

### 1.5 `static/mediavault/mediavault.js` — 1 функция

- `MediaVault.importDB` (экспортируется, но не вызывается)

### 1.6 `static/tagfetch/api.js` — 9 функций

- `TagfetchAPI.autoStatus`, `saveSettings`, `clearThumbCache`, `clearTagCache`, `clearDatabase`, `clearAll`, `regenerateThumbnails`, `generateMissingThumbnails`, `regenerateThumbnailsStatus`

### 1.7 `static/tagfetch/tagfetch.js` — 2 функции

- `Tagfetch.getCurrentTab`, `window.switchTab`

### 1.8 i18n мёртвый ключ

- `contentSearchPages` — определён в LOCALE и `_i18nData`, но нигде не используется

---

## 2. ДУБЛИРУЮЩИЙСЯ КОД — вынести в shared

### 2.1 `_cbSuffix()` — 5 копий (канон: `shared/utils.js:979`)

| Файл | Строки |
|------|--------|
| `shared/utils.js:979` | **канон** |
| `shared/grid-renderer.js:19` | копия |
| `content/comics.js:152` | копия |
| `content/tags-manage/tags-manage.js:374` | копия |
| `mediavault/api.js:12` (как `_cb()`) | копия |

**Действие**: удалить локальные копии, везде использовать `window._cbSuffix()`.

### 2.2 `hexToRgba()` — 3 копии (канон: `shared/utils.js:911`)

| Файл | Строки |
|------|--------|
| `shared/utils.js:911` | **канон** (`Shared.hexToRgba`) |
| `shared/grid-renderer.js:15` | копия |
| `content/utils.js:22` | копия |

**Действие**: grid-renderer.js и content/utils.js — переписать на `Shared.hexToRgba()`.

> **Все JSDoc комментарии на русском языке.**

### 2.3 `_t()` и `esc()` — в grid-renderer.js (копия из content/utils.js)

`grid-renderer.js:6-13` определяет свои `_t()` и `esc()`, хотя `content/utils.js` экспортирует те же функции.

**Действие**: grid-renderer.js может импортировать из `content/utils.js` (оба ES модули).

### 2.4 `parseTags` — дублирован в lightbox.js (канон: `shared/utils.js:917`)

`Lightbox.prototype._parseTags` (lightbox.js:823) — 50+ строк, дублирует `Shared.parseTags`.

### 2.5 `isMedia` / `isVideo` — 9 мест, 4 разных реализации

Разбросаны по: `manual-v2.js`, `auto.js`, `gallery.js`, `lightbox.js`, `content/utils.js`, `mediavault/utils.js` (dead).

**Действие**: создать `Shared.isVideo = function(name) { ... }` в shared/utils.js, заменить везде.

### 2.6 `renderDbTags` — 3 места

`gallery/tags.js`, `manual-v2.js` (live), `manual.js` (dead). V2 и tags.js — ~10 строк, почти идентичны.

### 2.7 API wrappers — 3 набора одинаковых эндпоинтов

- `mediavault/api.js` — `MediaVaultAPI.browse/fileinfo/fetchFile` (DEAD)
- `tagfetch/api.js` — `TagfetchAPI.browse/fileinfo/fetchFile` (live)
- `shared/api.js` — есть общий api.js в shared/

**Действие**: удалить dead, оставить только живые.

---

## 3. ДОКУМЕНТИРОВАНИЕ (JSDoc) — язык русский

Сколько функций нужно документировать по файлам:

| Файл | Функций | Статус |
|------|---------|--------|
| `shared/utils.js` | ~40 | Нет JSDoc |
| `shared/lightbox.js` | ~30 методов | Нет JSDoc |
| `shared/gallery/gallery.js` | ~25 | Нет JSDoc |
| `shared/gallery/tags.js` | ~8 | Нет JSDoc |
| `shared/grid-renderer.js` | ~8 | Нет JSDoc |
| `shared/comics/comics.js` | ~12 | Нет JSDoc |
| `shared/api.js` | ~4 | Нет JSDoc |
| `shared/init.js` | ~0 (только init) | Нет JSDoc |
| `shared/icons.js` | ~5 | Нет JSDoc |
| `shared/home-bg.js` | ~2 | Нет JSDoc |
| `shared/grid/shared-grid.js` | ~15 | Нет JSDoc |
| `shared/comics/comics-list.js` | ~5 | Нет JSDoc |
| `shared/comics/picker-bridge.js` | ~5 | Нет JSDoc |
| `content/*.js` (7 файлов) | ~50 | Нет JSDoc |
| `mediavault/*.js` (4 файла, с учётом удаления) | ~20 | Нет JSDoc |
| `admin/admin.js` | ~40 | Нет JSDoc |
| `tagfetch/*.js` (3 файла) | ~30 | Нет JSDoc |

**Всего**: ~300+ функций/методов без JSDoc.

---

## 4. ОЧИСТКА ДОКУМЕНТАЦИИ

| Файл | Действие |
|------|---------|
| `docs/new-features-summary.md` | Уже почищен (238 строк тестов удалено) |
| `docs/code-guide.md` | Обновить роуты, добавить bg download endpoints |
| `AGENTS.md` | Уже обновлён |
| `README.md` | Добавить структуру проекта |
| `roadmap/roadmap.md` | Feature 6 — 7 unchecked пунктов |

---

## 5. ПОРЯДОК ДЕЙСТВИЙ (рефакторинг не начат)

> **⚠️ Рефакторинг JS пока не начат.** Все шаги ниже — план на будущее. Сначала нужно протестировать багфиксы v1.2.0, затем приступить к JS рефакторингу.

```
Шаг 1: Поправить A[] → A[ ] в TESTING.md (пробел)
Шаг 2: Удалить static/tagfetch/manual/manual.js (611 строк)
        → обновить imports, проверить что manual-v2.js всё покрывает

Шаг 3: Удалить static/mediavault/utils.js (45 строк)
        → проверить что никто не импортирует MediaVaultUtils

Шаг 4: Удалить 3 функции из mediavault/api.js (browse, fileinfo, fetchFile)

Шаг 5: Удалить 6 функций из mediavault/db.js

Шаг 6: Удалить importDB из mediavault/mediavault.js

Шаг 7: Удалить 9 функций из tagfetch/api.js

Шаг 8: Удалить tagfetch/tagfetch.js или оставить если plan-заглушка

Шаг 9: Убрать дубликаты _cbSuffix, hexToRgba, _t, esc

Шаг 10: Вынести isMedia/isVideo в shared

Шаг 11: Добавить JSDoc (по 2-3 файла за раз)
```

---

## 6. ИТОГОВЫЕ МЕТРИКИ (прогноз — рефакторинг не начат)

| Параметр | До | После |
|----------|-----|-------|
| JS строк | ~9 594 | ~8 400 |
| JS файлов | 33 | 31 |
| Мёртвый код | ~1 100 строк | 0 |
| Дубликаты | ~250 строк | 0 |
| JSDoc coverage | 0% | 100% |

---

## 7. НОВАЯ ФИЧА: Визуальный просмотрщик дубликатов

После рефакторинга → новая фича для админки.

### Идея

Кнопка "Duplicates" в админке → модал с двумя панелями: слева список групп дубликатов (по md5), справа — два файла рядом для сравнения. Под каждым теги. Hover на видео/GIF играется. Клик открывает Lightbox.

### Backend

- **`GET /api/duplicates`** — возвращает группы дубликатов (md5 + массив файлов)
- SQL: `SELECT f.path, f.tags, f.width, f.height, m.md5 FROM files f JOIN file_md5 m ON f.path = m.path` → GROUP BY md5 HAVING COUNT(*) > 1
- Ответ:
```json
[
  {
    "md5": "abc123...",
    "files": [
      {"path": "Gallery/.../img.jpg", "tags": "tag1,tag2", "width": 1920, "height": 1080, "size": 12345, "mtime": 1234567890},
      {"path": "Downloads/.../img.jpg", "tags": "tag3,tag4", "width": 1920, "height": 1080, "size": 12345, "mtime": 1234567890}
    ]
  }
]
```

### Frontend (`admin/admin.js`)

- Новая секция `duplicates` в `_sections`
- Кнопка в хедере админки (рядом с Scan/Export/Import/Deduplicate)
- Левая панель: список групп (md5 + количество файлов + мини preview)
- Правая панель: flex-row с двумя `.dup-panel` (50/50)
- Каждый `.dup-panel`:
  - `<img>` или `<video>` с `/api/thumbnail?path=...`
  - Теги снизу (цветные чипсы, как в tagfetch)
  - Hover video/GIF → playPreview / stopPreview (из auto.js)
  - Клик → lightbox (из auto.js)

### CSS (`admin.css`)

- `.dup-modal` — fullscreen overlay
- `.dup-layout` — flex row, left panel 300px, right panel flex-1
- `.dup-compare` — flex row, два `.dup-panel` по 50%
- `.dup-panel` — превью `max-height: 60vh`, теги scroll
- `.dup-tag` — чипсы с цветом (реюз из tagfetch.css)
- `.dup-count` — бейдж с количеством файлов в группе

### Зависимости от рефакторинга

- Рефакторинг (шаги 1-5) должен быть завершён — фича добавляется **после** удаления мёртвого кода
- Не блокирует v1.2.0 — может войти как v1.3.0
- ~300 строк JS, ~100 строк CSS


