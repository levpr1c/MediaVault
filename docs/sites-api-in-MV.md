# Sites API Integration in MediaVault

## 1. Зачем этот документ

Справочник для AI-агентов: как MediaVault взаимодействует с внешними сайтами (Rule34, Danbooru, NHentai, Kemono, Coomer), какие бэкенды есть, как хранятся credentials, какие изменения были сделаны в new-features branch.

MediaVault не хранит медиа с этих сайтов. Он использует их API для получения тегов (по MD5 хешу файла) и для поиска/импорта контента. Архитектура модульная: каждый сайт может использовать один из двух бэкендов, настраиваемых per-site в админ-панели.

---

## 2. Общая архитектура

### 2.1 Модульная система бэкендов

```
src/backends/
├── __init__.py         ← BACKENDS registry, fetch_tags(), search_tags()
├── api_raw.py          ← ApiRawBackend: прямые HTTP-запросы к API (210 строк)
└── gallerydl.py        ← GalleryDlBackend: gallery-dl Python API (338 строк)
```

### 2.2 Registry и dispatch

```python
# src/backends/__init__.py
BACKENDS = {
    'api_raw':   ApiRawBackend(),
    'gallerydl': GalleryDlBackend(),
}

# Per-site default backends
_DEFAULT_BACKEND = {
    'rule34':  'api_raw',
    'danbooru':'api_raw',
    'nhentai': 'gallerydl',
    'kemono':  'gallerydl',
    'coomer':  'gallerydl',
}
```

Две глобальные функции диспатча:

| Функция | Назначение |
|---------|-----------|
| `fetch_tags(site, md5, settings)` | Получить теги по MD5 через настроенный бэкенд |
| `search_tags(site, query, page, settings)` | Поиск по тегу/запросу с пагинацией |

Обе читают `settings['fetch_backend'][site]` чтобы определить, какой бэкенд использовать для конкретного сайта. Если настройка отсутствует — используется `_DEFAULT_BACKEND`.

```python
def fetch_tags(site, md5, settings):
    fb = settings.get('fetch_backend', {})
    backend_name = fb.get(site) or _DEFAULT_BACKEND.get(site, 'api_raw')
    backend = get_backend(backend_name)
    if not backend:
        return {'tags': [], 'file_url': '', 'preview_url': ''}
    return backend.fetch(site, md5, settings)
```

### 2.3 Перенаправление с API-роутов

Два ключевых роута в `web_app.py` используют dispatch:

- `GET /api/fetch_file` — вычисляет MD5 файла, вызывает `fetch_tags()` параллельно для всех сайтов
- `GET /api/franchise/search` — вызывает `search_tags()` через `ThreadPoolExecutor` (max 3 workers, timeout 30s)
- `GET /api/nhentai/search` — вызывает `search_tags('nhentai', ...)`

### 2.4 Admin UI: настройка бэкендов

В админ-панели (`/admin`) есть раздел **Backends**. Для каждого сайта показывается выпадающий список доступных бэкендов:

```javascript
// static/admin/admin.js — строки 200-222
var sites = [
    {id:'rule34',  creds:[...], backends:['api_raw','gallerydl']},
    {id:'danbooru',creds:[...], backends:['api_raw','gallerydl']},
    {id:'nhentai', creds:[...], backends:['api_raw','gallerydl']},
    {id:'kemono',  creds:[],    backends:['gallerydl']},
    {id:'coomer',  creds:[],    backends:['gallerydl']},
];
```

Сохранение через `_saveSettings(data)`:

```javascript
// static/admin/admin.js — строки 604-619
function _saveApiKeys() {
    var data = {
        credentials: {
            rule34:   { uid: _val('admrule34uid'), key: _val('admrule34key') },
            danbooru: { login: _val('admdanboorulogin'), key: _val('admdanboorukey') },
            nhentai:  { key: _val('admnhentaikey') }
        }
    };
    var selects = document.querySelectorAll('.backend-select');
    var fetch_backend = {};
    selects.forEach(function(sel) {
        fetch_backend[sel.dataset.site] = sel.value;
    });
    data.fetch_backend = fetch_backend;
    _saveSettings(data);
}
```

