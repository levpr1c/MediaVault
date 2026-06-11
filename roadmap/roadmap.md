---
feature: "MediaVault v1.0"
spec: |
  Improve MediaVault: debug logging, meta-tag filtering fix, vertical settings, batch scan fix, PyInstaller binary, mobile responsive, Material 3 Expressive redesign (vanilla JS first, Vue 3 later).
---

## Task List

### Feature 1: Debug logging
Description: Добавить подробные логи в debug mode для событий: single fetch, batch fetch, fetch all, fetch tags, delete cache. Использовать для диагностики batch scan.
- [x] 1.01 Добавить систему уровней логирования (debug/info/error) в web_app.py, привязанную к --debug флагу (note: Implementing logging system in web_app.py) (note: Added logging system: log_debug/log_info/log_error, _enable_debug_logging(), tied to --debug flag)
- [x] 1.02 Добавить логи в single fetch, batch fetch, fetch all, fetch tags, delete cache, save, scan (note: Added detailed debug logs to: single fetch, batch fetch, fetch all, fetch tags, delete cache, save file, save all, batch scan, deduplicate, clear thumb cache, batch status)

### Feature 2: Meta-tag filtering fix + persistent found
Description: Авто-теги не должны влиять на фильтрацию. Persistent `found` статус через `scan_results` таблицу.
- [x] 2.01 Изучить код: где определяется статус файла (no_tags/db/found) на сервере и клиенте
- [x] 2.02 Добавить persistent found: scan_results таблица, _mark_tags_found, _has_tags_found, обновить batch_status и batch scan

### Feature 3: Batch scan fix
Description: Починить batch scan — сейчас не показывает все файлы к которым нашлись теги. Диагностика через debug логи.
- [x] 3.01 Диагностика: запустить batch scan с debug логами, проанализировать проблему (note: Diagnosed via debug logs: batch scan found tags but never saved to files table, plus TypeError in logging format)
- [x] 3.02 Batch scan now saves all files to files table (auto-tags + API tags), added _ensure_db_schema, _get_auto_tags, fixed TypeError in logging (note: Rewrote batch scan generate(): save every file to files table, merge auto-tags + API tags, extract dimensions. Also added _get_auto_tags() helper and _ensure_db_schema())

### Feature 4: Settings redesign + clear data buttons
Description: Вертикальные настройки + кнопки очистки кеша/БД/всего.
- [x] 4.01 Разработать дизайн вертикальных настроек (группы полей, разделы) (note: Designed vertical card-based layout for settings: each section as a card with header + body. Theme toggle buttons instead of select. Clean data grid (2-column).)
- [x] 4.02 Реализовать новый шаблон настроек в HTML/CSS/JS (note: Implemented new settings HTML (cards, theme toggle, field groups), CSS (tagfetch.css .settings-* rules), JS (setTheme function, i18n keys).)
- [x] 4.03 Добавить кнопки очистки: кеш тегов, кеш превью, БД, всё сразу (API + HTML + JS + i18n)

