# Спецификация: Редизайн tags-manual (ручной режим Tagfetch)

## 1. Overview

**tags-manual** — страница ручного тегирования неиндексированных медиафайлов. Пользователь (admin) просматривает файловую систему через веб-браузер, выбирает файл, получает теги с Rule34 и Danbooru по MD5, затем сохраняет их в локальную БД.

Место в проекте: `/tagfetch/manual` — одна из трёх вкладок Tagfetch (manual, auto, settings). Хост — `templates/tagfetch/manual.html`, JS — `static/tagfetch/manual/manual-v2.js` (645 строк, IIFE), CSS — `static/css/tagfetch.css` (раздел `[data-tf="manual"]`).

Жизненный цикл: выбор директории → просмотр файлов → выбор файла → фетч тегов (R34 + Danbooru) → просмотр/фильтрация → сохранение (одиночное или массовое).

---

## 2. Current Architecture

### 2.1 Файловый браузер

- Левая панель (`#mtBrowserPanel`), стиль `.shared-tag-panel` (как CM)
- Хлебные крошки (`#browseBreadcrumb`) — интерактивные, каждый сегмент ведёт к `ManualTagfetch.loadBrowser(path)`
- Список сущностей (`#browseBrowser`) — `.path-item`: папки (клик → переход), медиафайлы (клик → `selectFile()`)
- Вход: `loadBrowser(path)` → `TagfetchAPI.browse(path)` → рендер DOM напрямую

### 2.2 Панель информации о файле

- `#fileInfo` — путь, размер, разрешение, существующие DB-теги
- `#localPreview` — `<img>` или `<video>` с `/api/media?path=`
- `#currentTags` — существующие теги из БД

### 2.3 Панели фетча

- `#r34Tags` / `#danTags` — теги из API, отображаются как `.tag-chip`
- `#r34Preview` / `#danPreview` — превью с Rule34 / Danbooru
- `#r34Count` / `#danCount` — количество тегов
- `#actions` — кнопки сохранения (`saveFile('r34'|'dan'|'both')`)
- `#fetchBtn` — инициирует `fetchTags()`

### 2.4 Фильтр и сортировка

- Пять кнопок фильтра: all / no_tags / found / not_found / db
- Поле поиска (`#mtFileSearch`) — `filterFiles()`, фильтрация по имени
- Сортировка: `toggleDateSort()` — циклический переключатель name → newest → oldest

### 2.5 Save-флоу

**Одиночное сохранение:**
`selectFile()` → `fetchTags()` → просмотр тегов → `saveFile(source)` → `TagfetchAPI.saveFile()` → `updateFileStatus('db')`

**Массовое сохранение:**
1. `fetchAllFiles()` — последовательный обход всех файлов в директории (рекурсивный вызов `next()`)
2. После завершения — результаты в `#fetchAllResults` с кнопкой `+` для каждого
3. `openSaveAllModal()` — `TagfetchAPI.saveAllFetched(paths, dryRun=true)` → модалка
4. `executeSaveAll()` — `TagfetchAPI.saveAllFetched(paths, dryRun=false)`

### 2.6 Drag-to-tag

- Теги в `.tag-draggable` (R34 и Dan) — dragstart устанавливает `text/plain` + `application/x-source`
- Файлы в браузере — droppable, `onTagDrop()` → `POST /api/save_file` с `source='tag_editor'`

### 2.7 API endpoints

| Endpoint | Метод | Параметры | Назначение |
|----------|-------|-----------|------------|
| `/api/browse` | GET | `path` | Список файлов и папок в директории |
| `/api/fileinfo` | GET | `path` | Метаданные и теги файла из БД |
| `/api/fetch_file` | GET | `path` | Получение тегов с R34 и Dan по MD5 |
| `/api/check_status` | POST | `paths[]` | Статус по списку файлов (db/found/not_found/error) |
| `/api/save_file` | POST | `path, source` | Сохранение тегов в БД |
| `/api/save_all_fetched` | POST | `paths[], dry_run` | Массовое сохранение |
| `/api/clear_cache` | POST | `path` | Очистка in-memory кэша для файла |
| `/api/media` | GET | `path` | Отдача медиафайла (с Range) |

