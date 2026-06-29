# MediaVault — База знаний

**Сгенерировано:** 2026-06-28
**Ветка:** v1.2.1-testing
**Стек:** Flask SPA + Vanilla JS + SQLite

## ОБЗОР

Локальный веб-инструмент для сбора, тегирования и просмотра медиа с
поддержкой Rule34/Danbooru тегов, читалкой комиксов, галереей и лайтбоксом.
Три саб-приложения: MV (/mediavault/, read-only), CM (/content-mgmt/, admin),
Admin (/admin).

## СТРУКТУРА

```
MediaVault/
├── src/                          # Бэкенд: Flask (web_app.py ~6к строк)
│   ├── web_app.py                # 108+ роутов, SQLite, 6000+ строк
│   ├── credential_store.py       # Хранилище ключей API (keyring / файл)
│   └── backends/api_raw.py       # Прямые API запросы (NHentai)
├── static/
│   ├── shared/                   # Общие JS модули (13 файлов)
│   │   ├── utils.js              # Shared.* хелперы, _i18nData, debounce
│   │   ├── lightbox.js           # Lightbox класс (просмотрщик)
│   │   ├── grid-renderer.js      # HTML генераторы сеток
│   │   ├── icons.js              # SiteIcons.getIcon — inline SVG
│   │   ├── api.js                # API хелперы
│   │   ├── notifications.js      # Уведомления
│   │   ├── mobile-search.js      # Мобильный поиск
│   │   ├── home-bg.js            # Three.js фон на главной
│   │   ├── find-originals.js     # Поиск оригиналов
│   │   ├── init.js               # Инициализация общих компонентов
│   │   ├── comics/comics.js      # CRUD + рендер комиксов
│   │   ├── gallery/gallery.js    # Галерея MV
│   │   └── grid/                 # Вспомогательные модули сеток
│   ├── content/                   # CM SPA (8 файлов)
│   │   ├── main.js               # SPA роутер + init
│   │   ├── content-search.js     # Поиск по R34/Dan/NH/EH
│   │   ├── comics-tags.js        # Drag-n-drop теги комиксов
│   │   ├── comics.js             # CRUD комиксов в CM
│   │   ├── tags.js               # Массовое тегирование
│   │   ├── tags-manage/          # Тегирование файлов
│   │   ├── nhentai_search.js     # Поиск по NHentai
│   │   └── utils.js              # Утилиты CM
│   ├── admin/admin.js            # Админка: users, DB, API keys, сканирование
│   ├── css/                      # 8 CSS файлов
│   │   ├── shared.css            # Базовые стили (1-й порядок)
│   │   ├── content.css           # CM стили
│   │   ├── content-search.css    # Поиск контента
│   │   ├── admin.css             # Админка
│   │   ├── settings.css          # Настройки
│   │   ├── shared-grid.css       # Сетки
│   │   ├── tagfetch.css          # Tagfetch
│   │   └── mediavault.css        # MV стили (последний, !important разрешён)
│   ├── mediavault/               # MV галерея
│   │   ├── mediavault.js         # Основной модуль галереи
│   │   ├── api.js                # API для MV
│   │   └── db.js                 # LocalStorage/IndexedDB
│   ├── fonts/                    # Шрифты
│   └── lib/three.module.js       # Three.js (фон)
├── templates/                    # 15+ Jinja2 шаблонов
│   ├── base.html                 # Базовый шаблон
│   ├── home.html                 # Главная страница
│   ├── login.html                # Логин
│   ├── settings.html             # Настройки
│   ├── content-mgmt/
│   │   └── tags.html             # Теги (CM)
│   ├── shared/
│   │   ├── gallery.html          # Галерея (shared)
│   │   ├── comics-list.html      # Список комиксов
│   │   ├── macros.html           # Jinja2 макросы
│   │   ├── popular_tags.html     # Популярные теги
│   │   └── view.html             # Просмотр
│   ├── admin/admin.html          # Админка
│   ├── content-search.html       # Поиск контента
│   ├── kemono_import.html        # Импорт Kemono
│   ├── nhentai_search.html       # Поиск NHentai
│   ├── similar.html              # Похожие файлы
│   └── tagfetch/                 # Tagfetch страницы
├── docs/                         # Документация
├── test.py                       # CLI тестер (975 строк)
├── check.py                      # Проверки синтаксиса + smoke тесты
├── requirements.txt              # Python зависимости
└── packaging/aur/                # AUR PKGBUILD
```