### Feature 5: Binary build v1.0
Description: Собрать проект в бинарник через PyInstaller. Linux v1.0, потом Windows.
- [-] 5.01 Настроить PyInstaller spec, протестировать сборку (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [x] 5.02 Перенести хранение данных в ~/.local/share/MediaVault и ~/.config/MediaVault (note: settings → ~/.config/MediaVault/settings.json; default DB → ~/.local/share/MediaVault/MediaVaultDataBase.db; thumbnails as BLOB in thumbnail_cache table; removed .api_cache.json/.md5_cache.json)
- [-] 5.03 Проверить бинарник на чистой машине (note: Cancelled — текущий приоритет: восстановление SPA страниц)

### Feature 6: Mobile responsive
Description: Адаптировать интерфейс под телефоны, чтобы можно было открыть сайт с телефона.
- [x] 6.01 Добавить media queries для мобильных устройств (note: Добавлены media queries во все 3 CSS: shared.css (header, home, touch-action), tagfetch.css (sidebar, preview-row, panels, batch-grid, settings), mediavault.css (sidebar overlay, toolbar, gallery columns, lightbox fullscreen))
- [x] 6.02 Адаптировать галерею и лайтбокс под тач-взаимодействие (note: Добавлен touch swipe для навигации по lightbox (←/→), hover preview отключён на touch-устройствах через @media(hover:none), добавлено touch-action:manipulation для кнопок)

### Feature 7: Auto-discovery of media files
Description: Файлы появляются в MediaVault автоматически, без запуска Tagfetch batch scan. Quick scan (только auto-tags, без API).
- [x] 7.01 Добавить POST /api/scan_folder — walks media_dir, assigns auto-tags (photo/video/gif/sound), saves to files table (note: Added api_scan_folder endpoint in web_app.py)
- [x] 7.02 Auto-scan on empty gallery: when MediaVault loads and gallery is empty, trigger POST /api/scan_folder (note: Modified loadGallery() in gallery.js to auto-scan when _galleryData.length === 0 && media_dir_set)
- [x] 7.03 Scan Folder button in MediaVault sidebar (note: Added #scanFolderBtn button and scanFolder() function in gallery.js)
- [x] 7.04 scan_needed flag on settings save when media_dir changes (note: POST /api/settings returns scan_needed: true, ready for client handling)
- [x] 7.05 Оптимизация _quick_scan(): file-count check, background thread, single transaction, skip hidden dirs, no Pillow (width/height=0 lazy). Clear All Data triggers rescan.

### Feature 8: Material 3 Expressive redesign
Description: Переделать дизайн в Material 3 Expressive стиле: новые цвета, шрифты, анимации, компоненты.
- [-] 8.01 Разработать M3 дизайн-токены (цвета, тени, радиусы, типографика) (note: Starting M3 design tokens: colors, typography, shadows, radii. Using frontend-design skill) (note: Cancelled - user explicitly said not to work on old roadmap items) (note: Cancelled per user request — будет потом, не сейчас)
- [-] 8.02 Применить M3 стили ко всем компонентам (note: Cancelled per user request)
- [-] 8.03 Добавить spring-based анимации (преходы, hover, press) (note: Cancelled per user request)

### Feature 9: Filter fix + Popular Tags page
Description: Фильтры Tagfetch Manual + Popular Tags страница и контекстные популярные теги
- [x] 9.01 Fix filters: auto-tags не считаются реальными тегами; no_tags → проверка на сайтах; found/not_found persistent; skip not_found при автоскане (note: Starting filter fix implementation) (note: Implemented: not_found persistent status, aspect ratio auto-tags, filter fix, batch scan skip not_found. Restarting server to test.)
- [x] 9.02 Отдельная страница /popular-tags со всеми популярными тегами (note: Implemented: /popular-tags route, view, API (GET global + POST contextual), sidebar link, header link, i18n keys)
- [x] 9.03 Популярные теги в сайдбаре MediaVault — контекстные (только для текущей страницы/лимита) (note: Gallery sidebar now uses renderContextualPopularTags with getVisibleData() — counts for current page only)

### Feature 10: Batch scan rewrite + sidebar categories
Description: Переписать batch scan на базе fetch_all механизма (per-file fetch + save, SSE прогресс). Добавить показ тегов по категориям в сайдбаре MediaVault (до 25 тегов на категорию).
- [x] 10.01 Audit batch scan: понять логику, отличия от fetch_all, что нужно взять из fetch_all (note: Audit done: batch scan was saving to files table during scan (like fetch_all + save combined). Rewrote to separate fetch-only phase, save via Save All button. Fixed api_clear_tag_cache to also clear batch_scan table (was causing all files to skip with 'already_scanned' after cache clear).)
- [x] 10.02 Rewrite batch scan: скопировать механизм fetch_all (fetch + save per file), добавить пропуски по already_scanned/not_found, SSE прогресс по каждому файлу (note: Rewrote api_batch_scan generate(): removed files table save during scan (fetch-only now). Kept categorization, batch_scan tracking, found/not_found marking. Save happens via Save All → api_save_file with source='both'. Fixed api_clear_tag_cache to also drop batch_scan table.)
- [x] 10.03 Протестировать batch scan: fetch per file, save, прогресс, категоризация, пропуски (note: Tested batch scan: single file with no tags → status=no_tags, no DB save. Single file with tags → skip=has_tags. clear_tag_cache now also clears batch_scan table (verified with curl).)
- [x] 10.04 Показывать теги в сайдбаре MediaVault по категориям (группы Danbooru), макс 25 тегов на категорию (note: Added renderCategorizedTags() in tags.js, calls on filter/page change, i18n key mvCategorized, #categorizedTags section in template. Groups: artist/character/copyright/meta/general, max 25 each, sorted by count desc.)
- [x] 10.05 Протестировать сайдбар: категории, лимит 25, цвета групп (note: Tested and confirmed working. Categories display with correct Danbooru colors, 25 cap respected, dark theme compatible.)
- [x] 10.06 Fix `if not data` bug: empty dict `{}` is falsy in Python → causes 400 on batch scan and settings endpoints when client sends `{}` (note: Changed `if not data:` → `if data is None:` across all 7 endpoints: api_batch_scan, api_settings, api_categories, api_save_file, api_add_category, api_delete_category, api_add/remove_category_member)
- [x] 10.07 Add live progress counter to batch scan UI (note: batch.js now updates stats on every SSE event: `X/Y scanned, N found, M skipped` instead of only showing at the end)

### Feature 11: Мобильный lightbox + тап-навигация
Description: Фото на весь экран, теги под фото (скролл). Тап по левой/правой части для листания.
- [x] 11.01 Standalone photo page: фото + теги скроллом, тап-зоны навигации, тёмная тема, категории тегов, порядок навигации из галереи, счётчик позиции, SVG-иконки, компактный топбар, нав-зоны 12% (note: Fully implemented: |safe for tags, compact topbar 40px with 28×28 buttons, inline SVG back arrow, nav zones 12%/bottom:80px so video controls not blocked, emoji → inline SVG icons in toolbar)
- [-] 11.02 SPA lightbox на мобильных: теги под фото, тап-навигация (note: Cancelled per user request — отложено)

### Feature 12: Комикс/манга режим
Description: Сборник картинок как история — лента изображений во всю ширину
- [x] 12.01 Новый layout mode 'comic' в галерее — изображения одно под другим (note: Implemented: DB tables comics/comic_pages, api/comics/* endpoints, comics list page with grid, add modal with file browser, scroll+lightbox viewer, F key toggle, card hover delete)
- [x] 12.02 Серверный эндпоинт для sequential view с навигацией (note: /comics/view route serves sequential viewer with prev/next nav zones, scroll/lightbox mode toggle, page counter)
- [x] 12.03 Comics link в сайдбаре MediaVault + gallery thumbnail picker в модале добавления (note: Added Comics button with book SVG in mvSidebar sidebar. Replaced text-based file browser with search + thumbnail grid picker using /api/gallery and /api/thumbnail, multi-select with checkmarks) (note: Comics link in mvSidebar sidebar + gallery thumbnail picker in add modal)

### Feature 13: Админ-панель + система логина
Description: Авторизация по паролю для доступа к приложению
- [x] 13.01 Добавить таблицу users, хеширование пароля, endpoint /api/login (note: Implemented: users table, /api/login, /api/set_password, _ensure_admin_user())
- [x] 13.02 Flask middleware: проверка сессии на всех роутах (кроме login) (note: @app.before_request middleware with public path whitelist, _auth_required() helper, redirect to /login)
- [x] 13.03 UI: страница логина, logout, админ-панель (note: login.html, settings UI (password/credential backend/users), settings.js new functions, +40 i18n keys) (note: Добавлен: аккаунт-кнопка на главной (иконка + hover выезд имени + дропдаун с logout), /api/reset_credential_cache, i18n ключи, кнопка сброса кеша в настройках)

### Feature 14: Анимация смены темы
Description: Кнопка перекручивает (spin) и возвращается в исходное положение
- [x] 14.01 Реализовать анимацию: кнопка-тумблер с прокрутом и возвратом (note: Improved btnSpin animation with cubic-bezier(.34,1.56,.64,1) spring effect, 0.5s duration, scale pulse to 1.2. Uses btn-spin class toggle + Spring-like overshoot.)

### Feature 15: Tagfetch subview routing
Description: Разделить Tagfetch на два под-роута: /tagfetch/manual и /tagfetch/auto. Табы — <a>-ссылки с Jinja2 active class вместо JS switchTab.
- [x] 15.01 Добавить роуты /tagfetch/manual и /tagfetch/auto с subview в web_app.py (note: 3 routes with subview param, default 'manual')
- [x] 15.02 Табы переделаны в <a href="..."> с Jinja2-классом .active по subview (note: Buttons → links, CSS updated with text-decoration:none)
- [x] 15.03 tagfetch.js упрощён до getCurrentTab(). init.js инициализирует Manual только при subview='manual' (note: Simplified tagfetch.js, init.js only calls TagfetchManual.init() on manual subview)
- [x] 15.04 Home page ссылки обновлены: /tagfetch#manual → /tagfetch/manual (note: Updated both home links)
- [x] 15.05 docs/code-guide.md — полное описание subview routing + диаграммы (note: Updated section 10 with subview explanation, Mermaid diagrams, code examples)
- [x] 15.06 docs/user-guide.md — полностью переписан, стал детальным (note: Rewritten user guide: 2.5× larger, full feature explanations, Q&A)
- [x] 15.07 README.md — обновлена структура, маршруты, line counts (note: Updated for new routing and file sizes)
- [x] 15.08 AGENTS.md — обновлена таблица роутов и JS модулей (note: Added new routes, simplified tagfetch module)
- [x] 15.09 Комментарии в коде обновлены (note: Comments updated in web_app.py, tagfetch.js, init.js, index.html)

### Feature 16: KDE Wallet credential storage
Description: Хранить API-ключи в KDE Wallet вместо settings.json. Переключатель в настройках.
- [-] 16.01 Исследовать kwallet (dbus) / kwalletcli / python-qtkeyring для интеграции с KDE Wallet (note: AVIF thumbnails implemented (Pillow AVIF for images, ffmpeg libsvtav1 for video); thumbnail constants renamed to LARGE (300px) / XL (600px); ratio logic simplified to single THUMB_RATIO_LIMIT (21/9); stale cache cleared on startup) (note: Reverted - AVIF thumbnail work is not KDE Wallet) (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [-] 16.02 Реализовать KDEWalletStore: get/set/delete/list, проверка доступности (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [-] 16.03 Добавить переключатель бэкенда в Settings UI (Plain JSON / KDE Wallet) (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [-] 16.04 Миграция ключей между бэкендами при переключении (note: Cancelled — текущий приоритет: восстановление SPA страниц)

### Feature 17: Thumbnail regeneration feedback
Description: Добавить визуальный прогресс и debug-логирование для фоновой перегенерации миниатюр.
- [-] 17.01 Добавить debug-логи каждого файла в _regen_all_thumbnails (log_debug path, status) (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [-] 17.02 Показывать живой прогресс (N/M) в UI после нажатия кнопки regenerate (note: Cancelled — текущий приоритет: восстановление SPA страниц)
- [-] 17.03 Кнопка Cancel для фоновой перегенерации (note: Cancelled — текущий приоритет: восстановление SPA страниц)

### Feature 18: API key save/load bugfix
Description: api_settings() saves global settings but keys stripped by save_settings(). Fix: settings = load_settings() instead of settings = s.
- [x] 18.01 Fix api_settings(): change settings = s to settings = load_settings() @ line 1825 (note: Fixed api_settings(): settings = load_settings() instead of settings = s)
- [x] 18.02 Verify R34/Danbooru fetch uses keys after fix (note: Verified — api_settings loads from load_settings() before returning)

### Feature 19: Admin: Clear Tags + Delete All buttons
Description: Clear Tags: drop tags, tag_category_members, clear caches. Delete All: clear everything except users + comics tables.
- [x] 19.01 Add POST /api/clear_tags endpoint (note: Added POST /api/clear_tags endpoint: drops tags, tag_category_members, scan_results, auto_scan tables + clears caches)
- [x] 19.02 Add POST /api/delete_all endpoint (note: Added POST /api/delete_all endpoint: clears everything except users, comics, comic_pages tables)
- [x] 19.03 Add admin.js buttons + i18n keys (note: Updated admin.js _dbAction() paths + i18n labels + confirm messages for clear_tags and delete_all)

### Feature 20: Content Files: masonry + lightbox + init preview
Description: Fix CSS masonry (column-width), lightbox overlay on click, lazy images not loading on render
- [x] 20.01 #cmFileMainGrid CSS: use column-width masonry (note: Changed .cm-files-grid from grid to column-width:150px masonry layout + break-inside:avoid on items + auto height thumbs)
- [x] 20.02 Add lightbox overlay to file click (note: Added lightbox overlay: fullscreen display with prev/next nav, close btn, keyboard arrows+escape, video support)
- [x] 20.03 Fix preview loading on initial render without search (note: Removed loading=lazy from thumb images so they load immediately on render)

### Feature 21: Sidebar removal + header navigation
Description: Remove sidebar from content + admin pages, nav via header buttons
- [x] 21.01 content.html: remove sidebar, add header nav (note: content.html: removed sidebar, header nav buttons with active state, hdr-nav added to desktop header)
- [x] 21.02 admin.html: remove sidebar, add header nav (note: admin.html: removed sidebar, header nav buttons with active state)
- [x] 21.03 CSS + JS updates for no-sidebar layout (note: CSS: removed sidebar rules, removed toggle/collapse from JS, active state via .mv-mh-icon.active, hdr-nav in desktop header. Fixed files grid (CSS grid), comics thumbs (object-fit:cover), double scroll, cpage items height) (note: Double scroll fixed: complete flex chain (#content → #contentView → .cm-main → #cmContentBody → .cm-files-layout), body overflow hidden. Single scrollbar per section.)

### Feature 22: Debug logging with colors
Description: Add ANSI colored debug output (green=found, red=not-found) + more events
- [x] 22.01 Add ANSI colors to log_debug in fetch functions (note: ANSI colored logging: green for FOUND/tags_found, red for NOT FOUND/tags_not_found in fetch_rule34, fetch_danbooru, _mark_tags_found, _mark_tags_not_found, api_fetch_file summary, auto_scan RESULT)
- [x] 22.02 Add more detailed events in auto_scan and manual fetch

### Feature 23: Refactoring — анализ дублирований
Description: Найти все дублирования HTML, JS, Python, CSS. Составить карту повторений.
- [x] 23.01 Проанализировать HTML-шаблоны: найти повторяющиеся блоки (формы, таблицы, модалки) (note: Запущен параллельный анализ HTML-шаблонов) (note: HTML: ~394 строк дублирования (комикс-модал ×3, темы ×4, пароли ×10, табы ×2, вьювер CSS ×2). Потенциал экономии ~246 строк через Jinja2-макросы.) (note: BUG FIX: @admin_required NameError — перенёс декораторы до роутов (line 1624). Также исправил Jinja2 `_ is undefined` в макросах — добавил `with context` во все импорты macros.html)
- [x] 23.02 Проанализировать JS: найти дублирующиеся функции и логику (note: Запущен параллельный анализ JS-файлов) (note: JS: ~4100 строк дублирования из ~6700 total. Критично: gallery (2 impl, ~920 LOC), lightbox (2 impl, ~850 LOC), comics (2 impl, ~966 LOC), settings vs admin (~530 LOC), toggleDateSort ×4 (~140 LOC).)
- [x] 23.03 Проанализировать Python: найти дублирующиеся эндпоинты и хелперы (note: Запущен параллельный анализ Python-кода) (note: Python: CRITICAL — log_warning undefined, нет role-based auth, 8 unprotected endpoints, 24× except pass, 37× одинаковый error handler. ~400-450 строк дублирования (media_dir ×11, scan_status ×6, JOIN ×5).)
- [x] 23.04 Проанализировать CSS: найти дублирующиеся/пересекающиеся стили (note: Запущен параллельный анализ CSS-стилей) (note: CSS: 22 проблемы (4 high: --radius не определён, .action-btn конфликт, z-index хаос, 5 видов модалов; 10 medium). ~180-250 строк из 1506 можно оптимизировать.)

### Feature 24: Refactoring — архитектура
Description: Спроектировать универсальные эндпоинты, переиспользуемые компоненты, систему проверки прав
- [x] 24.01 Спроектировать систему ролей и декораторы/middleware для проверки прав (note: AGENTS.md Refactoring Vision + REFACTORING.md)
- [x] 24.02 Спроектировать универсальные API-эндпоинты (get/upload/delete/update) (note: AGENTS.md Refactoring Vision + REFACTORING.md)
- [x] 24.03 Спроектировать переиспользуемые Jinja2-макросы (note: AGENTS.md Refactoring Vision + templates/macros.html)
- [x] 24.04 Спроектировать общие JS-модули (note: AGENTS.md Refactoring Vision + REFACTORING.md)

### Feature 25: Refactoring — бэкенд
Description: Универсальные функции, декораторы прав, единые форматы ответов
- [x] 25.01 Создать декоратор @admin_required / @auth_required (note: Реализованы в web_app.py line ~1624, добавлены на 25+ эндпоинтов)
- [x] 25.02 Объединить дублирующиеся эндпоинты в универсальные (note: 5 category endpoints → 2 (GET/POST /api/categories). Settings page удалена (3 routes → 0).)
- [x] 25.03 Добавить проверку роли во все изменяющие эндпоинты (note: POST /api/categories добавлен @admin_required. @admin_required/@auth_required на 27 эндпоинтах.)
- [x] 25.04 Унифицировать форматы ответов API (JSON) (note: @api_error_handler отложен — слишком много нюансов в 37+ эндпоинтах) (note: @api_error_handler декоратор реализован, применён ко всем 50 API endpoints. Упрощены auth_required/admin_required (import wraps вынесен наверх).) (note: @api_error_handler applied to all 50+ API endpoints, correct decorator order fixed (app.route → auth → handler))

### Feature 26: Refactoring — фронтенд
Description: Макросы Jinja2, общие JS-модули, единые стили
- [x] 26.01 Выделить повторяющиеся HTML-блоки в Jinja2-макросы (note: 6 макросов в templates/macros.html: password_field, theme_buttons, sort_btn, close_svg, loading_spinner, view_btn)
- [x] 26.02 Вынести общую JS-логику в shared-модули (note: content/*.js (4 файла, ~1400 строк) дублирует mediavault/*.js — предстоит унификация) (note: Унифицированы shared-утилиты: hexToRgba/parseTags вынесены в Shared (2 локальные копии удалены из mediavault/gallery/tags.js + gallery.js). content/utils.js — мост к shared-глобалам. mediavault/utils.js — делегаты к Shared. Все 4 content/*.js модуля получают те же функции через import. Итого устранено ~8 строк дублирования (парадигмально — unified single source of truth для hexToRgba/parseTags).) (note: hexToRgba/parseTags unified into Shared.* — 4 duplicated implementations consolidated. esc()/toast() also delegate to Shared.)
- [x] 26.03 Унифицировать CSS-классы, убрать дублирование (note: CSS vars (--radius, --font, 5 z-index, --overlay/--shadow). Settings CSS удалён.)

### Feature 27: Refactoring — разделение интерфейса
Description: User видит только просмотр, admin — всё в Content Management
- [x] 27.01 Убрать кнопки редактирования из MediaVault для user (note: gallery.html: admin-кнопки (manageCategories, bulkTag) обёрнуты в session.role check. view.html: createComicBtn — под admin. comics.html: addComicBtn — под admin, delete-кнопки — под admin, add-card скрыт. home.html: admin-блоки — под admin. tagfetch/manual.html: action-bar — под admin. tagfetch/auto.html: start/cancel/save кнопки — под admin.) (note: All templates wrapped admin controls in {% if session.role == 'admin' %}: gallery.html, view.html, comics.html, home.html, tagfetch/manual.html, tagfetch/auto.html)
- [x] 27.02 Добавить скрытие admin-элементов на фронтенде по роли (note: CSS-based скрытие не нужно — Jinja2 {% if %} выключает рендеринг HTML admin-элементов для user. Фронтенд не получает кнопок вовсе.) (note: Admin HTML not rendered for users (Jinja2 conditional blocks, not CSS hiding))
- [x] 27.03 Проверить, что все admin-маршруты недоступны user (note: Добавлен @admin_required на: /api/scan_folder, /api/clear_cache, /api/fetch_file, /api/save_all_fetched, /api/auto_scan, /api/clear_thumb_cache, /api/clear_database, /api/clear_all, /api/settings (GET), /content page route (role check). Итого 10 endpoints.) (note: All mutating endpoints protected by @admin_required backend decorator with 403 for non-admin)

### Feature 28: Refactoring — тестирование
Description: User не может сломать, admin может работать, нет дублирования
- [-] 28.01 Тест: user не может удалять/создавать/редактировать (note: Отложено — не было явной команды)
- [-] 28.02 Тест: admin может работать через Content Management (note: Отложено — не было явной команды)
- [-] 28.03 Проверка: нет дублирования кода (note: Отложено — не было явной команды)

### Feature 29: F29 Modularization Phase 1
Description: F29 Phase 1: routes + templates + home redesign
- [x] 29.01 Phase 1 — Routes + templates + home page redesign (note: ✅ Done: /content-mgmt/* routes, content-mgmt/tags.html + /comics.html + settings.html, 3-block home page, i18n keys)