### 2.5 Настройки: формат в settings.json

```json
{
    "fetch_backend": {
        "rule34": "api_raw",
        "danbooru": "api_raw",
        "nhentai": "gallerydl",
        "kemono": "gallerydl",
        "coomer": "gallerydl"
    },
    "credentials": {
        "rule34":   {"uid": "", "key": ""},
        "danbooru": {"login": "", "key": ""},
        "nhentai":  {"key": ""}
    }
}
```

---

## 3. ApiRawBackend (backends/api_raw.py)

Прямые HTTP-запросы к API сайтов. Без сторонних библиотек кроме `requests`.

```python
UA = 'MediaVault/1.0 (mediavault project)'
API_DELAY = 1.0
```

### 3.1 Rule34

**Эндпоинт:** `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1`

**Аутентификация:** обязательна с августа 2025. Параметры `user_id` и `api_key` передаются в query string.

**Где получить ключ:** `https://rule34.xxx/index.php?page=account&s=options`

```python
def _fetch_rule34(self, md5, uid, key):
    if not uid or not key:
        return {'tags': [], 'file_url': '', 'preview_url': ''}
    url = (f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1'
           f'&limit=1&tags=md5:{md5}&user_id={uid}&api_key={key}')
    for attempt in range(3):
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
            if r.status_code == 200 and r.text.strip():
                data = r.json()
                if data:
                    return {
                        'tags': data[0].get('tags', '').split(),
                        'file_url': data[0].get('file_url', ''),
                        'preview_url': data[0].get('preview_url', ''),
                    }
        except Exception:
            if attempt < 2:
                time.sleep(1)
    return {'tags': [], 'file_url': '', 'preview_url': ''}
```

**Поиск (`_search_rule34`):**
- Endpoint: тот же, параметры `&tags=query&limit=100&pid={page-1}`
- Формат ответа: JSON (массив постов)
- Каждый результат: id, tags, file_url, preview_url, sample_url, width, height
- **Без credentials (uid+key) возвращает пустой результат**
- User-Agent: `MediaVault/1.0 (mediavault project)`
- 1 попытка (без retry), таймаут 30s

### 3.2 Danbooru

**Эндпоинт:** `https://danbooru.donmai.us/posts.json`

**Аутентификация:** HTTP Basic Auth (login:api_key) для fetch, query params (login, api_key) для search. Оба метода опциональны — Danbooru API допускает анонимные запросы (с ограничением rate limit).

**Где получить ключ:** `https://danbooru.donmai.us/profile` → Generate API key

```python
def _fetch_danbooru(self, md5, login, api_key):
    url = f'https://danbooru.donmai.us/posts.json?limit=1&tags=md5:{md5}'
    auth = (login, api_key) if login and api_key else None
    for attempt in range(3):
        try:
            r = requests.get(url, headers={'User-Agent': UA}, auth=auth, timeout=15)
            if r.status_code == 200 and r.text.strip():
                data = r.json()
                if data:
                    p = data[0]
                    return {
                        'tags': p.get('tag_string', '').split(),
                        'tag_general': p.get('tag_string_general', '').split(),
                        'tag_artist': p.get('tag_string_artist', '').split(),
                        'tag_character': p.get('tag_string_character', '').split(),
                        'tag_copyright': p.get('tag_string_copyright', '').split(),
                        'tag_meta': p.get('tag_string_meta', '').split(),
                        'file_url': p.get('file_url', ''),
                        'large_file_url': p.get('large_file_url', '') or p.get('file_url', ''),
                        'preview_file_url': p.get('preview_file_url', ''),
                    }
        except Exception:
            if attempt < 2:
                time.sleep(1)
    return {'tags': [], 'file_url': '', 'preview_url': ''}
```

