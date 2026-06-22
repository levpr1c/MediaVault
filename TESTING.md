# MediaVault — Полный чеклист тестирования

> Сводный файл всех тестов для ручной/автоматической проверки MediaVault.
> Sources: `test-plan.md`, `docs/new-features-summary.md`, `roadmap/roadmap.md`

## Условные обозначения
- `[ ]` — manual test (unchecked)
- `[x]` — manual test (passed)


## 1. Автоматические тесты (test.py)

- [x] `venv/bin/python test.py` — полный прогон: py + js + locale + dead + func
- [x] `--check py` — Python syntax (2 файла)
- [x] `--check js` — JS syntax (33 модуля)
- [x] `--check css` — CSS непустые (8 файлов)
- [x] `--check locale` — i18n parity en↔ru, JS sync, дубликаты
- [x] `--check dead` — мёртвый код (AST Python + regex JS)
- [x] `--check func` — хелперы (_has_non_meta_tags и др.)
- [x] `--check smoke` — Flask старт + /login 200 + /api/gallery 401
- [x] 42 теста passed
- [x] 6 pre-existing failures (не связаны с сессией)

## 2. Авторизация и доступ

- [x] `/login` — форма входа отображается
- [x] Login с валидными кредами → редирект
- [x] Login с невалидными → ошибка
- [x] Logout
- [x] Доступ без авторизации → 401/редирект
- [x] `/admin` недоступен без admin-роли
- [x] `/content-mgmt/*` недоступен без auth
- [ ] 403 JSON при отсутствии admin-роли
- [ ] 401 JSON при отсутствии auth
вот эти пункты проверь сам плиз

## 3. Gallery (MV)

- [x] `/mediavault/gallery` — загружается
- [x] Файлы отображаются в сетке
- [x] Фильтр по типу (images/video/audio/other) — работает
- [x] Сортировка (по имени/дате/размеру)
- [x] Переключение layout (grid/list/compact)
- [x] Folder filter: переключение All/Gallery/Comics/DL
- [ ] Folder filter: сохраняется в localStorage (mediavault_folder_filter)
- [ ] Folder filter: применяется при загрузке галереи
- [ ] Пагинация (page_size из localStorage)
- [x] Поиск по тегам
- [ ] gallery.html — нет inline `style=""` на sidebar элементах я не ебу что это
- [x] view.html — нет emoji, все иконки SVG
http://127.0.0.1:5050/mediavault/gallery?pics=30  мобильный грди сломан. он масонори да, но падинг между карточками огронмый. там на 1-2 фокти ещё место есть

я логинился за user и понял, что надо добавить на главную страниуц 3 карточку - 
CONTENT MANAGEMENT, но с 2 кнопками. searcch + auto tagfetch. для user поменять хеддер для pc и мобыли. (для admin расширенный)  
## 4. Lightbox 

- [x] Клик по файлу → lightbox открывается
- [x] Теги отображаются
- [ ] Навигация prev/next (клавиши + кнопки) вот ты замени зоны переключения в лайтбоксе на стелочки, в view mode оставь зоны.
- [x] Close (кнопка + Escape)
- [ ] Close без предшествующего open() — не падает (guard в Lightbox.close() на null) это как...
- [x] Видео-файлы корректно отображаются
- [ ] При навигации теги обновляются 
- [x] "Open source" button: для NHentai → nhentai.net/g/{id}/
- [x] "Open source" button: для Danbooru → danbooru.donmai.us/posts/{id}
- [x] "Open source" button: для Rule34 → rule34.xxx/index.php?page=post&s=view&id={id}
- [x] "Open source" button: для MV gallery → fallback на standalone view
- [x] Download label: content-search shows "Download from {site}"
- [x] Download label: MV gallery shows `⬇` without label
- [x] Download label: LabelFn works as option in Lightbox constructor

## 5. Tagfetch (CM)

### 5.1 Tags Manual

- [x] `/content-mgmt/tags-manual` — загружается
- [x] Поиск по имени файла
- [ ] Drag-to-tag работает на тегс манула нету дрга дропа
- [x] Source присваивается правильно (site name / auto / manual)
- [ ] Layout — `.tf-layout` использует `display:flex` (aside + main) хз мб

### 5.2 Tags Auto

