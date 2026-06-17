# MediaVault — План тестирования (new-features branch)

## 1. Автоматические тесты (test.py)

```bash
# Полный прогон
venv/bin/python test.py

# По категориям:
venv/bin/python test.py --check py                   # Python syntax (все .py)
venv/bin/python test.py --check js                   # JS syntax (27 модулей)
venv/bin/python test.py --check css                  # CSS непустые
venv/bin/python test.py --check locale               # i18n parity en↔ru
venv/bin/python test.py --check dead                 # мёртвый код
venv/bin/python test.py --check func                 # _has_non_meta_tags() и др.
venv/bin/python test.py --check smoke                # Flask start + /login 200 + /api/gallery 401
```

### Ожидаемый результат
- 42 теста passed ✅
- 6 pre-existing failures (не связаны с этой сессией)

---

## 2. Проверка удаления NokufindBackend/cloudscraper

```bash
# В коде не должно быть упоминаний
grep -r "nokufind\|cloudscraper\|NokufindBackend" src/ --include="*.py"
# → пусто

# В документации — только historical notes
grep -r "nokufind\|cloudscraper\|NokufindBackend" docs/ --include="*.md"
# → только code-guide.md (секция "Удалено"), sites-api-in-MV.md (история)
```

---

## 3. Ручное тестирование — Бэкенды

### 3.1 NHentai Search
- [ ] Открыть `/nhentai-search`
- [ ] Ввести "touhou" → нажать Search
- [ ] **Спиннер загрузки появляется** и **исчезает** после ответа
- [ ] Результаты отображаются в сетке (карточки)
- [ ] Клик по карточке → detail view:
  - [ ] Обложка галереи
  - [ ] Теги с цветовыми категориями (tag/artist/parody/character/language/category/group)
  - [ ] Stats (ID, pages, tag count)
- [ ] Drag-to-tag работает
- [ ] Add all tags работает
- [ ] Error state: при ошибке API показывается сообщение

### 3.2 Franchise Search
- [ ] Открыть `/franchise-search`
- [ ] Ввести "hatsune_miku" → нажать Search
- [ ] Результаты от Rule34, Danbooru, NHentai
- [ ] **Preview images загружаются** (fallback если preview_url пуст)
- [ ] Debug info: показан backend + URL для каждого результата
- [ ] onerror: если картинка не грузится, подставляется file_url/sample_url

### 3.3 Kemono/Coomer Import
- [ ] Открыть `/kemono-import`
- [ ] **Нет** ложной ошибки "gallery-dl not installed"
- [ ] Ввести валидный URL (kemono.su/... или coomer.su/...)
- [ ] Get Info — возвращает метаданные
- [ ] Download — скачивает файлы
- [ ] Debug info в консоли браузера

---

## 4. Ручное тестирование — UI

### 4.1 Admin Panel
- [ ] Открыть `/admin`
- [ ] **Folders** больше нет в навигации (верхние иконки)
- [ ] Внутри **Database** секции есть **Folders card**:
  - [ ] media_dir (readonly display + input)
  - [ ] Pick folder button
  - [ ] Scan button
  - [ ] gallery_dir/comics_dir inputs
- [ ] Save button работает
- [ ] Router: клик по Database → всё загружается, нет dead links

### 4.2 Settings → Database tab
- [ ] Открыть `/settings`
- [ ] Переключиться на **Database** tab
- [ ] Есть **Backend Selection** card:
  - [ ] rule34: dropdown (api_raw / gallerydl)
  - [ ] danbooru: dropdown (api_raw / gallerydl)
  - [ ] nhentai: dropdown (api_raw / gallerydl)
  - [ ] kemono: dropdown (api_raw / gallerydl)
  - [ ] coomer: dropdown (api_raw / gallerydl)
- [ ] Текущее значение пред-выбрано из настроек
- [ ] Save → перезагружает с новыми бэкендами

### 4.3 Comics Viewer
- [ ] Открыть комикс в scroll/webtoon режиме
- [ ] **Счётчик страниц** обновляется при скролле:
  - [ ] Плавно, без dead zone
  - [ ] Правильный номер страницы в viewport
- [ ] Навигация по превью работает

---

## 5. Регрессионные тесты

### 5.1 Аутентификация
- [ ] `/login` — форма входа
- [ ] Login с валидными кредами → редирект
- [ ] Login с невалидными → ошибка
- [ ] Logout
- [ ] Доступ без авторизации → 401/редирект

### 5.2 Gallery
- [ ] `/mediavault/gallery` — загружается
- [ ] Файлы отображаются
- [ ] Фильтр по типу (images/video/audio/other)
- [ ] Сортировка

### 5.3 Lightbox
- [ ] Клик по файлу → открывается lightbox
- [ ] Теги отображаются
- [ ] Навигация prev/next
- [ ] Close

### 5.4 Tagfetch
- [ ] `/content-mgmt/tags-manual` — ручной поиск
- [ ] `/content-mgmt/tags-auto` — авто сканирование
- [ ] Drag-to-tag работает
- [ ] Source присваивается правильно (site name / auto / manual)

### 5.5 Admin CRUD
- [ ] Добавить пользователя
- [ ] Удалить пользователя
- [ ] Сменить пароль
- [ ] Сменить роль (admin/user)

### 5.6 Settings
- [ ] Appearance tab: theme toggle (light/dark)
- [ ] Appearance tab: language toggle (EN/RU)
- [ ] Database tab: clear browser cache
- [ ] Database tab: VACUUM
- [ ] Account tab: change password

### 5.7 i18n
- [ ] EN: все строки на английском
- [ ] RU: все строки на русском
- [ ] Нет missing keys (`undefined` в UI)
- [ ] Переключение без перезагрузки страницы

---

## 6. Производительность

- [ ] Gallery-dl Python API fetch: < 3s на запрос
- [ ] NHentai search: < 5s
- [ ] Franchise search (3 сайта параллельно): < 10s
- [ ] Cache-Control: правильные заголовки на /api/media
- [ ] Browser cache: no-cache режим работает

---

## 7. Крайние случаи

- [ ] Пустой поиск (NHentai, Franchise)
- [ ] Спецсимволы в поиске (Unicode, HTML entities)
- [ ] Невалидный URL (Kemono Import)
- [ ] Файл без тегов (пустой результат)
- [ ] MD5 не найден нигде (404/empty)
- [ ] Сетевые ошибки (timeout, 403, 500)
