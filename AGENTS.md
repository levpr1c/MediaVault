# MediaVault

Flask single-file (`src/web_app.py`, 3571 строк, 71 роут, 33 `@admin_required`, 2 `@auth_required`, 53 `@api_error_handler`) + `src/credential_store.py` (67). Три под-приложения: **MV** (`/mediavault/`, read-only), **CM** (`/content-mgmt/`, admin-only), **Admin** (`/admin`).

## Команды

```bash
venv/bin/python src/web_app.py             # http://0.0.0.0:5050
venv/bin/python src/web_app.py --debug     # авто-релоад + verbose
venv/bin/python src/web_app.py --bind 127.0.0.1
venv/bin/python test.py                    # синтаксис + локаль + мёртвый код + тесты
venv/bin/python test.py --check py         # только Python
venv/bin/python test.py --check js         # только JavaScript
venv/bin/python test.py --check smoke      # smoke-тест (запуск Flask)
```

```bash
venv/bin/pyinstaller mediavault.spec --clean --noconfirm   # сборка onefile (29 MB)
```

## Релиз (AUR)

```bash
mv dist/mediavault dist/mediavault-linux-amd64
sha256sum dist/mediavault-linux-amd64
# → GitHub Release v1.0.0, загрузить binary как assets
# → обновить sha256sums в packaging/aur/mediavault-bin/PKGBUILD
# → скопировать packaging/aur/mediavault-bin/ → AUR git → push
```

## PKGBUILD

`packaging/aur/mediavault-bin/PKGBUILD` + `mediavault.install` (post_install: gnome-keyring hint). `depends=('ffmpeg')`, `optdepends=('gnome-keyring')`.

Deps: `flask`, `requests`, `Pillow` — в `venv/`. FFmpeg нужен для видео-превью + определения звука (`ffprobe`).

## Конвенции (не очевидные)

- **`if data is None:`** — пустой `{}` falsy в Python. Все API так.
- **`window.fnName`** для `onclick` — IIFE модули экспортят глобалы (`Shared.*`, `AdminDashboard.*`, `ContentManager.*`). Проверять шаблон перед переименованием.
- **`_has_non_meta_tags(tag_str)`** — false если только META_TAGS (`sound`, `animated`, `photo`, `video`, `gif`) или aspect-ratio (`^\d+:\d+$`).
- **Thumbnail constants**: `_THUMB_LARGE = 360`, `_THUMB_XL = 600`, `_THUMB_RATIO_LIMIT = 21/9`.
- **Icons**: inline SVG. **Нет emoji**. SVG sun/moon для темы, текст RU/EN.
- **CSS loading order**: `shared.css` → (content.css / admin.css / tagfetch.css / settings.css) → `mediavault.css` **последний** (специфичность без `!important`).
- **Header**: inline в `base.html`, никаких partials. Блоки: `hdr_brand`, `hdr_tabs`, `hdr_nav`, `hdr_actions`, `hdr_search`, `hdr_drawer`. Desktop `.hdr-desktop` + mobile `.hdr-mobile` скрываются/показываются через CSS media queries (768px). **Нет `window.innerWidth` в JS**.
- **Desktop-only**: `.desktop-only` скрыт на mobile CSS. Mobile **не получает HTML** для sidebar, search panel, toolbar controls.
- **SPA страницы**: `content-mgmt/*`, `settings`, `admin` — extend `base.html`, контент через JS. **Standalone**: `login.html` (не extend base), `popular_tags`, `view` — suppress header blocks.
- **localStorage keys**: `mediavault_page_size`, `mediavault_layout`, `mediavault_thumb_size`.
- **Lightbox position (`lb-pos`)**: визуальный порядок (`getVisualOrder()` → `getBoundingClientRect()` top→left), не data-array порядок. Важно для column-masonry.
- **`ComicsPicker`**: единый компонент, `shared/comics/comics.js`. Открывается через `ComicsPicker.openPicker()`. В MV mode доступен через `picker-bridge.js` для ES-модулей CM.
- **`comics-list.html`**: один шаблон для двух режимов — MV view (`mode != 'edit'`) и CM редактор (`mode == 'edit'`). Флаг `mode` из роута.
- **Auth**: сессии Flask. `@admin_required` → 403 JSON. `@auth_required` → 401 JSON. `@api_error_handler` → 500 JSON с трассировкой. **Порядок**: `@app.route` → auth → `@api_error_handler`.
- **`three_bg`** — отдельный тоггл от `effects`. `data-three-bg="0"` на `<html>` скрывает Three.js canvas через MutationObserver в `home-bg.js`. Не зависит от `data-no-effects`.

## Three.js (offline)

- Self-hosted: `static/lib/three.module.js` (v0.160.0, 53044 строк)
- Importmap во всех шаблонах: `"three": "/static/lib/three.module.js"`
- Shared модуль: `static/shared/home-bg.js` — `initHomeBg(opts)` с `beforeRender` хуком
- Используется в `home.html` и `login.html`

## Роуты (71)

9 групп. Полный справочник — `docs/code-guide.md` раздел 6.

## JS модули (25, 6862 строк без lib/)

| Паттерн | Директории |
|---------|-----------|
| **IIFE + `window.*`** | `shared/`, `mediavault/`, `tagfetch/`, `admin/` |
| **ES modules** (`import`/`export`) | `content/`, `shared/home-bg.js`, `shared/comics/picker-bridge.js` |

Всего 5 файлов с `import`: `content/` (main, tags, files, comics, utils) + `home-bg.js`.

## CSS (6, 1579 строк)

| Файл | Строк | Что |
|------|-------|-----|
| `shared.css` | 257 | CSS vars, темы, base, header, fonts (Unbounded + IBM Plex Sans self-hosted) |
| `content.css` | 460 | CM: tags, files, comics |
| `admin.css` | 384 | Admin SPA: cards, tables, modals |
| `mediavault.css` | 232 | Gallery, lightbox, sidebar, mobile (загружается последним) |
| `tagfetch.css` | 134 | Tagfetch panels |
| `settings.css` | 112 | Settings tabs, cards |

## Шаблоны (13, 2065 строк)

Все кроме `login.html` extend `base.html`. См. `docs/code-guide.md` секция 7.

## i18n

- Сервер: `LOCALE` dict (190 en + 190 ru, строки 150-546), `_()` в Jinja2
- Клиент: `_i18nData` в `base.html`, `_t('key')` в JS
- `Shared.toggleLang()` — переключение без перезагрузки

## Shared.* utilities (`static/shared/utils.js`)

`Shared.hexToRgba()`, `Shared.parseTags()`, `Shared.getColumnCount()`, `Shared.reorderGalleryDOM()`, `Shared.getVisualOrder()`, `Shared.toggleTheme()`, `Shared.toggleLang()`, `Shared.applyI18n()`, `Shared.logout()`, `Shared.toggleDropdown()`.

## Docs

| Файл | О чём |
|------|-------|
| `docs/code-guide.md` (2333) | Архитектура, backend, frontend, все роуты, counts |
| `docs/user-guide.md` (665) | Руководство пользователя |
| `DESING.md` (924) | Дизайн-система: цвета, шрифты, компоненты |
| `docs/FAQ.md` | Частые вопросы |
| `docs/GLOSSARY.md` | Словарь терминов |
| `docs/TROUBLESHOOTING.md` | Решение проблем |