- [x] `/content-mgmt/tags-auto` — загружается
- [x] Сканирование файлов
- [ ] Drag-to-tag работает нету буквально как на тегс манула, этого не должно быть
- [x] Прогресс отображается
- [ ] AI Filter (исключение AI-generated) не надо просто

## 6. Content Management (CM)

### 6.1 Content Search

- [ ] Поиск по query
- [x] Результаты от Rule34, Danbooru, NHentai (в зависимости от site selection)
- [x] Скелетоны при загрузке
- [ ] Error state: сообщение при ошибке API (res.ok проверка) это чё
- [ ] Пустой поиск — соответствующее сообщение при нажати на search в хедере не работает переход на поиск, а блять работает, только на images + comics, я то думал там будет чисто одна кнопка. ты добавь перевод кнопко на русский язык, если нету.
- [ ] Спецсимволы в поиске (Unicode, HTML entities) это чо
- [x] Content-search использует CM header (условие: request.path == '/content-search')
- [x] Lightbox try-catch: new Lightbox() обёрнут — ошибка не блокирует поиск
- [x] Shared.applyI18n() guard — не падает если Shared не определён
- [ ] `tags_by_category` в API response для Danbooru результатов
- [x] Lightbox показывает color-coded tags (Artist=red, Character=green, Copyright=blue, General=grey, Meta=dark grey)
- [x] Danbooru результаты имеют artist/character/copyright/general/meta категории
- [x] Rule34 результаты — uncategorized (без категорий)
- [x] AI filter checkbox виден
- [x] AI filter checked → Rule34 исключает AI-контент (-ai_generated -ai -ai_assisted)
- [x] AI filter unchecked → все Rule34 результаты
- [x] AI filter: Danbooru/NHentai не меняются при включении
- [x] NHentai галерея открывается в lightbox с 2-page spreads
- [x] Навигация стрелками (spreads) и PgUp/PgDn
- [x] Lazy load — подгрузка страниц при достижении конца
- [x] Счётчик страниц корректный ("1-2 / 200")

### 6.2 NHentai Search

- [x] `/nhentai-search` — загружается
- [x] Ввести "touhou" → результаты в сетке (карточки)
- [ ] Спиннер появляется и исчезает это что
- [x] Клик по карточке → detail view:
  - [x] Обложка
  - [x] Теги с цветовыми категориями (tag/artist/parody/character/language/category/group)
  - [x] Stats (ID, pages, tag count)
- [ ] Drag-to-tag работает
- [x] Add all tags работает
- [x] Error state: при ошибке API показывается сообщение
дизайн бы обновить под вид MV GALLERY и перенести кнопки в выпадающие меню для мобилы. убрать текст "поиск контента" и его svg icon + вернуть навщение cm в хедер

### 6.3 Manga Download (NHentai)

- [x] Клик "Download All" на деталях галереи → task_id
- [x] Toast "Download started"
- [x] Task running: toast с прогрессом N/M каждые 2с
- [x] Task completed: toast с количеством файлов
- [x] Ссылка "View comics" в toast
- [x] Навигация на другую страницу — загрузка продолжается (background task)
- [x] Overwrite confirm: если папка существует → confirm() диалог
- [x] Overwrite: "Download again?" → подтверждение → файлы заменяются
- [x] Single file download работает (download-async)
- [ ] Errors: toast при ошибке
- [ ] Создаётся `Downloads/nhentai/<gid>/` директория
- [ ] Скачиваются все страницы 1.jpg..N.jpg
- [ ] Каждая страница индексирована в БД с тегами галереи
- [ ] Уже загруженные страницы пропускаются (нет дубликатов)
- [ ] Ошибки на отдельных страницах не останавливают пакет
- [ ] Concurrent download: 4 параллельных потока (ThreadPoolExecutor)
- [ ] NHentai v2 API: правильные расширения (jpg/png/webp)
- [ ] Загруженные файлы сразу появляются в MV gallery с тегами
- [ ] Danbooru категории сохранены в tag_category_members
- [ ] Aspect ratio теги вычислены корректно

### 6.4 Manga Viewer