**Поиск (`_search_danbooru`):**
- Endpoint: тот же, параметры `?tags={query}&limit=100&page={page}`
- Аутентификация: query params `login` + `api_key` (опционально)
- Rate limit: 10 req/s глобально, 1-4 updates/s
- Каждый результат: id, tags, file_url, preview_url, large_file_url, width, height, source

### 3.3 NHentai (API v2) — ApiRawBackend

**Эндпоинты:**
- Деталь: `https://nhentai.net/api/v2/galleries/{gid}`
- Поиск: `https://nhentai.net/api/v2/search?query={query}&page={page}&sort=popular`

**Важно:** Старый v1 endpoint `/api/gallery/{id}` удалён в 2026 после миграции NHentai на SvelteKit. Используется только v2.

**Аутентификация:** обязательна. Header `Authorization: Key YOUR_API_KEY` + User-Agent.

**Где получить ключ:** `https://nhentai.net` → Account Settings → API Keys

**Cloudflare:** NHentai за Cloudflare. Дефолтный бэкенд — Gallery-DL (gallery-dl), так как он сам обходит Cloudflare.

def _fetch_nhentai(self, gid, settings):
    api_key = settings.get('credentials', {}).get('nhentai', {}).get('key', '')
    scraper = _get_scraper()
    if not scraper:
        return {'tags': [], 'file_url': '', 'preview_url': ''}
    try:
        r = scraper.get(
            f'https://nhentai.net/api/v2/galleries/{gid}',
            headers={'Authorization': f'Key {api_key}', 'User-Agent': UA},
            timeout=15
        )
        if r.status_code == 200:
            d = r.json()
            media_id = d.get('media_id')
            return {
                'id': d.get('id'),
                'title': d.get('title', {}).get('english', ''),
                'media_id': media_id,
                'tags': [t.get('name', '') for t in d.get('tags', [])],
                'num_pages': d.get('num_pages', 0),
                'file_url': f"https://i.nhentai.net/galleries/{media_id}/1.jpg",
                'preview_url': f"https://t.nhentai.net/galleries/{media_id}/thumb.jpg",
            }
    except Exception:
        pass
    return {'tags': [], 'file_url': '', 'preview_url': ''}
```

**Поиск (`_search_nhentai`):**
- Endpoint v2: `https://nhentai.net/api/v2/search?query=...&page=...&sort=popular`
- Заголовки: `Authorization: Key ...` + `User-Agent: MediaVault/1.0`
- Полная Swagger docs: `https://nhentai.net/api/v2/docs`

### 3.4 Общие особенности ApiRawBackend

- **User-Agent:** Все запросы отправляют `MediaVault/1.0 (mediavault project)`. Запрещено использовать `curl/8.20.0` или дефолтный библиотечный UA.
- **Retry:** 3 попытки с задержкой 1 секунда (`API_DELAY = 1.0`)
- **Таймаут:** 15s для fetch, 30s для search
- **Обработка ошибок:** `try/except` без логирования (тихий сброс)

---

## 4. GalleryDlBackend (backends/gallerydl.py)

Обёртка над **Python API** gallery-dl (`gallery_dl.extractor.find`, итератор `.items()`). Не использует CLI subprocess (кроме Kemono/Coomer).

```python
from gallery_dl.extractor import find
# extr = find('https://danbooru.donmai.us/posts?tags=md5:...')
# for _path, _prefix, data in extr.items():
#     ...
```

### 4.1 gallery-dl config

```python
def _apply_gd_config(self, settings):
    from gallery_dl import config as gconfig
    gconfig.set((), 'skip', True)      # не скачивать файлы
    gconfig.set((), 'sleep', 0)        # без задержек

    creds = settings.get('credentials', {}) if settings else {}

    # Danbooru auth (опционально)
    dan = creds.get('danbooru', {})
    if dan.get('login') and dan.get('key'):
        gconfig.set(('extractor', 'danbooru'), 'username', dan['login'])
        gconfig.set(('extractor', 'danbooru'), 'password', dan['key'])

    # R34 auth (обязательно для gallery-dl)
    r34 = creds.get('rule34', {})
    if r34.get('uid') and r34.get('key'):
        gconfig.set(('extractor', 'rule34'), 'api-key', r34['key'])
        gconfig.set(('extractor', 'rule34'), 'user-id', r34['uid'])

    gconfig.set(('extractor', 'danbooru'), 'per-page', 50)
    gconfig.set(('extractor', 'danbooru'), 'page-limit', 1)
    gconfig.set(('extractor', 'nhentai'), 'per-page', 25)
    gconfig.set(('extractor', 'nhentai'), 'page-limit', 1)
```