## ГДЕ ИСКАТЬ

| Задача | Файл(ы) | Ключевые символы |
|--------|---------|-------------------|
| Роуты, API, БД | `src/web_app.py` | 108+ роутов, SQLite WAL |
| Хранилище ключей | `src/credential_store.py` | `CredentialStore`, keyring/plain |
| Прямые API (NHentai) | `src/backends/api_raw.py` | `api_raw_nhentai` |
| Галерея MV | `static/mediavault/mediavault.js` | `init()`, `onSidebarTagClick` |
| Лайтбокс | `static/shared/lightbox.js` | `Lightbox` класс |
| CM: поиск контента | `static/content/content-search.js` | `doSearch()`, `showLightbox()`, R34/Dan/NH/EH |
| CM: теги комиксов | `static/content/comics-tags.js` | `comicsTagsRender()`, drag-n-drop |
| CM: CRUD комиксов | `static/content/comics.js` | `comicsRender()`, `addComic()` |
| CM: роутинг SPA | `static/content/main.js` | `init()`, `loadSection()`, роуты |
| CM: массовое тегирование | `static/content/tags.js` | Тегирование файлов |
| CM: NHentai поиск | `static/content/nhentai_search.js` | Поиск манги |
| Админка | `static/admin/admin.js` | `init()`, 5 секций (Users, DB, API, Scan, Mount) |
| Общие утилиты | `static/shared/utils.js` | `Shared.*`, `_i18nData` |
| Сетка карточек | `static/shared/grid-renderer.js` | `comicCardHTML()`, `buildComicsGridHTML()` |
| Иконки | `static/shared/icons.js` | `SiteIcons.getIcon` |
| Базовый шаблон | `templates/base.html` | {% block content %}, {% block scripts %} |
| Популярные теги | `templates/shared/popular_tags.html` | Кнопки популярных тегов |
| Тесты | `test.py` | CLI тестер (975 строк) |

## КАРТА API (бэкенд)

### Страницы (GET)
| Маршрут | Функция | Описание |
|---------|---------|----------|
| `/` | `home` | Главная |
| `/mediavault/gallery` | `gallery` | Галерея MV |
| `/mediavault/comics` | `comics` | Комиксы MV |
| `/mediavault/view` | `view` | Просмотр MV |
| `/mediavault/comics/view` | `comics_view` | Просмотр комикса MV |
| `/content-mgmt/search` | `content_mgmt_search` | CM поиск |
| `/content-mgmt/comics-tags` | `content_mgmt_comics_tags` | CM теги комиксов |
| `/content-mgmt/comics-edit` | `content_mgmt_comics_edit` | CM редактор комиксов |
| `/content-mgmt/tags-auto` | `tags_auto` | CM авто-теги |
| `/content-mgmt/tags-manual` | `tags_manual` | CM ручные теги |
| `/content-mgmt/tags-manage` | `tags_manage` | CM управление тегами |
| `/admin` | `admin` | Панель администратора |
| `/settings` | `settings` | Настройки |
| `/popular-tags` | `popular_tags_page` | Популярные теги |
| `/nhentai-search` | `nhentai_search_page` | Поиск NHentai |
| `/kemono-import` | `kemono_import_page` | Импорт Kemono |
| `/similar` | `similar` | Похожие |
| `/login` | `login` | Логин |