- [ ] Открыть комикс в scroll/webtoon режиме
- [ ] Счётчик страниц обновляется при скролле (реальный скролл)
- [ ] Счётчик не дёргается при программном скролле (_programmaticScroll guard)
- [ ] Навигация по превью работает
- [ ] Spread mode (2 страницы на экран, display:flex + object-fit:contain)
- [ ] Без скролла: height: calc(100vh - 44px), overflow: hidden
- [ ] F — переключение spread ↔ lightbox, корректный возврат
- [ ] ← → и PgUp/PgDn работают в обоих режимах
- [ ] Счётчик: "1-2 / 200" для spread, "1 / 200" для lightbox
- [ ] Последняя страница (нечётная) отображается одна
- [ ] Работает на мобильных (2 страницы, масштабируются)

### 6.5 Comics Picker

- [ ] `/content-mgmt/comics-picker` — загружается
- [ ] Модальное окно 2100px с preview
- [ ] Flexbox wrap grid (left→right), 6 columns
- [ ] Поиск по комиксам
- [ ] Выбор комикса
- [ ] Preview панель анимируется плавно (cubic-bezier transition)
- [ ] На мобильных — 3 колонки, модал не шире 95vw
- [ ] `.comic-modal-body` — нет огромных отступов (min-height: 0)

### 6.6 Comics Tags

- [ ] `/content-mgmt/comics-tags` — загружается
- [ ] Секция определяется по URL в main.js
- [ ] Левая панель показывает категории тегов (.cm-files-left-section структура)
- [ ] Теги можно перетаскивать на карточки комиксов
- [ ] Drag-to-tag работает

### 6.7 Content-Search Download Saves Tags

- [ ] File downloaded appears in MV gallery immediately
- [ ] Tags from content-search are saved to file
- [ ] Danbooru categories are stored in DB
- [ ] Duplicate download updates existing record
- [ ] Aspect ratio auto-computed from downloaded file dimensions

## 7. Franchise Search

- [ ] `/franchise-search` — загружается
- [ ] Результаты от Rule34, Danbooru, NHentai
- [ ] Preview images загружаются (fallback если preview_url пуст)
- [ ] Debug info (backend + URL для каждого результата)
- [ ] onerror: если картинка не грузится, подставляется file_url/sample_url
- [ ] Пустой поиск — соответствующее сообщение

## 8. Kemono/Coomer Import

- [ ] `/kemono-import` — загружается
- [ ] Нет ложной ошибки "gallery-dl not installed"
- [ ] Ввести валидный URL (kemono.su/... или coomer.su/...)
- [ ] Get Info — возвращает метаданные
- [ ] Download — скачивает файлы
- [ ] Debug info в консоли браузера
- [ ] Пустой/невалидный URL — ошибка
- [ ] Новые домены (.cr, .cv, .party, .so, .us, .co) парсятся
- [ ] Старые .su домены продолжают работать
- [ ] GET /api/kemono/mirrors → {"mirrors": ["kemono.su", "kemono.cr", ...]} (14 entries)
- [ ] POST /api/kemono/download → файлы скачиваются в Downloads/kemono/

## 9. Admin Panel

