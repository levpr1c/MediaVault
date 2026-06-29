# src/ — Бэкенд

**Стек:** Flask + SQLite + Python 3
**LOC:** ~6900 (web_app.py ~6000, credential_store.py ~300, backends/api_raw.py ~600)

## Файлы

| Файл | LOC | Роль |
|------|-----|------|
| `web_app.py` | ~6000 | Весь бэкенд: роуты, БД, аутентификация, API |
| `credential_store.py` | ~300 | Хранилище API ключей (keyring/plain text) |
| `backends/api_raw.py` | ~600 | Прямые HTTP запросы к NHentai API |

## web_app.py — Структура

### Порядок декораторов (обязательно)
`@app.route` → `@admin_required` → `@api_error_handler`

### Страницы (HTML/Jinja2)
- `/` → `home()`
- `/mediavault/gallery` → `gallery()`
- `/mediavault/comics` → `comics()`
- `/mediavault/view` → `view()`
- `/mediavault/comics/view` → `comics_view()`
- `/content-mgmt/search` → `content_mgmt_search()`
- `/content-mgmt/comics-tags` → `content_mgmt_comics_tags()`
- `/content-mgmt/comics-edit` → `content_mgmt_comics_edit()`
- `/content-mgmt/tags-auto` → `tags_auto()`
- `/content-mgmt/tags-manual` → `tags_manual()`
- `/content-mgmt/tags-manage` → `tags_manage()`
- `/admin` → `admin()`
- `/settings` → `settings()`
- `/popular-tags` → `popular_tags_page()`
- `/nhentai-search` → `nhentai_search_page()`
- `/kemono-import` → `kemono_import_page()`
- `/similar` → `similar()`
- `/login` → `login()`

### API Группы

**Аутентификация:**
- `GET /api/auth_status` — статус сессии
- `POST /api/login` — вход
- `POST /api/logout` — выход
- `POST /api/set_password` — установка пароля
- `POST /api/account/change_username` — смена юзернейма

**Медиа:**
- `GET /api/gallery` — данные галереи (фильтрация, пагинация)
- `GET /api/media` — медиа-файлы
- `GET /api/thumbnail` — миниатюры
- `GET /api/fileinfo` — информация о файле
- `GET /api/browse` — навигация по папкам
- `GET /api/pick_folder` — выбор папки
- `GET /api/similar` — похожие файлы

**Теги:**
- `GET/POST /api/categories` — категории тегов
- `POST /api/tags` — добавление тега
- `POST /api/tags/bulk` — массовое тегирование
- `GET /api/tags/autocomplete` — автодополнение
- `POST /api/popular_tags` — популярные теги
- `GET /api/content-mgmt/files-without-tags` — файлы без тегов

**Сканирование/Рескан:**
- `POST /api/scan_folder` — сканирование папки
- `GET /api/scan_status` — статус сканирования
- `POST /api/rescan/full` — полный рескан
- `POST /api/auto_scan` — автосканирование
- `POST /api/auto_status` — статус автосканирования

**База данных:**
- `GET /api/export_db` — экспорт
- `POST /api/import_db` — импорт
- `POST /api/clear_cache` / `clear_tag_cache` / `clear_database` / `clear_all` / `clear_tags`
- `POST /api/delete_all` — удалить всё
- `POST /api/deduplicate` — дедупликация
- `POST /api/rehash` + `GET /api/rehash-progress` — перехеширование
- `POST /api/find-duplicates` + `POST /api/remove-duplicates` — дубликаты
- `POST /api/regenerate_thumbnails` + `POST /api/cancel_regen` — миниатюры
- `GET /api/admin/scan-progress` — прогресс сканирования

**Комиксы:**
- `GET /api/comics/search` — поиск
- `GET /api/comics/list` — список
- `POST /api/comics/add` — создание
- `POST /api/comics/delete` — удаление
- `POST /api/comics/get` — получить
- `POST /api/comics/update` — обновить
- `POST /api/comics/pages/tag` — теги страниц

**Content Search (внешние API):**
- `GET /api/content-mgmt/search` — поиск (R34/Dan/NH/EH)
- `POST /api/content-mgmt/search/download` — скачивание
- `POST /api/content-mgmt/search/download-async` — асинхронное
- `POST /api/content-mgmt/search/download-manga` — манга NHentai
- `GET /api/content-mgmt/search/nhentai-gallery` — галерея NH
- `GET /api/content-mgmt/search/task/<id>` — статус задачи
- `GET /api/mount-check` — проверка монтирования
- `POST /api/content-mgmt/search/create-folders` — создание папок

**Внешние интеграции:**
- `GET /api/nhentai/search` — NHentai API
- `GET /api/ehentai/gallery` — E-Hentai
- `GET /api/kemono/mirrors` + `GET /api/kemono/info` + `POST /api/kemono/download` — Kemono

**Админ:**
- `GET /api/admin/users` + `POST` + `DELETE /<id>` + `POST /<id>/role` + `POST /<id>/password`

## credential_store.py

- `CredentialStore` класс
- Поддержка keyring (GNOME Keyring / KDE KWallet)
- Fallback на plain text (settings.json)
- Методы: `get_credential()`, `set_credential()`, `delete_credential()`

## backends/api_raw.py

- `api_raw_nhentai()` — прямой HTTP запрос к NHentai API
- Используется когда основной API недоступен
- Возвращает сырые данные галереи

## ТЕХДОЛГ И УЛУЧШЕНИЯ (для AI-ревью)

### Бэкенд — узкие места

1. **Монолит**: `web_app.py` ~6000 строк, все роуты в одном файле. Рефакторинг:
   - Flask Blueprints по группам: `auth`, `media`, `tags`, `comics`, `content_search`, `admin`
   - Вынести SQL-запросы в отдельные `models/` (по таблицам)
   - Вынести бизнес-логику в `services/`

2. **Нет миграций БД**: Схема меняется через ALTER TABLE вручную. Нужен Alembic.

3. **Нет индексов**: Поиск по тегам и популярным тегам может тормозить на больших коллекциях.

4. **Обработка ошибок**: `@api_error_handler` есть, но часть роутов возвращает сырые ошибки без JSON.

5. **CredentialStore**: keyring падает без GNOME Keyring — fallback на plain text работает, но это安全隐患.

6. **gallery-dl**: Вызывается как CLI subprocess — нет мониторинга прогресса, нет таймаутов.

7. **Прямые HTTP запросы**: `api_raw_nhentai()` без retry-логики и rate limiting.

### Что улучшить в первую очередь

| Задача | Сложность | Эффект |
|--------|-----------|--------|
| Разбить `web_app.py` на Blueprints | Средняя | Упрощает навигацию, позволяет тестировать изолированно |
| Добавить pytest + ruff | Низкая | Качество кода, безопасность рефакторинга |
| Индексы на tags/queries | Низкая | Скорость поиска на больших БД |
| Timeout/retry для внешних API | Низкая | Стабильность, меньше ошибок пользователю |
| Alembic миграции | Средняя | Безопасные изменения схемы БД |

### Что НЕ трогать
- `@app.route` → `@admin_required` → `@api_error_handler` порядок декораторов — сломалось при изменении
- SQLite → PostgreSQL миграция — проект локальный, SQLite достаточно
- Логирование (`log_debug/info/error`) — ANSI цвета, менять только если переходим на structured logging