### API (JSON)
| Маршрут | Описание |
|---------|----------|
| `GET /api/gallery` | Данные галереи |
| `GET /api/media` | Медиа-файлы |
| `GET /api/thumbnail` | Миниатюры |
| `GET /api/fileinfo` | Информация о файле |
| `GET /api/browse` | Навигация по папкам |
| `GET /api/popular_tags` | Популярные теги |
| `GET/POST /api/categories` | Категории тегов |
| `GET/POST /api/settings` | Настройки |
| `POST /api/login` | Логин |
| `POST /api/logout` | Logout |
| `POST /api/scan_folder` | Сканирование папки |
| `GET /api/scan_status` | Статус сканирования |
| `POST /api/rescan/full` | Полное пересканирование |
| `GET /api/auth_status` | Статус авторизации |
| `POST /api/theme` | Смена темы |
| `POST /api/effects` | Эффекты |
| `POST /api/save_file` | Сохранение файла |
| `POST /api/save_all_fetched` | Сохранение всех найденных |
| `POST /api/auto_scan` | Авто-сканирование |
| `POST /api/auto_status` | Статус авто-сканирования |
| `POST /api/tags` | Добавление тегов |
| `POST /api/tags/bulk` | Массовое тегирование |
| `POST /api/clear_*` | Очистка кэша/БД/тегов |
| `POST /api/delete_all` | Удаление всех файлов |
| `POST /api/deduplicate` | Дедупликация |
| `POST /api/rehash` | Перехеширование |
| `GET /api/rehash-progress` | Прогресс перехеширования |
| `POST /api/find-duplicates` | Поиск дубликатов |
| `POST /api/remove-duplicates` | Удаление дубликатов |
| `POST /api/find-originals` | Поиск оригиналов |
| `GET /api/export_db` | Экспорт БД |
| `POST /api/import_db` | Импорт БД |
| `POST /api/regenerate_thumbnails` | Регенерация миниатюр |
| `POST /api/cancel_regen` | Отмена регенерации |
| `POST /api/comics/search` | Поиск комиксов |
| `POST /api/comics/add` | Создание комикса |
| `POST /api/comics/delete` | Удаление комикса |
| `POST /api/comics/update` | Обновление комикса |
| `POST /api/comics/pages/tag` | Тегирование страниц комикса |
| `GET /api/admin/users` | Список пользователей |
| `POST /api/admin/users` | Создание пользователя |
| `DELETE /api/admin/users/<id>` | Удаление пользователя |
| `POST /api/admin/users/<id>/role` | Смена роли |
| `POST /api/admin/users/<id>/password` | Смена пароля |
| `GET /api/content-mgmt/search` | Поиск контента (R34/Dan/NH/EH) |
| `POST /api/content-mgmt/search/download` | Скачивание |
| `POST /api/content-mgmt/search/download-async` | Асинхронное скачивание |
| `POST /api/content-mgmt/search/download-manga` | Скачивание манги NHentai |
| `GET /api/content-mgmt/search/task/<id>` | Статус задачи |
| `GET /api/content-mgmt/search/nhentai-gallery` | Галерея NHentai |
| `GET /api/content-mgmt/files-without-tags` | Файлы без тегов |
| `GET /api/tags/autocomplete` | Автодополнение тегов |
| `GET /api/nhentai/search` | Поиск по NHentai API |
| `GET /api/ehentai/gallery` | Галерея E-Hentai |
| `GET /api/credential_status` | Статус ключей API |
| `POST /api/pick_folder` | Выбор папки |
| `GET /api/similar` | Похожие файлы |

## КАРТА СИМВОЛОВ (ключевые функции)

| Символ | Тип | Файл | Роль |
|--------|-----|------|------|
| `web_app.py` | модуль | `src/` | 6к строк, весь бэкенд |
| `Lightbox` | класс | `static/shared/lightbox.js` | Просмотрщик с зумом, навигацией, тегами |
| `Shared.*` | модуль | `static/shared/utils.js` | Хелперы (hexToRgba, parseTags, getColumnCount) |
| `SiteIcons.getIcon` | модуль | `static/shared/icons.js` | Все SVG иконки проекта |
| `ContentSearch.*` | модуль | `static/content/content-search.js` | Поиск по R34/Dan/NH/EH |
| `ComicsTags.*` | модуль | `static/content/comics-tags.js` | Drag-n-drop теги комиксов |
| `AdminDashboard` | модуль | `static/admin/admin.js` | Админка (5 секций) |
| `main.js` | SPA | `static/content/main.js` | Роутинг CM |
| `grid-renderer.js` | модуль | `static/shared/` | `comicCardHTML()`, `buildComicsGridHTML()` |
| `comics.js` (CM) | модуль | `static/content/comics.js` | CRUD комиксов в CM |
| `comics.js` (shared) | модуль | `static/shared/comics/` | CRUD комиксов в shared |
| `mediavault.js` | модуль | `static/mediavault/` | Галерея MV |
| `api_raw.py` | модуль | `src/backends/` | Прямые NHentai API запросы |
| `credential_store.py` | модуль | `src/` | Хранилище ключей (keyring) |

