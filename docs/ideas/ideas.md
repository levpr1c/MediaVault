# Ideas

## SQLite шифрование (pysqlcipher3)
- Замена встроенного sqlite3 на `pysqlcipher3` (C-расширение, требует `libsqlcipher`)
- `PRAGMA key = 'passphrase'` — вся БД шифруется AES-256

- Проблемы: сложный билд, PyInstaller, Windows (`libsqlcipher.dll`)

## Thumbnail regeneration debug
- Добавить `log_debug` в `_regen_all_thumbnails` — логировать каждый файл (path, status: ok/skip/error)
- Живой прогресс в UI для фоновой регенерации (SSE или polling `/api/regenerate_thumbnails_status`)
- Кнопка Cancel для остановки фоновой регенерации
- Счётчик на кнопке: сколько сделано / всего

## Удалить таблицу `tags`

Таблица только пишется (`INSERT OR IGNORE`), никогда не читается (`SELECT`). Все данные из `files.tags` и `tag_category_members`. Убрать 3 вставки в коде.