### 4.2 Поддерживаемые сайты

| Сайт | fetch() | search() | get_info() | download() | Примечание |
|------|---------|----------|------------|------------|-----------|
| Rule34 | + | + (raw API) | - | - | search через raw JSON (gallery-dl требует api-key для v2) |
| Danbooru | + | + | - | - | auth опциональна |
| NHentai | + (fetch_gallery) | + | - | - | gallery-dl сам обходит Cloudflare |
| Kemono | - | - | + (через CLI) | + (через CLI) | импорт постов |
| Coomer | - | - | + (через CLI) | + (через CLI) | импорт постов |

### 4.3 Получение тегов по MD5 (fetch)

**Danbooru:**
```python
def _fetch_danbooru(self, md5, settings):
    self._apply_gd_config(settings)
    from gallery_dl.extractor import find
    extr = find(f'https://danbooru.donmai.us/posts?tags=md5:{md5}')
    if not extr:
        return {}
    for _path, _prefix, data in self._gd_extract(extr, limit=1):
        return {
            'tags': data.get('tag_string', '').split(),
            'tag_general': [t for t in data.get('tags_general', [])],
            'tag_artist': [t for t in data.get('tags_artist', [])],
            # ... tag_character, tag_copyright, tag_meta
            'file_url': data.get('file_url', ''),
            'large_file_url': data.get('large_file_url', '') or data.get('file_url', ''),
            'preview_file_url': data.get('preview_file_url', ''),
        }
```

**Rule34:**
```python
def _fetch_rule34(self, md5, settings):
    # Проверка api-key + user-id
    creds = settings.get('credentials', {}).get('rule34', {})
    if not creds.get('uid') or not creds.get('key'):
        return {}
    extr = find(f'https://rule34.xxx/index.php?page=post&s=list&tags=md5:{md5}')
    # ...
```

### 4.4 Поиск (search)

**Danbooru search через gallery-dl:**
```python
extr = find(f'https://danbooru.donmai.us/posts?tags={tags_q}&page={page}')
for _path, _prefix, data in self._gd_extract(extr):
    results.append({
        'id': str(data.get('id', '')),
        'tags': data.get('tag_string', '').split(),
        'file_url': data.get('file_url', ''),
        'preview_url': data.get('preview_file_url', '') or data.get('file_url', ''),
        'large_file_url': data.get('large_file_url', '') or data.get('file_url', ''),
        'width': data.get('image_width', 0),
        'height': data.get('image_height', 0),
        'rating': data.get('rating', ''),
        'score': data.get('score', 0),
        'source': 'danbooru',
    })
```

**Rule34 search — не через gallery-dl.** Gallery-dl требует api-key для Rule34 v2 API. Поэтому `_search_rule34` в GalleryDlBackend использует прямой HTTP-запрос (как в ApiRawBackend), но **без credentials**:

```python
def _search_rule34(self, query, page):
    pid = page - 1
    url = (f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1'
           f'&tags={requests.utils.quote(query)}&limit=100&pid={pid}')
    r = requests.get(url, headers={'User-Agent': 'curl/8.20.0'}, timeout=30)
```

**Важно:** Здесь используется `User-Agent: curl/8.20.0` (не стандартный `MediaVault/1.0`). Это историческое исключение для Rule34 API.

**NHentai search через gallery-dl:**
```python
extr = find(f'https://nhentai.net/search/?q={tags_q}')
for _path, _prefix, data in self._gd_extract(extr):
    gid = data.get('gallery_id')
    # gallery-dl NHentai search только возвращает gallery_id
    # полные метаданные — через fetch_gallery(gid)
```