## КОНВЕНЦИИ

### Бэкенд
- **Порядок декораторов:** `@app.route` → `@admin_required` → `@api_error_handler`
- **Ошибки API:** 403 JSON (`@admin_required`), 401 JSON (`@auth_required`),
  500 JSON (`@api_error_handler`)
- **Логирование:** `log_debug()`/`log_info()`/`log_error()` с ANSI цветами
- **БД:** SQLite WAL + `busy_timeout=5000`. **Нет `DROP TABLE`** (эксклюзивная
  блокировка даже в WAL). Вместо этого `DELETE FROM` или `VACUUM` → checkpoint
- **Пароли:** Werkzeug `generate_password_hash`/`check_password_hash`

### Фронтенд
- **ES модули:** `{% block content %}` рендерится до `{% block scripts %}`.
  Ошибки верхнего уровня в ES модулях блокируют все остальные скрипты
- **Mobile:** Нет `window.innerWidth` в JS. `.desktop-only` скрыт через CSS
  media query. Mobile не получает HTML сайдбара/панели поиска/тулбара
- **Иконки:** Только inline SVG (никаких emoji). `SiteIcons.getIcon`
- **LocalStorage:** `mediavault_page_size`, `mediavault_layout`,
  `mediavault_thumb_size`, `mediavault_lang`, `mediavault_folder_filter`
- **i18n:** `_i18nData` глобальная переменная, ключи в `src/web_app.py`

### CSS
- `.action-btn` — стандартизирован: `border-radius:8px; inline-flex; SVG+text`,
  hover/active/danger состояния
- `.admin-header a.active` — `color:var(--accent); background:var(--accent-glow)`
- `focus-visible` везде через `box-shadow`, не `outline`
- Порядок CSS: `shared.css` → (content, content-search, admin, tagfetch,
  settings) → `mediavault.css` (последний)
- `!important` — только в `mediavault.css`

## АНТИПАТТЕРНЫ

- **`as any`, `@ts-ignore`, `@ts-expect-error`** — никогда
- **Lightbox без try-catch** — всегда оборачивай `new Lightbox()` и
  `csLightbox.close()` (глючит если закрыть до открытия)
- **Пустые catch блоки** — `catch(e) {}` запрещены
- **Удаление тестов** чтобы "починить" сборку
- **gallery-dl как Python API** — только CLI субпроцесс
- **CSS `!important`** — только в `mediavault.css`

## КОМАНДЫ

```bash
venv/bin/python src/web_app.py                   # Запуск на :5050
venv/bin/python src/web_app.py --debug            # С авто-перезагрузкой
venv/bin/python test.py                           # Все проверки (без smoke)
venv/bin/python test.py --check py/js/css         # Выборочные проверки
venv/bin/python test.py --fix                     # Починить неиспользуемые LOCALE ключи
venv/bin/python check.py                          # 68 синтакс. проверок + 3 smoke
venv/bin/pyinstaller mediavault.spec --clean --noconfirm  # Бинарник
```

## ЗАМЕТКИ

- `MobileSearch.register()` кидает "is not a function" — обёрнуто в try-catch
- Дубликаты LOCALE значений: `navAdmin`/`userRoleAdmin` → "Admin" и др. (pre-existing)
- `grid-auto-rows: minmax(267px, auto)` нужно на `.cm-comics-tags-grid-inner`
  (фикс бага перекрытия рядов в CSS Grid)
- Нет pytest, ruff, flake8, CI/CD, Docker. Весь тест — `test.py`
- Админка: 5 секций (Users, Database, API Keys, Scan, Mount)
- Content Search: unified API с `tags_by_category` для цветных категорий тегов
- NHentai manga download: скачивает все страницы в `Downloads/nhentai/{gid}/`
- Lightbox `downloadLabelFn` опция: динамическая подпись кнопки скачивания
- Три саб-приложения: MV (read-only), CM (admin), Admin

## ЗАВИСИМОСТИ

