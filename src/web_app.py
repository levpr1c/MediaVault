#!/usr/bin/env python3
"""
tagfetch web — standalone Flask app for fetching tags from boorus.
Design matches MediaVault (index.html) dark/light theme.
"""

import hashlib, io, json, logging, math, os, re, secrets, shutil, sqlite3, subprocess, sys, time, threading, urllib.parse
from functools import wraps

import requests
from flask import Flask, jsonify, render_template, request, send_file, abort, Response, stream_with_context, redirect, session
from PIL import Image
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import HTTPException

import credential_store
from backends import fetch_tags, get_backend

# ── Логирование ──
LOG = logging.getLogger('mediavault')
_LOG_FORMAT = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
_LOG_SH = logging.StreamHandler(sys.stdout)
_LOG_SH.setFormatter(_LOG_FORMAT)
LOG.addHandler(_LOG_SH)
DEBUG_MODE = False

_ANSI_RESET = '\033[0m'
_ANSI_GREEN = '\033[92m'
_ANSI_RED = '\033[91m'
_ANSI_YELLOW = '\033[93m'
_ANSI_CYAN = '\033[96m'

# Включает подробное логирование для отладки
def _enable_debug_logging():
    global DEBUG_MODE
    DEBUG_MODE = True
    LOG.setLevel(logging.DEBUG)
    LOG.debug('Debug logging enabled')

# Логирует отладочное сообщение (только в режиме DEBUG)
def log_debug(msg, *args):
    if DEBUG_MODE:
        LOG.debug(msg, *args)

def log_debug_green(msg, *args):
    if DEBUG_MODE:
        LOG.debug(_ANSI_GREEN + msg + _ANSI_RESET, *args)

def log_debug_red(msg, *args):
    if DEBUG_MODE:
        LOG.debug(_ANSI_RED + msg + _ANSI_RESET, *args)

# Логирует информационное сообщение
def log_info(msg, *args):
    LOG.info(msg, *args)

def log_info_green(msg, *args):
    LOG.info(_ANSI_GREEN + msg + _ANSI_RESET, *args)

def log_info_red(msg, *args):
    LOG.info(_ANSI_RED + msg + _ANSI_RESET, *args)

def log_info_cyan(msg, *args):
    LOG.info(_ANSI_CYAN + msg + _ANSI_RESET, *args)

def log_info_yellow(msg, *args):
    LOG.info(_ANSI_YELLOW + msg + _ANSI_RESET, *args)

# Логирует сообщение об ошибке
def log_error(msg, *args):
    LOG.error(msg, *args)

def log_warning(msg, *args):
    LOG.warning(msg, *args)

def log_request(method, path, query, status):
    full = path + ('?' + query if query else '')
    if status < 300:
        log_info_green('%s %s → %d', method, full, status)
    elif status < 400:
        log_info_cyan('%s %s → %d', method, full, status)
    elif status < 500:
        log_info_yellow('%s %s → %d', method, full, status)
    else:
        log_info_red('%s %s → %d', method, full, status)

# ── Путь к БД (всегда в скрытой папке) ──

_DB_DIR = os.path.expanduser('~/.local/share/MediaVault')
_DB_PATH = os.path.join(_DB_DIR, 'MediaVaultDataBase.db')

# Создаёт директорию для БД, если её нет
def _ensure_db_dir():
    os.makedirs(_DB_DIR, exist_ok=True)

# Meta tags that should not be counted as fetched tags
META_TAGS = {'sound', 'animated', 'photo', 'video', 'gif'}
ASPECT_RATIO_RE = re.compile(r'^\d+:\d+$')

# Проверяет, есть ли в строке тегов хотя бы один не-мета-тег
# (не photo/video/animated/gif/sound и не соотношение сторон)
def _has_non_meta_tags(tag_str):
    """Return True if tag_str contains any tag not in META_TAGS and not an aspect-ratio auto-tag."""
    return any(
        t.strip() and t.strip() not in META_TAGS and not ASPECT_RATIO_RE.match(t.strip())
        for t in tag_str.split(',')
    )

API_DELAY = 1.0
UA = 'curl/8.20.0'

if getattr(sys, 'frozen', False):
    _basedir = sys._MEIPASS
else:
    _basedir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_DIR = os.path.expanduser('~/.config/MediaVault')
SETTINGS_FILE = os.path.join(SETTINGS_DIR, 'settings.json')

app = Flask(__name__,
    template_folder=os.path.join(_basedir, 'templates'),
    static_folder=os.path.join(_basedir, 'static'),
    static_url_path='/static')
app.secret_key = secrets.token_hex(32)  # overridden from settings on startup

logging.getLogger('werkzeug').setLevel(logging.WARNING)

_credential_store: credential_store.KeyringStore | None = None
_thumb_regen_progress = {'running': False, 'current': 0, 'total': 0, 'skipped': 0, 'mode': ''}
_thumb_regen_cancel = False

def init_credential_store():
    global _credential_store
    _credential_store = credential_store.init_credential_store()
app.permanent_session_lifetime = 86400  # 24h

_has_users_cached = None  # None=unchecked, True/False=has users

def _has_users():
    global _has_users_cached
    if _has_users_cached is None:
        try:
            db = _db_conn()
            row = db.execute('SELECT COUNT(*) FROM users').fetchone()
            _has_users_cached = bool(row and row[0] > 0)
            db.close()
        except Exception:
            return False
    return bool(_has_users_cached)

def _invalidate_users_cache():
    global _has_users_cached
    _has_users_cached = None

# ── i18n ──
LOCALE = {
    'en': {
        'adminSettings': 'Administration & Settings',
        'adminDesc': 'Configure settings and manage access',
        'tfFilterAll': 'All',
        'tfFilterNoTags': 'Untagged',
        'tfFilterFound': 'Found',
        'tfFilterNotFound': 'Not found',
        'tfFilterInDb': 'In DB',
        'tfLocal': 'Local',
        'tfNotFetched': 'Not fetched',
        'tfNoFile': 'No file selected',
        'tfFetchTags': 'Fetch Tags',
        'tfFetchAll': 'Fetch All',
        'tfClearCache': 'Clear cache',
        'tfSaveAll': 'Save All',
        'tfStartAuto': '▶ Start Auto Scan',
        'tfReady': 'Ready',
        'tfSaveEarly': '💾 Save Early',
        'tfScrollOn': '⬇ Scroll: On',
        'tfScanning': 'Scanning cache…',
        'settings': 'Settings',
        'settingsAppearance': 'Appearance',
        'settingsApiCreds': '🔑 API Credentials',
        'settingsMediaPath': 'Media directory',
        'settingsScan': 'Scan Folder',
        'settingsSystemDialog': 'Browse…',
        'settingsDb': '🗄️ Database',
        'settingsSaveStart': '💾 Save & Start',
        'settingsSelectFolder': 'Select folder',
        'settingsCleared': '✅ Cleared',
        'settingsRunning': '⏳ Running…',
        'settingsSkipped': 'skipped',
        'settingsProcessed': 'processed',
        'settingsGenerated': 'generated',
        'settingsFailed': 'failed',
        'settingsCancelling': '⏳ Cancelling…',
        'settingsClearCache': '🗑️ Clear thumbnail cache',
        'settingsRegenThumbnails': '🔄 Regenerate all thumbnails',
        'settingsRegenMissing': '🔧 Generate missing thumbnails',
        'secConfirmClearThumb': '⚠️ Clear ALL cached thumbnails? They will be regenerated on demand.',
        'secConfirmRegenThumb': '⚠️ Regenerate ALL thumbnails now? This may take a while.',
        'secConfirmClearBrowser': '⚠️ Clear browser cache? All clients will reload thumbnails and media on next visit.',
        'secConfirmClearTag': '⚠️ Clear tag cache for all files? Tags will need to be re-fetched.',
        'secConfirmDedup': '⚠️ Deduplicate database? Duplicate file entries will be removed.',
        'secConfirmClearDb': '⚠️ Clear ALL files from database? This will remove all scanned files.',
        'settingsClearBrowserCache': '🧹 Clear browser cache',
        'settingsClearBrowserCacheDesc': 'Increment cache buster — forces browsers to refetch thumbnails and media.',
        'settingsError': '❌ Error',
        'settingsBrowserCache': 'Browser Cache',
        'settingsBrowserCacheDefault': 'Default (24h)',
        'settingsBrowserCacheReduced': 'Reduced (1h)',
        'settingsBrowserCacheNoCache': 'No cache',
        'secPassword': 'Password',
        'secUsername': 'Username',
        'secNewPassword': 'New Password',
        'secPwTooShort': 'Password too short (min 4)',
        'secPwSet': 'Password set',
        'secConfirmClearAll': '⚠️ Delete ALL data? Tags, categories, files, thumbs — everything except users and comics.',
        'secUserReq': 'Username required, password min 4 chars',
        'secRole': 'Role',
        'mvHeader': 'MEDIAVAULT',
        'mvSearchPlaceholder': 'Search...',
        'mvSearchByTag': 'Search by tag',
        'mvToggleSidebar': 'Sidebar',
        'mvPopularTags': 'Popular Tags',
        'mvManageTags': 'Manage',
        'mvCategorized': 'Categories',
        'mvGroupColors': '🎨 Group Colors',
        'mvPageSize': 'Pg:',
        'mvNoFiles': 'No files loaded',
        'mvNoFilesDesc': 'Import a database to get started, or use Tagfetch to fetch tags first',
        'mvBulkAdd': '+ Add',
        'mvCatModalTitle': '🎨 Tag Categories',
        'mvCatModalClose': '✕ Close',
        'mvCatModalNew': 'New category...',
        'mvCatModalAssign': 'Assign tag...',
        'mvCatModalNoTags': 'No tags',
        'mvCatModalNoCats': 'No categories yet',
        'mvCatModalFailed': 'Failed to load',
        'welcome': 'Welcome to MediaVault',
        'welcomeDesc': 'Import a database or use Tagfetch to get started',
        'dbReady': 'Database ready',
        'noFiles': 'No media files found',
        'addTag': 'Add tag...',
        'logout': 'Logout',
        'bulkTag': '➕ Add to files',
        'bulkTagExit': '✕ Exit',
        'selected': '{n} selected',
        'svLoading': 'Loading...',
        'svTapForTags': 'Tap image to show tags',
        'svNoTags': 'No tags yet',
        'home': 'Home',
        'mvGallery': 'Gallery',
        'mvComics': 'Comics',
        'mvDesc': 'Browse and explore your media library',
        'homeSearchFiles': 'Search Files',
        'navMediaVault': 'MediaVault',
        'navSearch': 'Search',
        'navEditor': 'Editor',
        'navAdmin': 'Admin',
        'navGroups': 'Groups',
        'contentSearch': 'Content Search',
        'contentSearchPlaceholder': 'Search all sites by tag…',
        'contentSearchBtn': 'Search',
        'contentSearchNoResults': 'No results found',
        'contentSearchError': 'Search failed',
        'contentSearchLoadMore': 'Load More',
        'contentSearchSelectSource': 'Select at least one source',
        'contentSearchAiFilter': 'Hide AI',
        'contentSearchStorageEmpty': 'Storage appears empty — your drive may not be mounted',
        'contentSearchDownload': 'Download from {site}',
        'contentSearchPages': 'pages',
        'contentSearchViewComics': 'View Comics',
        'contentSearchNhWarning': 'NHentai API key is not configured — search may fail.',
        'settingsDownloadsDir': 'Downloads folder',
        'settingsCreateFolders': 'Create folders',
        'settingsCreateFoldersDone': 'Folders created',
        'settingsFoldersExist': 'Already exist',
        'settingsMountOk': 'Storage is ready',
        'settingsMountFail': 'Storage is empty or not mounted',
        # ── Home page ──
        'cmHeader': 'CONTENT MANAGEMENT',
        'cmDesc': 'Manage tags, categories, and comics',
        'autoFetch': 'Auto',
        'manualFetch': 'Manual',
        'comicsEditor': 'Comics Editor',
        'comicsTags': 'Comics Tags',
        'cmSectionTagfetch': 'TAGFETCH',
        'cmSectionTags': 'TAGS',
        'cmSectionComics': 'COMICS',
        'cmSectionSearch': 'SEARCH',
        'tags': 'TAGS',

        'sortByName': 'By name',
        'sortByNewest': 'Newest',
        'sortByOldest': 'Oldest',
        'sortByNameTitle': 'Sort by name',
        'previewComic': 'Preview',
        'createComic': 'Create comic',
        'showPreview': 'Show preview',
        'openInViewer': 'Open in viewer',
        'unsavedConfirm': 'You have unsaved changes. Continue?',
        'cancel': 'Cancel',
        'comicNamePlaceholder': 'Comic title',
        'searchFiles': 'Search files…',
        'searchComics': 'Search comics…',
        'switchViewMode': 'Switch view mode',
        'prevPage': 'Previous',
        'nextPage': 'Next',
        'delete': 'Delete',
        'comicPagesLabel': 'Pages',
        'save': 'Save',
        'filesCountShort': '{n} files',
        'mediaDirEmpty': 'Media directory is empty',
        'secLoginTitle': '🔐 MediaVault',
        'secLoginDesc': 'Sign in to your account',
        'secSignIn': 'Sign In',
        # ── Account page ──
        'accountSettings': 'Account Settings',
        'accountChangeUsername': 'Change Username',
        'effectsTitle': 'Visual Effects',
        'effectsDescription': 'Blur, animations and transitions',
        'effectsOn': 'Effects ON',
        'effectsOff': 'Effects OFF',
        'accountCurrentPassword': 'Current Password',
        'accountConfirmPassword': 'Confirm Password',
        # ── Admin panel ──
        'adminPanel': 'Admin Panel',
        'navUsers': 'Users',
        'navDatabase': 'Database',
        'navApiKeys': 'API Keys',
        'navTags': 'Tags',
        'navFiles': 'Files',
        'tagsManage': 'Tags Manage',
        'tagsGroup': 'Tags Groups',
        'userAddBtn': 'Add User',
        'userSetPasswordBtn': 'Set Password',
        'userRoleAdmin': 'Admin',
        'userRoleUser': 'User',
        'noUsers': 'No users yet',
        'you': 'you',
        'actions': 'Actions',
        'lastAdminWarning': 'Cannot delete the last admin',
        'sectionCredential': 'Credential Backend',
        'sectionDatabase': 'Database Tools',
        'credBackendDesc': 'Where API keys are stored',
        'credStatus': 'Active backend',
        'credKeyring': 'Keyring',
        'secKeyring': 'Stored in GNOME Keyring',
        'credPlainText': 'Plain Text',
        'secPlainText': 'Stored in settings file',
        'adminGalleryDir': 'Gallery folder',
        'adminComicsDir': 'Comics folder',
        'sectionFolders': 'Folder Settings',
        'backendApiRaw': 'API Raw',
        'backendGallerydl': 'Gallery-DL (universal)',
        'siteRule34': 'Rule34',
        'siteDanbooru': 'Danbooru',
        'siteNhentai': 'NHentai',
        'siteKemono': 'Kemono',
        'siteCoomer': 'Coomer',
        'categoryNewName': 'New category name',
        'tagBulkDeleteConfirm': 'Delete all categories and tags?',
        'toAllMedia': 'to all media',
        # ── Unique keys from removed duplicate block ──
        'loading': 'Loading…',
        'loadingError': 'Loading error',
        'tagSearchPlaceholder': 'Search tags…',
        'tagBulkDelete': 'Delete selected',
        'alreadyExists': 'Already exists',
        'addCategory': 'Add Category',
        'comicCreated': 'Comic created',
        'confirmDelete': 'Confirm delete?',
        'added': 'Added',
        'deleted': 'Deleted',
        'updated': 'Updated',
        'created': 'Created',
        'comicsEmpty': 'No comics yet',
        'comicsName': 'Name',
        'langToggle': 'Switch language',
        'sortToggle': 'Toggle sort',
        'themeToggle': 'Switch theme',
        'uncategorized': 'Uncategorized',
        # ── Settings page ──
        'exportDb': 'Export DB',
        'dbImport': 'Import DB',
        'cleanThumbCache': 'Clean Thumbnail Cache',
        'regenAllThumbs': 'Regenerate All Thumbnails',
        'genMissingThumbs': 'Generate Missing',
        'settingsCleanDuplicates': 'Clean Duplicates',
        'settingsCleanTagCache': 'Clean Tag Cache',
        'settingsCleanDb': 'Clean Database',
        'settingsCleanAll': 'Clean All',
        'similarTo': 'Similar to',
        'similarBtn': 'Similar',
        'allFiles': 'All files',
        'noResults': 'No results',
    },
    'ru': {
        'adminSettings': 'Администрирование и настройки',
        'adminDesc': 'Настройки и управление доступом',
        'tfFilterAll': 'Все',
        'tfFilterNoTags': 'Без тегов',
        'tfFilterFound': 'Найдено',
        'tfFilterNotFound': 'Не найдено',
        'tfFilterInDb': 'В БД',
        'tfLocal': 'Локальный',
        'tfNotFetched': 'Не получено',
        'tfNoFile': 'Файл не выбран',
        'tfFetchTags': 'Получить теги',
        'tfFetchAll': 'Получить всё',
        'tfClearCache': 'Очистить кэш',
        'tfSaveAll': 'Сохранить всё',
        'tfStartAuto': '▶ Начать автосканирование',
        'tfReady': 'Готов',
        'tfSaveEarly': '💾 Сохранить досрочно',
        'tfScrollOn': '⬇ Прокрутка: Вкл',
        'tfScanning': 'Сканирование кэша…',
        'settings': 'Настройки',
        'settingsAppearance': 'Внешний вид',
        'settingsApiCreds': '🔑 API доступа',
        'settingsMediaPath': '/путь/к/медиа',
        'settingsScan': 'Сканировать папку',
        'settingsSystemDialog': '🖥️ Системный диалог',
        'settingsDb': '🗄️ База данных',
        'settingsSaveStart': '💾 Сохранить',
        'settingsSelectFolder': 'Выбор папки',
        'settingsCleared': '✅ Очищено',
        'settingsRunning': '⏳ Выполняется…',
        'settingsSkipped': 'пропущено',
        'settingsProcessed': 'обработано',
        'settingsGenerated': 'сгенерировано',
        'settingsFailed': 'ошибок',
        'settingsCancelling': '⏳ Отмена…',
        'settingsClearCache': '🗑️ Очистить кэш превью',
        'settingsRegenThumbnails': '🔄 Перегенерировать все превью',
        'settingsRegenMissing': '🔧 Сгенерировать недостающие',
        'secConfirmClearThumb': '⚠️ Очистить ВСЕ кэшированные превью? Они будут перегенерированы при просмотре.',
        'secConfirmRegenThumb': '⚠️ Перегенерировать ВСЕ превью сейчас? Это может занять некоторое время.',
        'secConfirmClearBrowser': '⚠️ Сбросить кэш браузера? Все клиенты перезагрузят превью и медиа при следующем визите.',
        'secConfirmClearTag': '⚠️ Очистить кэш тегов для всех файлов? Теги нужно будет получить заново.',
        'secConfirmDedup': '⚠️ Дедуплицировать базу данных? Дублирующиеся записи будут удалены.',
        'secConfirmClearDb': '⚠️ Удалить ВСЕ файлы из базы данных? Все отсканированные файлы будут удалены.',
        'settingsClearBrowserCache': '🧹 Сбросить кэш браузера',
        'settingsClearBrowserCacheDesc': 'Инкрементировать cache buster — браузеры перезапросят превью и медиафайлы.',
        'settingsError': '❌ Ошибка',
        'settingsBrowserCache': 'Кеш браузера',
        'settingsBrowserCacheDefault': 'По умолчанию (24ч)',
        'settingsBrowserCacheReduced': 'Уменьшенный (1ч)',
        'settingsBrowserCacheNoCache': 'Без кеша',
        'secNewPassword': 'Новый пароль',
        'secPwTooShort': 'Пароль слишком короткий (мин. 4)',
        'secPwSet': 'Пароль установлен',
        'secConfirmClearAll': '⚠️ Удалить ВСЁ? Теги, категории, файлы, превью — всё кроме пользователей и комиксов.',
        'secUserReq': 'Имя пользователя обязательно, пароль мин. 4 символа',
        'secRole': 'Роль',
        'mvHeader': 'MEDIAVAULT',
        'mvSearchPlaceholder': 'Поиск...',
        'mvSearchByTag': 'Поиск по тегу',
        'mvToggleSidebar': 'Сайдбар',
        'mvPopularTags': 'Популярные теги',
        'mvManageTags': 'Управление',
        'mvCategorized': 'Категории',
        'mvGroupColors': '🎨 Цвет групп',
        'mvPageSize': 'Стр:',
        'mvNoFiles': 'Файлы не загружены',
        'mvNoFilesDesc': 'Импортируйте БД или используйте Tagfetch для получения тегов',
        'mvBulkAdd': '+ Добавить',
        'mvCatModalTitle': '🎨 Категории тегов',
        'mvCatModalClose': '✕ Закрыть',
        'mvCatModalNew': 'Новая категория...',
        'mvCatModalAssign': 'Назначить тег...',
        'mvCatModalNoTags': 'Нет тегов',
        'mvCatModalNoCats': 'Пока нет категорий',
        'mvCatModalFailed': 'Ошибка загрузки категорий',
        'welcome': 'Добро пожаловать в MediaVault',
        'welcomeDesc': 'Импортируйте базу данных или используйте Tagfetch',
        'dbReady': 'База данных готова',
        'noFiles': 'Файлы не найдены',
        'addTag': 'Добавить тег...',
        'logout': 'Выйти',
        'bulkTag': '➕ Добавить к файлам',
        'bulkTagExit': '✕ Выйти',
        'selected': 'Выбрано: {n}',
        'cancel': 'Отмена',
        'svLoading': 'Загрузка...',
        'svTapForTags': 'Нажми на фото чтобы показать теги',
        'svNoTags': 'Тегов пока нет',
        'home': 'Главная',
        'mvGallery': 'Галерея',
        'mvComics': 'Комиксы',
        'mvDesc': 'Просмотр и управление медиатекой',
        'homeSearchFiles': 'Поиск файлов',
        'navMediaVault': 'MediaVault',
        'navSearch': 'Поиск',
        'navEditor': 'Редактор',
        'navAdmin': 'Админ',
        'navGroups': 'Группы',
        'contentSearch': 'Поиск контента',
        'contentSearchPlaceholder': 'Поиск на всех сайтах по тегу…',
        'contentSearchBtn': 'Найти',
        'contentSearchNoResults': 'Ничего не найдено',
        'contentSearchError': 'Ошибка поиска',
        'contentSearchLoadMore': 'Загрузить ещё',
        'contentSearchSelectSource': 'Выберите хотя бы один источник',
        'contentSearchAiFilter': 'Без AI',
        'contentSearchStorageEmpty': 'Хранилище пустое — возможно, накопитель не подключён',
        'contentSearchDownload': 'Скачать с {site}',
        'contentSearchPages': 'страниц',
        'contentSearchViewComics': 'Открыть комикс',
        'contentSearchNhWarning': 'API-ключ NHentai не настроен — поиск может не работать.',
        'settingsDownloadsDir': 'Папка загрузок',
        'settingsCreateFolders': 'Создать папки',
        'settingsCreateFoldersDone': 'Папки созданы',
        'settingsFoldersExist': 'Уже существуют',
        'settingsMountOk': 'Накопитель в порядке',
        'settingsMountFail': 'Накопитель не подключён или пуст',
        # ── Home page ──
        'cmHeader': 'УПРАВЛЕНИЕ КОНТЕНТОМ',
        'cmDesc': 'Управление тегами, категориями и комиксами',
        'autoFetch': 'Авто',
        'manualFetch': 'Ручной',
        'comicsEditor': 'Редактор Комиксов',
        'comicsTags': 'Теги комиксов',
        'cmSectionTagfetch': 'ПОИСК ТЕГОВ',
        'cmSectionTags': 'ТЕГИ',
        'cmSectionComics': 'КОМИКСЫ',
        'cmSectionSearch': 'ПОИСК',
        'tags': 'ТЕГИ',
        'sortByName': 'По имени',
        'sortByNewest': 'Сначала новые',
        'sortByOldest': 'Сначала старые',
        'sortByNameTitle': 'Сортировать по имени',
        'previewComic': 'Предпросмотр',
        'createComic': 'Создать комикс',
        'showPreview': 'Показать',
        'openInViewer': 'Открыть в просмотрщике',
        'unsavedConfirm': 'У вас есть несохранённые изменения. Продолжить?',
        'comicNamePlaceholder': 'Название комикса',
        'searchFiles': 'Поиск файлов…',
        'searchComics': 'Поиск комиксов…',
        'switchViewMode': 'Переключить режим',
        'prevPage': 'Предыдущая',
        'nextPage': 'Следующая',
        'delete': 'Удалить',
        'comicPagesLabel': 'Страницы',
        'save': 'Сохранить',
        'filesCountShort': '{n} файлов',
        'mediaDirEmpty': 'Папка с медиа пуста: {path}. Возможно, хранилище недоступно.',
        'secLoginTitle': '🔐 MediaVault',
        'secLoginDesc': 'Войдите в аккаунт',
        'secSignIn': 'Войти',
        'secUsername': 'Имя пользователя',
        'secPassword': 'Пароль',
        # ── Account page ──
        'accountSettings': 'Настройки аккаунта',
        'accountChangeUsername': 'Сменить имя',
        'effectsTitle': 'Визуальные эффекты',
        'effectsDescription': 'Размытие, анимации и переходы',
        'effectsOn': 'Эффекты ВКЛ',
        'effectsOff': 'Эффекты ВЫКЛ',
        'accountCurrentPassword': 'Текущий пароль',
        'accountConfirmPassword': 'Подтвердите пароль',
        # ── Admin panel ──
        'adminPanel': 'Панель управления',
        'navUsers': 'Пользователи',
        'navDatabase': 'База данных',
        'navApiKeys': 'API ключи',
        'navTags': 'Теги',
        'navFiles': 'Файлы',
        'tagsManage': 'Управление тегами',
        'tagsGroup': 'Группы тегов',
        'userAddBtn': 'Добавить',
        'userSetPasswordBtn': 'Сменить пароль',
        'userRoleAdmin': 'Админ',
        'userRoleUser': 'Пользователь',
        'noUsers': 'Нет пользователей',
        'you': 'вы',
        'actions': 'Действия',
        'lastAdminWarning': 'Нельзя удалить последнего админа',
        'sectionCredential': 'Хранилище ключей',
        'sectionDatabase': 'Инструменты БД',
        'credBackendDesc': 'Где хранятся API ключи',
        'credStatus': 'Активный бэкенд',
        'credKeyring': 'Связка ключей',
        'secKeyring': 'Хранится в GNOME Keyring',
        'credPlainText': 'Обычный текст',
        'secPlainText': 'Хранится в файле настроек',
        'adminGalleryDir': 'Папка галереи',
        'adminComicsDir': 'Папка комиксов',
        'sectionFolders': 'Настройки папок',
        'backendApiRaw': 'API Raw',
        'backendGallerydl': 'Gallery-DL (универсальный)',
        'siteRule34': 'Rule34',
        'siteDanbooru': 'Danbooru',
        'siteNhentai': 'NHentai',
        'siteKemono': 'Kemono',
        'siteCoomer': 'Coomer',
        'toAllMedia': 'ко всем медиа',
        'dbImport': 'Импорт БД',
        'loading': 'Загрузка…',
        'loadingError': 'Ошибка загрузки',
        'alreadyExists': 'Уже существует',
        'addCategory': 'Добавить категорию',
        'tagSearchPlaceholder': 'Поиск тегов…',
        'categoryNewName': 'Новое имя категории',
        'tagBulkDelete': 'Удалить выбранные',
        'tagBulkDeleteConfirm': 'Удалить все категории и теги?',
        'confirmDelete': 'Подтвердить удаление?',
        'comicCreated': 'Комикс создан',
        'added': 'Добавлен',
        'deleted': 'Удалён',
        'updated': 'Обновлён',
        'created': 'Создан',
        'comicsEmpty': 'Комиксов пока нет',
        'comicsName': 'Название',
        'langToggle': 'Сменить язык',
        'sortToggle': 'Сменить сортировку',
        'themeToggle': 'Сменить тему',
        'uncategorized': 'Без категории',
        # ── Settings page ──
        'exportDb': 'Экспорт БД',
        'dbImport': 'Импорт БД',
        'cleanThumbCache': 'Очистить кэш превью',
        'regenAllThumbs': 'Перегенерировать все превью',
        'genMissingThumbs': 'Сгенерировать недостающие',
        'settingsCleanDuplicates': 'Очистить дубликаты',
        'settingsCleanTagCache': 'Очистить кэш тегов',
        'settingsCleanDb': 'Очистить БД',
        'settingsCleanAll': 'Очистить всё',
        'similarTo': 'Похоже на',
        'similarBtn': 'Похожие',
        'allFiles': 'Все файлы',
        'noResults': 'Нет результатов',
    },
}