### 4.5 Kemono/Coomer — CLI subprocess

Для Kemono и Coomer GalleryDlBackend использует **CLI** (не Python API), legacy subprocess:

```python
def is_available(self):
    subprocess.run(['gallery-dl', '--version'], capture_output=True, timeout=10)
    return True

def get_info(self, url):
    r = subprocess.run(
        ['gallery-dl', '--list-urls', '--no-download', url],
        capture_output=True, text=True, timeout=30
    )
    # парсинг artist, post_id из URL через regex

def download(self, url, dest_dir):
    r = subprocess.run(
        ['gallery-dl', '--directory', dest_dir, url],
        capture_output=True, text=True, timeout=300
    )
```

**Требование:** gallery-dl CLI в `PATH` (не только в venv).

**Зеркала Kemono/Coomer:**
```python
_KEMONO_DOMAINS = r'(?:kemono|coomer)\.(?:su|cr|cv|party|so|us|co)'

@staticmethod
def get_mirrors():
    return [
        'kemono.su', 'kemono.cr', 'kemono.cv', 'kemono.party',
        'kemono.so', 'kemono.us', 'kemono.co',
        'coomer.su', 'coomer.cr', 'coomer.cv', 'coomer.party',
        'coomer.so', 'coomer.us', 'coomer.co',
    ]
```

---

## 5. Credentials / Хранение ключей

### 5.1 Per-site формат

С августа 2025 ключи хранятся в per-site формате:

```python
# src/credential_store.py
_PER_SITE_SCHEMA = {
    'rule34':   ['uid', 'key'],
    'danbooru': ['login', 'key'],
    'nhentai':  ['key'],
}

_OLD_KEY_MAP = {
    'r34_uid':   ('rule34',   'uid'),
    'r34_key':   ('rule34',   'key'),
    'dan_login': ('danbooru', 'login'),
    'dan_key':   ('danbooru', 'key'),
    'nh_key':    ('nhentai',  'key'),
}
```

### 5.2 KeyringStore (GNOME Keyring)

```python
class KeyringStore:
    _SERVICE = 'mediavault'

    def is_available(self) -> bool    # проверка keyring
    def get(self, key: str) -> str | None
    def set(self, key: str, value: str)
    def delete(self, key: str)
```

Ключи в GNOME Keyring: `api:rule34:uid`, `api:rule34:key`, `api:danbooru:login`, `api:danbooru:key`, `api:nhentai:key`.

### 5.3 Жизненный цикл

1. **Старт:** `init_credential_store()` пытается создать `KeyringStore`
2. **Загрузка:** `load_settings()` вызывает `migrate_old_keys()` — читает старые плоские ключи из settings.json и старые keyring ключи (`api:r34_uid`), переносит в per-site формат, удаляет старые
3. **Сохранение:** `save_settings()` записывает credentials в settings.json, дублирует в keyring (если доступен), удаляет старые плоские ключи

```python
# web_app.py — save_settings()
def save_settings(s):
    global _has_users_cached
    _has_users_cached = None
    cred = s.get('credentials', {})
    if _credential_store:
        # удаляем старые плоские ключи
        _credential_store.delete('api:r34_uid')
        _credential_store.delete('api:r34_key')
        # ...
        # записываем per-site ключи
        for site, keys in [('rule34', ['uid', 'key']), ('danbooru', ['login', 'key']), ('nhentai', ['key'])]:
            site_cred = cred.get(site, {})
            for k in keys:
                val = site_cred.get(k, '')
                if val:
                    _credential_store.set(f'api:{site}:{k}', val)
                else:
                    _credential_store.delete(f'api:{site}:{k}')
    # удаляем плоские ключи из settings.json
    for k in ('r34_uid', 'r34_key', 'dan_login', 'dan_key', 'nh_key'):
        s.pop(k, None)
```

### 5.4 API для управления credentials

