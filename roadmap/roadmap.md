---
feature: "MediaVault new-features"
spec: |
  Исправление багов, кэш-инфраструктура, архитектурные улучшения, новые фичи (NHentai, drag-to-tag, Similar, Kemono), редизайн UI.
---

## Task List

### Feature 1: Критические баги
Description: Исправление багов: мёртвые таблицы, source тегов, защита API, скрытие кнопок
- [x] 1.1 Удалить мёртвую таблицу tags (CREATE + INSERT + DROP)
- [x] 1.2 Очистить _COMMON_META_TAGS (только file-type + ratio:*)
- [x] 1.3 Исправить бескатегорийные R34 теги (убрать `if cat != 'general':`)
- [x] 1.4 Сохранять source при перемещении тега (SELECT перед INSERT)
- [x] 1.5 Source при добавлении нового тега = 'manual'
- [x] 1.6 Защитить POST /api/tags — @admin_required (уже есть)
- [x] 1.7 Скрыть управление тегами в лайтбоксе для non-admin

### Feature 2: Кэш-инфраструктура
Description: Browser cache busting, Cache-Control заголовки, VACUUM после DB ops
- [x] 2.1 POST /api/clear_browser_cache + cache_buster в settings/frontend
- [x] 2.2 Cache-Control + ETag на /api/media и /api/thumbnail
- [x] 2.3 VACUUM + batch_scan drop + очистка in-memory кешей
- [x] 2.4 Settings UI кнопка + i18n + &cb=N во всех JS URLs
- [x] 2.5 Убрать webbrowser.open() при старте сервера

### Feature 3: Архитектура
Description: Система подпапок, бекенды фетча, очистка кеша, перепроектирование таблиц
- [ ] 3.1 Система подпапок (Gallery/Comics/Downloads + folder_type)
- [ ] 3.2 Выбор бекенда фетча (api_raw / nokufind / gallery-dl)
- [ ] 3.3 Очистка кеша данных (архитектурный уровень)
- [ ] 3.4 Перепроектирование таблиц тегов (site_source, site_id, last_updated, data)

### Feature 4: Новые фичи
Description: NHentai поиск, drag-to-tag, страница "Похожее", Kemono/Coomer
- [ ] 4.1 NHentai поиск тегов для комиксов
- [ ] 4.2 Drag-to-tag для комиксов
- [ ] 4.3 Страница "Похожее" (по франшизе/автору/персонажу)
- [ ] 4.4 Интеграция Kemono/Coomer с проверкой зеркал

### Feature 5: Редизайн UI/UX
Description: Привести все страницы к единому дизайну, добавить иконки сайтов
- [ ] 5.1 Редизайн Tagfetch (под единый дизайн)
- [ ] 5.2 Редизайн Gallery (под единый дизайн)
- [ ] 5.3 Иконки сайтов (8 сайтов, inline SVG)