### 2.8 Структура данных (`st`)

```js
var st = {
  currentFileAbsPath: '',   // абсолютный путь к текущему файлу
  currentFileRelPath: '',   // относительный (от media_dir)
  browsePath: '',           // текущая директория в браузере
  fileEntries: [],          // [{name, path, rel_path, mtime, is_dir, _status}]
  fetchAllData: [],         // [{name, path, r34n, dann, r34, dan, dan_*, found, saved, source}]
  saveAllFiles: [],         // [{name, path, tags_count}]
  filterMode: 'all',
  sortMode: 'name',
  fetchAllCancelled: false
};
```

---

## 3. Current Pain Points

### 3.1 Управление состоянием

- **Единый IIFE-объект** с плоским состоянием (`st`). Нет разделения на подсостояния (browser, selection, fetch, save).
- **Мутация `st` напрямую** из функций: `st.fileEntries = []`, `st.currentFileRelPath = rp`. Нет иммутабельности, нет хуков на изменения.
- **Нет guards**: `saveFile()` не проверяет, есть ли данные для сохранения; `fetchTags()` не блокирует повторный вызов до завершения предыдущего.
- **Гонка между `loadBrowser()` и `checkStatus()`**: `checkStatus` — асинхронный, мапит на `st.fileEntries`, но `loadBrowser` может быть вызван снова до завершения `checkStatus`, оставляя статусы на старых entries.

### 3.2 Async / Race conditions

- **`fetchAllFiles()` — рекурсивный цикл** с `setTimeout(next, 300)`. Нет ограничения на параллелизм. Может накладываться на пользовательский `selectFile()`.
- **Глобальный `st.fetchAllCancelled`** — флаг не проверяется атомарно между `then`. При быстрой отмене может сохраниться последний файл.
- **`saveFetchResult()`** — временно перезаписывает `st.currentFileRelPath`, что ломает UI во время массового сохранения.
- **Нет AbortController**: ни один fetch не отменяем. Переход в другую директорию не отменяет текущие запросы.

### 3.3 UI/UX

- **Эмодзи как иконки**: `🎬`, `🖼️`, `💾`, `🔍`, `🚫`, `❌` — не консистентно с inline SVG в CM. Проблемы с доступностью.
- **Нет состояния загрузки** для `loadBrowser()`: при медленном ответе пользователь видит старый контент.
- **Нет Undo**: любое сохранение тегов необратимо (кроме перезаписи вручную).
- **Отсутствует tag editor**: нет возможности ввести или удалить отдельный тег. Только add из API.
- **Нет массового редактирования**: нельзя добавить/удалить тег у нескольких файлов одновременно.
- **Нет категоризации тегов при отображении**: теги из БД показываются плоским списком без группировки по категориям.

### 3.4 Код

- **Дублирование рендера** между `fetchTags()` и `fetchAllFiles()`: идентичные блоки для R34/Dan tags, preview, action buttons — скопированы (строки 277–306 vs 379–404).
- **Inline `onclick` в шаблоне** и в JS при генерации HTML. Нарушает CSP, усложняет отладку.
- **Hardcoded строки**: `'🔍 Fetch Tags'`, `'Failed to fetch'`, эмодзи — нет i18n.
- **Нет типов**: JS без TypeScript/JSDoc. Невозможно статически проверить структуру `fetchAllData[i]`.
- **Нет ES modules**: IIFE без изоляции. `window.ManualTagfetch` добавляет 16 публичных методов.

### 3.5 Отсутствующие фичи