| Эндпоинт | Описание |
|----------|---------|
| `GET /api/credential_status` | Активный backend + варианты |
| `POST /api/set_credential_backend` | Переключить KeyringStore/plain с миграцией |
| `GET/POST /api/settings` | Чтение/запись credentials (через поле `credentials`) |

```python
# web_app.py — api_settings() POST
data = request.get_json(silent=True)
if 'credentials' in data:
    s['credentials'] = data['credentials']
# backward compat: старые плоские ключи
for old_k, site, cred_k in [('r34_uid', 'rule34', 'uid'), ...]:
    if old_k in data:
        s.setdefault('credentials', {}).setdefault(site, {})[cred_k] = data[old_k]
```

### 5.5 Fallback

Если `keyring` не установлен или недоступен (нет GNOME Keyring / KWallet), ключи хранятся в **settings.json** в открытом виде. Это единственный fallback, без шифрования.

---

## 6. User-Agent политика

**Правило:** Все HTTP-запросы к внешним API отправляют `User-Agent: MediaVault/1.0 (mediavault project)`.

```python
UA = 'MediaVault/1.0 (mediavault project)'
```

**Исключения:**
1. GalleryDlBackend._search_rule34() — использует `User-Agent: curl/8.20.0`. Это историческое исключение для Rule34 API.
2. gallery-dl Python API — использует дефолтный UA gallery-dl (не контролируется проектом).
3. gallery-dl CLI — использует дефолтный UA gallery-dl.

Запрещено использовать `curl/8.20.0` или дефолтный библиотечный `User-Agent` в новых запросах. Если добавляете новый прямой HTTP-запрос — используйте `MediaVault/1.0 (mediavault project)`.

---

## 7. История изменений (new-features branch)

### 7.1 Создание модульной системы бэкендов

**Было:** Прямые HTTP-вызовы к API Rule34 и Danbooru прямо в `web_app.py` (функции `_fetch_from_r34()`, `_fetch_from_danbooru()`).

**Стало:** Модульная архитектура в `src/backends/`:
- `ApiRawBackend` — для Rule34, Danbooru, NHentai (прямые API)
- `GalleryDlBackend` — для всех 5 сайтов (gallery-dl Python API)
- Dispatch через `fetch_tags()` / `search_tags()`

### 7.2 Per-site credentials

- Мигрированы глобальные ключи (`r34_uid`, `r34_key`, `dan_login`, `dan_key`, `nh_key`) в per-site формат: `credentials.rule34.uid/key`, `credentials.danbooru.login/key`, `credentials.nhentai.key`
- Admin UI: поля grouped by site с иконками
- KeyringStore: ключи `api:site:keyname` вместо `api:r34_uid`
- Автоматическая миграция старых ключей при загрузке настроек

### 7.3 NHentai v2

- Миграция с v1 API (удалён в 2026) на v2:
  - Деталь: `/api/gallery/{id}` → `/api/v2/galleries/{id}`
  - Поиск: новый эндпоинт `/api/v2/search`
  - Аутентификация: добавлен header `Authorization: Key ...` (обязателен)
- Полная Swagger docs: `https://nhentai.net/api/v2/docs`

### 7.4 Rule34 обязательная аутентификация

С августа 2025 Rule34 API требует `user_id` + `api_key` для всех запросов. Без них API возвращает 403. Оба бэкенда проверяют наличие credentials и возвращают пустой результат если их нет.

### 7.5 Удаление NokufindBackend

**NokufindBackend** ранее удалён.

**Причина:** gallery-dl сам обходит Cloudflare для всех сайтов, включая NHentai. NHentai теперь поддерживается через:
- `ApiRawBackend` — NHentai API v2 (с Key-Header)
- `GalleryDlBackend` — gallery-dl Python API (дефолтный бэкенд для NHentai)

### 7.6 Gallery-dl как универсальная альтернатива

**Решение от 16.06.2026:** Вместо 3-х новых библиотек (rule34Py, Pybooru, enma/nhentai-tools) — используем gallery-dl (уже в venv) для search() и fetch() на всех сайтах.