### Python (из requirements.txt)
- Flask, flask-compress
- Pillow (миниатюры AVIF)
- requests (HTTP к внешним API)
- pyjwt (JWT для аутентификации)
- python-dotenv

### Системные
- FFmpeg (миниатюры видео)
- python3-keyring (опционально, для шифрования ключей API)
- GNOME Keyring / KDE KWallet (опционально)

### от user
- если просят сделать что то связаное с тегам, изменнея фоток, видео, комиксов - то это компонент contetn-mgmt. либо к этому доступ будет в admin panel. спроси у user об этом.
- если страницы относиться к MV; CM; ADMIN and etc, то дизайн страницы должен быть такой, как у других страниц из MV, CM, и так далее

## ТЕХДОЛГ И УЗКИЕ МЕСТА (для AI-ревью)

### Критические (блокируют развитие)

1. **Монолит `web_app.py` ~6000 строк**
   - Все роуты, БД, бизнес-логика, аутентификация — в одном файле
   - Рефакторинг: разбить на `routes/`, `models/`, `services/`
   - Приоритет: высокий — любое изменение рискует сломать всё

2. **Нет тестов**
   - Нет pytest, unittest, jest. Весь тест — кастомный `test.py` (CLI скрипт)
   - Нет CI/CD — каждое изменение тестируется вручную
   - Приоритет: высокий — без тестов рефакторинг опасен

3. **Vanilla JS без сборки**
   - ES модули грузятся напрямую браузером — нет бандлера
   - Нет TypeScript — вся типизация теряется на границе Python ↔ JS API
   - Нет линтера/форматтера для JS
   - Приоритет: высокий — растёт количество багов на стыке фронта/бэка

### Существенные (тормозят разработку)

4. **Дублирование JS модулей**
   - `comics.js` существует в двух местах: `static/shared/comics/` и `static/content/comics.js` — разная реализация одного и того же
   - Часть логики галереи дублируется между `mediavault/mediavault.js`, `shared/gallery/gallery.js` и `content/content-search.js`

5. **SQLite как основная БД**
   - Нет миграций (Alembic) — схема меняется вручную через ALTER TABLE
   - WAL режим частично решает, но конкурентные записи всё ещё блокируются
   - Нет индексов на часть частых запросов (поиск по тегам)

6. **Нет WebSocket**
   - Прогресс сканирования/регенерации через SSE (Server-Sent Events)
   - Долгие операции не имеют реального push-уведомления

7. **Перемешанные слои в шаблонах**
   - Jinja2 шаблоны содержат inline JS (в блоках `scripts`) и CSS
   - Логика рендеринга размазана между Python, Jinja2 и JS

### Малые (но накапливаются)

8. **`MobileSearch.register()` падает с "is not a function"** — залечено try-catch, но не исправлено
9. **Дубликаты LOCALE ключей** — `navAdmin`/`userRoleAdmin` → "Admin" и др.
10. **CSS `!important` в `mediavault.css`** — разрешён только там, но это костыль
11. **Нет Docker-образа** — хотя AUR пакет есть

## НАПРАВЛЕНИЯ ДЛЯ УЛУЧШЕНИЙ (для AI-планирования)

### Архитектура
- Разделить `web_app.py` на модули (Flask Blueprints)
- Ввести сервисный слой между роутами и БД
- Добавить Alembic для миграций SQLite
- Вынести внешние API (R34, Danbooru, NH, EH) в отдельные адаптеры

### Фронтенд
- Добавить Vite/esbuild для сборки JS
- Постепенно мигрировать критические модули (Lightbox, Content Search) на TypeScript
- Ввести единую стейт-менеджмент систему (не DOM-состояние)
- Объединить дублирующиеся модули (comics.js, gallery)

### Инфраструктура
- Добавить pytest + ruff/flake8 для Python
- Добавить ESLint/Prettier для JS
- Настроить GitHub Actions (CI: тесты + линтеры, CD: сборка AUR)
- Docker Compose для разработки (app + SQLite)

### Безопасность
- JWT токены хранятся в cookies — проверить httpOnly флаги
- CSRF защита на API эндпоинтах
- Rate limiting на внешние API прокси

### UX
- Infinite scroll в галерее вместо пагинации (опционально)
- Drag-n-drop загрузка файлов
- Предпросмотр видео в лайтбоксе