- **Фильтр по тегам**: нельзя найти файлы, содержащие определённый тег.
- **Полнотекстовый поиск** по именам файлов (есть `filterFiles()`, но примитивный — `indexOf`, нет debounce).
- **Групповые операции**: select all, batch tag add/remove.
- **Prefetch**: нет prefetch соседних файлов при просмотре.
- **Клавиатурная навигация**: есть ArrowUp/Down, но нет Enter для фетча, нет Escape для отмены.

---

## 4. Proposed Redesign

### 4.1 Архитектура: ES module + классы

Заменить IIFE на ES module с экспортом классов:

```
ManualTagfetch (модуль)
├── FileBrowser        — навигация, breadcrumb, фильтр, сортировка
├── FilePreview        — превью, метаданные, DB-теги
├── TagFetcher         — R34/Dan API, кэш
├── TagEditor          — ручное добавление/удаление тегов (как CM tags-manage)
├── SaveManager        — одиночное и массовое сохранение + Undo
└── StateManager       — централизованное состояние с подписками
```

### 4.2 State machine для выбора файла

Чёткие состояния перехода:

```
IDLE → BROWSING → FILE_SELECTED → FETCHING → TAGS_READY → SAVING → SAVED
                                      ↓            ↓
                                 FETCH_ERROR   NO_TAGS
```

Каждое состояние блокирует неподходящие действия (нельзя сохранить до фетча, нельзя фетчить повторно).

### 4.3 Unified tag editing panel

Вместо текущих `#r34Tags` + `#danTags` + `#currentTags` — единая панель как в CM `tags-manage.js`:

- Группированные теги по категориям (artist, character, copyright, meta, general)
- Ввод нового тега вручную (`.cm-tags-add-input`)
- Удаление тега крестиком (`.cm-tags-chip-rm`)
- Drag-to-tag между категориями
- Цветовая индикация категорий

### 4.4 Undo support

- Стек операций `[{type: 'tag_add'|'tag_remove'|'save', timestamp, filePath, prevTags, newTags}]`
- `Ctrl+Z` / кнопка Undo — откат последней операции
- Bulk undo для `saveAll`
- Undo-стек ограничен 50 операциями, очищается при смене директории

### 4.5 Mobile experience

- Текущий CSS: `@media(max-width:768px)` — колонки stack, модалка на всю ширину
- Дополнительно: bottom sheet для панели тегов, выдвижной файловый браузер (drawer)
- Touch-friendly drag-to-tag (long-press + drag)
- Адаптивные кнопки: `flex: 1; min-width: 0` (уже есть частично)

---

## 5. UI Mockups (textual)

### 5.1 Состояние: пустая директория

```
┌──────────────────────────────────────────────────────┐
│ [All] [No Tags] [Found] [Not Found] [In DB]  🔍 ___ │  ← toolbar
├──────────────────────┬───────────────────────────────┤
│                      │                               │
│   📁 /               │                               │
│   › media ›          │   ┌───────────────────────┐  │
│   empty_dir          │   │  📁 No media files    │  │
│                      │   │  in this directory    │  │
│   <empty>            │   └───────────────────────┘  │
│                      │                               │
│                      │   File info: (none)            │
│                      │   Preview: (none)              │
│                      │   Tags: (none)                 │
│                      │                               │
├──────────────────────┴───────────────────────────────┤
│ 0 files                                              │
└──────────────────────────────────────────────────────┘
```

### 5.2 Состояние: файл выбран + результаты фетча