**Что сделано:**
1. GalleryDlBackend полностью переписан на Python API (`gallery_dl.extractor.find`, итератор `.items()`)
2. Поддерживает все 5 сайтов: Rule34, Danbooru, NHentai, Kemono, Coomer
3. Зарегистрирован в BACKENDS registry (gallerydl) — доступен в Admin UI
4. Admin UI: 2 варианта per-site (api_raw или gallery_dl)
5. Дефолтный бэкенд для NHentai/Kemono/Coomer (gallery-dl сам обходит Cloudflare)

### 7.7 Админ-панель: рефакторинг (5 разделов)

**Было:** 3 раздела (Users, Database, API Keys).

**Стало:** 5 разделов:
1. **Users** — управление пользователями
2. **Database** — инструменты БД
3. **API Keys** — API-ключи per-site + Credential Backend
4. **Folders** — gallery_dir / comics_dir
5. **Backends** — выбор бэкенда per-site

### 7.8 Site Icons

SVG-иконки для всех сайтов в `static/shared/icons.js`:

```javascript
window.SiteIcons = {
    _svg: {
        rule34: '...',   // Красный круг с "34"
        danbooru: '...', // Коричневая буква D
        nhentai: '...',  // Розовая молния NHentai
        kemono: '...',   // Оранжевая маска
        coomer: '...',   // Синяя маска
    },
    getIcon(site),           // → data URI
    getIconImg(site, size),  // → <img> элемент
    getIconDataURI(site),    // → data: URI
}
```

Используются в: Admin Backend Selection UI, Franchise Search, ComicsPicker.

### 7.9 Franchise Search

- Страница `/franchise-search` + API `/api/franchise/search`
- Сервер-сайд рендеринг (без отдельного JS модуля)
- Параллельный dispatch: `ThreadPoolExecutor` → `search_tags()` для rule34, danbooru, nhentai
- Результаты с source badge + site icon
- Header link + 6 i18n ключей

---

## 8. Как добавить новый сайт

Если нужно добавить поддержку нового сайта (например, Gelbooru или Sankaku), пошаговая инструкция:

### 8.1 Credentials

Добавить схему ключей в `src/credential_store.py`:

```python
_PER_SITE_SCHEMA = {
    'rule34':   ['uid', 'key'],
    'danbooru': ['login', 'key'],
    'nhentai':  ['key'],
    'newsite':  ['api_key'],    # <-- новый сайт
}
```

Добавить миграцию старых ключей (если были) в `_OLD_KEY_MAP`.

### 8.2 Backend

Добавить методы fetch/search в один из существующих бэкендов или создать новый файл:

```python
# src/backends/api_raw.py
class ApiRawBackend:
    def fetch(self, site, md5, settings):
        if site == 'rule34': ...
        elif site == 'newsite':
            return self._fetch_newsite(md5, settings)
        # ...

    def _fetch_newsite(self, md5, settings):
        c = self._creds('newsite', settings)
        # HTTP-запрос к API нового сайта
        url = f'https://api.newsite.example/posts?md5={md5}&key={c.get("api_key", "")}'
        r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
        # парсинг ответа
        return {'tags': [...], 'file_url': '...', 'preview_url': '...'}
```

### 8.3 Registry

Зарегистрировать в `src/backends/__init__.py`:

```python
_DEFAULT_BACKEND = {
    'rule34':  'api_raw',
    'danbooru':'api_raw',
    'nhentai': 'gallerydl',
    'kemono':  'gallerydl',
    'coomer':  'gallerydl',
    'newsite': 'api_raw',       # <-- новый сайт
}
```

### 8.4 Admin UI

Добавить запись в `static/admin/admin.js`:

```javascript
var sites = [
    {id:'rule34', ...},
    {id:'newsite', nameKey:'siteNewsite', icon:'newsite',
        creds:[{id:'api_key', label:'API Key'}],
        vals:{api_key: (s.credentials?.newsite?.api_key || '')},
        backends:['api_raw','gallerydl']},
    // ...
];
```

