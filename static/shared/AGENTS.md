# static/shared/ — Общие JS модули

**LOC:** ~4600 (17 файлов + 3 поддиректории)
**Используется:** во всех трёх саб-приложениях (MV, CM, Admin)

## Файлы

| Файл | LOC | Роль |
|------|-----|------|
| `utils.js` | 1071 | `Shared.*` хелперы, `_i18nData`, debounce |
| `lightbox.js` | 1127 | `Lightbox` класс — полноэкранный просмотрщик |
| `find-originals.js` | 428 | Поиск оригиналов |
| `gallery/gallery.js` | 857 | Галерея MV (рендер, фильтры) |
| `comics/comics.js` | 554 | CRUD + рендер комиксов (shared) |
| `grid-renderer.js` | 149 | `comicCardHTML()`, `buildComicsGridHTML()` |
| `home-bg.js` | 145 | Three.js фон на главной |
| `grid/shared-grid.js` | 140 | Вспомогательные модули сеток |
| `comics/comics-list.js` | 117 | Список комиксов |
| `init.js` | 101 | Инициализация общих компонентов |
| `gallery/lightbox.js` | 96 | Лайтбокс галереи (shared) |
| `mobile-search.js` | 84 | Мобильный поиск |
| `comics/comics-search.js` | 65 | Поиск комиксов |
| `comics/picker-bridge.js` | 53 | Мост выбора файлов |
| `api.js` | 37 | API хелперы (fetch, ошибки) |
| `icons.js` | 26 | `SiteIcons.getIcon` — все SVG иконки |
| `gallery/tags.js` | 224 | Тегирование в галерее |

## Ключевые символы

### utils.js
- `Shared.hexToRgba(hex, alpha)` — конвертация цвета
- `Shared.parseTags(str)` — парсинг строки тегов
- `Shared.getColumnCount()` — количество колонок (responsive)
- `Shared.reorderGalleryDOM()` — переупорядочивание DOM галереи
- `Shared.getVisualOrder()` — визуальный порядок элементов
- `Shared.debounce(fn, ms)` — debounce
- `Shared.escHtml(s)` — экранирование HTML
- `_i18nData` — глобальный объект локализации

### lightbox.js
- `class Lightbox` — основной класс
  - `constructor(opts)` — создание с опциями
  - `open(index)` — открыть
  - `close()` — закрыть
  - `next()` / `prev()` — навигация
  - `_sizeLb()` — изменение размера (в т.ч. LB_PANEL_W для панели тегов)
  - `_renderTags()` — рендер тегов
  - `_attachEvents()` / `_detachEvents()` — события
  - `_keydown()` — клавиатурная навигация
- Опции: arrowNav, tagPanel, downloadLabelFn, etc.
- **Важно:** всегда оборачивать `new Lightbox()` и `close()` в try-catch

### icons.js
- `SiteIcons.getIcon(name)` — возвращает inline SVG строку
- Иконки: search, close, menu, settings, admin, tag, download, и т.д.

### grid-renderer.js
- `buildLeftPanelHtml(searchPlaceholder)` — левая панель
- `renderLeftTags(container, cats, searchQ, opts)` — теги слева
- `setupDragEvents(body, signal, opts)` — drag events
- `comicCardHTML(comic)` — HTML карточки комикса
- `buildComicsGridHTML(comics)` — HTML сетки комиксов

### find-originals.js
- Поиск оригиналов (более высокое разрешение) через внешние API
- Отображение прогресса
- Кнопка отмены

### mobile-search.js
- `MobileSearch.register()` — **бросает "is not a function"**, обёрнуто в try-catch
- Мобильный поиск с выдвижной панелью

### comics/comics.js
- CRUD операции: create, read, update, delete комиксов
- Рендер списка комиксов в grid/masonry
- Модальные окна для создания/редактирования

### gallery/gallery.js
- Галерея MV (рендер, фильтры, layout переключение)
- Masonry/Grid/List layouts
- Фильтрация по тегам и имени
- Пагинация

## ТЕХДОЛГ И УЛУЧШЕНИЯ (для AI-ревью)

### Shared модули — узкие места

1. **Lightbox — самый сложный модуль (~1500 строк)**
   - Вся логика: навигация, зум, теги, клавиатура — в одном классе
   - Нужно разбить: `LightboxView`, `LightboxTags`, `LightboxZoom`
   - `downloadLabelFn` — опция костыль, лучше strategy pattern
   - **Важно**: `new Lightbox()` и `.close()` всегда в try-catch — иначе краш

2. **Нет TypeScript**: все модули на Vanilla JS — типы теряются, рефакторить страшно

3. **Нет тестов**: ни одного unit-теста на JS модули

4. **`MobileSearch.register()` падает**: залечено try-catch, но root cause не исправлен

5. **Иконки через `SiteIcons.getIcon()`**: все SVG инлайном в JS — хорошо для производительности, но нельзя tree-shake

6. **Нет системы уведомлений** — `notifications.js` был удалён, уведомления через примитивный toast

7. **Дублирование `comics.js`**: существует и в `shared/comics/`, и в `content/comics.js` — разная реализация

### Что улучшить

| Задача | Сложность | Эффект |
|--------|-----------|--------|
| Разбить Lightbox на sub-классы | Высокая | Читаемость, тестируемость |
| Добавить Jest/Vitest для shared модулей | Средняя | Безопасность рефакторинга |
| Починить `MobileSearch.register()` | Низкая | Убрать try-catch костыль |
| Добавить очередь уведомлений | Низкая | UX — не терять уведомления |
| Объединить `comics.js` (shared + content) | Средняя | Убрать дублирование |

### Что НЕ трогать
- `Shared.*` — стабильный API, менять только с обратной совместимостью
- `SiteIcons.getIcon` — все иконки в одном месте, это удобно
- `_i18nData` — глобальная переменная, но работает. Рефакторинг только если переходить на i18n library