```
┌──────────────────────────────────────────────────────┐
│ [All] [No Tags] [Found] [Not Found] [In DB]  🔍 ___ │
├──────────────────────┬───────────────────────────────┤
│  › media › artists   │  image_001.jpg                │
│  › painter ›         │  📐 1920×1080  📦 2.3 MB      │
│                      │  🏷️ portrait, oil, landscape │
│  📁 ..               │                               │
│  🖼️ image_001.jpg  ←│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  🖼️ image_002.jpg   │  │Local │ │R34   │ │Dan   │ │
│  🖼️ image_003.jpg   │  │      │ │      │ │      │ │
│                      │  └──────┘ └──────┘ └──────┘ │
│                      │                               │
│                      │  [🔍 Fetch Tags] [🗑 Clear]  │
│                      │                               │
│                      │  ┌─ R34 (12) ────────────┐   │
│                      │  │ girl  blonde  dress   │   │
│                      │  │ blue_eyes  smile      │   │
│                      │  └────────────────────────┘  │
│                      │  ┌─ Danbooru (8) ─────────┐  │
│                      │  │ Artist: john_doe       │  │
│                      │  │ Character: yuki        │  │
│                      │  │ Series: original       │  │
│                      │  └────────────────────────┘  │
│                      │                               │
│                      │  [📥 Add Both (20)]          │
│                      │                               │
│                      │  DB Tags: portrait, oil       │
│                      │  [+ Add tag...]              │
└──────────────────────┴───────────────────────────────┘
```

### 5.3 Состояние: save confirmation (после сохранения + Undo)

```
┌──────────────────────────────────────────────────────┐
│ [All] [No Tags] [Found] [Not Found] [In DB]  🔍 ___ │
├──────────────────────┬───────────────────────────────┤
│  › media › artists   │  image_001.jpg                │
│  › painter ›         │  ✅ Saved                     │
│                      │                               │
│  📁 ..               │  [🔍 Fetch Tags] [↩ Undo]    │
│  🖼️ image_001.jpg ✅│                               │
│  🖼️ image_002.jpg 🔍│  DB Tags: portrait, oil,      │
│                      │  girl, blonde, blue_eyes      │
│                      │                               │
│                      │  Success notification:        │
│                      │  ┌─────────────────────────┐ │
│                      │  │ ✅ Tags saved (20)     x│ │
│                      │  │ [↩ Undo]                │ │
│                      │  └─────────────────────────┘ │
└──────────────────────┴───────────────────────────────┘
```

---

## 6. Tech Spec

### 6.1 ES module conversion

**Вход:** `static/tagfetch/manual/manual-v2.js` (645 строк, IIFE)

**Выход:** ES module `static/tagfetch/manual/manual.js` с экспортом:

```js
// manual.js — ES module
import { FileBrowser }  from './browser.js'
import { FilePreview }  from './preview.js'
import { TagFetcher }   from './fetcher.js'
import { TagEditor }    from './editor.js'
import { SaveManager }  from './saver.js'
import { StateManager } from './state.js'

export class ManualTagfetch {
  constructor(container) { /* ... */ }
  init() { /* ... */ }
  destroy() { /* ... */ }
}
```

**Загрузка в шаблоне:**
```html
<script type="module">
  import { ManualTagfetch } from '/static/tagfetch/manual/manual.js'
  window.ManualTagfetch = new ManualTagfetch(document.getElementById('contentView'))
  ManualTagfetch.init()
</script>
```

### 6.2 Data flow diagram (text)

```
User clicks dir         User types filter        User clicks file
      │                       │                       │
      ▼                       ▼                       ▼
FileBrowser.navigate()  FileBrowser.filter()    FileBrowser.select()
      │                       │                       │
      ▼                       ▼                       ▼
TagfetchAPI.browse()    DOM filter (local)      StateManager.set('selected')
      │                                       ┌─────────┴──────────┐
      ▼                                       ▼                    ▼
StateManager.set('entries')             FilePreview.show()   Tagfetcher.fetch()
      │                                       │                    │
      ▼                                       ▼                    ▼
DOM render + breadcrumb               /api/fileinfo →       /api/fetch_file →
      │                                meta + DB tags        R34 + Dan tags
      ▼                                       │                    │
TagfetchAPI.checkStatus()                    ▼                    ▼
      │                                FilePreview.update()  TagEditor.render()
      ▼                                                                  │
StateManager.set('statuses')                                       User clicks Save
      │                                                                  │
      ▼                                                                  ▼
sortBrowserItems() + applyFilter()                               SaveManager.save()
                                                                         │
                                                                         ▼
                                                                  /api/save_file
                                                                         │
                                                                    ┌────┴────┐
                                                                    ▼         ▼
                                                              StateManager  UndoStack.push
                                                              updateFileStatus('db')
```