Добавить иконку в `static/shared/icons.js`.

### 8.5 i18n

Добавить ключи в `LOCALE` в `web_app.py`:

```python
LOCALE = {
    'en': {
        # ...
        'siteNewsite': 'NewSite',
    },
    'ru': {
        # ...
        'siteNewsite': 'NewSite',
    },
}
```

### 8.6 Сохранение в save_settings

Обновить list сайтов в `save_settings()` (web_app.py):

```python
for site, keys in [('rule34', ['uid', 'key']), ('danbooru', ['login', 'key']),
                   ('nhentai', ['key']), ('newsite', ['api_key'])]:
    # ...
```

### 8.7 API settings

Обновить backward compatibility блок в `api_settings()` при необходимости.

### 8.8 Тестирование

- `venv/bin/python test.py --check func` — проверить что `fetch_tags()` и `search_tags()` не падают
- Ручная проверка: выбрать новый бэкенд в админке → сохранить → проверить fetch и search
- Проверить сохранение и загрузку credentials
- Проверить иконку в UI

---

## Приложение A: Полный список API эндпоинтов для внешних сайтов

| Метод | Роут | Admin | Назначение | Бэкенд |
|-------|------|-------|------------|--------|
| GET | `/api/fetch_file` | + | Получить теги по MD5 | `fetch_tags()` → настроенный бэкенд |
| GET | `/api/nhentai/search` | - | Поиск по NHentai | `search_tags('nhentai')` |
| GET | `/api/franchise/search` | + | Параллельный поиск | `search_tags()` × 3 (R34/Dan/NH) |
| GET | `/api/kemono/mirrors` | + | Зеркала Kemono | `GalleryDlBackend.get_mirrors()` |
| GET | `/api/kemono/info` | + | Метаданные поста | `GalleryDlBackend.get_info()` (CLI) |
| POST | `/api/kemono/download` | + | Скачать пост | `GalleryDlBackend.download()` (CLI) |
| POST | `/api/auto_scan` | + | Пакетное сканирование | `fetch_tags()` для всех файлов без тегов |
| GET | `/api/credential_status` | - | Статус хранилища ключей | `KeyringStore.is_available()` |
| POST | `/api/set_credential_backend` | + | Смена хранилища ключей | KeyringStore ↔ plain |
| GET/POST | `/api/settings` | + (POST) | Чтение/запись настроек | credentials + fetch_backend |

## Приложение B: Сравнение бэкендов

| Характеристика | ApiRawBackend | GalleryDlBackend |
|---------------|---------------|------------------|
| Зависимости | requests | gallery-dl (Python API) |
| Cloudflare | Ограниченная (через requests) | Встроенная поддержка |
| Rule34 | + (прямой API, требует ключи) | + (через gallery-dl, требует ключи) |
| Danbooru | + (прямой API, auth опциональна) | + (через gallery-dl, auth опциональна) |
| NHentai | + (API v2) | + (gallery-dl, дефолтный) |
| Kemono/Coomer | - | + (CLI subprocess) |
| Поиск (search) | Rule34, Danbooru, NHentai | Rule34(прямой HTTP), Danbooru, NHentai |
| Thread-safety | Да (stateless) | Да (threading.Lock) |
| User-Agent | MediaVault/1.0 | gallery-dl дефолтный |

## Приложение C: Ключевые файлы

| Файл | Строк | Что содержит |
|------|-------|-------------|
| `src/backends/__init__.py` | 41 | BACKENDS registry, dispatch функции |
| `src/backends/api_raw.py` | 210 | Прямые HTTP-запросы к API |
| `src/backends/gallerydl.py` | 338 | gallery-dl Python API обёртка |
| `src/credential_store.py` | 122 | KeyringStore, миграция, per-site схема |
| `src/web_app.py` | 3898 | Роуты, dispatch, save/load settings |
| `static/admin/admin.js` | 727 | Admin UI: API Keys, Backends, Folders |
| `static/shared/icons.js` | 30 | SiteIcons: SVG data URI для всех сайтов |
