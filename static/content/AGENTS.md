# static/content/ — Content Management SPA

**LOC:** ~2000 (8 файлов + поддиректория tags-manage/)
**Роль:** Административная панель управления контентом (/content-mgmt/)

## Файлы

| Файл | LOC | Роль |
|------|-----|------|
| `main.js` | ~100 | SPA роутер и инициализация |
| `content-search.js` | ~700 | Поиск по Rule34/Danbooru/NHentai/E-Hentai |
| `comics-tags.js` | ~250 | Drag-n-drop теги для комиксов |
| `comics.js` | ~150 | CRUD комиксов (CM версия) |
| `tags.js` | ~200 | Массовое тегирование файлов |
| `nhentai_search.js` | ~300 | Поиск по NHentai |
| `utils.js` | ~100 | Утилиты CM |
| `tags-manage/` | ~200 | Тегирование отдельных файлов |

## main.js — SPA Роутер

- `init()` — точка входа, запускает роутинг
- `loadSection(name)` — загрузка секции по имени
- `registerMobileSection(name)` — регистрация мобильных секций
- Роуты: search, comics, comics-tags, tags, tags-manage, nhentai

## content-search.js — Поиск контента

### Функции
- `getActiveSites()` — выбранные сайты для поиска
- `doSearch(query)` — основной поиск
- `fetchPage(rawQuery, sites, pageNum, keepLoading, showLoading)` — страница результатов
- `renderPage()` — отрисовка результатов
- `renderPageNumbers(totalPages)` — пагинация
- `goToPage(page)` — переход на страницу
- `cardHTML(r)` — HTML карточки результата
- `showLightbox(index)` — просмотр в лайтбоксе
- `buildMangaViewer(file, media, lb)` — просмотрщик манги
- `updateNhCategories(lb, tbc)` — категории NHentai

### Поддерживаемые сайты
- Rule34 (R34)
- Danbooru (Dan)
- NHentai (NH)
- E-Hentai (EH)

### Возможности
- Цветные категории тегов (`tags_by_category`)
- AI фильтр (только для R34)
- Скачивание с индексацией тегов
- Асинхронное скачивание (SSE прогресс)
- Массовое скачивание

## comics-tags.js — Drag-n-drop теги

- `comicsTagsRender(body)` — рендер страницы тегов комиксов
- `comicsTagsDestroy()` — очистка
- `_buildHTML()` — построение HTML
- `_attachEvents(body, signal)` — события (drag-n-drop)
- `_renderLeftTags()` — теги слева
- `_assignTagToComic(comicId, tag, source)` — назначение тега
- `_startCmScan()` / `_startCmScanProgressPoll()` — сканирование комиксов

## comics.js — CRUD комиксов (CM)

- `comicsRender(body)` — рендер
- `comicsDestroy()` — очистка
- `_buildHTML()` / `_attachEvents()` — HTML + события
- `addComic()` / `editComic(id)` / `deleteComic(id)` — CRUD
- `reloadComics()` — перезагрузка списка
- `initModalEvents()` — события модалок
- Поддерживаемые форматы: CBZ, CBR, PDF, директории с изображениями

## tags.js — Массовое тегирование

- Тегирование файлов по категориям
- Drag-n-drop тегов
- Поиск по тегам
- Цветовые категории (Danbooru-style)

## nhentai_search.js — Поиск NHentai

- Поиск по названию/тегам
- Просмотр галерей
- Скачивание всей манги (все страницы)
- Индексация тегов в БД

## tags-manage/ — Управление тегами

- Тегирование отдельных файлов
- Добавление/удаление тегов
- Просмотр всех тегов файла
- Категоризация тегов

## ТЕХДОЛГ И УЛУЧШЕНИЯ (для AI-ревью)

### CM SPA — узкие места

1. **SPA роутер примитивный**: `main.js` просто подменяет innerHTML секций — нет истории, нет URL-роутинга, нет guard-ов
   - Нет deep linking: `/content-mgmt/search?q=tag1` не работает
   - Нет lazy loading — все модули грузятся сразу

2. **`content-search.js` — перегружен (~700 строк)**
   - Рендер, API, лайтбокс, пагинация — всё в одном файле
   - Логика для 4 сайтов (R34/Dan/NH/EH) перемешана
   - `buildMangaViewer()` — огромная функция с вложенными замыканиями

3. **Дублирование `comics.js`**: CM-версия и shared-версия — разный код, разный UX
   - При добавлении фичи чинить надо в двух местах

4. **Нет стейт-менеджмента**: состояние живёт в DOM и глобальных переменных
   - `_comics`, `_currentPage`, `_searchResults` — размазаны по модулям
   - При перерендере теряются ссылки на обработчики

5. **Нет TypeScript/типов**: структуры данных (result, comic, tag) никак не описаны
   - API ответы от Python приходят как plain objects — нет валидации

6. **Нет тестов**: ни одного unit-теста на CM модули

### Что улучшить

| Задача | Сложность | Эффект |
|--------|-----------|--------|
| Разбить `content-search.js` на модули (search, render, lightbox) | Средняя | Читаемость, можно тестировать по частям |
| URL-роутинг с query params | Средняя | Deep linking, возможность шарить ссылки |
 |Объединить `comics.js` (shared + CM) | Средняя | Убрать дублирование, единый UX |
| Добавить Store (Zustand или простой EventBus) | Средняя | Согласованное состояние |
| Добавить TypeScript в JSDoc аннотациях | Низкая | Автокомплит, валидация IDE |

### Что НЕ трогать
- SPA модель: страница одна, секции переключаются — это нормально для админки
- Content Search API (`/api/content-mgmt/search`) — менять только с обратной совместимостью
- Drag-n-drop теги (`comics-tags.js`) — работает стабильно, туда лезть только при багах