### 6.3 State shape (предлагаемая)

```js
const state = {
  browser: {
    path: '/media/manga',
    entries: [{ name, path, relPath, mtime, isDir, status }],
    filter: 'all',            // all | no_tags | found | not_found | db
    sort: 'name',             // name | newest | oldest
    searchQuery: '',
    isLoading: false,
    error: null,
  },
  selection: {
    absPath: '',
    relPath: '',
    name: '',
    fileInfo: { size, dimensions, dbTags, tagCategories, hasNonMetaTags },
    status: 'idle'            // idle | loading_selected | fetching | tags_ready
                              // | no_tags | saving | saved | error
  },
  fetch: {
    r34: { tags: [], preview: '', count: 0, isLoading: false },
    dan: { tags: { artist: [], character: [], copyright: [], meta: [], general: [] },
           preview: '', count: 0, isLoading: false },
    error: null,
  },
  editor: {
    manualTags: [],          // tags added/removed by user
    originalDbTags: '',      // для undo
    pendingChanges: false,
  },
  bulk: {
    allFiles: [],
    fetchAllData: [],
    saveAllPaths: [],
    isFetching: false,
    isSaving: false,
    cancelled: false,
  },
  undoStack: [],
};
```

### 6.4 API endpoints (те же, с опциональными улучшениями)

| Endpoint | Изменения |
|----------|-----------|
| `/api/browse` | + `filter` param для серверной фильтрации (опционально) |
| `/api/check_status` | Без изменений |
| `/api/fetch_file` | + `sources[]` для выбора API (сейчас всегда оба) |
| `/api/save_file` | + `tags[]` для указания конкретного набора тегов. + `mode: 'merge'|'replace'` |
| `/api/save_all_fetched` | + `mode` параметр |
| `/api/fileinfo` | Без изменений |
| `/api/clear_cache` | Без изменений |

### 6.5 TagEditor — унификация с CM tags-manage

Использовать компонент `TagEditor` из CM (или standalone):

- Поле ввода с автокомплитом (по существующим тегам в БД)
- Drag-to-tag между категориями
- Удаление крестиком
- Категоризированное отображение (цветовые группы)
- Bulk add/remove для выделенных файлов

### 6.6 Undo stack

```js
class UndoManager {
  constructor(maxSize = 50) {
    this.stack = [];
    this.maxSize = maxSize;
  }
  push(entry) { /* { type, file, prevTags, newTags, timestamp } */ }
  undo() { /* revert last operation */ }
  clear() { /* on directory change */ }
}
```

### 6.7 Migration план

1. Создать новую структуру: `manual/` с подпапками `browser/`, `preview/`, `fetcher/`, `editor/`, `saver/`, `state/`
2. Поэтапно переносить функции из `manual-v2.js` в классы с сохранением API `window.ManualTagfetch.*`
3. После завершения — удалить IIFE, переключить шаблон на ES module
4. Протестировать: `fetchTags()`, `fetchAllFiles()`, `saveFile()`, `saveAll`, drag-to-tag, filter/sort, empty states
5. Удалить `manual-v2.js` и rename `manual.js` -> перезаписать

### 6.8 Критические конвенции (из AGENTS.md)

- `Lightbox.close()` — guard на `_el('Media')` null
- `window.fnName` для `onclick` — IIFE модули экспортят глобалы (`Shared.*`, `AdminDashboard.*`)
- ES module timing bug: content рендерится до scripts — try-catch вокруг `new ManualTagfetch()`
- CSS loading order: `tagfetch.css` → `mediavault.css` последний
- Нет emoji — inline SVG (но в текущей реализации эмодзи, миграция на SVG)