# Добавляет функцию _() в шаблоны для интернационализации
@app.context_processor
def inject_i18n():
    def _(key):
        lang = request.cookies.get('mediavault_lang', 'en')
        return LOCALE.get(lang, {}).get(key, LOCALE['en'].get(key, key))
    return dict(_=_)

@app.context_processor
def inject_media_vars():
    s = load_settings()
    md = s.get('media_dir', '')
    media_dir_exists = bool(md) and os.path.isdir(md)
    media_dir_empty = media_dir_exists and _is_dir_empty(md)
    lang = request.cookies.get('mediavault_lang', 'en')
    return dict(media_dir_exists=media_dir_exists, media_dir_empty=media_dir_empty, lang=lang)

# Возвращает язык из cookie запроса
def get_lang():
    return request.cookies.get('mediavault_lang', 'en')

# ── Вспомогательные функции ──

# Вычисляет MD5-хеш файла
def compute_md5(filepath):
    h = hashlib.md5()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()

# Извлекает MD5 из имени файла (первые 32 шестнадцатеричных символа)
def _md5_from_filename(filename):
    """Extract MD5 hash from filename if it starts with a 32-char hex string."""
    import re
    m = re.match(r'^([0-9a-fA-F]{32})', filename)
    return m.group(1).lower() if m else None

# ── Работа с БД ──