- [ ] `/admin` — загружается
- [ ] 5 иконок в хедере (Users, Database, API Keys, Folders, Backends)
- [ ] Users: добавление/удаление/смена роли/пароля
- [ ] Database: Export/Import/Clear
- [ ] Database секция: Folders card (media_dir, gallery_dir, comics_dir)
- [ ] Scan button работает
- [ ] Blinking dot (mount indicator) в хедере (рядом с названием страницы)
- [ ] Blinking dot: зелёный — storage mounted, красный — not mounted
- [ ] Folders card: нет дублированного mount indicator (#admMountStatus удалён)
- [ ] API Keys секция (ключи + credential backend) — media_dir вынесен
- [ ] Backends секция: выбор бэкенда per-site (+ иконки)
- [ ] Save в любой секции → toast с подтверждением
- [ ] Обновление страницы — секция не теряется (router)
- [ ] Клик по Folders → gallery_dir и comics_dir отображаются
- [ ] Клик по Backends → список сайтов с выбором бэкенда
- [ ] Media dir: Browse + Scan работают

## 10. Settings

- [ ] `/settings` — загружается
- [ ] Appearance tab: theme toggle (light/dark)
- [ ] Appearance tab: language toggle (EN/RU) — без перезагрузки
- [ ] Appearance tab: Browser Cache (default/reduced/nocache) — 3 опции
- [ ] Appearance tab: Folder Filter checkboxes (Gallery/Comics/DL)
- [ ] Folder filter: сохраняется в localStorage
- [ ] Database tab: Backend Selection (rule34/danbooru/nhentai/kemono/coomer dropdowns)
- [ ] Database tab: Clear browser cache
- [ ] Database tab: VACUUM
- [ ] Account tab: change password
- [ ] Account tab: Admin CRUD (add/delete user, change role)
- [ ] После Save — значения сохраняются
- [ ] Mount indicator (#mountStatus) в хедере карточки Media Path (слева от заголовка)
- [ ] `default` → Cache-Control: public, max-age=86400, immutable
- [ ] `nocache` → Cache-Control: no-cache
- [ ] `reduced` → Cache-Control: public, max-age=3600
- [ ] POST /api/clear_browser_cache → cache_buster инкрементируется
- [ ] Файлы перезагружаются с &cb=N после очистки кэша
- [ ] GET /api/content-search/mount-check возвращает корректный статус

## 11. i18n / L10n

- [ ] EN: все строки на английском
- [ ] RU: все строки на русском
- [ ] Нет missing keys (`undefined` в UI)
- [ ] Переключение EN↔RU без перезагрузки (Shared.toggleLang)

## 12. Header & Navigation

- [ ] Desktop: левая иконка → дропдаун с 4 группами (TAGFETCH | TAGS | COMICS | SEARCH)
- [ ] CM header имеет 4 раскрывающиеся группы (expandable dropdowns)
- [ ] Клик по TAGS открывает тэг-пад, закрывает другие dropdowns
- [ ] Header: SEARCH кнопка (CM)
- [ ] Content-search показывает CM header
- [ ] Mobile: бургер-меню, drawer с навигационными группами
- [ ] COMICS dropdown: только Editor, Comics Tags (без NHentai, без Franchise)
- [ ] Desktop-only элементы не видны на mobile
- [ ] Mobile не получает HTML для sidebar/search panel/toolbar

## 13. Админка CRUD

- [ ] Добавить пользователя
- [ ] Удалить пользователя
- [ ] Сменить пароль
- [ ] Сменить роль (admin/user)

## 14. Home Page

- [ ] CM card показывает 4 колонки (TAGFETCH | TAGS | COMICS | SEARCH)
- [ ] Каждая колонка имеет заголовок + кнопки
- [ ] Кнопка Comic Tags → `/content-mgmt/comics-tags`
- [ ] NHentai кнопка → `/content-search?site=nhentai`
- [ ] Home page card sizes сбалансированы на 1920×1080 (MV flex:1, CM flex:1.5 max-width:520px, Admin flex:1.2 max-width:440px)
- [ ] На 960px CM grid переходит в 2 колонки
- [ ] На 768px все карточки stack
- [ ] На 650px CM grid 1 колонка
- [ ] Account button SVG корректного размера (padding 8px, 36×36 SVG)
- [ ] Есть кнопка «Comics Fetch» (только для admin)

## 15. Производительность

- [ ] NHentai search: < 5s
- [ ] Franchise search (3 сайта параллельно): < 10s
- [ ] Gallery-dl fetch: < 3s на запрос
- [ ] Cache-Control: правильные заголовки на /api/media и /api/thumbnail
- [ ] Browser cache: no-cache режим работает
- [ ] Cache: `reduced` режим работает
- [ ] Background scan не блокирует UI
- [ ] Manga скачивание: 4 параллельных потока (ThreadPoolExecutor)
- [ ] Background task survives page navigation

## 16. Крайние случаи / Edge Cases

- [ ] Пустой поиск (NHentai, Franchise)
- [ ] Спецсимволы в поиске (Unicode, HTML entities)
- [ ] Невалидный URL (Kemono Import)
- [ ] Файл без тегов (пустой результат)
- [ ] MD5 не найден нигде (404/empty)
- [ ] Сетевые ошибки (timeout, 403, 500)
- [ ] Светбокс до open() — не падает (TypeError guard в Lightbox.close())
- [ ] Дубликат тегов при повторном фетче
- [ ] ES-модуль: ошибка в одном не блокирует другие (try-catch вокруг new Lightbox)
- [ ] Multiple tabs: concurrent scan
- [ ] Close lightbox before video loaded
- [ ] Folder filter с пустым localStorage
- [ ] Перезагрузка страницы во время download-задачи
- [ ] Открытие comics без страниц (пустой комикс)
- [ ] Сломанный ответ API — не вызывает исключение (res.ok проверка)
- [ ] CommsPicker на мобильных — модал не шире 95vw
- [ ] Scroll в ридере — счётчик не дёргается при программном скролле
- [ ] Реальный скролл — счётчик обновляется

## 17. Gallery-dl Backend

- [ ] `GalleryDlBackend().is_available()` — true если gallery-dl в PATH
- [ ] `GalleryDlBackend().get_info(url)` — возвращает metadata
- [ ] `GalleryDlBackend().download(url, dest)` — скачивает файлы
- [ ] `ApiRawBackend().search('nhentai', query, 1, settings)` — NHentai через прямой API
- [ ] `BACKENDS` registry: per-site выбор (api_raw или gallery_dl)
- [ ] `fetch_tags('rule34', md5, settings)` — возвращает теги
- [ ] `fetch_tags('danbooru', md5, settings)` — возвращает теги
- [ ] `fetch_tags('nhentai', md5, settings)` — возвращает теги
- [ ] `search_tags('danbooru', 'fumimi', 1, settings)` — возвращает результаты
- [ ] `search_tags('nhentai', 'test', 1, settings)` — NHentai поиск работает
- [ ] Rule34 search возвращает корректный total count (XML API)
- [ ] Danbooru search возвращает корректный total count (anonymous, /counts/posts.json)
- [ ] NHentai search работает с API v2 (/api/v2/search + /api/v2/galleries/{id})
- [ ] NHentai gallery fetch возвращает все страницы и categorized tags
- [ ] Тег с source='auto' при повторном фетче получает source='danbooru' или 'rule34' (UPSERT)
- [ ] Категория тега обновляется при конфликте (UPSERT)
- [ ] При рекатегоризации (manual) source не затирается

### Feature 6 (roadmap) — Gallery-dl как универсальная альтернатива

- [ ] 6.1 GalleryDlBackend.fetch() для Rule34 (через gallery-dl Python API)
- [ ] 6.2 GalleryDlBackend.fetch() для Danbooru (через gallery-dl Python API)
- [ ] 6.3 GalleryDlBackend.search() для NHentai (через gallery-dl Python API)
- [ ] 6.4 GalleryDlBackend.search() для Rule34 (через gallery-dl Python API)
- [ ] 6.5 GalleryDlBackend.search() для Danbooru (через gallery-dl Python API)
- [ ] 6.6 Регистрация в BACKENDS registry + UI (2 варианта per-site: raw_api или gallery_dl)
- [ ] 6.7 Сравнить результаты fetch/search с raw API

## 18. Регрессия — старые фичи

- [ ] Счётчик комиксов на странице комиксов
- [ ] Picker модальное окно не шире 95vw на мобильных
- [ ] Scroll в ридере — реальный скролл обновляет счётчик
- [ ] `_()` module-level работает в API роутах
- [ ] WAL mode: PRAGMA journal_mode=WAL на каждом соединении
- [ ] Нет DROP TABLE — используется DELETE FROM
- [ ] Vacuum через PRAGMA wal_checkpoint(TRUNCATE)
- [ ] `_quick_scan` thread-safe через _scan_lock(blocking=False)
- [ ] CSS loading order: shared → (content/admin/etc) → mediavault
- [ ] Desktop header .hdr-desktop, mobile .hdr-mobile (CSS media 768px)
- [ ] Нет window.innerWidth в JS
- [ ] Нигде нет `style="display:none"` (используется класс `.hidden`)
- [ ] JS не использует `element.style.display = 'none/block'`
- [ ] Нет inline styles в gallery.html (все через CSS классы)
- [ ] Нет emoji в view.html (все иконки SVG)
- [ ] При загрузке раздела Files счётчик пагинации показывает 1 (сброс _currentPage)
- [ ] Переключение между секциями не ломает счётчик
- [ ] Мёртвый код NokufindBackend/cloudscraper удалён (grep пуст в src/)