# Открывает соединение с БД (создаёт папку при необходимости)
def _db_conn():
    """Open connection to the fixed DB, creating dir if needed."""
    _ensure_db_dir()
    conn = sqlite3.connect(_DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA busy_timeout=5000')
    return conn

# Объединяет существующие теги с новыми, удаляя дубликаты
def merge_tags(existing, new):
    parts = {t.strip() for t in existing.split(',') if t.strip()}
    for t in new:
        parts.add(t.strip())
    return ','.join(sorted(parts))

# Ищет файл в БД по относительному пути (несколько вариантов совпадения)
def find_file_in_db(file_rel_path):
    if not os.path.exists(_DB_PATH):
        return None
    try:
        db = _db_conn()
        attempts = [
            file_rel_path,
            '/' + file_rel_path,
            file_rel_path.lstrip('/'),
        ]
        if settings.get('media_dir'):
            md = settings['media_dir'].rstrip('/')
            child = os.path.basename(md)
            if child:
                attempts.append(child + '/' + file_rel_path.lstrip('/'))
        attempts.append(os.path.basename(file_rel_path))
        row = None
        for a in attempts:
            row = db.execute('SELECT path, name, tags, type FROM files WHERE path = ?', [a]).fetchone()
            if row:
                break
        db.close()
        if row:
            return {'path': row[0], 'name': row[1], 'tags': row[2] or '', 'type': row[3]}
    except Exception:
        pass
    return None

# ── Настройки ──

def load_settings():
    try:
        with open(SETTINGS_FILE) as f:
            s = json.load(f)
    except Exception:
        s = {'media_dir': '', 'theme': 'dark', 'effects': True, 'three_bg': True, 'cache_buster': 0, 'startup_scan_count': 0, 'startup_scan_dir': '', 'fetch_backend': {}, 'browser_cache': 'default', 'gallery_dir': 'Gallery', 'comics_dir': 'Comics', 'downloads_dir': 'Downloads'}
    # migrate old flat keys → per-site credentials + replenish from keyring
    s = credential_store.migrate_old_keys(_credential_store, s)
    s.setdefault('fetch_backend', {})
    s.setdefault('browser_cache', 'default')
    s.setdefault('three_bg', True)
    s.setdefault('gallery_dir', 'Gallery')
    s.setdefault('comics_dir', 'Comics')
    s.setdefault('downloads_dir', 'Downloads')
    return s

def save_settings(s):
    global _has_users_cached
    _has_users_cached = None
    cred = s.get('credentials', {})
    if _credential_store:
        _credential_store.delete('api:r34_uid')
        _credential_store.delete('api:r34_key')
        _credential_store.delete('api:dan_login')
        _credential_store.delete('api:dan_key')
        _credential_store.delete('api:nh_key')
        for site, keys in [('rule34', ['uid', 'key']), ('danbooru', ['login', 'key']), ('nhentai', ['key'])]:
            site_cred = cred.get(site, {})
            for k in keys:
                val = site_cred.get(k, '')
                if val:
                    _credential_store.set(f'api:{site}:{k}', val)
                else:
                    _credential_store.delete(f'api:{site}:{k}')
    # remove any leftover flat keys
    for k in ('r34_uid', 'r34_key', 'dan_login', 'dan_key', 'nh_key'):
        s.pop(k, None)
    os.makedirs(SETTINGS_DIR, exist_ok=True)
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(s, f, indent=2)
    try:
        os.chmod(SETTINGS_FILE, 0o600)
    except OSError:
        pass

def _cache_control_header():
    mode = settings.get('browser_cache', 'default')
    if mode == 'nocache':
        return 'no-cache'
    if mode == 'reduced':
        return 'public, max-age=3600'
    return 'public, max-age=86400, immutable'

# ── Безопасность путей ──

# Нормализует путь: разрешает симлинки, приводит к абсолютному
def _norm_path(path):
    """Resolve symlinks and normalize path components."""
    return os.path.abspath(os.path.realpath(path))

# Безопасно резолвит путь к файлу: абсолютный напрямую, относительный через media_dir
def _safe_media_path(requested_path):
    """Resolve a path (relative or absolute) to an existing file.
    When media_dir is set, resolve relative paths against it.
    Tries progressively shorter prefixes of requested_path (in case media_dir
    already overlaps with path components stored in the DB)."""
    if os.path.isabs(requested_path):
        c = os.path.realpath(requested_path)
        if os.path.exists(c):
            return c
    md = settings.get('media_dir', '')
    if md:
        md_real = _norm_path(md)
        parts = requested_path.replace('\\', '/').split('/')
        for i in range(len(parts) + 1):
            suffix = '/'.join(parts[i:])
            if not suffix:
                continue
            candidate = _norm_path(os.path.join(md_real, suffix))
            if os.path.exists(candidate) and candidate.startswith(md_real.rstrip('/') + '/'):
                return candidate
        return None
    c = _norm_path(requested_path)
    return c if os.path.exists(c) else None

# ── Кэш превью (BLOB в БД) ──

_THUMB_LARGE = 360            # normal aspect ratio thumbnails
_THUMB_XL = 600               # extra large for panoramic / very tall images
_THUMB_RATIO_LIMIT = 21 / 9   # images beyond this ratio get cropped to 21:9 and XL size

# Генерирует AVIF-превью: для изображений через Pillow, для видео через ffmpeg
def _make_thumbnail_bytes(filepath):
    """Generate thumbnail bytes. Returns AVIF bytes or None."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext in _VIDEO_EXTS:
        try:
            import subprocess, tempfile
            t0 = time.time()
            fd, tmp = tempfile.mkstemp(suffix='.avif')
            os.close(fd)
            env = {**os.environ, 'FONTCONFIG_PATH': '/etc/fonts'}
            r = subprocess.run(
                ['ffmpeg', '-y', '-i', filepath, '-vframes', '1', '-vf',
                 'scale=%d:-1' % _THUMB_LARGE, '-c:v', 'libsvtav1',
                 '-preset', '10', '-crf', '30', tmp],
                capture_output=True, timeout=30, env=env)
            elapsed = time.time() - t0
            stderr = r.stderr.decode('utf-8', errors='replace') if r.stderr else ''
            # Extract resolution from ffmpeg output
            res_match = re.search(r'Stream.*Video.* (\d+)x(\d+)', stderr)
            vid_res = 'x'.join(res_match.groups()) if res_match else '?'
            with open(tmp, 'rb') as f:
                data = f.read()
            os.unlink(tmp)
            if data:
                log_debug('_make_thumbnail VIDEO  path=%s res=%s thumb=%d time=%.2fs', filepath, vid_res, len(data), elapsed)
                return data
            log_debug('_make_thumbnail VIDEO EMPTY  path=%s res=%s time=%.2fs', filepath, vid_res, elapsed)
        except subprocess.TimeoutExpired:
            log_debug('_make_thumbnail VIDEO TIMEOUT  path=%s', filepath)
        except Exception as e:
            log_debug('_make_thumbnail VIDEO ERROR  path=%s: %s', filepath, e)
        return None
    try:
        t0 = time.time()
        img = Image.open(filepath)
        w, h = img.size
        orig_res = '%dx%d' % (w, h)
        if w > 0 and h > 0:
            hw = h / w
            wh = w / h
            if hw > _THUMB_RATIO_LIMIT:
                new_h = int(w * _THUMB_RATIO_LIMIT)
                img = img.crop((0, (h - new_h) // 2, w, (h - new_h) // 2 + new_h))
                h = new_h
                max_size = _THUMB_XL
            elif wh > _THUMB_RATIO_LIMIT:
                new_w = int(h * _THUMB_RATIO_LIMIT)
                img = img.crop(((w - new_w) // 2, 0, (w - new_w) // 2 + new_w, h))
                w = new_w
                max_size = _THUMB_XL
            else:
                max_size = _THUMB_LARGE
        quality = 95 if max_size == _THUMB_XL else 85
        img.thumbnail((max_size, max_size), Image.LANCZOS)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        buf = io.BytesIO()
        img.save(buf, 'AVIF', quality=quality)
        data = buf.getvalue()
        elapsed = time.time() - t0
        log_debug('_make_thumbnail IMAGE  path=%s orig=%s thumb=%d max=%d q=%d time=%.2fs', filepath, orig_res, len(data), max_size, quality, elapsed)
        return data
    except Exception as e:
        log_debug('_make_thumbnail IMAGE ERROR  path=%s: %s', filepath, e)
        return None

# Возвращает превью файла — из кэша БД или свежесгенерированное
def _get_thumbnail(filepath):
    """Get thumbnail bytes for a file — from DB cache or freshly generated."""
    if not filepath or not os.path.exists(filepath):
        log_debug('_get_thumbnail: path missing or not exists: %s', filepath)
        return None
    h = hashlib.md5(filepath.encode('utf-8')).hexdigest()
    file_mtime = int(os.path.getmtime(filepath))
    fsize = os.path.getsize(filepath)
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            row = db.execute(
                'SELECT data, mtime FROM thumbnail_cache WHERE path = ?',
                [h]
            ).fetchone()
            if row and row[1] == file_mtime:
                db.close()
                log_debug('_get_thumbnail CACHE HIT  path=%s size=%d thumb_bytes=%d', filepath, fsize, len(row[0]))
                return row[0]
            db.close()
            if row:
                log_debug('_get_thumbnail CACHE STALE path=%s (mtime changed: cached=%d current=%d)', filepath, row[1], file_mtime)
            else:
                log_debug('_get_thumbnail CACHE MISS  path=%s size=%d', filepath, fsize)
        except Exception as e:
            log_debug('_get_thumbnail cache read error path=%s: %s', filepath, e)
    t0 = time.time()
    data = _make_thumbnail_bytes(filepath)
    elapsed = time.time() - t0
    if data:
        log_debug('_get_thumbnail GENERATED  path=%s size=%d thumb_bytes=%d time=%.2fs', filepath, fsize, len(data), elapsed)
        try:
            db = _db_conn()
            _ensure_db_schema()
            db.execute(
                'INSERT OR REPLACE INTO thumbnail_cache (path, data, mtime) VALUES (?, ?, ?)',
                [h, sqlite3.Binary(data), file_mtime]
            )
            db.commit()
            db.close()
            log_debug('_get_thumbnail SAVED TO DB  path=%s thumb_bytes=%d', filepath, len(data))
        except Exception as e:
            log_debug('_get_thumbnail db write error path=%s: %s', filepath, e)
    else:
        log_debug('_get_thumbnail FAILED  path=%s size=%d', filepath, fsize)
    return data

def _regen_all_thumbnails():
    global _thumb_regen_progress, _thumb_regen_cancel
    try:
        s = load_settings()
        media_dir = s.get('media_dir', '')
        db = _db_conn()
        db.execute('DELETE FROM thumbnail_cache')
        db.commit()
        files = db.execute('SELECT path FROM files WHERE type IN ("image", "video")').fetchall()
        db.close()
        total = len(files)
        generated = 0
        skipped = 0
        failed = 0
        _thumb_regen_progress = {'running': True, 'current': 0, 'total': total, 'skipped': 0, 'mode': 'all'}
        _thumb_regen_cancel = False
        log_info('_regen_all_thumbnails: regenerating %d thumbnails', total)
        for i, row in enumerate(files):
            if _thumb_regen_cancel:
                log_info('_regen_all_thumbnails: cancelled at %d/%d', i, total)
                break
            full = os.path.join(media_dir, row[0]) if media_dir else row[0]
            t0 = time.time()
            if os.path.exists(full):
                try:
                    data = _get_thumbnail(full)
                    elapsed = time.time() - t0
                    if data:
                        generated += 1
                        log_debug_green('_regen_all_thumbnails [%d/%d] GENERATED (%.2fs) %s', i + 1, total, elapsed, row[0])
                    else:
                        failed += 1
                        log_debug_red('_regen_all_thumbnails [%d/%d] FAILED (%.2fs) %s', i + 1, total, elapsed, row[0])
                except Exception as e:
                    elapsed = time.time() - t0
                    failed += 1
                    log_debug_red('_regen_all_thumbnails [%d/%d] ERROR (%.2fs) %s: %s', i + 1, total, elapsed, row[0], e)
            else:
                elapsed = time.time() - t0
                skipped += 1
                log_debug('_regen_all_thumbnails [%d/%d] SKIP (not found) (%.2fs) %s', i + 1, total, elapsed, row[0])
            _thumb_regen_progress['current'] = i + 1
            _thumb_regen_progress['skipped'] = skipped
        log_info('_regen_all_thumbnails: %d generated, %d skipped, %d failed / %d total', generated, skipped, failed, total)
    except Exception as e:
        log_error('_regen_all_thumbnails error: %s', e)
    finally:
        _thumb_regen_progress['running'] = False
        _thumb_regen_cancel = False

# ── Помощники категорий тегов ──

_COMMON_META_TAGS = [
    'photo', 'video', 'gif', 'animated', 'sound',
    'ratio:1:1', 'ratio:3:2', 'ratio:4:3', 'ratio:5:4', 'ratio:16:9',
    'ratio:16:10', 'ratio:21:9', 'ratio:32:9', 'ratio:9:16',
]

# Создаёт категории из Danbooru-ответа (artist, character, copyright, meta, general)
def _ensure_categories(dan_result):
    if not dan_result:
        return
    db = _db_conn()
    cats = {
        'tag_artist': 'artist',
        'tag_character': 'character',
        'tag_copyright': 'copyright',
        'tag_meta': 'meta',
        'tag_general': 'general',
    }
    cat_colors = {
        'artist': '#ff4444',
        'character': '#44cc44',
        'copyright': '#4488ff',
        'meta': '#999999',
        'general': '#cccccc',
    }
    for field, cat_name in cats.items():
        tags = dan_result.get(field, [])
        if not tags:
            continue
        db.execute("INSERT OR IGNORE INTO tag_categories (name, color) VALUES (?, ?)", [cat_name, cat_colors[cat_name]])
        for tag in tags:
            db.execute("""
                INSERT INTO tag_category_members (tag_name, category, source, last_updated)
                VALUES (?, ?, 'danbooru', ?)
                ON CONFLICT(tag_name) DO UPDATE SET
                    category = excluded.category,
                    source = 'danbooru',
                    last_updated = excluded.last_updated
            """, [tag, cat_name, int(time.time())])
    _ensure_common_meta(db)
    db.commit()
    db.close()

# Добавляет категорию 'meta' и заполняет её типовыми мета-тегами
def _ensure_common_meta(db):
    db.execute("INSERT OR IGNORE INTO tag_categories (name, color) VALUES ('meta', '#999999')")
    meta_exists = db.execute("SELECT color FROM tag_categories WHERE name = 'meta'").fetchone()
    if not meta_exists:
        db.execute("INSERT INTO tag_categories (name, color) VALUES ('meta', '#999999')")
    for tag in _COMMON_META_TAGS:
        db.execute("INSERT OR IGNORE INTO tag_category_members (tag_name, category, source, last_updated) VALUES (?, ?, 'auto', ?)", [tag, 'meta', int(time.time())])

# Эвристика категорий для тегов Rule34 — префиксы с двоеточием
_R34_CAT_PREFIXES = {
    'artist': 'artist',
    'character': 'character',
    'series': 'copyright',
    'copyright': 'copyright',
    'meta': 'meta',
}

# Определяет категорию тега Rule34: сначала БД, затем эвристика по префиксу
def _categorize_r34_tag(tag):
    """Determine category for an R34 tag: check DB membership first, then heuristic prefix."""
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            row = db.execute(
                "SELECT category FROM tag_category_members WHERE tag_name = ?", [tag]
            ).fetchone()
            db.close()
            if row:
                return row[0]
        except Exception:
            pass
    if ':' in tag:
        prefix = tag.split(':', 1)[0].lower()
        if prefix in _R34_CAT_PREFIXES:
            return _R34_CAT_PREFIXES[prefix]
    return 'general'

# Создаёт категории для тегов Rule34 (перекрёстная ссылка на Danbooru или эвристика)
def _ensure_r34_categories(r34_tags):
    """Insert R34 tags into tag_category_members with cross-referenced or heuristic categories.
    All tags get categorized: known prefixes use their category, flat tags go to 'general'."""
    if not r34_tags:
        return
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        _ensure_common_meta(db)
        for tag in r34_tags:
            cat = _categorize_r34_tag(tag)
            db.execute("INSERT OR IGNORE INTO tag_categories (name, color) VALUES (?, ?)", [cat, {'artist':'#ff4444','character':'#44cc44','copyright':'#4488ff','general':'#cccccc','meta':'#999999'}.get(cat, '#cccccc')])
            db.execute("""
                INSERT INTO tag_category_members (tag_name, category, source, last_updated)
                VALUES (?, ?, 'rule34', ?)
                ON CONFLICT(tag_name) DO UPDATE SET
                    category = excluded.category,
                    source = 'rule34',
                    last_updated = excluded.last_updated
            """, [tag, cat, int(time.time())])
        db.commit()
        db.close()
    except Exception:
        pass

# ── Автосканирование ──

# Создаёт таблицу auto_scan, если её нет
def _ensure_auto_scan_table():
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        db.execute('CREATE TABLE IF NOT EXISTS auto_scan (path TEXT PRIMARY KEY, scanned_at INTEGER NOT NULL)')
        db.commit()
        db.close()
    except Exception:
        pass

# Создаёт таблицу scan_results для хранения статуса поиска тегов
def _ensure_scan_results_table():
    """Create the scan_results table for persistent found status."""
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        db.execute('CREATE TABLE IF NOT EXISTS scan_results (path TEXT PRIMARY KEY, tags_found INTEGER DEFAULT 1, found_at INTEGER NOT NULL)')
        db.commit()
        db.close()
    except Exception:
        pass

_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'}
_VIDEO_EXTS = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}
_AUDIO_EXTS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'}
_MEDIA_EXTS = _IMAGE_EXTS | _VIDEO_EXTS | _AUDIO_EXTS

_AUTO_TAG_MAP = {
    '.gif': 'gif,animated',
    '.mp4': 'video,animated', '.webm': 'video,animated', '.mov': 'video,animated', '.avi': 'video,animated', '.mkv': 'video,animated',
    '.jpg': 'photo', '.jpeg': 'photo', '.png': 'photo', '.webp': 'photo', '.bmp': 'photo',
    '.mp3': 'sound', '.wav': 'sound', '.flac': 'sound', '.ogg': 'sound', '.m4a': 'sound', '.aac': 'sound',
}

# Возвращает авто-теги по расширению файла (photo/video/gif/sound/animated)
# Для видео дополнительно проверяет аудиодорожку через ffprobe
def _get_auto_tags(filepath):
    """Return auto-tags based on file extension + audio detection for video."""
    ext = os.path.splitext(filepath)[1].lower()
    tags = _AUTO_TAG_MAP.get(ext, '')
    if ext in _VIDEO_EXTS and tags:
        if _video_has_audio(filepath):
            tags += ',sound'
    return tags

# Проверяет наличие аудиодорожки в видеофайле через ffprobe (если доступен)
_FFPROBE_AVAILABLE = None
def _video_has_audio(filepath):
    global _FFPROBE_AVAILABLE
    if _FFPROBE_AVAILABLE is None:
        _FFPROBE_AVAILABLE = shutil.which('ffprobe') is not None
    if not _FFPROBE_AVAILABLE:
        return False
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a:0',
             '-show_entries', 'stream=codec_type', '-of', 'csv=p=0',
             filepath],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0 and result.stdout.strip() == 'audio'
    except (subprocess.TimeoutExpired, subprocess.SubprocessError, OSError):
        return False

# Возвращает тег соотношения сторон (напр. '16:9') или '' при ошибке
def _get_aspect_ratio_tag(width, height):
    """Return aspect ratio tag like '16:9', '4:3' from width/height. Returns '' if invalid."""
    if not width or not height:
        return ''
    try:
        g = math.gcd(width, height)
        return f'{width // g}:{height // g}'
    except Exception:
        return ''

# Быстро проверяет, есть ли в директории хоть какие-нибудь файлы (не только медиа).
# Для пустых/отвалившихся Cryptomator-монтирований — вернёт True (пусто).
# Использует os.scandir с кратким рекурсивным обходом (макс 2 уровня).
def _is_dir_empty(path):
    """Quick check if directory has no files at all (max depth=2)."""
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False) and not entry.name.startswith('.'):
                return False
            if entry.is_dir(follow_symlinks=False) and not entry.name.startswith('.'):
                for sub in os.scandir(entry.path):
                    if sub.is_file(follow_symlinks=False) and not sub.name.startswith('.'):
                        return False
        return True
    except Exception:
        return True

# Быстрый подсчёт медиафайлов в директории (без Pillow и БД), пропуская скрытые
def _count_media_files(media_dir):
    """Fast walk counting media files (no Pillow, no DB). Skips hidden dirs/files."""
    count = 0
    for root, dirs, files in os.walk(media_dir):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if f.startswith('.'):
                continue
            if os.path.splitext(f)[1].lower() in _MEDIA_EXTS:
                count += 1
    return count

# Создаёт все необходимые таблицы БД, если их нет
def _ensure_db_schema():
    """Create all required tables if they don't exist."""
    _ensure_db_dir()
    try:
        db = _db_conn()
        db.execute('CREATE TABLE IF NOT EXISTS files (path TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, mtime INTEGER, tags TEXT, width INTEGER DEFAULT 0, height INTEGER DEFAULT 0, created_at INTEGER, folder_type TEXT DEFAULT \'gallery\')')
        db.execute('CREATE TABLE IF NOT EXISTS tag_categories (name TEXT PRIMARY KEY, color TEXT NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS tag_category_members (tag_name TEXT PRIMARY KEY, category TEXT NOT NULL, source TEXT DEFAULT \'auto\')')
        db.execute('CREATE TABLE IF NOT EXISTS auto_scan (path TEXT PRIMARY KEY, scanned_at INTEGER NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS scan_results (path TEXT PRIMARY KEY, tags_found INTEGER DEFAULT 1, found_at INTEGER NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS thumbnail_cache (path TEXT PRIMARY KEY, data BLOB NOT NULL, mtime INTEGER NOT NULL)')
        db.execute('CREATE TABLE IF NOT EXISTS comics (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, cover_path TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        db.execute('CREATE TABLE IF NOT EXISTS comic_pages (id INTEGER PRIMARY KEY AUTOINCREMENT, comic_id INTEGER NOT NULL, page_number INTEGER NOT NULL, file_path TEXT NOT NULL, FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE)')
        db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT DEFAULT \'user\', created_at INTEGER DEFAULT (strftime(\'%s\', \'now\')))')
        # Миграция: добавляем колонку source в tag_category_members, если её нет
        try:
            db.execute("ALTER TABLE tag_category_members ADD COLUMN source TEXT DEFAULT 'auto'")
        except Exception:
            pass  # колонка уже существует
        # Миграция: добавляем колонку folder_type в files, если её нет
        try:
            db.execute("ALTER TABLE files ADD COLUMN folder_type TEXT DEFAULT 'gallery'")
        except Exception:
            pass  # колонка уже существует
        # Миграция 3.4: site_id, last_updated, data в tag_category_members
        try:
            db.execute("ALTER TABLE tag_category_members ADD COLUMN site_id TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE tag_category_members ADD COLUMN last_updated INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE tag_category_members ADD COLUMN data TEXT DEFAULT '{}'")
        except Exception:
            pass
        # Миграция: добавляем колонки source и source_id в comics
        try:
            db.execute("ALTER TABLE comics ADD COLUMN source TEXT DEFAULT ''")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE comics ADD COLUMN source_id TEXT DEFAULT ''")
        except Exception:
            pass
        db.commit()
        db.close()
    except Exception:
        pass

# Отмечает файл как «теги найдены» (постоянный статус)
def _mark_tags_found(rel_path):
    """Mark a file as having tags found (persistent 'found' status)."""
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        db.execute('INSERT OR REPLACE INTO scan_results (path, tags_found, found_at) VALUES (?, 1, ?)', [rel_path, int(time.time())])
        db.commit()
        db.close()
        log_debug_green('tags_found marked for %s', rel_path)
    except Exception:
        pass

# Проверяет, отмечен ли файл как «теги найдены»
def _has_tags_found(rel_path):
    """Check if file has persistent 'found' status."""
    if not os.path.exists(_DB_PATH):
        return False
    try:
        db = _db_conn()
        row = db.execute('SELECT 1 FROM scan_results WHERE path = ? AND tags_found = 1', [rel_path]).fetchone()
        db.close()
        return row is not None
    except Exception:
        return False

# Отмечает файл как проверенный, но теги не найдены
def _mark_tags_not_found(rel_path):
    """Mark a file as checked but no API tags found (persistent 'not_found' status)."""
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        db.execute('INSERT OR REPLACE INTO scan_results (path, tags_found, found_at) VALUES (?, 0, ?)',
                   [rel_path, int(time.time())])
        db.commit()
        db.close()
        log_debug_red('tags_not_found marked for %s', rel_path)
    except Exception:
        pass

# Проверяет, отмечен ли файл как «теги не найдены»
def _was_tags_not_found(rel_path):
    """Check if file has persistent 'not_found' status (checked, no API tags)."""
    if not os.path.exists(_DB_PATH):
        return False
    try:
        db = _db_conn()
        row = db.execute('SELECT 1 FROM scan_results WHERE path = ? AND tags_found = 0', [rel_path]).fetchone()
        db.close()
        return row is not None
    except Exception:
        return False

# Проверяет, был ли файл уже просканирован автосканированием
def _is_auto_scanned(rel_path):
    if not os.path.exists(_DB_PATH):
        return False
    try:
        db = _db_conn()
        row = db.execute('SELECT 1 FROM auto_scan WHERE path = ?', [rel_path]).fetchone()
        db.close()
        return row is not None
    except Exception:
        return False

# Отмечает файл как просканированный автосканированием
def _mark_auto_scanned(rel_path):
    if not os.path.exists(_DB_PATH):
        return
    try:
        db = _db_conn()
        db.execute('INSERT OR IGNORE INTO auto_scan (path, scanned_at) VALUES (?, ?)', [rel_path, int(time.time())])
        db.commit()
        db.close()
    except Exception:
        pass

def _get_tag_categories():
    """Returns ({tag: color}, {tag: (category, color)}) dicts."""
    try:
        db = _db_conn()
        rows = db.execute(
            'SELECT m.tag_name, m.category, c.color FROM tag_category_members m JOIN tag_categories c ON m.category = c.name'
        ).fetchall()
        db.close()
        tag_colors = {}
        cat_map = {}
        for tag_name, cat_name, color in rows:
            tag_colors[tag_name] = color
            cat_map[tag_name] = (cat_name, color)
        return tag_colors, cat_map
    except Exception:
        return {}, {}

def _get_file_type(ext):
    """Returns 'image', 'video', 'audio', or 'other' based on file extension."""
    if ext in _IMAGE_EXTS:
        return 'image'
    if ext in _VIDEO_EXTS:
        return 'video'
    if ext in _AUDIO_EXTS:
        return 'audio'
    return 'other'

def _get_image_dimensions(filepath):
    """Returns (width, height) tuple or (0, 0) for non-image files."""
    try:
        with Image.open(filepath) as img:
            return img.width, img.height
    except Exception:
        return 0, 0

# ── Auth / permission decorators ─────────────

def _auth_required():
    """Check if user is authenticated. Returns error response or None."""
    if not _has_users():
        return None
    if not session.get('authenticated'):
        return jsonify({'error': 'auth_required'}), 401
    return None

def _admin_required():
    """Check if user is authenticated AND has admin role. Returns error response or None."""
    auth = _auth_required()
    if auth:
        return auth
    if session.get('role') != 'admin':
        return jsonify({'error': 'forbidden', 'message': 'Admin role required'}), 403
    return None

def auth_required(f):
    """Decorator: require authentication for a route."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = _auth_required()
        if auth:
            return auth
        return f(*args, **kwargs)
    return wrapper

def admin_required(f):
    """Decorator: require admin role for a route."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = _admin_required()
        if auth:
            return auth
        return f(*args, **kwargs)
    return wrapper

def api_error_handler(f):
    """Decorator: catch exceptions in API routes, return consistent JSON error."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except HTTPException:
            raise  # let Flask handle real HTTP errors (404, 403, etc.)
        except Exception as e:
            path = request.path
            qs = request.query_string.decode()
            log_error('API error in %s: %s', f.__name__, e)
            log_error('  Request: %s %s?%s', request.method, path, qs)
            if DEBUG_MODE:
                import traceback
                log_debug('  Traceback:\n%s', traceback.format_exc())
            return jsonify({'error': str(e)}), 500
    return wrapper

# ── Flask-приложение: роуты и API ──

settings = load_settings()

_api_cache = {}
_md5_cache = {}
_lock = threading.Lock()

# Запрос к Rule34 API по MD5 хешу файла. Возвращает словарь с тегами, file_url и preview_url.
def fetch_rule34(md5, uid='', key=''):
    url = 'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=1&tags=md5:' + md5
    if uid and key:
        url += '&user_id=' + requests.utils.quote(uid) + '&api_key=' + requests.utils.quote(key)
    for attempt in range(3):
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
            if r.status_code == 200 and r.text.strip().startswith('['):
                posts = r.json()
                if posts:
                    p = posts[0]
                    tags = p.get('tags', '').strip().split() if p.get('tags') else []
                    log_debug_green('r34 FOUND for md5=%s (%d tags)', md5, len(tags))
                    return {'tags': tags, 'file_url': p.get('file_url', ''), 'preview_url': p.get('preview_url', '')}
            log_debug_red('r34 NOT FOUND for md5=%s', md5)
            return {'tags': [], 'file_url': '', 'preview_url': ''}
        except Exception as e:
            if attempt < 2:
                backoff = attempt + 1
                log_warning('fetch_rule34 error (attempt %d/3): %s — retrying in %ds', attempt + 1, e, backoff)
                time.sleep(backoff)
            else:
                log_error('fetch_rule34 error (final): %s', e)
    return {'tags': [], 'file_url': '', 'preview_url': ''}

# Запрос к Danbooru API по MD5 хешу файла. Возвращает словарь с тегами, разбитыми по категориям, и URL изображений.
def fetch_danbooru(md5, login='', api_key=''):
    url = 'https://danbooru.donmai.us/posts.json?limit=1&tags=md5:' + md5
    auth = {}
    if login and api_key:
        auth = {'auth': (login, api_key)}
    for attempt in range(3):
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=15, **auth)
            if r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0:
                p = r.json()[0]
                tags = p.get('tag_string', '').split()
                log_debug_green('dan FOUND for md5=%s (%d tags)', md5, len(tags))
                return {
                    'tags': tags,
                    'tag_general': p.get('tag_string_general', '').split(),
                    'tag_artist': p.get('tag_string_artist', '').split(),
                    'tag_character': p.get('tag_string_character', '').split(),
                    'tag_copyright': p.get('tag_string_copyright', '').split(),
                    'tag_meta': p.get('tag_string_meta', '').split(),
                    'file_url': p.get('file_url', ''),
                    'large_file_url': p.get('large_file_url', ''),
                    'preview_file_url': p.get('preview_file_url', ''),
                }
            log_debug_red('dan NOT FOUND for md5=%s', md5)
            return {'tags': [], 'tag_general': [], 'tag_artist': [], 'tag_character': [], 'tag_copyright': [], 'tag_meta': [], 'file_url': '', 'large_file_url': '', 'preview_url': ''}
        except Exception as e:
            if attempt < 2:
                backoff = attempt + 1
                log_warning('fetch_danbooru error (attempt %d/3): %s — retrying in %ds', attempt + 1, e, backoff)
                time.sleep(backoff)
            else:
                log_error('fetch_danbooru error (final): %s', e)
    return {'tags': [], 'tag_general': [], 'tag_artist': [], 'tag_character': [], 'tag_copyright': [], 'tag_meta': [], 'file_url': '', 'large_file_url': '', 'preview_url': ''}

# Вернуть состояние кэшей API и MD5.
def get_caches():
    global _api_cache, _md5_cache
    return _api_cache, _md5_cache

# Главная страница — рендерит index.html с page='home'.
@app.route('/favicon.ico')
def favicon():
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#6c5ce7"/><text x="16" y="22" text-anchor="middle" font-size="18" font-weight="bold" fill="white">M</text></svg>', 200, {'Content-Type': 'image/svg+xml'}

@app.route('/')
def index():
    s = load_settings()
    username = session.get('username') if session.get('authenticated') else None
    return render_template('home.html', page='home', s=s, username=username)

# ───────────────────────────────────────────────────────
# MediaVault — read-only просмотр
# ───────────────────────────────────────────────────────

@app.route('/mediavault/gallery')
def mediavault_gallery_route():
    s = load_settings()
    return render_template('shared/gallery.html', page='mediavault', subview='gallery', s=s)

@app.route('/mediavault/comics')
def mediavault_comics_route():
    s = load_settings()
    return render_template('shared/comics-list.html', page='mediavault', subview='comics', mode='view', s=s)

@app.route('/mediavault/view')
def mediavault_view_route():
    raw_path = request.args.get('path', '')
    order_str = request.args.get('order', '')
    media_dir = settings.get('media_dir', '')
    if not raw_path or not media_dir:
        abort(404)
    safe_path = _safe_media_path(raw_path)
    if not safe_path or not os.path.exists(safe_path):
        abort(404)
    filename = os.path.basename(safe_path)
    ext = os.path.splitext(filename)[1].lower()
    is_video = ext in _VIDEO_EXTS
    if order_str:
        nav_paths = order_str.split('|')
    else:
        nav_paths = [raw_path]
    from urllib.parse import quote
    nav_paths_q = [quote(p, safe='') for p in nav_paths]
    current_raw = raw_path
    current_idx = -1
    for i, p in enumerate(nav_paths):
        if p == current_raw:
            current_idx = i
            break
    has_prev = current_idx > 0
    has_next = current_idx >= 0 and current_idx < len(nav_paths) - 1
    prev_path_q = nav_paths_q[current_idx - 1] if has_prev else ''
    next_path_q = nav_paths_q[current_idx + 1] if has_next else ''
    order_qs = '&order=' + quote(order_str, safe='') if order_str else ''
    rel_for_db = raw_path
    if raw_path.startswith(media_dir):
        rel_for_db = os.path.relpath(raw_path, media_dir)
    row = find_file_in_db(rel_for_db)
    tags_html = ''
    if row and row['tags']:
        db_tags = [t.strip() for t in row['tags'].split(',') if t.strip()]
        if db_tags:
            try:
                _, cat_map = _get_tag_categories()
            except Exception:
                cat_map = {}
            groups = {}
            for tag in db_tags:
                if tag in cat_map:
                    cat_name, color = cat_map[tag]
                    groups.setdefault((cat_name, color), []).append(tag)
                else:
                    groups.setdefault(('General', '#888888'), []).append(tag)
            parts = []
            for (cat_name, color), tags in sorted(groups.items()):
                dot = f'<span class="cat-dot" style="background:{color}"></span>'
                header = f'<div class="cat-hdr">{dot}{cat_name}</div>'
                chips = ''.join(
                    f'<a class="tag" href="/mediavault?q=%23{tag}" target="_blank" style="background:{color}22;color:{color}">#{tag}</a>'
                    for tag in sorted(tags)
                )
                parts.append(f'<div class="cat-group">{header}<div class="tags-wrap">{chips}</div></div>')
            tags_html = ''.join(parts) if parts else '<div class="empty-tags">' + _('svNoTags') + '</div>'
        else:
            tags_html = '<div class="empty-tags">' + _('svNoTags') + '</div>'
    else:
        tags_html = '<div class="empty-tags">' + _('svNoTags') + '</div>'
    return render_template('shared/view.html', mode='standalone',
        theme=settings.get('theme', 'dark'),
        s=settings,
        page='mediavault',
        filename=filename,
        path_q=quote(raw_path, safe=''),
        is_video=is_video,
        has_prev=has_prev,
        has_next=has_next,
        prev_path_q=prev_path_q,
        next_path_q=next_path_q,
        order_qs=order_qs,
        tags_html=tags_html)

@app.route('/mediavault/comics/view')
def mediavault_comics_view_route():
    return redirect('/comics/view' + ('?' + request.query_string.decode() if request.query_string else ''))

@app.route('/popular-tags')
def popular_tags_route():
    s = load_settings()
    return render_template('shared/popular_tags.html', page='popular_tags', s=s)

# ───────────────────────────────────────────────────────
# Comics (legacy, read-only) + MV comics aliases
# ───────────────────────────────────────────────────────

@app.route('/comics')
def comics_route():
    return redirect('/mediavault/comics')

@app.route('/comics/view')
def comics_view_route():
    comic_id = request.args.get('id', type=int)
    preview = request.args.get('preview')
    s = load_settings()
    lang = get_lang()
    if comic_id:
        try:
            db = _db_conn()
            comic = db.execute('SELECT id, title, cover_path, created_at FROM comics WHERE id = ?', [comic_id]).fetchone()
            if not comic:
                db.close()
                return redirect('/comics')
            pages = db.execute('SELECT id, page_number, file_path FROM comic_pages WHERE comic_id = ? ORDER BY page_number', [comic_id]).fetchall()
            db.close()
        except Exception:
            return redirect('/comics')
        import urllib.parse
        pages_data = [{'id': p[0], 'num': p[1], 'path': urllib.parse.quote(p[2])} for p in pages]
        comic_data = {'id': comic[0], 'title': comic[1], 'cover': comic[2]}
        return render_template('shared/view.html', mode='comics', comic=comic_data, pages=pages_data, theme=s.get('theme', 'dark'), s=s, page='mediavault', preview=False)
    elif preview:
        import urllib.parse
        paths_raw = request.args.get('paths', '')
        if not paths_raw:
            return redirect('/comics')
        paths = [urllib.parse.unquote(p) for p in paths_raw.split('|') if p]
        pages_data = [{'id': 0, 'num': i + 1, 'path': urllib.parse.quote(paths[i])} for i in range(len(paths))]
        comic_data = {'title': LOCALE.get(lang, {}).get('quickPreview', 'Quick Preview'), 'cover': paths[0] if paths else ''}
        return render_template('shared/view.html', mode='comics', comic=comic_data, pages=pages_data, theme=s.get('theme', 'dark'), s=s, page='mediavault', preview=True)
    return redirect('/comics')

# ───────────────────────────────────────────────────────
# Content Management — admin-only
# ───────────────────────────────────────────────────────

@app.route('/content-mgmt/tags-auto')
def content_mgmt_tags_auto():
    """TagFetch Auto: SSE-поток поиска тегов."""
    if session.get('role') != 'admin':
        return redirect('/')
    s = load_settings()
    return render_template('tagfetch/auto.html', page='tagfetch', subview='auto', s=s, cm_tab='auto')

@app.route('/content-mgmt/tags-manual')
def content_mgmt_tags_manual():
    """TagFetch Manual: браузер файлов + ручной fetch тегов."""
    if session.get('role') != 'admin':
        return redirect('/')
    s = load_settings()
    return render_template('tagfetch/manual.html', page='tagfetch', subview='manual', s=s, cm_tab='manual')

@app.route('/content-mgmt/tags-manage')
def content_mgmt_tags_manage():
    """Управление тегами: вкладки Files (галерея) и Groups (категории)."""
    if session.get('role') != 'admin':
        return redirect('/')
    s = load_settings()
    tab = request.args.get('tab', 'gallery')
    theme = s.get('theme', 'dark')
    return render_template('content-mgmt/tags.html', page='content-mgmt', theme=theme, s=s, tab=tab, cm_tab=tab,
                           LOCALE_JSON=json.dumps(LOCALE, ensure_ascii=False))

@app.route('/content-mgmt/tags-group')
def content_mgmt_tags_group():
    """Управление группами/категориями тегов."""
    if session.get('role') != 'admin':
        return redirect('/')
    s = load_settings()
    theme = s.get('theme', 'dark')
    return render_template('content-mgmt/tags.html', page='content-mgmt', theme=theme, s=s, tab='groups', cm_tab='groups',
                           LOCALE_JSON=json.dumps(LOCALE, ensure_ascii=False))

@app.route('/content-mgmt/comics-edit')
@admin_required
def content_mgmt_comics_edit():
    """Редактор комиксов: создание/удаление/сортировка страниц."""
    s = load_settings()
    return render_template('shared/comics-list.html', page='content-mgmt', mode='edit', s=s)

@app.route('/nhentai-search')
@admin_required
def nhentai_search_page():
    """Redirect to new content search with NHentai tab."""
    return redirect('/content-search?site=nhentai')

@app.route('/content-mgmt/comics-tags')
@admin_required
def comics_tags_page():
    """Comics grid + tag panel drag-to-tag."""
    s = load_settings()
    return render_template('content-mgmt/tags.html', page='content-mgmt/comics-tags', s=s)

@app.route('/franchise-search')
@admin_required
def franchise_search_page():
    """Redirect to new content search."""
    return redirect('/content-search')

@app.route('/content-search')
@admin_required
def content_search_page():
    """New unified search page (R34, Danbooru, NHentai)."""
    s = load_settings()
    return render_template('content-search.html', page='content-search', s=s)

@app.route('/api/content-search')
@admin_required
@api_error_handler
def api_content_search():
    """API: parallel search across selected sites."""
    q = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    sites_param = request.args.get('sites', 'r34,dan,nhentai')
    filter_ai = request.args.get('filter_ai', '0') == '1'
    if not q:
        return jsonify({'error': 'no query'}), 400
    from backends import search_tags
    import concurrent.futures
    site_map = {'r34': 'rule34', 'dan': 'danbooru', 'nhentai': 'nhentai'}
    sites = [site_map[s] for s in sites_param.split(',') if s in site_map]
    results = {}
    total = 0
    log_debug('[ContentSearch API] query="%s" sites=%s page=%d filter_ai=%d', q, sites, page, filter_ai)
    settings = load_settings()
    # NHentai API key check (for api_raw backend)
    nh_has_key = bool(settings.get('credentials', {}).get('nhentai', {}).get('key', ''))
    nh_key_warning = False
    if 'nhentai' in sites:
        fb = settings.get('fetch_backend', {})
        nh_backend = fb.get('nhentai') or 'gallerydl'
        if nh_backend == 'api_raw' and not nh_has_key:
            nh_key_warning = True
            log_warning('[NHentai] api_raw backend selected but no nhentai API key configured')
        log_debug('[NHentai] key_exists=%s backend=%s', nh_has_key, nh_backend)

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(sites)) as exc:
        fut = {}
        for s in sites:
            site_q = q
            if filter_ai and s == 'rule34':
                site_q = q + ' -ai_generated -ai -ai_assisted'
            if s == 'nhentai':
                log_debug('[NHentai] searching: query="%s" page=%d key_exists=%s', site_q, page, nh_has_key)
            fut[s] = exc.submit(search_tags, s, site_q, page, settings)
        for s in sites:
            try:
                results[s] = fut[s].result(timeout=30)
                n = len(results[s].get('results', []))
                total += results[s].get('total', n)
                if s == 'nhentai':
                    log_debug('[NHentai] response: %d results total=%d', n, results[s].get('total', n))
                log_debug('[ContentSearch API] %s: %d results', s, n)
            except Exception as e:
                results[s] = {'results': [], 'total': 0}
                if s == 'nhentai':
                    log_debug_red('[NHentai] search ERROR: %s', e)
                log_debug_red('[ContentSearch API] %s ERROR: %s', s, e)
    # Compute tags_by_category for each result
    cat_fields = {
        'tag_artist': 'artist',
        'tag_character': 'character',
        'tag_copyright': 'copyright',
        'tag_general': 'general',
        'tag_meta': 'meta',
    }
    cat_colors = {
        'artist': '#ff4444',
        'character': '#44cc44',
        'copyright': '#4488ff',
        'general': '#cccccc',
        'meta': '#999999',
        'uncategorized': '#666666',
    }
    # Load DB categories for merging
    db_cat_map = {}
    try:
        _ensure_db_schema()
        db = _db_conn()
        db_rows = db.execute('SELECT tag_name, category FROM tag_category_members').fetchall()
        color_rows = db.execute('SELECT name, color FROM tag_categories').fetchall()
        db.close()
        for tag_name, cat_name in db_rows:
            db_cat_map[tag_name] = cat_name
        for cat_name, color in color_rows:
            cat_colors[cat_name] = color
    except Exception:
        pass
    for site_key, site_data in results.items():
        items = site_data.get('results', [])
        for r in items:
            all_categorized = set()
            tags_by_cat = {}
            for field, cat_name in cat_fields.items():
                tags = r.get(field, [])
                if tags:
                    tags_by_cat[cat_name] = tags
                    for t in tags:
                        all_categorized.add(t)
            remaining = [t for t in r.get('tags', []) if t not in all_categorized]
            uncategorized = []
            for t in remaining:
                db_cat = db_cat_map.get(t)
                if db_cat:
                    tags_by_cat.setdefault(db_cat, []).append(t)
                else:
                    uncategorized.append(t)
            if uncategorized:
                tags_by_cat['uncategorized'] = uncategorized
            r['tags_by_category'] = tags_by_cat
    log_debug('[ContentSearch API] done: query="%s" total=%d', q, total)
    resp = {'results': results, 'total': total, 'cat_colors': cat_colors}
    if nh_key_warning:
        resp['nhentai_warning'] = True
    return jsonify(resp)

@app.route('/api/content-search/download', methods=['GET', 'POST'])
@auth_required
@api_error_handler
def api_content_search_download():
    """Download a remote file to the gallery directory and save tags to DB."""
    if request.method == 'POST':
        data = request.get_json()
        if data is None:
            return jsonify({'error': 'no data'}), 400
        url = (data.get('url') or '').strip()
        source = (data.get('source') or '').strip()
        tags_str = (data.get('tags') or '').strip()
        tags_by_category = data.get('tags_by_category') or {}
    else:
        url = request.args.get('url', '').strip()
        source = request.args.get('source', '').strip()
        tags_str = request.args.get('tags', '').strip()
        tags_by_category = {}

    if not url or not source:
        return jsonify({'error': 'Missing url or source'}), 400

    settings = load_settings()
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'error': 'Media directory not configured'}), 400

    # Check storage is mounted (not empty)
    if not os.path.isdir(media_dir) or not os.listdir(media_dir):
        return jsonify({'error': 'storage_empty', 'message': _('contentSearchStorageEmpty')}), 400

    import re
    if not re.match(r'^[a-zA-Z0-9]+$', source):
        return jsonify({'error': 'Invalid source name'}), 400

    dl_dir = settings.get('downloads_dir', 'Downloads')
    target_dir = os.path.join(media_dir, dl_dir, source)
    try:
        os.makedirs(target_dir, exist_ok=True)
    except Exception as e:
        return jsonify({'error': 'Cannot create directory: ' + str(e)}), 500

    from urllib.parse import urlparse
    import requests as req_lib
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path) or 'download'
    filename = os.path.basename(filename)
    target_path = os.path.join(target_dir, filename)

    was_downloaded = False
    if not os.path.exists(target_path):
        try:
            r = req_lib.get(url, headers={'User-Agent': 'MediaVault/1.0'}, timeout=60, stream=True)
            r.raise_for_status()
            with open(target_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            log_info('[ContentSearch] Downloaded: %s -> %s', url, target_path)
            was_downloaded = True
        except Exception as e:
            return jsonify({'error': 'Download failed: ' + str(e)}), 500

    # ── Save file + tags to DB ──
    rel_path = os.path.relpath(target_path, media_dir)
    _ensure_db_schema()

    if tags_str:
        existing = find_file_in_db(rel_path)
        ext = os.path.splitext(target_path)[1].lower()
        ftype = _get_file_type(ext)
        auto_tags = _get_auto_tags(target_path)
        auto_set = set(t.strip() for t in auto_tags.split(',') if t.strip()) if auto_tags else set()
        for t in tags_str.split(','):
            t = t.strip()
            if t:
                auto_set.add(t)
        stat = os.stat(target_path)
        name = os.path.basename(rel_path)
        width = height = 0
        if ftype == 'image':
            width, height = _get_image_dimensions(target_path)
        ar_tag = _get_aspect_ratio_tag(width, height) if width and height else ''
        if ar_tag:
            auto_set.add(ar_tag)
        merged = ','.join(sorted(auto_set))
        first_dir = rel_path.split('/')[0] if '/' in rel_path else ''
        gd = settings.get('gallery_dir', 'Gallery')
        cd = settings.get('comics_dir', 'Comics')
        dd = settings.get('downloads_dir', 'Downloads')
        folder_type = {gd: 'gallery', cd: 'comics', dd: 'downloads'}.get(first_dir, 'gallery')
        db = _db_conn()
        if existing:
            existing_tags = existing['tags'] or ''
            existing_set = set(t.strip() for t in existing_tags.split(',') if t.strip())
            existing_set.update(auto_set)
            merged = ','.join(sorted(existing_set))
            db.execute('UPDATE files SET tags=?, width=?, height=?, mtime=? WHERE path=?',
                       [merged, width or existing.get('width', 0), height or existing.get('height', 0),
                        int(os.path.getmtime(target_path)), rel_path])
        else:
            db.execute(
                'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at, folder_type) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [rel_path, name, ftype, stat.st_size, int(stat.st_mtime), merged, width, height,
                 int(time.time()), folder_type]
            )
        db.commit()
        db.close()
        log_info('[ContentSearch] Saved tags for %s: %d tags', rel_path, len(auto_set))

    # ── Save tag categories (Danbooru only) ──
    if tags_by_category and source.lower() in ('danbooru', 'dan'):
        dan_result = {}
        for short_cat, tag_list in tags_by_category.items():
            if isinstance(tag_list, list):
                dan_result['tag_' + short_cat] = tag_list
        _ensure_categories(dan_result)

    return jsonify({'path': target_path, 'exists': not was_downloaded, 'tags_saved': bool(tags_str)})


@app.route('/api/content-search/download-manga', methods=['POST'])
@auth_required
@api_error_handler
def api_content_search_download_manga():
    """Download all pages of an NHentai gallery into a subfolder."""
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400

    source = (data.get('source') or '').strip()
    gid = data.get('gid')
    media_id = data.get('media_id')
    num_pages = int(data.get('num_pages') or 1)
    title = (data.get('title') or '').strip()
    tags_str = (data.get('tags') or '').strip()

    if not gid or not media_id:
        return jsonify({'error': 'Missing gid or media_id'}), 400

    settings = load_settings()
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'error': 'Media directory not configured'}), 400

    if not os.path.isdir(media_dir) or not os.listdir(media_dir):
        return jsonify({'error': 'storage_empty', 'message': _('contentSearchStorageEmpty')}), 400

    # Folder: <media_dir>/<downloads_dir>/nhentai/<gid>/
    dl_dir = settings.get('downloads_dir', 'Downloads')
    target_dir = os.path.join(media_dir, dl_dir, 'nhentai', str(gid))
    try:
        os.makedirs(target_dir, exist_ok=True)
    except Exception as e:
        return jsonify({'error': 'Cannot create directory: ' + str(e)}), 500

    import requests as req_lib
    import re

    _ensure_db_schema()
    gd = settings.get('gallery_dir', 'Gallery')
    cd = settings.get('comics_dir', 'Comics')
    dd = settings.get('downloads_dir', 'Downloads')

    log_info('[ContentSearch] Manga start: gid=%s title="%s" pages=%d dir=%s',
             gid, title or '(no title)', num_pages, target_dir)

    count = 0
    errors = 0
    base_url = 'https://i.nhentai.net/galleries/' + str(media_id)

    for n in range(1, num_pages + 1):
        page_url = base_url + '/' + str(n) + '.jpg'
        filename = str(n) + '.jpg'
        target_path = os.path.join(target_dir, filename)

        if os.path.exists(target_path):
            log_debug('[ContentSearch] manga page %d/%d: already exists', n, num_pages)
            count += 1
            continue

        log_info('[ContentSearch] manga page %d/%d: downloading %s', n, num_pages, page_url)

        try:
            r = req_lib.get(page_url, headers={'User-Agent': 'MediaVault/1.0'}, timeout=30)
            r.raise_for_status()
            with open(target_path, 'wb') as f:
                f.write(r.content)
        except Exception as e:
            log_error('[ContentSearch] manga page %d/%d FAILED: %s', n, num_pages, e)
            errors += 1
            continue

        # Index in DB with gallery tags
        rel_path = os.path.relpath(target_path, media_dir)
        ext = '.jpg'
        ftype = 'image'
        auto_tags = _get_auto_tags(target_path)
        auto_set = set(t.strip() for t in auto_tags.split(',') if t.strip()) if auto_tags else set()
        for t in tags_str.split(','):
            t = t.strip()
            if t:
                auto_set.add(t)
        stat = os.stat(target_path)
        w, h = _get_image_dimensions(target_path)
        ar_tag = _get_aspect_ratio_tag(w, h) if w and h else ''
        if ar_tag:
            auto_set.add(ar_tag)
        merged = ','.join(sorted(auto_set))
        first_dir = rel_path.split('/')[0] if '/' in rel_path else ''
        folder_type = {gd: 'gallery', cd: 'comics', dd: 'downloads'}.get(first_dir, 'gallery')

        log_info('[ContentSearch] manga page %d/%d: OK %dx%d %.1fKB tags=%d',
                 n, num_pages, w, h, stat.st_size / 1024, len(auto_set))

        existing = find_file_in_db(rel_path)
        db = _db_conn()
        if existing:
            existing_tags = existing['tags'] or ''
            existing_set = set(t.strip() for t in existing_tags.split(',') if t.strip())
            existing_set.update(auto_set)
            merged = ','.join(sorted(existing_set))
            db.execute('UPDATE files SET tags=?, width=?, height=? WHERE path=?',
                       [merged, w or existing.get('width', 0), h or existing.get('height', 0), rel_path])
        else:
            db.execute(
                'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at, folder_type) VALUES (?,?,?,?,?,?,?,?,?,?)',
                [rel_path, filename, ftype, stat.st_size, int(stat.st_mtime), merged, w, h,
                 int(time.time()), folder_type]
            )
        db.commit()
        db.close()
        count += 1

    log_info('[ContentSearch] Manga downloaded: gid=%s, %d pages, %d errors', gid, count, errors)

    # Auto-add comics entry
    comics_id = None
    if count > 0:
        try:
            db = _db_conn()
            cover_rel = os.path.relpath(os.path.join(target_dir, '1.jpg'), media_dir)
            pages_rel = sorted(
                os.path.relpath(os.path.join(target_dir, f), media_dir)
                for f in os.listdir(target_dir)
                if f.lower().endswith('.jpg') and os.path.isfile(os.path.join(target_dir, f))
            )
            pages_rel.sort(key=lambda x: int(os.path.splitext(os.path.basename(x))[0]))
            comics_title = title or 'NHentai #' + str(gid)
            c = db.execute('INSERT INTO comics (title, cover_path, source, source_id) VALUES (?, ?, ?, ?)',
                           [comics_title, cover_rel if os.path.exists(os.path.join(target_dir, '1.jpg')) else (pages_rel[0] if pages_rel else None),
                            'nhentai', str(gid)])
            comics_id = c.lastrowid
            for i, p in enumerate(pages_rel):
                db.execute('INSERT INTO comic_pages (comic_id, page_number, file_path) VALUES (?, ?, ?)',
                           [comics_id, i + 1, p])
            db.commit()
            db.close()
            log_info('[ContentSearch] Comics auto-created: id=%d title="%s" pages=%d', comics_id, comics_title, len(pages_rel))
        except Exception as e:
            log_error('[ContentSearch] Comics auto-create failed: %s', e)

    return jsonify({'ok': True, 'count': count, 'errors': errors, 'dir': target_dir, 'comics_id': comics_id})

@app.route('/api/content-search/mount-check')
@auth_required
@api_error_handler
def api_content_search_mount_check():
    """Check if media_dir is mounted (has files)."""
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'mounted': False, 'empty': True, 'message': _('contentSearchStorageEmpty')})
    if not os.path.isdir(media_dir):
        return jsonify({'mounted': False, 'empty': True, 'message': _('contentSearchStorageEmpty')})
    try:
        entries = os.listdir(media_dir)
        has_content = any(not e.startswith('.') for e in entries)
        if not has_content:
            return jsonify({'mounted': True, 'empty': True, 'message': _('contentSearchStorageEmpty')})
        return jsonify({'mounted': True, 'empty': False})
    except Exception as e:
        return jsonify({'mounted': False, 'empty': True, 'message': str(e)})


@app.route('/api/content-search/create-folders', methods=['POST'])
@admin_required
@api_error_handler
def api_content_search_create_folders():
    """Create Gallery/, Comics/, Downloads/ subdirs in media_dir."""
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'error': 'media_dir not configured'}), 400
    if not os.path.isdir(media_dir):
        return jsonify({'error': 'media_dir does not exist'}), 400
    created = []
    existing = []
    for sub in [settings.get('gallery_dir', 'Gallery'), settings.get('comics_dir', 'Comics'), settings.get('downloads_dir', 'Downloads')]:
        path = os.path.join(media_dir, sub)
        try:
            if os.path.isdir(path):
                existing.append(sub)
            else:
                os.makedirs(path, exist_ok=True)
                created.append(sub)
        except Exception as e:
            return jsonify({'error': 'Cannot create ' + sub + ': ' + str(e)}), 500
    log_info('[ContentSearch] Folders: created=%s existing=%s', ', '.join(created) or '-', ', '.join(existing) or '-')
    return jsonify({'ok': True, 'created': created, 'existing': existing})


@app.route('/api/franchise/search')
@admin_required
@api_error_handler
def api_franchise_search():
    """Legacy alias: delegates to content search API."""
    q = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    if not q:
        return jsonify({'error': 'no query'}), 400
    from flask import Response as Resp
    resp = Resp()
    resp.headers['Location'] = f'/api/content-search?q={urllib.parse.quote(q)}&page={page}'
    resp.status_code = 308
    return resp

@app.route('/api/tags/autocomplete')
@admin_required
@api_error_handler
def api_tags_autocomplete():
    """Autocomplete: search tags in local DB."""
    q = request.args.get('q', '').strip()
    if not q or len(q) < 2:
        return jsonify([])
    db = _db_conn()
    try:
        rows = db.execute(
            'SELECT DISTINCT tags FROM files WHERE tags IS NOT NULL AND tags != ""'
        ).fetchall()
        all_tags = set()
        for (tags_str,) in rows:
            for t in tags_str.split(','):
                t = t.strip()
                if t and q.lower() in t.lower():
                    all_tags.add(t)
        sorted_tags = sorted(all_tags)[:20]
        return jsonify(sorted_tags)
    finally:
        db.close()

@app.route('/similar')
@api_error_handler
def similar_page():
    """Похожие изображения по пересечению тегов."""
    s = load_settings()
    return render_template('similar.html', page='similar', s=s)

# ─── Settings ────────────────────────────────

@app.route('/settings')
def settings_page():
    """Настройки приложения: вкладки Appearance / API Keys / Database / Account.
    """
    s = load_settings()
    theme = s.get('theme', 'dark')
    username = session.get('username', '')
    return render_template('settings.html', page='settings', theme=theme, s=s,
                           username=username,
                           LOCALE_JSON=json.dumps(LOCALE, ensure_ascii=False))

# ─── API: Settings ───────────────────────────

@app.route('/api/settings', methods=['GET', 'POST'])
@api_error_handler
def api_settings():
    """GET — вернуть все настройки. POST — обновить указанные поля.
    Поля: media_dir, theme, three_bg, fetch_backend, browser_cache,
    gallery_dir, comics_dir, credentials (per-site).
    При смене media_dir сбрасывает startup_scan_count для пересканирования.
    """
    auth = _admin_required()
    if auth:
        return auth
    if request.method == 'GET':
        return jsonify(load_settings())
    global settings, _api_cache, _md5_cache
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'error': 'no data'}), 400
    s = load_settings()
    old_media_dir = s.get('media_dir', '')
    if 'credentials' in data:
        s['credentials'] = data['credentials']
    # backward compat: accept old flat keys, convert to per-site
    for old_k, site, cred_k in [('r34_uid', 'rule34', 'uid'), ('r34_key', 'rule34', 'key'),
                                 ('dan_login', 'danbooru', 'login'), ('dan_key', 'danbooru', 'key'),
                                 ('nh_key', 'nhentai', 'key')]:
        if old_k in data:
            s.setdefault('credentials', {}).setdefault(site, {})[cred_k] = data[old_k]
    for k in ('media_dir', 'theme', 'three_bg', 'fetch_backend', 'browser_cache', 'gallery_dir', 'comics_dir', 'downloads_dir'):
        if k in data:
            s[k] = os.path.expanduser(data[k]) if k == 'media_dir' else data[k]
    save_settings(s)
    settings = load_settings()
    _api_cache = {}
    _md5_cache = {}
    scan_needed = bool(s.get('media_dir')) and s['media_dir'] != old_media_dir
    if scan_needed:
        s['startup_scan_count'] = 0
        save_settings(s)
    return jsonify({'ok': True, 'scan_needed': scan_needed})

@app.route('/api/nhentai/search')
@api_error_handler
def api_nhentai_search():
    query = request.args.get('q', '').strip()
    page = request.args.get('page', 1, type=int)
    if not query:
        return jsonify({'error': 'no query'}), 400
    from backends import search_tags
    log_debug('[NHentai API] search: query="%s" page=%d', query, page)
    result = search_tags('nhentai', query, page, load_settings())
    n = len(result.get('results', []))
    total = result.get('total', 0)
    log_debug('[NHentai API] search: %d results, %d total for query="%s"', n, total, query)
    if result.get('error'):
        log_debug_red('[NHentai API] search ERROR: %s', result['error'])
    return jsonify(result)

@app.route('/api/kemono/mirrors')
@admin_required
@api_error_handler
def api_kemono_mirrors():
    from backends.gallerydl import GalleryDlBackend
    return jsonify({'mirrors': GalleryDlBackend.get_mirrors()})

# ── Kemono/Coomer Import ─────────────────────

@app.route('/kemono-import')
@admin_required
@api_error_handler
def kemono_import_page():
    s = load_settings()
    return render_template('kemono_import.html', page='kemono-import', s=s)

@app.route('/api/kemono/info')
@admin_required
@api_error_handler
def api_kemono_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'no URL'}), 400
    from backends.gallerydl import GalleryDlBackend
    backend = GalleryDlBackend()
    result = backend.get_info(url)
    return jsonify(result)

@app.route('/api/kemono/download', methods=['POST'])
@admin_required
@api_error_handler
def api_kemono_download():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'error': 'no data'}), 400
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'no URL'}), 400
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'error': 'media_dir not set'}), 400
    dest = os.path.join(media_dir, 'Downloads', 'kemono')
    from backends.gallerydl import GalleryDlBackend
    backend = GalleryDlBackend()
    info = backend.get_info(url)
    artist = info.get('artist', 'unknown') if info.get('ok') else 'unknown'
    dest_sub = os.path.join(dest, artist)
    os.makedirs(dest_sub, exist_ok=True)
    result = backend.download(url, dest_sub)
    if result.get('ok'):
        _quick_scan()
    return jsonify(result)

# ── API: Credentials ─────────────────────────

@app.route('/api/credential_status', methods=['GET'])
@api_error_handler
def api_credential_status():
    """Вернуть текущий бэкенд хранения API-ключей (KeyringStore | plain)."""
    active = _credential_store.name() if _credential_store else 'plain'
    available = ['KeyringStore', 'plain']
    return jsonify({'active': active, 'available': available})

@app.route('/api/set_credential_backend', methods=['POST'])
@admin_required
@api_error_handler
def api_set_credential_backend():
    """Сменить бэкенд хранения ключей. POST: {'backend': 'KeyringStore'|'plain'}
    KeyringStore → ключи в GNOME Keyring, plain → в settings.json.
    При смене мигрирует все ключи между хранилищами.
    """
    global _credential_store
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({'error': 'no data'}), 400
    name = data.get('backend', '')
    _PER_SITE = [('rule34', ['uid', 'key']), ('danbooru', ['login', 'key']), ('nhentai', ['key'])]
    if name == 'KeyringStore':
        ks = credential_store.KeyringStore()
        if not ks.is_available():
            return jsonify({'error': 'KeyringStore not available', 'current': _credential_store.name() if _credential_store else 'plain'}), 400
        s = load_settings()
        for site, keys in _PER_SITE:
            site_cred = s.get('credentials', {}).get(site, {})
            for k in keys:
                v = site_cred.get(k, '')
                if v:
                    ks.set(f'api:{site}:{k}', v)
        _credential_store = ks
        s['credential_backend'] = 'KeyringStore'
        save_settings(s)
        return jsonify({'ok': True, 'current': 'KeyringStore'})
    elif name == 'plain':
        s = load_settings()
        if _credential_store:
            cred = s.setdefault('credentials', {})
            for site, keys in _PER_SITE:
                for k in keys:
                    v = _credential_store.get(f'api:{site}:{k}')
                    if v:
                        cred.setdefault(site, {})[k] = v
        _credential_store = None
        s['credential_backend'] = 'plain'
        save_settings(s)
        return jsonify({'ok': True, 'current': 'plain'})
    return jsonify({'error': 'unknown backend'}), 400

# ── API: Theme / Effects ─────────────────────

@app.route('/api/theme', methods=['POST'])
@api_error_handler
def api_theme():
    """Переключение темы. POST: {'theme': 'light'|'dark'}"""
    global settings
    data = request.get_json()
    if data and 'theme' in data:
        s = load_settings()
        s['theme'] = data['theme']
        save_settings(s)
        settings = s
    return jsonify({'ok': True})

@app.route('/api/effects', methods=['POST'])
@api_error_handler
def api_effects():
    """Вкл/выкл визуальных эффектов. POST: {'effects': true|false}"""
    global settings
    data = request.get_json()
    if data and 'effects' in data:
        s = load_settings()
        s['effects'] = bool(data['effects'])
        save_settings(s)
        settings = s
    return jsonify({'ok': True})

def _relocate_or_clean(old_rel_path):
    """Search for a file by basename in media_dir. If found, update DB path.
    If not found, delete the stale DB record. Returns new safe path or None."""
    md = settings.get('media_dir', '')
    if not md or not os.path.isdir(md):
        return None
    basename = os.path.basename(old_rel_path)
    found = None
    for root, _, files in os.walk(md):
        for f in files:
            if f == basename:
                found = os.path.join(root, f)
                break
        if found:
            break
    if found:
        new_rel = os.path.relpath(found, md)
        if os.path.exists(_DB_PATH):
            try:
                db = _db_conn()
                db.execute('UPDATE files SET path = ? WHERE path = ?', [new_rel, old_rel_path])
                db.commit()
                db.close()
                log_info('[Relocate] %s → %s', old_rel_path, new_rel)
            except Exception as e:
                log_error('[Relocate] DB update failed: %s', e)
        return found
    # Guard: if media_dir appears unmounted (empty), do NOT delete records
    try:
        entries = [e for e in os.listdir(md) if not e.startswith('.')]
        if not entries:
            log_info_yellow('[Relocate] media_dir empty/unmounted, skip delete for %s', old_rel_path)
            return None
    except Exception:
        return None
    # Not found → delete stale record
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            db.execute('DELETE FROM files WHERE path = ?', [old_rel_path])
            db.commit()
            db.close()
            log_info('[Relocate] Deleted stale DB record: %s', old_rel_path)
        except Exception as e:
            log_error('[Relocate] DB delete failed: %s', e)
    return None

def _ensure_admin_user():
    """Create default admin if no users exist."""
    try:
        db = _db_conn()
        row = db.execute('SELECT COUNT(*) FROM users').fetchone()
        if row and row[0] == 0:
            pw = generate_password_hash('admin')
            db.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                       ['admin', pw, 'admin'])
            db.commit()
            _invalidate_users_cache()
        db.close()
    except Exception:
        pass

# ── Auth endpoints ───────────────────────────

@app.route('/api/auth_status', methods=['GET'])
@api_error_handler
def api_auth_status():
    """Проверка статуса авторизации.
    Если нет пользователей — возвращает authenticated=True (режим первого запуска).
    """
    if not _has_users():
        return jsonify({'authenticated': True, 'password_set': False})
    return jsonify({'authenticated': bool(session.get('authenticated')), 'password_set': True,
                    'username': session.get('username') if session.get('authenticated') else None})

@app.route('/api/login', methods=['POST'])
@api_error_handler
def api_login():
    """Вход по username/password. Устанавливает сессию.
    POST: {'username': '...', 'password': '...'}
    """
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    if not _has_users():
        return jsonify({'error': 'no_users'}), 400
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    try:
        db = _db_conn()
        row = db.execute('SELECT id, username, password_hash, role FROM users WHERE username = ?', [username]).fetchone()
        db.close()
        if row and check_password_hash(row[2], password):
            session['authenticated'] = True
            session.permanent = True
            session['user_id'] = row[0]
            session['username'] = row[1]
            session['role'] = row[3]
            return jsonify({'ok': True})
    except Exception:
        pass
    return jsonify({'error': 'wrong_credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@api_error_handler
def api_logout():
    """Выход — очистка сессии."""
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/set_password', methods=['POST'])
@auth_required
@api_error_handler
def api_set_password():
    """Смена пароля текущего пользователя.
    POST: {'password': '...'} — минимум 4 символа.
    """
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    password = data.get('password', '')
    if len(password) < 4:
        return jsonify({'error': 'password_too_short'}), 400
    try:
        db = _db_conn()
        db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                   [generate_password_hash(password), session['user_id']])
        db.commit()
        db.close()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/account/change_username', methods=['POST'])
@auth_required
@api_error_handler
def api_account_change_username():
    """Смена username текущего пользователя.
    POST: {'username': '...', 'password': '...'} — требует подтверждения паролем.
    """
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    if not username:
        return jsonify({'error': 'invalid_input'}), 400
    try:
        db = _db_conn()
        row = db.execute('SELECT password_hash FROM users WHERE id = ?', [session['user_id']]).fetchone()
        if not row:
            db.close()
            return jsonify({'error': 'user_not_found'}), 404
        if not check_password_hash(row[0], password):
            db.close()
            return jsonify({'error': 'wrong_password'}), 403
        db.execute('UPDATE users SET username = ? WHERE id = ?', [username, session['user_id']])
        db.commit()
        db.close()
        session['username'] = username
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Admin panel ──────────────────────────────

@app.route('/admin')
def admin_panel():
    """Admin Panel: управление пользователями, БД, API-ключами.
    Только admin. Если нет пользователей — доступ без авторизации.
    """
    if _has_users():
        if not session.get('authenticated'):
            return redirect('/login')
        if session.get('role') != 'admin':
            return redirect('/')
    s = load_settings()
    theme = s.get('theme', 'dark')
    db = _db_conn()
    row = db.execute('SELECT id FROM users WHERE id = ?', [session.get('user_id', 0)]).fetchone()
    db.close()
    return render_template('admin/admin.html', page='admin', theme=theme, s=s,
                           self_id=row[0] if row else 0,
                            LOCALE_JSON=json.dumps(LOCALE, ensure_ascii=False))

# Legacy redirect: старый /content-mgmnt → /content-mgmt/tags-manage
@app.route('/content-mgmnt')
def content_page_legacy():
    if session.get('role') != 'admin':
        return redirect('/')
    return redirect('/content-mgmt/tags-manage')

@app.route('/api/admin/users', methods=['GET'])
@admin_required
@api_error_handler
def api_admin_users():
    try:
        db = _db_conn()
        rows = db.execute('SELECT id, username, role, created_at FROM users ORDER BY id').fetchall()
        db.close()
        users = [{'id': r[0], 'username': r[1], 'role': r[2], 'created_at': r[3]} for r in rows]
        return jsonify({'users': users})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['POST'])
@admin_required
@api_error_handler
def api_admin_add_user():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'user')
    if not username or len(password) < 4:
        return jsonify({'error': 'invalid_input'}), 400
    try:
        db = _db_conn()
        db.execute('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                   [username, generate_password_hash(password), role])
        db.commit()
        db.close()
        _invalidate_users_cache()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
@api_error_handler
def api_admin_delete_user(user_id):
    try:
        db = _db_conn()
        db.execute('DELETE FROM users WHERE id = ? AND role != \'admin\'', [user_id])
        db.commit()
        db.close()
        _invalidate_users_cache()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/admin/users/<int:user_id>/role', methods=['POST'])
@admin_required
@api_error_handler
def api_admin_set_role(user_id):
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    role = data.get('role', 'user')
    if role not in ('admin', 'user'):
        return jsonify({'error': 'invalid_role'}), 400
    try:
        db = _db_conn()
        db.execute('UPDATE users SET role = ? WHERE id = ?', [role, user_id])
        db.commit()
        db.close()
        _invalidate_users_cache()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<int:user_id>/password', methods=['POST'])
@admin_required
@api_error_handler
def api_admin_set_password(user_id):
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    password = data.get('password', '')
    if len(password) < 4:
        return jsonify({'error': 'password_too_short'}), 400
    try:
        db = _db_conn()
        db.execute('UPDATE users SET password_hash = ? WHERE id = ?',
                   [generate_password_hash(password), user_id])
        db.commit()
        db.close()
        _invalidate_users_cache()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.before_request
def check_auth():
    if request.method == 'OPTIONS':
        return None
    public_paths = ('/api/login', '/api/logout', '/api/auth_status', '/api/set_password',
                    '/api/credential_status', '/static/', '/api/theme')
    if any(request.path.startswith(p) for p in public_paths):
        return None
    if not _has_users():
        return None  # no users = open access
    if request.path == '/login':
        return None
    if not session.get('authenticated'):
        if request.path.startswith('/api/'):
            return jsonify({'error': 'auth_required'}), 401
        return redirect('/login')

@app.after_request
def log_access(response):
    log_request(request.method, request.path, request.query_string.decode() if request.query_string else '', response.status_code)
    return response

@app.route('/login')
def login_page():
    if _has_users() and session.get('authenticated'):
        return redirect('/')
    s = load_settings()
    lang = request.cookies.get('mediavault_lang', 'en')
    theme = s.get('theme', 'dark')
    return render_template('login.html', lang=lang, theme=theme, s=s,
                           LOCALE_JSON=json.dumps(LOCALE, ensure_ascii=False))

# Фоновое сканирование media_dir при старте. Добавляет новые файлы в БД с авто-тегами.
def _quick_scan(force=False):
    """Walk media_dir, auto-tag NEW files only (skip already-scanned). Returns (count, errors).

    If `force` is True, ignores file-count cache and walks everything.
    Skips hidden directories (starting with '.') and hidden files.
    Uses a single transaction — no per-file commits.
    Computes width/height for image files during scan (Pillow).
    """
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return (0, 0)

    # ── Fast check: compare file count ──
    s = load_settings()
    current_count = _count_media_files(media_dir)
    prev_count = s.get('startup_scan_count', 0)
    prev_dir = s.get('startup_scan_dir', '')

    if not force and prev_dir == media_dir and current_count == prev_count:
        log_info('quick_scan: file count unchanged (%d), skipping', current_count)
        return (0, 0)

    _ensure_db_schema()
    count = 0
    errors = 0
    db = _db_conn()

    try:
        for root, dirs, files in os.walk(media_dir):
            # Skip hidden directories (e.g. .thumb_cache, .Trash-1000)
            dirs[:] = [d for d in dirs if not d.startswith('.')]

            for f in files:
                if f.startswith('.'):
                    continue
                ext = os.path.splitext(f)[1].lower()
                if ext not in _MEDIA_EXTS:
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, media_dir)

                # Already in DB → skip (has auto-tags, preview, everything)
                if db.execute('SELECT 1 FROM files WHERE path = ?', [rel]).fetchone():
                    continue

                # New file — insert with auto-tags and folder_type
                try:
                    auto_tags = _get_auto_tags(full)
                    auto_set = set(t.strip() for t in auto_tags.split(',') if t.strip()) if auto_tags else set()
                    merged = ','.join(sorted(auto_set)) if auto_set else ''
                    ftype = _get_file_type(ext)
                    size = os.path.getsize(full)
                    mtime = int(os.path.getmtime(full))
                    w, h = _get_image_dimensions(full) if ftype == 'image' else (0, 0)
                    # Определяем folder_type по первому компоненту пути
                    first_dir = rel.split('/')[0] if '/' in rel else ''
                    gallery_dir = settings.get('gallery_dir', 'Gallery')
                    comics_dir = settings.get('comics_dir', 'Comics')
                    dl_dir = settings.get('downloads_dir', 'Downloads')
                    folder_type = {gallery_dir: 'gallery', comics_dir: 'comics', dl_dir: 'downloads'}.get(first_dir, 'gallery')

                    db.execute(
                        'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at, folder_type) VALUES (?,?,?,?,?,?,?,?,?,?)',
                        [rel, f, ftype, size, mtime, merged, w, h, int(time.time()), folder_type]
                    )
                    count += 1
                except Exception as e:
                    log_error('_quick_scan error path=%s: %s', rel, e)
                    errors += 1
    finally:
        db.commit()
        db.close()

    # Save count for next startup
    s = load_settings()
    s['startup_scan_count'] = current_count
    s['startup_scan_dir'] = media_dir
    save_settings(s)

    log_info('quick_scan done: %d new, %d errors (total %d files in dir)', count, errors, current_count)
    return (count, errors)

# Ручное сканирование папки (кнопка Scan Folder). Запускает _quick_scan(force=True).
@app.route('/api/scan_folder', methods=['POST'])
@admin_required
@api_error_handler
def api_scan_folder():
    count, errors = _quick_scan(force=True)
    return jsonify({'ok': True, 'scanned': count, 'errors': errors})

# Загрузка галереи с пагинацией. Параметры: page, per_page. Возвращает список файлов с тегами.
@app.route('/api/gallery')
@api_error_handler
def api_gallery():
    """Return files from DB with pagination for MediaVault gallery.
    Supports ?folder=gallery|comics|downloads to filter by folder_type."""
    if not os.path.exists(_DB_PATH):
        return jsonify({'files': [], 'categories': {}, 'total': 0, 'media_dir_set': False, 'folder_counts': {}})
    try:
        _ensure_db_schema()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 0, type=int)
        from_date = request.args.get('from_date', None, type=int)
        to_date = request.args.get('to_date', None, type=int)
        folder = request.args.get('folder', None, type=str)
        db = _db_conn()
        where_clauses = []
        params = []
        if from_date is not None:
            where_clauses.append('mtime >= ?')
            params.append(from_date)
        if to_date is not None:
            where_clauses.append('mtime <= ?')
            params.append(to_date)
        if folder and folder in ('gallery', 'comics', 'downloads'):
            if folder in ('gallery', 'comics'):
                fdir = settings.get(folder + '_dir', folder.capitalize())
                where_clauses.append('path LIKE ?')
                params.append(fdir + '/%')
            else:
                where_clauses.append('folder_type = ?')
                params.append(folder)
        where_sql = ' WHERE ' + ' AND '.join(where_clauses) if where_clauses else ''
        if per_page > 0:
            offset = (page - 1) * per_page
            rows = db.execute(f'SELECT path, name, tags, type, width, height, mtime FROM files{where_sql} ORDER BY name ASC LIMIT ? OFFSET ?', params + [per_page, offset]).fetchall()
        else:
            rows = db.execute(f'SELECT path, name, tags, type, width, height, mtime FROM files{where_sql} ORDER BY name ASC').fetchall()
        tag_colors, _ = _get_tag_categories()
        categories = tag_colors
        seen = set()
        files = []
        for r in rows:
            if r[0] in seen:
                continue
            seen.add(r[0])
            files.append({'path': r[0], 'name': r[1], 'tags': r[2] or '', 'type': r[3], 'width': r[4], 'height': r[5], 'mtime': r[6], 'fetched': _has_non_meta_tags(r[2] or '')})
        total = len(files) if per_page <= 0 else db.execute('SELECT COUNT(DISTINCT path) FROM files' + where_sql, params).fetchone()[0]
        folder_counts = {}
        for ft in ('gallery', 'comics', 'downloads'):
            if ft in ('gallery', 'comics'):
                fdir = settings.get(ft + '_dir', ft.capitalize())
                c = db.execute('SELECT COUNT(*) FROM files WHERE path LIKE ?', [fdir + '/%']).fetchone()[0]
            else:
                c = db.execute('SELECT COUNT(*) FROM files WHERE folder_type = ?', [ft]).fetchone()[0]
            if c > 0:
                folder_counts[ft] = c
        log_debug('api_gallery: folder=%s page=%d per_page=%d → %d files, %d total',
                  folder or 'all', page, per_page, len(files), total)
        return jsonify({
            'files': files,
            'categories': categories,
            'total': total,
            'page': page,
            'per_page': per_page,
            'media_dir_set': bool(settings.get('media_dir', '')),
            'folder_counts': folder_counts,
            'current_folder': folder or 'all'
        })
    except Exception as e:
        log_error('api_gallery: %s', e)
        return jsonify({'error': str(e)}), 500

# Автоопределение media_dir по путям из БД. Перебирает стандартные директории.
# Открытие системного диалога выбора папки (через zenity/kdialog).
@app.route('/api/pick_folder', methods=['POST'])
@admin_required
@api_error_handler
def api_pick_folder():
    import subprocess
    data = request.get_json(silent=True) or {}
    pick_type = data.get('type', 'folder')
    if pick_type == 'folder':
        zenity_cmd = ['zenity', '--file-selection', '--directory', '--title=Select folder']
        kdialog_cmd = ['kdialog', '--getexistingdirectory', '--title=Select folder']
        for cmd in [zenity_cmd, kdialog_cmd]:
            try:
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
                if r.returncode == 0 and r.stdout.strip():
                    return jsonify({'path': r.stdout.strip()})
            except FileNotFoundError:
                continue
            except subprocess.TimeoutExpired:
                continue
    return jsonify({'error': 'no file picker available (install zenity or kdialog)'}), 400

# Просмотр файловой системы. Параметр: path — путь к директории.
@app.route('/api/browse')
@admin_required
@api_error_handler
def api_browse():
    path = request.args.get('path', '/')
    safe_path = _norm_path(path)
    if not os.path.exists(safe_path):
        safe_path = '/'
    media_dir = settings.get('media_dir', '')
    try:
        entries = []
        for name in sorted(os.listdir(safe_path), key=lambda n: (not os.path.isdir(os.path.join(safe_path, n)), n.lower())):
            full = os.path.join(safe_path, name)
            try:
                rel_path = ''
                if media_dir:
                    rp = os.path.relpath(full, media_dir)
                    if not rp.startswith('..'):
                        rel_path = rp
                entries.append({'name': name, 'path': full, 'rel_path': rel_path, 'is_dir': os.path.isdir(full), 'mtime': int(os.path.getmtime(full)) if not os.path.isdir(full) else 0})
            except OSError:
                pass
        parent = os.path.dirname(safe_path) if safe_path != '/' else None
        return jsonify({'path': safe_path, 'parent': parent, 'entries': entries})
    except OSError as e:
        return jsonify({'error': str(e)}), 400

# Отдача медиафайла с поддержкой Range-запросов для видео. Параметр: path.
@app.route('/api/media')
@api_error_handler
def api_media():
    filepath = request.args.get('path', '')
    if not filepath:
        log_info_yellow('api_media: missing path')
        abort(404)
    safe = _safe_media_path(filepath)
    if not safe or not os.path.exists(safe):
        safe = _relocate_or_clean(filepath)
        if not safe:
            log_info_yellow('api_media: not found path=%s', filepath)
            abort(404)
        log_info_green('api_media: relocated path=%s → %s', filepath, safe)
    ext = os.path.splitext(safe)[1].lower()
    resp = send_file(safe, conditional=True)
    resp.headers['Cache-Control'] = _cache_control_header()
    mtime = os.path.getmtime(safe)
    fsize = os.path.getsize(safe)
    resp.headers['ETag'] = f'"{int(mtime)}-{fsize}"'
    if ext in _VIDEO_EXTS:
        resp.mimetype = 'video/' + ext[1:]
    log_debug('api_media: path=%s → %s (%d bytes)', filepath, safe, fsize)
    return resp

# Отдача превью изображения/видео. Если нет превью — отдаёт оригинал. Параметр: path.
@app.route('/api/thumbnail')
@api_error_handler
def api_thumbnail():
    filepath = request.args.get('path', '')
    if not filepath:
        log_info_yellow('api_thumbnail: missing path')
        abort(404)
    safe = _safe_media_path(filepath)
    if not safe or not os.path.exists(safe):
        safe = _relocate_or_clean(filepath)
        if not safe:
            log_info_yellow('api_thumbnail: not found path=%s', filepath)
            abort(404)
    data = _get_thumbnail(safe)
    if data:
        resp = send_file(io.BytesIO(data), mimetype='image/avif')
        resp.headers['Cache-Control'] = _cache_control_header()
        resp.headers['ETag'] = f'"{int(os.path.getmtime(safe))}-{len(data)}"'
        return resp
    ext = os.path.splitext(safe)[1].lower()
    if ext in _VIDEO_EXTS:
        abort(404)
    resp = send_file(safe, conditional=True)
    resp.headers['Cache-Control'] = _cache_control_header()
    mtime = os.path.getmtime(safe)
    fsize = os.path.getsize(safe)
    resp.headers['ETag'] = f'"{int(mtime)}-{fsize}"'
    return resp

# Информация о файле: размер, размеры изображения, теги из БД. Параметр: path.
@app.route('/api/fileinfo')
@api_error_handler
def api_fileinfo():
    raw_path = request.args.get('path', '')
    media_dir = settings.get('media_dir', '')
    if not media_dir or not raw_path:
        return jsonify({'error': 'bad params'}), 400

    safe = _safe_media_path(raw_path)
    if not safe or not os.path.exists(safe):
        return jsonify({'error': 'file not found'}), 404

    info = {}
    stat = os.stat(safe)
    size = stat.st_size
    if size < 1024:
        info['size'] = f'{size} B'
    elif size < 1024 * 1024:
        info['size'] = f'{size / 1024:.1f} KB'
    else:
        info['size'] = f'{size / 1024 / 1024:.1f} MB'

    ext = os.path.splitext(raw_path)[1].lower()
    if ext in _IMAGE_EXTS:
        try:
            with Image.open(safe) as img:
                info['dimensions'] = f'{img.width}×{img.height}'
        except Exception:
            pass

    if os.path.exists(_DB_PATH):
        rel_for_db = raw_path
        if media_dir and raw_path.startswith(media_dir):
            rel_for_db = os.path.relpath(raw_path, media_dir)
        row = find_file_in_db(rel_for_db)
        if row:
            info['db_tags'] = row['tags']
            try:
                tag_colors, _ = _get_tag_categories()
                info['tag_categories'] = tag_colors
            except Exception:
                info['tag_categories'] = {}
        else:
            info['db_tags'] = ''
            info['tag_categories'] = {}

    return jsonify(info)

# Похожие изображения по пересечению тегов. Параметр: path.
@app.route('/api/similar')
@api_error_handler
def api_similar():
    path = request.args.get('path', '')
    if not path:
        return jsonify({'error': 'no path'}), 400
    if not os.path.exists(_DB_PATH):
        return jsonify({'results': []})
    db = _db_conn()
    row = db.execute("SELECT tags FROM files WHERE path = ?", [path]).fetchone()
    if not row or not row[0]:
        db.close()
        return jsonify({'results': []})
    tags = [t.strip() for t in row[0].split(',') if t.strip()]
    if not tags:
        db.close()
        return jsonify({'results': []})
    similar = {}
    for tag in tags:
        rows = db.execute("""
            SELECT path, tags FROM files
            WHERE (',' || tags || ',') LIKE ('%,' || ? || ',%')
            AND path != ?
        """, [tag, path]).fetchall()
        for fpath, ftags in rows:
            if fpath not in similar:
                similar[fpath] = {'path': fpath, 'overlap': 0, 'total_tags': len(ftags.split(',')) if ftags else 0}
            similar[fpath]['overlap'] += 1
    db.close()
    results = sorted(similar.values(), key=lambda x: x['overlap'], reverse=True)[:50]
    return jsonify({'results': results})

# Получение тегов по MD5 с Rule34 и Danbooru. Параметр: path (относительный путь).
@app.route('/api/fetch_file')
@admin_required
@api_error_handler
def api_fetch_file():
    rel_path = request.args.get('path', '')
    media_dir = settings.get('media_dir', '')
    if not rel_path or not media_dir:
        return jsonify({'error': 'bad params'}), 400

    filepath = _safe_media_path(rel_path)
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'file not found'}), 404

    api_cache, md5_cache = get_caches()
    with _lock:
        fname_md5 = _md5_from_filename(os.path.basename(rel_path))
        md5 = md5_cache.get(rel_path)
        if not md5:
            md5 = fname_md5 or compute_md5(filepath)
            md5_cache[rel_path] = md5

        creds = settings.get('credentials', {})
        log_debug('api_fetch_file API keys: rule34:uid=%s rule34:key=%s danbooru:login=%s danbooru:key=%s',
                  'SET' if creds.get('rule34', {}).get('uid') else 'MISSING',
                  'SET' if creds.get('rule34', {}).get('key') else 'MISSING',
                  'SET' if creds.get('danbooru', {}).get('login') else 'MISSING',
                  'SET' if creds.get('danbooru', {}).get('key') else 'MISSING')

        r34_result = api_cache.get(f'{md5}_r34')
        if r34_result is None:
            r34_result = fetch_tags('rule34', md5, settings)
            api_cache[f'{md5}_r34'] = r34_result
            time.sleep(API_DELAY)

        dan_result = api_cache.get(f'{md5}_dan')
        if dan_result is None:
            dan_result = fetch_tags('danbooru', md5, settings)
            api_cache[f'{md5}_dan'] = dan_result
            time.sleep(API_DELAY)

        # If MD5 came from filename and only one site found tags → try content MD5 for the other
        r34_tags0 = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
        dan_tags0 = dan_result.get('tags', []) if isinstance(dan_result, dict) else []
        if fname_md5 and md5 == fname_md5 and (bool(r34_tags0) != bool(dan_tags0)):
            content_md5 = compute_md5(filepath)
            if content_md5 != fname_md5:
                missing_r34 = not r34_tags0
                log_debug('api_fetch_file filename MD5 only found %s, trying content MD5 %s for %s',
                          'dan' if dan_tags0 else 'r34', content_md5, rel_path)
                if missing_r34:
                    r34_result = api_cache.get(f'{content_md5}_r34')
                    if r34_result is None:
                        r34_result = fetch_tags('rule34', content_md5, settings)
                        api_cache[f'{content_md5}_r34'] = r34_result
                        time.sleep(API_DELAY)
                else:
                    dan_result = api_cache.get(f'{content_md5}_dan')
                    if dan_result is None:
                        dan_result = fetch_tags('danbooru', content_md5, settings)
                        api_cache[f'{content_md5}_dan'] = dan_result
                        time.sleep(API_DELAY)

    # Save Danbooru categories to DB on fetch (for color-coded display)
    if isinstance(dan_result, dict) and dan_result.get('tags'):
        try:
            _ensure_categories(dan_result)
        except Exception:
            pass
    tag_categories = {}
    db_tags = ''
    if os.path.exists(_DB_PATH):
        row = find_file_in_db(rel_path)
        if row:
            db_tags = row['tags']
        try:
            tag_colors, _ = _get_tag_categories()
            tag_categories = tag_colors
        except Exception:
            pass

    r34_tags = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
    dan_tags = dan_result.get('tags', []) if isinstance(dan_result, dict) else []
    if r34_tags or dan_tags:
        _ensure_scan_results_table()
        _mark_tags_found(rel_path)
    else:
        _ensure_scan_results_table()
        _mark_tags_not_found(rel_path)

    if r34_tags or dan_tags:
        log_info_green('fetch path=%s md5=%s r34=%d dan=%d', rel_path, md5, len(r34_tags), len(dan_tags))
    else:
        log_info_red('fetch path=%s md5=%s r34=%d dan=%d', rel_path, md5, len(r34_tags), len(dan_tags))
    return jsonify({
        'r34': r34_result.get('tags', []),
        'r34_image': r34_result.get('file_url', ''),
        'r34_preview': r34_result.get('preview_url', ''),
        'dan': dan_result.get('tags', []),
        'dan_general': dan_result.get('tag_general', []),
        'dan_artist': dan_result.get('tag_artist', []),
        'dan_character': dan_result.get('tag_character', []),
        'dan_copyright': dan_result.get('tag_copyright', []),
        'dan_meta': dan_result.get('tag_meta', []),
        'dan_image': dan_result.get('large_file_url', '') or dan_result.get('file_url', ''),
        'dan_preview': dan_result.get('large_file_url', '') or dan_result.get('preview_url', ''),
        'db_tags': db_tags,
        'tag_categories': tag_categories,
        'md5': md5
    })

# Статус автосканирования для списка файлов. POST с {'paths': [...]}. Приоритет: db > found > not_found > no_tags.
@app.route('/api/auto_status', methods=['POST'])
@api_error_handler
def api_auto_status():
    data = request.get_json()
    paths = data.get('paths', []) if data else []
    if not paths:
        return jsonify({}), 200
    log_debug('auto_status checking %d paths', len(paths))
    _ensure_scan_results_table()
    api_cache, md5_cache = get_caches()
    result = {}
    for p in paths:
        md5 = md5_cache.get(p, '')
        status = 'no_tags'
        found_src = []
        has_db_tags = False
        if os.path.exists(_DB_PATH):
            row = find_file_in_db(p)
            if row and _has_non_meta_tags(row['tags']):
                has_db_tags = True
        if has_db_tags:
            status = 'db'
        elif _has_tags_found(p):
            status = 'found'
        elif _was_tags_not_found(p):
            status = 'not_found'
        elif md5:
            r34 = api_cache.get(f'{md5}_r34', {})
            dan = api_cache.get(f'{md5}_dan', {})
            if isinstance(r34, dict) and r34.get('tags'):
                found_src.append('r34')
            if isinstance(dan, dict) and dan.get('tags'):
                found_src.append('dan')
            if found_src:
                status = 'found'
        # File in DB with auto-tags only (or no MD5 yet) → needs checking
        elif row:
            status = 'no_tags'
        result[p] = {'status': status}
    return jsonify(result)

# Статус проверки для списка файлов (ручной режим Tagfetch).
# POST с {'paths': [...]}. Приоритет статусов: db > found > not_found > no_tags.
# Используется в manual.js для расстановки data-status на элементах списка,
# чтобы работали кнопки фильтра (All / In DB / Found / Not Found).
@app.route('/api/check_status', methods=['POST'])
@api_error_handler
def api_check_status():
    """Return per-file status (db/found/not_found/no_tags) for a list of file paths."""
    data = request.get_json()
    paths = data.get('paths', []) if data else []
    if not paths:
        return jsonify({}), 200
    _ensure_db_schema()
    _ensure_scan_results_table()
    api_cache, md5_cache = get_caches()
    result = {}
    for p in paths:
        status = 'no_tags'
        has_db_tags = False
        if os.path.exists(_DB_PATH):
            row = find_file_in_db(p)
            if row and _has_non_meta_tags(row['tags']):
                has_db_tags = True
        if has_db_tags:
            status = 'db'
        elif _has_tags_found(p):
            status = 'found'
        elif _was_tags_not_found(p):
            status = 'not_found'
        else:
            md5 = md5_cache.get(p, '')
            if md5:
                r34 = api_cache.get(f'{md5}_r34', {})
                dan = api_cache.get(f'{md5}_dan', {})
                if (isinstance(r34, dict) and r34.get('tags')) or (isinstance(dan, dict) and dan.get('tags')):
                    status = 'found'
        result[p] = {'status': status}
    return jsonify(result)

# Очистка кэша API/MD5 для одного файла. POST с {'path': '...'}.
@app.route('/api/clear_cache', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_cache():
    """Clear API/MD5 cache for a single file (Tagfetch manual view)."""
    data = request.get_json()
    rel_path = data.get('path', '') if data else ''
    if not rel_path:
        return jsonify({'error': 'bad params'}), 400
    log_debug('clear_cache path=%s', rel_path)
    api_cache, md5_cache = get_caches()
    md5 = md5_cache.get(rel_path, '')
    if md5:
        api_cache.pop(f'{md5}_r34', None)
        api_cache.pop(f'{md5}_dan', None)
        log_debug('clear_cache removed cache for md5=%s', md5)
    return jsonify({'ok': True})

# Популярные теги: GET — глобальная статистика, POST — по конкретным путям.
@app.route('/api/popular_tags', methods=['GET', 'POST'])
@api_error_handler
def api_popular_tags():
    """Return aggregated list of popular tags.
    GET = global counts from all files.
    POST = contextual counts for given paths.
    """
    if not os.path.exists(_DB_PATH):
        return jsonify({'tags': []})
    try:
        db = _db_conn()
        if request.method == 'POST':
            data = request.get_json()
            paths = data.get('paths', []) if data else []
            if paths:
                placeholders = ','.join(['?'] * len(paths))
                rows = db.execute(
                    f'SELECT tags FROM files WHERE path IN ({placeholders}) AND tags IS NOT NULL AND tags != ""',
                    paths
                ).fetchall()
            else:
                rows = []
        else:
            rows = db.execute('SELECT tags FROM files WHERE tags IS NOT NULL AND tags != ""').fetchall()
        db.close()
        counter = {}
        for r in rows:
            tag_str = r[0]
            for t in tag_str.split(','):
                t = t.strip()
                if t:
                    counter[t] = counter.get(t, 0) + 1
        sorted_tags = sorted(counter.items(), key=lambda x: -x[1])
        return jsonify({'tags': [{'name': t, 'count': c} for t, c in sorted_tags]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Единый эндпоинт категорий (GET — чтение, POST — мутации с @admin_required) ──
@app.route('/api/categories', methods=['GET', 'POST'])
@api_error_handler
def api_categories():
    """GET: return categories with tags/colors. POST: mutate (admin only)."""
    if not os.path.exists(_DB_PATH):
        return jsonify({'categories': [], 'members': {}, 'cat_colors': {}, 'cat_map': {}})
    try:
        _ensure_db_schema()
        db = _db_conn()
        if request.method == 'GET':
            rows = db.execute('''
                SELECT c.name, c.color, m.tag_name
                FROM tag_categories c
                LEFT JOIN tag_category_members m ON c.name = m.category
                ORDER BY c.name, m.tag_name
            ''').fetchall()
            db.close()
            cat_names = []
            cat_colors = {}
            members_full = {}
            cat_map = {}
            for cat_name, color, tag_name in rows:
                if cat_name not in cat_colors:
                    cat_names.append(cat_name)
                    cat_colors[cat_name] = color
                    members_full[cat_name] = []
                if tag_name:
                    members_full[cat_name].append(tag_name)
                    cat_map[tag_name] = cat_name
            categories = [{'name': n, 'color': cat_colors[n]} for n in cat_names]
            return jsonify({
                'categories': categories,
                'members': members_full,
                'cat_colors': cat_colors,
                'cat_map': cat_map,
            })
        else:
            data = request.get_json()
            if data is None:
                return jsonify({'error': 'no data'}), 400
            auth = _admin_required()
            if auth:
                return auth
            action = data.get('action', '')
            if action == 'add_category':
                db.execute("INSERT OR IGNORE INTO tag_categories (name, color) VALUES (?, ?)", [data['name'], data.get('color', '#888888')])
            elif action == 'assign_tag':
                existing = db.execute("SELECT source FROM tag_category_members WHERE tag_name = ?", [data['tag']]).fetchone()
                source = existing[0] if existing else data.get('source', 'manual')
                db.execute("INSERT OR IGNORE INTO tag_category_members (tag_name, category, source, last_updated) VALUES (?, ?, ?, ?)", [data['tag'], data['category'], source, int(time.time())])
            elif action == 'add_tag':
                tag_name = data.get('tag_name') or data.get('tag')
                cat_name = data.get('cat_name') or data.get('category')
                existing = db.execute("SELECT source FROM tag_category_members WHERE tag_name = ?", [tag_name]).fetchone()
                source = existing[0] if existing else data.get('source', 'manual')
                db.execute("INSERT OR IGNORE INTO tag_category_members (tag_name, category, source, last_updated) VALUES (?, ?, ?, ?)", [tag_name, cat_name, source, int(time.time())])
            elif action == 'remove_tag':
                db.execute("DELETE FROM tag_category_members WHERE tag_name = ?", [data['tag']])
            elif action == 'rename':
                db.execute("UPDATE tag_categories SET name = ? WHERE name = ?", [data['new_name'], data['old_name']])
            elif action == 'rename_tag':
                old = data['old_tag']
                new = data['new_tag']
                db.execute("UPDATE tag_category_members SET tag_name = ? WHERE tag_name = ?", [new, old])
                db.execute("UPDATE files SET tags = REPLACE(tags, ?, ?) WHERE tags LIKE ?", [old, new, '%' + old + '%'])
            elif action == 'delete_category':
                name = data['name']
                db.execute("DELETE FROM tag_category_members WHERE category = ?", [name])
                db.execute("DELETE FROM tag_categories WHERE name = ?", [name])
            elif action == 'update_color':
                db.execute("UPDATE tag_categories SET color = ? WHERE name = ?", [data['color'], data['name']])
            elif action == 'delete_all':
                db.execute("DELETE FROM tag_category_members")
                db.execute("DELETE FROM tag_categories")
            elif action == 'check_exists':
                exists = db.execute("SELECT 1 FROM tag_categories WHERE name = ?", [data['name']]).fetchone() is not None
                db.close()
                return jsonify({'exists': exists})
            db.commit()
            db.close()
            return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Сохранение тегов для одного файла (r34/dan/both/tag_editor).
@app.route('/api/save_file', methods=['POST'])
@admin_required
@api_error_handler
def api_save_file():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    rel_path = data.get('path', '')
    tags_str = data.get('tags', '')
    source = data.get('source', '')
    if not source and data.get('tags'):
        source = data['tags']
    media_dir = settings.get('media_dir', '')
    if not rel_path or not source or not media_dir:
        return jsonify({'error': 'bad params'}), 400

    filepath = _safe_media_path(rel_path)
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'file not found'}), 404

    _ensure_db_schema()

    # ── Resolve tags to save ──
    api_cache, md5_cache = get_caches()
    api_tags = []

    if source in ('r34', 'dan', 'both'):
        # Tagfetch Manual: look up API cache for previously fetched tags
        md5 = md5_cache.get(rel_path)
        if not md5:
            md5 = compute_md5(filepath)
            md5_cache[rel_path] = md5
        if source in ('r34', 'both'):
            r34_res = api_cache.get(f'{md5}_r34', {})
            if isinstance(r34_res, dict):
                api_tags.extend(r34_res.get('tags', []))
        if source in ('dan', 'both'):
            dan_res = api_cache.get(f'{md5}_dan', {})
            if isinstance(dan_res, dict):
                api_tags.extend(dan_res.get('tags', []))
        save_tags_str = ','.join(api_tags)
    elif source == 'tag_editor':
        save_tags_str = tags_str
    else:
        # MediaVault lightbox/bulk: source IS the tag string
        save_tags_str = source

    try:
        existing = find_file_in_db(rel_path)
        if existing:
            existing_tags = existing['tags'] or ''
            merged_set = set(t.strip() for t in existing_tags.split(',') if t.strip())
            for t in save_tags_str.split(','):
                t = t.strip()
                if t:
                    merged_set.add(t)
            # Add aspect ratio if dimensions available (try to detect if DB has 0/None)
            w = existing.get('width') or 0
            h = existing.get('height') or 0
            if (not w or not h) and os.path.exists(filepath):
                w, h = _get_image_dimensions(filepath)
            if w and h:
                ar_tag = _get_aspect_ratio_tag(w, h)
                if ar_tag:
                    merged_set.add(ar_tag)
                if not existing.get('width') or not existing.get('height'):
                    db = _db_conn()
                    db.execute('UPDATE files SET width=?, height=? WHERE path=?', [w, h, rel_path])
                    db.commit()
                    db.close()
            new_tags = ','.join(sorted(merged_set))
            db = _db_conn()
            db.execute('UPDATE files SET tags=? WHERE path=?', [new_tags, rel_path])
            db.commit()
            db.close()
        else:
            ext = os.path.splitext(filepath)[1].lower()
            ftype = _get_file_type(ext)
            auto_tags = _get_auto_tags(filepath)
            auto_set = set(t.strip() for t in auto_tags.split(',') if t.strip()) if auto_tags else set()
            for t in save_tags_str.split(','):
                t = t.strip()
                if t:
                    auto_set.add(t)
            stat = os.stat(filepath)
            name = os.path.basename(rel_path)
            width = height = 0
            if ftype == 'image':
                width, height = _get_image_dimensions(filepath)
            ar_tag = _get_aspect_ratio_tag(width, height) if width and height else ''
            if ar_tag:
                auto_set.add(ar_tag)
            merged = ','.join(sorted(auto_set))
            db = _db_conn()
            db.execute(
                'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                [rel_path, name, ftype, stat.st_size, int(stat.st_mtime), merged, width, height, int(time.time())]
            )
            db.commit()
            db.close()
            new_tags = merged

        # Mark persistent found status
        _ensure_scan_results_table()
        if api_tags:
            _mark_tags_found(rel_path)
        else:
            _mark_tags_not_found(rel_path)

        # Categorise tags from APIs if available
        if source in ('dan', 'both'):
            md5 = md5_cache.get(rel_path)
            if md5:
                dan_result = api_cache.get(f'{md5}_dan', {})
                if dan_result:
                    _ensure_categories(dan_result)
        if source in ('r34', 'both'):
            md5 = md5_cache.get(rel_path)
            if md5:
                r34_result = api_cache.get(f'{md5}_r34', {})
                if r34_result:
                    _ensure_r34_categories(r34_result.get('tags', []))

        return jsonify({'ok': True, 'tags': new_tags})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Массовое сохранение тегов для списка файлов (ручной режим Tagfetch).
# Сохранение полученных тегов из авто-сканирования. dry_run — проверка без записи.
@app.route('/api/save_all_fetched', methods=['POST'])
@admin_required
@api_error_handler
def api_save_all_fetched():
    """Save all fetched tags (Tagfetch auto view). Returns per-file results."""
    data = request.get_json()
    paths = data.get('paths', []) if data else []
    dry_run = data.get('dry_run', False)
    media_dir = settings.get('media_dir', '')
    if not paths or not media_dir:
        return jsonify({'error': 'bad params'}), 400

    log_info('save_all_fetched starting: %d paths, dry_run=%s', len(paths), dry_run)
    _ensure_db_schema()
    api_cache, md5_cache = get_caches()

    results = []
    saved_count = 0

    for rel_path in paths:
        result = {'path': rel_path, 'name': os.path.basename(rel_path), 'saved': False, 'tags_count': 0}
        filepath = _safe_media_path(rel_path) or ''
        md5 = md5_cache.get(rel_path, '')
        if not md5 and filepath and os.path.exists(filepath):
            md5 = compute_md5(filepath)
            md5_cache[rel_path] = md5
        if not md5:
            results.append(result)
            continue

        r34_result = api_cache.get(f'{md5}_r34', {})
        dan_result = api_cache.get(f'{md5}_dan', {})
        r34_tags = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
        dan_tags = dan_result.get('tags', []) if isinstance(dan_result, dict) else []
        chosen = list(set(r34_tags) | set(dan_tags))

        if not chosen:
            results.append(result)
            continue

        result['tags_count'] = len(chosen)

        if dry_run:
            row = find_file_in_db(rel_path)
            if row and _has_non_meta_tags(row['tags']):
                result['db_tags'] = row['tags']
            results.append(result)
            continue

        try:
            row = find_file_in_db(rel_path)
            existing = row['tags'] if row else ''
            auto_tags_str = _get_auto_tags(filepath)
            auto_tags_list = [t for t in auto_tags_str.split(',') if t] if auto_tags_str else []
            merged = merge_tags(existing, chosen + auto_tags_list)
            db = _db_conn()
            if row:
                db.execute('UPDATE files SET tags = ? WHERE path = ?', [merged, row['path']])
            else:
                fname = os.path.basename(rel_path)
                ext = os.path.splitext(fname)[1].lower()
                ftype = _get_file_type(ext)
                size = os.path.getsize(filepath) if filepath and os.path.exists(filepath) else 0
                mtime = int(os.path.getmtime(filepath)) if filepath and os.path.exists(filepath) else 0
                width = height = 0
                if ftype == 'image' and filepath and os.path.exists(filepath):
                    width, height = _get_image_dimensions(filepath)
                db.execute(
                    'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                    [rel_path, fname, ftype, size, mtime, merged, width, height, int(time.time())]
                )
            db.commit()
            if dan_tags:
                _ensure_categories(dan_result)
            if r34_tags:
                _ensure_r34_categories(r34_tags)
            db.close()
            result['saved'] = True
            saved_count += 1
        except Exception as e:
            log_error('save_all error path=%s: %s', rel_path, e)
        results.append(result)

    return jsonify({'results': results, 'saved': saved_count, 'total': len(paths)})

# SSE-поток: получает пути, ищет теги на Rule34+Danbooru, отдаёт прогресс (fetch-only, без сохранения в БД).
@app.route('/api/auto_scan', methods=['POST'])
@admin_required
@api_error_handler
def api_auto_scan():
    """Receive a list of paths, scan each — mark seen + save all results."""
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    media_dir = settings.get('media_dir', '')
    if not media_dir:
        return jsonify({'error': 'no media dir'}), 400
    paths = data.get('paths', [])
    if not paths:
        log_info('auto_scan: no paths provided, walking media_dir')
        for root, dirs, files in os.walk(media_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in files:
                if f.startswith('.'): continue
                rel = os.path.relpath(os.path.join(root, f), media_dir)
                paths.append(rel)
        log_info('auto_scan: found %d files', len(paths))
    _ensure_db_schema()
    _ensure_auto_scan_table()
    _ensure_scan_results_table()
    log_info('auto_scan starting with %d paths', len(paths))

    creds = settings.get('credentials', {})
    log_debug('auto_scan API keys: rule34:uid=%s rule34:key=%s danbooru:login=%s danbooru:key=%s',
              'SET' if creds.get('rule34', {}).get('uid') else 'MISSING',
              'SET' if creds.get('rule34', {}).get('key') else 'MISSING',
              'SET' if creds.get('danbooru', {}).get('login') else 'MISSING',
              'SET' if creds.get('danbooru', {}).get('key') else 'MISSING')

    def generate():
        try:
            saved = 0
            errors = 0
            skipped = 0
            total = len(paths)
            for idx, rel_path in enumerate(paths, 1):
                try:
                    filepath = _safe_media_path(rel_path)
                    if not filepath or not os.path.exists(filepath):
                        yield f'data: {json.dumps({"type": "progress", "index": idx, "total": total, "status": "skip", "reason": "not_found"})}\n\n'
                        skipped += 1
                        continue

                    # Already in DB with non-meta tags? skip
                    existing = find_file_in_db(rel_path)
                    if existing and _has_non_meta_tags(existing['tags']):
                        yield f'data: {json.dumps({"type": "progress", "index": idx, "total": total, "status": "skip", "reason": "has_tags"})}\n\n'
                        skipped += 1
                        continue

                    # Already checked and no API tags found? skip
                    if _was_tags_not_found(rel_path):
                        yield f'data: {json.dumps({"type": "progress", "index": idx, "total": total, "status": "skip", "reason": "no_tags_found"})}\n\n'
                        skipped += 1
                        continue

                    # Already auto-scanned? skip
                    if _is_auto_scanned(rel_path):
                        yield f'data: {json.dumps({"type": "progress", "index": idx, "total": total, "status": "skip", "reason": "already_scanned"})}\n\n'
                        skipped += 1
                        continue

                    api_cache, md5_cache = get_caches()
                    fname_md5 = _md5_from_filename(os.path.basename(rel_path))
                    md5 = md5_cache.get(rel_path)
                    if not md5:
                        md5 = fname_md5 or compute_md5(filepath)
                        md5_cache[rel_path] = md5

                    r34_result = fetch_tags('rule34', md5, settings)
                    time.sleep(API_DELAY)
                    api_cache[f'{md5}_r34'] = r34_result
                    dan_result = fetch_tags('danbooru', md5, settings)
                    time.sleep(API_DELAY)
                    api_cache[f'{md5}_dan'] = dan_result

                    r34_tags = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
                    dan_tags = dan_result.get('tags', []) if isinstance(dan_result, dict) else []

                    # If MD5 from filename and only one site found tags → try content MD5 for the other
                    if fname_md5 and md5 == fname_md5 and (bool(r34_tags) != bool(dan_tags)):
                        content_md5 = compute_md5(filepath)
                        if content_md5 != fname_md5:
                            log_debug('auto_scan[%d/%d] filename MD5 only found %s, trying content MD5 %s for %s',
                                      idx, total, 'dan' if dan_tags else 'r34', content_md5, rel_path)
                            if not r34_tags:
                                r34_result = fetch_tags('rule34', content_md5, settings)
                                time.sleep(API_DELAY)
                                api_cache[f'{content_md5}_r34'] = r34_result
                            if not dan_tags:
                                dan_result = fetch_tags('danbooru', content_md5, settings)
                                time.sleep(API_DELAY)
                                api_cache[f'{content_md5}_dan'] = dan_result
                            r34_tags = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
                            dan_tags = dan_result.get('tags', []) if isinstance(dan_result, dict) else []

                    # If nothing found yet and MD5 wasn't from filename → try filename MD5
                    if not r34_tags and not dan_tags and fname_md5 and md5 != fname_md5:
                        log_debug('auto_scan[%d/%d] trying filename MD5 %s for %s', idx, total, fname_md5, rel_path)
                        r34_result = fetch_tags('rule34', fname_md5, settings)
                        time.sleep(API_DELAY)
                        api_cache[f'{fname_md5}_r34'] = r34_result
                        dan_result = fetch_tags('danbooru', fname_md5, settings)
                        time.sleep(API_DELAY)
                        api_cache[f'{fname_md5}_dan'] = dan_result
                        r34_tags = r34_result.get('tags', []) if isinstance(r34_result, dict) else []
                        dan_tags = dan_result.get('tags', []) if isinstance(dan_result, dict) else []

                    all_tags = list(set(r34_tags + dan_tags))
                    has_tags = bool(all_tags)

                    # Categorise tags (no files table save — save happens via Save All button)
                    if dan_result:
                        _ensure_categories(dan_result)
                    if r34_tags:
                        _ensure_r34_categories(r34_tags)

                    _mark_auto_scanned(rel_path)
                    if has_tags:
                        _mark_tags_found(rel_path)
                    else:
                        _mark_tags_not_found(rel_path)

                    found_count = len(all_tags)

                    tag_colors = {}
                    try:
                        tag_colors, _ = _get_tag_categories()
                    except Exception:
                        pass

                    result_data = {
                        "type": "progress", "index": idx, "total": total,
                        "status": "ok" if has_tags else "no_tags",
                        "path": rel_path, "name": os.path.basename(rel_path),
                        "found": found_count,
                        "tag_colors": tag_colors,
                        "dan_artist": dan_result.get('tag_artist', []) if isinstance(dan_result, dict) else [],
                        "dan_character": dan_result.get('tag_character', []) if isinstance(dan_result, dict) else [],
                        "dan_copyright": dan_result.get('tag_copyright', []) if isinstance(dan_result, dict) else [],
                        "dan_meta": dan_result.get('tag_meta', []) if isinstance(dan_result, dict) else [],
                        "dan_general": dan_result.get('tag_general', []) if isinstance(dan_result, dict) else [],
                        "r34_tags": r34_result.get('tags', []) if isinstance(r34_result, dict) else []
                    }
                    yield f'data: {json.dumps(result_data)}\n\n'
                    if found_count > 0:
                        log_debug_green('auto_scan[%d/%d] RESULT found=%d tags: %s', idx, total, found_count, rel_path)
                    else:
                        log_debug_red('auto_scan[%d/%d] RESULT found=%d tags: %s', idx, total, found_count, rel_path)
                    saved += 1

                except Exception as e:
                    log_error('auto_scan[%d/%d] ERROR %s: %s', idx, total, rel_path, e)
                    errors += 1

            yield f'data: {json.dumps({"type": "done", "saved": saved, "errors": errors, "skipped": skipped, "total": total})}\n\n'
            log_info('auto_scan done: saved=%d errors=%d skipped=%d total=%d', saved, errors, skipped, total)
        except GeneratorExit:
            pass

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

# Скачивание файла БД (mediavault.db).
@app.route('/api/export_db', methods=['GET'])
@admin_required
@api_error_handler
def api_export_db():
    """Send the DB file as a download."""
    if not os.path.exists(_DB_PATH):
        return jsonify({'error': 'no database'}), 400
    return send_file(_DB_PATH, as_attachment=True, download_name='mediavault.db')

# Загрузка и замена БД из файла (с проверкой валидности SQLite).
@app.route('/api/import_db', methods=['POST'])
@admin_required
@api_error_handler
def api_import_db():
    """Replace the DB with an uploaded file."""
    if 'file' not in request.files:
        return jsonify({'error': 'no file'}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'empty filename'}), 400
    try:
        _ensure_db_dir()
        tmp = _DB_PATH + '.import_tmp'
        file.save(tmp)
        conn = sqlite3.connect(tmp)
        conn.execute('SELECT COUNT(*) FROM files')
        conn.close()
        os.replace(tmp, _DB_PATH)
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Очистка кэша превью (таблица thumbnail_cache).
@app.route('/api/clear_thumb_cache', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_thumb_cache():
    log_debug('clear_thumb_cache')
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            db.execute('DELETE FROM thumbnail_cache')
            db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            db.commit()
            count = db.total_changes
            db.close()
            log_info('clear_thumb_cache removed %d entries + checkpoint', count)
        except Exception as e:
            log_error('clear_thumb_cache error: %s', e)
            return jsonify({'error': str(e)}), 500
    return jsonify({'ok': True})

# Перегенерация всех миниатюр (фон, асинхронно).
@app.route('/api/regenerate_thumbnails', methods=['POST'])
@admin_required
@api_error_handler
def api_regenerate_thumbnails():
    """Regenerate all thumbnails in background thread."""
    log_info('regenerate_thumbnails')
    if _thumb_regen_progress['running']:
        return jsonify({'error': 'already running'}), 409
    threading.Thread(target=_regen_all_thumbnails, daemon=True).start()
    return jsonify({'ok': True})

# Статус перегенерации миниатюр.
@app.route('/api/regenerate_thumbnails_status', methods=['GET'])
@api_error_handler
def api_regenerate_thumbnails_status():
    return jsonify(_thumb_regen_progress)

def _regen_missing_thumbnails():
    global _thumb_regen_progress
    try:
        s = load_settings()
        media_dir = s.get('media_dir', '')
        db = _db_conn()
        files = db.execute('SELECT path FROM files WHERE type IN ("image", "video")').fetchall()
        db.close()
        total = len(files)
        generated = 0
        skipped = 0
        _thumb_regen_progress = {'running': True, 'current': 0, 'total': total, 'skipped': 0, 'mode': 'missing'}
        log_info('_regen_missing_thumbnails: checking %d files', total)
        for i, row in enumerate(files):
            full = os.path.join(media_dir, row[0]) if media_dir else row[0]
            if os.path.exists(full):
                data = _get_thumbnail(full)
                if data:
                    generated += 1
                else:
                    skipped += 1
            else:
                skipped += 1
            _thumb_regen_progress['current'] = i + 1
            _thumb_regen_progress['skipped'] = skipped
        log_info('_regen_missing_thumbnails: %d generated, %d skipped / %d total', generated, skipped, total)
    except Exception as e:
        log_error('_regen_missing_thumbnails error: %s', e)
    finally:
        _thumb_regen_progress['running'] = False

# Генерация недостающих миниатюр (асинхронно, с прогрессом).
@app.route('/api/generate_missing_thumbnails', methods=['POST'])
@admin_required
@api_error_handler
def api_generate_missing_thumbnails():
    """Generate thumbnails for files that don't have one yet (async)."""
    log_info('generate_missing_thumbnails')
    if _thumb_regen_progress['running']:
        return jsonify({'error': 'already running'}), 409
    threading.Thread(target=_regen_missing_thumbnails, daemon=True).start()
    return jsonify({'ok': True})

# SSE-поток: очистка + перегенерация всех миниатюр с живым прогрессом.
@app.route('/api/regenerate_thumbnails/stream', methods=['GET'])
@admin_required
@api_error_handler
def api_regen_thumbnails_stream():
    """SSE stream: clear cache + regenerate all thumbnails with live progress."""
    log_info('regenerate_thumbnails/stream')
    if _thumb_regen_progress['running']:
        return jsonify({'error': 'already running'}), 409

    def generate():
        global _thumb_regen_progress, _thumb_regen_cancel
        try:
            s = load_settings()
            media_dir = s.get('media_dir', '')
            db = _db_conn()
            db.execute('DELETE FROM thumbnail_cache')
            db.commit()
            files = db.execute('SELECT path FROM files WHERE type IN ("image", "video")').fetchall()
            db.close()
            total = len(files)
            generated = 0
            skipped = 0
            failed = 0
            _thumb_regen_progress = {'running': True, 'current': 0, 'total': total, 'skipped': 0, 'mode': 'all'}
            _thumb_regen_cancel = False

            log_info('regen_thumbnails/stream: regenerating %d thumbnails', total)
            yield f'data: {json.dumps({"type": "start", "total": total})}\n\n'

            for i, row in enumerate(files):
                if _thumb_regen_cancel:
                    yield f'data: {json.dumps({"type": "cancelled", "current": i, "total": total, "generated": generated, "skipped": skipped, "failed": failed})}\n\n'
                    log_info('regen_thumbnails/stream: cancelled at %d/%d', i, total)
                    return

                full = os.path.join(media_dir, row[0]) if media_dir else row[0]
                t0 = time.time()
                status = 'skipped'

                if os.path.exists(full):
                    try:
                        data = _get_thumbnail(full)
                        elapsed = time.time() - t0
                        if data:
                            status = 'generated'
                            generated += 1
                            log_debug_green('regen_thumbnails [%d/%d] GENERATED (%.2fs) %s', i + 1, total, elapsed, row[0])
                        else:
                            status = 'failed'
                            failed += 1
                            log_debug_red('regen_thumbnails [%d/%d] FAILED (%.2fs) %s', i + 1, total, elapsed, row[0])
                    except Exception as e:
                        elapsed = time.time() - t0
                        status = 'failed'
                        failed += 1
                        log_debug_red('regen_thumbnails [%d/%d] ERROR (%.2fs) %s: %s', i + 1, total, elapsed, row[0], e)
                else:
                    elapsed = time.time() - t0
                    skipped += 1
                    log_debug('regen_thumbnails [%d/%d] SKIP (not found) (%.2fs) %s', i + 1, total, elapsed, row[0])

                _thumb_regen_progress['current'] = i + 1
                _thumb_regen_progress['skipped'] = skipped

                yield f'data: {json.dumps({"type": "progress", "current": i + 1, "total": total, "status": status, "path": row[0], "generated": generated, "skipped": skipped, "failed": failed})}\n\n'

            yield f'data: {json.dumps({"type": "done", "total": total, "generated": generated, "skipped": skipped, "failed": failed})}\n\n'
            log_info('regen_thumbnails/stream: %d generated, %d skipped, %d failed / %d total', generated, skipped, failed, total)
        except GeneratorExit:
            pass
        except Exception as e:
            log_error('regen_thumbnails/stream error: %s', e)
            yield f'data: {json.dumps({"type": "error", "message": str(e)})}\n\n'
        finally:
            _thumb_regen_progress['running'] = False
            _thumb_regen_cancel = False

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

# Отмена перегенерации миниатюр.
@app.route('/api/cancel_regen', methods=['POST'])
@admin_required
@api_error_handler
def api_cancel_regen():
    """Cancel ongoing thumbnail regeneration."""
    global _thumb_regen_cancel
    if not _thumb_regen_progress['running']:
        return jsonify({'error': 'not running'}), 400
    _thumb_regen_cancel = True
    log_info('cancel_regen: cancellation requested')
    return jsonify({'ok': True})

# Добавление/удаление тегов у файла.
@app.route('/api/tags', methods=['POST'])
@admin_required
@api_error_handler
def api_tags():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    path = data.get('path', '')
    tags = data.get('tags', [])
    action = data.get('action', 'add')
    if not path or not tags:
        return jsonify({'error': 'invalid_input'}), 400
    rel = os.path.relpath(path, settings.get('media_dir', '/'))
    if rel.startswith('..'):
        return jsonify({'error': 'invalid_path'}), 400
    db = _db_conn()
    row = db.execute('SELECT id, tags FROM files WHERE path = ?', [rel]).fetchone()
    if not row:
        db.close()
        return jsonify({'error': 'file_not_found'}), 404
    fid, existing_tags = row
    tag_set = set(t.strip() for t in (existing_tags or '').split(',') if t.strip())
    if action == 'add':
        tag_set.update(tags)
    else:
        tag_set.difference_update(tags)
    db.execute('UPDATE files SET tags = ? WHERE id = ?', [','.join(sorted(tag_set)), fid])
    db.commit()
    db.close()
    return jsonify({'ok': True, 'tags': ','.join(sorted(tag_set))})

# Массовое добавление/удаление тега для всех файлов.
@app.route('/api/tags/bulk', methods=['POST'])
@admin_required
@api_error_handler
def api_tags_bulk():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    tag = data.get('tag', '').strip()
    action = data.get('action', 'add')
    if not tag:
        return jsonify({'error': 'invalid_input'}), 400
    db = _db_conn()
    try:
        rows = db.execute('SELECT id, tags FROM files').fetchall()
        for fid, existing_tags in rows:
            tag_set = set(t.strip() for t in (existing_tags or '').split(',') if t.strip())
            if action == 'add':
                tag_set.add(tag)
            else:
                tag_set.discard(tag)
            db.execute('UPDATE files SET tags = ? WHERE id = ?', [','.join(sorted(tag_set)), fid])
        db.commit()
    finally:
        db.close()
    return jsonify({'ok': True})

# Инкрементирует cache_buster — браузер перезапросит thumbnail/media.
@app.route('/api/clear_browser_cache', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_browser_cache():
    s = load_settings()
    s['cache_buster'] = s.get('cache_buster', 0) + 1
    save_settings(s)
    log_info('clear_browser_cache: busted to %d', s['cache_buster'])
    return jsonify({'ok': True, 'cache_buster': s['cache_buster']})

# Очистка in-memory кэша (API + MD5) и таблиц scan_results/auto_scan.
@app.route('/api/clear_tag_cache', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_tag_cache():
    """Clear API cache, MD5 cache, and scan_results table."""
    log_info('clear_tag_cache')
    global _api_cache, _md5_cache
    _api_cache = {}
    _md5_cache = {}
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            db.execute('DROP TABLE IF EXISTS scan_results')
            db.execute('DROP TABLE IF EXISTS auto_scan')
            db.commit()
            db.close()
            log_debug('clear_tag_cache dropped scan_results + auto_scan tables')
        except Exception as e:
            log_error('clear_tag_cache db error: %s', e)
    return jsonify({'ok': True})

# Очистка таблиц files, scan_results, auto_scan (категории сохраняются).
@app.route('/api/clear_database', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_database():
    """Clear all file records from the database (preserves categories)."""
    log_info('clear_database')
    global _api_cache, _md5_cache
    _api_cache = {}
    _md5_cache = {}
    if not os.path.exists(_DB_PATH):
        return jsonify({'ok': True})
    try:
        db = _db_conn()
        db.execute('DELETE FROM files')
        db.execute('DELETE FROM thumbnail_cache')
        db.execute('DROP TABLE IF EXISTS scan_results')
        db.execute('DROP TABLE IF EXISTS auto_scan')
        db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
        db.commit()
        db.close()
        s = load_settings()
        s['startup_scan_count'] = 0
        save_settings(s)
        log_info('clear_database: cleared files, thumb_cache, scan_results, auto_scan + checkpoint')
        return jsonify({'ok': True})
    except Exception as e:
        log_error('clear_database error: %s', e)
        return jsonify({'error': str(e)}), 500

# Полная очистка: кэш тегов + превью + БД + фоновое пересканирование.
@app.route('/api/clear_all', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_all():
    """Clear everything: tag cache, thumb cache, database — then rescan in background."""
    log_info('clear_all: starting')
    global _api_cache, _md5_cache
    _api_cache = {}
    _md5_cache = {}
    api_clear_tag_cache()
    api_clear_thumb_cache()
    api_clear_database()
    if settings.get('media_dir'):
        threading.Thread(target=_quick_scan, daemon=True).start()
    log_info('clear_all: done, background scan started')
    return jsonify({'ok': True})

# Очистка таблиц тегов (tags + tag_category_members), кэша и результатов сканирования.
@app.route('/api/clear_tags', methods=['POST'])
@admin_required
@api_error_handler
def api_clear_tags():
    """Clear tags tables, API cache, MD5 cache, scan_results, auto_scan. Keep categories."""
    log_info('clear_tags: starting')
    global _api_cache, _md5_cache
    _api_cache = {}
    _md5_cache = {}
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            db.execute('DROP TABLE IF EXISTS tag_category_members')
            db.execute('DROP TABLE IF EXISTS scan_results')
            db.execute('DROP TABLE IF EXISTS auto_scan')
            db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            db.commit()
            db.close()
            log_info('clear_tags: dropped tag_category_members, scan_results, auto_scan + checkpoint')
        except Exception as e:
            log_error('clear_tags db error: %s', e)
            return jsonify({'error': str(e)}), 500
    return jsonify({'ok': True})

# Полная очистка БД: всё кроме users, comics, comic_pages.
@app.route('/api/delete_all', methods=['POST'])
@admin_required
@api_error_handler
def api_delete_all():
    """Delete everything except users, comics, comic_pages. Rescan in background."""
    log_info('delete_all: starting')
    global _api_cache, _md5_cache
    _api_cache = {}
    _md5_cache = {}
    if os.path.exists(_DB_PATH):
        try:
            db = _db_conn()
            db.execute('DELETE FROM files')
            db.execute('DROP TABLE IF EXISTS tag_categories')
            db.execute('DROP TABLE IF EXISTS tag_category_members')
            db.execute('DROP TABLE IF EXISTS scan_results')
            db.execute('DROP TABLE IF EXISTS auto_scan')
            db.execute('DELETE FROM thumbnail_cache')
            db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
            db.commit()
            db.close()
            log_info('delete_all: cleared files, categories, scan data, thumbs + checkpoint')
        except Exception as e:
            log_error('delete_all db error: %s', e)
            return jsonify({'error': str(e)}), 500
    s = load_settings()
    s['startup_scan_count'] = 0
    save_settings(s)
    if settings.get('media_dir'):
        threading.Thread(target=_quick_scan, daemon=True).start()
    log_info('delete_all: done, background scan started')
    return jsonify({'ok': True})

# Удаление дубликатов по имени+размеру. Теги дубля объединяются с оригиналом.
@app.route('/api/deduplicate', methods=['POST'])
@admin_required
@api_error_handler
def api_deduplicate():
    if not os.path.exists(_DB_PATH):
        return jsonify({'error': 'db not found'}), 400
    try:
        db = _db_conn()
        rows = db.execute('SELECT path, name, COALESCE(tags,\'\') as tags, COALESCE(size,0) as sz FROM files ORDER BY name, sz').fetchall()
        seen = {}
        remove = []
        for path, name, tags, sz in rows:
            key = (name, sz)
            if key in seen:
                prev_path, prev_tags = seen[key]
                merged = prev_tags
                dup_tags = tags
                if dup_tags:
                    if merged:
                        merged = ','.join(sorted(set(merged.split(',') + dup_tags.split(','))))
                    else:
                        merged = dup_tags
                log_info('dedup: merging %s -> %s', path, prev_path)
                db.execute('UPDATE files SET tags = ? WHERE path = ?', [merged, prev_path])
                remove.append(path)
            else:
                seen[key] = (path, tags)
        for p in remove:
            db.execute('DELETE FROM files WHERE path = ?', [p])
        db.commit()
        db.close()
        log_info('dedup: removed %d duplicates', len(remove))
        return jsonify({'ok': True, 'removed': len(remove)})
    except Exception as e:
        log_error('deduplicate error: %s', e)
        return jsonify({'error': str(e)}), 500

# ── Comics/Manga API ──

# Поиск комиксов по названию.
@app.route('/api/comics/search')
@api_error_handler
def api_comics_search():
    q = request.args.get('q', '').strip().lower()
    if not q:
        return jsonify([])
    try:
        db = _db_conn()
        rows = db.execute('''
            SELECT c.id, c.title, c.cover_path, c.created_at,
              (SELECT file_path FROM comic_pages WHERE comic_id = c.id ORDER BY page_number LIMIT 1) as first_page
            FROM comics c
            WHERE LOWER(c.title) LIKE ?
            ORDER BY c.created_at DESC
        ''', ['%' + q + '%']).fetchall()
        db.close()
        return jsonify([{
            'id': r[0], 'title': r[1],
            'cover': r[2] if r[2] else r[4],
            'created_at': r[3]
        } for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Список всех комиксов.
@app.route('/api/comics/list')
@api_error_handler
def api_comics_list():
    try:
        db = _db_conn()
        rows = db.execute('''
            SELECT c.id, c.title, c.cover_path, c.created_at, c.source,
              (SELECT file_path FROM comic_pages WHERE comic_id = c.id ORDER BY page_number LIMIT 1) as first_page,
              (SELECT COUNT(*) FROM comic_pages WHERE comic_id = c.id) as page_count
            FROM comics c ORDER BY c.created_at DESC
        ''').fetchall()
        db.close()
        return jsonify([{
            'id': r[0], 'title': r[1],
            'cover': r[2] if r[2] else r[5],
            'created_at': r[3],
            'source': r[4] or '',
            'page_count': r[6]
        } for r in rows])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Создание нового комикса из списка файлов.
@app.route('/api/comics/add', methods=['POST'])
@admin_required
@api_error_handler
def api_comics_add():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    title = data.get('title', '').strip()
    paths = data.get('paths', [])
    if not title:
        return jsonify({'error': 'title required'}), 400
    if not paths:
        return jsonify({'error': 'at least one file required'}), 400
    try:
        db = _db_conn()
        media_dir = settings.get('media_dir', '')
        cover = data.get('cover_path') or (paths[0] if paths else None)
        source = data.get('source', '')
        source_id = data.get('source_id', '')
        c = db.execute('INSERT INTO comics (title, cover_path, source, source_id) VALUES (?, ?, ?, ?)',
                       [title, cover, source, source_id])
        comic_id = c.lastrowid
        for i, p in enumerate(paths):
            db.execute('INSERT INTO comic_pages (comic_id, page_number, file_path) VALUES (?, ?, ?)', [comic_id, i+1, p])
        db.commit()
        db.close()
        return jsonify({'id': comic_id, 'title': title})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Удаление комикса и всех его страниц.
@app.route('/api/comics/delete', methods=['POST'])
@admin_required
@api_error_handler
def api_comics_delete():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    comic_id = data.get('id')
    if not comic_id:
        return jsonify({'error': 'id required'}), 400
    try:
        db = _db_conn()
        db.execute('DELETE FROM comic_pages WHERE comic_id = ?', [comic_id])
        db.execute('DELETE FROM comics WHERE id = ?', [comic_id])
        db.commit()
        db.close()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Данные комикса со страницами.
@app.route('/api/comics/get', methods=['POST'])
@api_error_handler
def api_comics_get():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    comic_id = data.get('id')
    if not comic_id:
        return jsonify({'error': 'id required'}), 400
    try:
        db = _db_conn()
        row = db.execute('SELECT id, title, cover_path FROM comics WHERE id = ?', [comic_id]).fetchone()
        if not row:
            db.close()
            return jsonify({'error': 'not_found'}), 404
        pages = db.execute('SELECT page_number, file_path FROM comic_pages WHERE comic_id = ? ORDER BY page_number', [comic_id]).fetchall()
        db.close()
        return jsonify({
            'id': row[0],
            'title': row[1],
            'cover': row[2],
            'pages': [{'page_number': p[0], 'path': p[1]} for p in pages]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Обновление комикса (название, страницы, обложка).
@app.route('/api/comics/update', methods=['POST'])
@admin_required
@api_error_handler
def api_comics_update():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    comic_id = data.get('id')
    title = data.get('title', '').strip()
    if not comic_id or not title:
        return jsonify({'error': 'id and title required'}), 400
    paths = data.get('paths', [])
    if not paths:
        return jsonify({'error': 'at least one file required'}), 400
    try:
        db = _db_conn()
        cover = data.get('cover_path') or paths[0]
        db.execute('UPDATE comics SET title = ?, cover_path = ? WHERE id = ?', [title, cover, comic_id])
        db.execute('DELETE FROM comic_pages WHERE comic_id = ?', [comic_id])
        for i, p in enumerate(paths):
            db.execute('INSERT INTO comic_pages (comic_id, page_number, file_path) VALUES (?, ?, ?)', [comic_id, i+1, p])
        db.commit()
        db.close()
        return jsonify({'ok': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Добавление тега к странице комикса с указанием source (r34/dan/nhentai).
# Синтаксис: POST /api/comics/pages/tag  {"path": "...", "tag": "tag_name", "source": "r34|dan|nhentai"}
@app.route('/api/comics/pages/tag', methods=['POST'])
@admin_required
@api_error_handler
def api_comics_pages_tag():
    data = request.get_json()
    if data is None:
        return jsonify({'error': 'no data'}), 400
    path = data.get('path', '')
    tag = data.get('tag', '').strip()
    source = data.get('source', '')
    if not path or not tag or not source:
        return jsonify({'error': 'bad params'}), 400
    if source not in ('r34', 'dan', 'nhentai'):
        return jsonify({'error': 'invalid source'}), 400

    source_map = {'r34': 'rule34', 'dan': 'danbooru', 'nhentai': 'nhentai'}
    cat_source = source_map[source]
    rel = os.path.relpath(path, settings.get('media_dir', '/'))
    if rel.startswith('..'):
        return jsonify({'error': 'invalid_path'}), 400

    db = _db_conn()
    try:
        # 1. Add tag to file's tags
        row = db.execute('SELECT id, tags FROM files WHERE path = ?', [rel]).fetchone()
        if row:
            fid, existing_tags = row
            tag_set = set(t.strip() for t in (existing_tags or '').split(',') if t.strip())
            tag_set.add(tag)
            db.execute('UPDATE files SET tags = ? WHERE id = ?', [','.join(sorted(tag_set)), fid])
        else:
            filepath = _safe_media_path(rel)
            if not filepath or not os.path.exists(filepath):
                return jsonify({'error': 'file not found'}), 404
            ext = os.path.splitext(filepath)[1].lower()
            ftype = _get_file_type(ext)
            stat = os.stat(filepath)
            width, height = 0, 0
            if ftype == 'image':
                width, height = _get_image_dimensions(filepath)
            db.execute(
                'INSERT INTO files (path, name, type, size, mtime, tags, width, height, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
                [rel, os.path.basename(rel), ftype, stat.st_size, int(stat.st_mtime), tag, width, height, int(time.time())]
            )

        # 2. Add tag to category system with correct source (NOT 'manual')
        cat = 'general'
        if source == 'r34':
            cat = _categorize_r34_tag(tag)
        db.execute("INSERT OR IGNORE INTO tag_categories (name, color) VALUES (?, ?)",
                   [cat, {'artist':'#ff4444','character':'#44cc44','copyright':'#4488ff','general':'#cccccc','meta':'#999999'}.get(cat, '#cccccc')])
        db.execute("""
            INSERT INTO tag_category_members (tag_name, category, source, last_updated)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tag_name) DO UPDATE SET
                category = excluded.category,
                source = excluded.source,
                last_updated = excluded.last_updated
        """, [tag, cat, cat_source, int(time.time())])

        # 3. Mark found in scan_results
        _ensure_scan_results_table()
        _mark_tags_found(rel)

        db.commit()
        return jsonify({'ok': True, 'tag': tag})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

# ── Entry point ───────────────────────────────

def main():
    """Точка входа: парсит аргументы CLI, инициализирует хранилище ключей,
    запускает фоновое сканирование, открывает браузер, стартует Flask.

    --port  PORT      Порт (default: 5050)
    --debug           Режим отладки (авто-перезагрузка + debug.log)
    --bind  INTERFACE Интерфейс (default: 127.0.0.1)
    """
    global settings
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5050)
    parser.add_argument('--debug', action='store_true')
    parser.add_argument('--bind', default='127.0.0.1', help='Interface to bind (default: 127.0.0.1)')
    args, _ = parser.parse_known_args()
    if args.debug:
        _enable_debug_logging()

    # Сохраняем secret_key между перезапусками
    global app
    s = load_settings()
    if not s.get('secret_key'):
        s['secret_key'] = secrets.token_hex(32)
        save_settings(s)
    else:
        app.secret_key = s['secret_key']

    _ensure_db_schema()
    _ensure_admin_user()

    if args.debug:
        from werkzeug.debug import get_pin_and_cookie_name
        pin, _ = get_pin_and_cookie_name(app)
        if pin:
            LOG.info(' * Debugger PIN: %s', pin)
        log_info('MediaVault starting on port %d (debug=%s)', args.port, args.debug)
    else:
        log_info('MediaVault starting on port %d (debug=%s)', args.port, args.debug)

    # Инициализация хранилища API-ключей (GNOME Keyring / VaultStore / plain)
    init_credential_store()
    if _credential_store and s.get('credential_backend') != 'plain':
        s = load_settings()
        cred = s.get('credentials', {})
        changed = False
        for site, keys in [('rule34', ['uid', 'key']), ('danbooru', ['login', 'key'])]:
            site_cred = cred.get(site, {})
            for k in keys:
                val = site_cred.get(k, '')
                if val and not _credential_store.get(f'api:{site}:{k}'):
                    _credential_store.set(f'api:{site}:{k}', val)
                    changed = True
        if changed:
            save_settings(s)
    settings = load_settings()

    # Миграция старого JPEG-кэша превью в AVIF (однократно)
    if not settings.get('thumb_migrated'):
        _ensure_db_schema()
        try:
            db = _db_conn()
            db.execute('DELETE FROM thumbnail_cache')
            db.commit()
            db.close()
            settings['thumb_migrated'] = True
            save_settings(settings)
            log_info('thumbnail cache cleared (migrated to AVIF)')
        except Exception:
            pass

    # Фоновое сканирование + открытие браузера (пропускаем reloader parent)
    if not args.debug or os.environ.get('WERKZEUG_RUN_MAIN'):
        threading.Thread(target=_quick_scan, daemon=True).start()
        # browser auto-open disabled

    use_reloader = args.debug and not getattr(sys, 'frozen', False)
    if getattr(sys, 'frozen', False) and args.debug:
        app.run(host=args.bind, port=args.port, debug=True, use_reloader=False,
                use_debugger=False, use_evalex=False, threaded=True)
    else:
        app.run(host=args.bind, port=args.port, debug=args.debug, use_reloader=use_reloader, threaded=True)

if __name__ == '__main__':
    main()
