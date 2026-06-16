// ============================================================
// Общие утилиты: экранирование HTML, уведомления, тема,
// интернационализация (i18n), форматирование размера,
// CSS.escape polyfill, звуковой сигнал
// ============================================================
var Shared = window.Shared || {};

// Экранирование HTML-спецсимволов для безопасной вставки в DOM
Shared.esc = function(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/[&<>"']/g, function(m) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
  });
};

// Показ всплывающего уведомления (toast) с авто-скрытием через 3 сек
Shared.notify = function(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  var bg = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#6366f1';
  toast.style.cssText = 'padding:10px 18px;border-radius:8px;background:'+bg+';color:#fff;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.25);animation:fadeSlide .2s ease;pointer-events:auto;max-width:360px';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.transition = 'opacity .3s,transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3000);
};

// Переключение тёмной/светлой темы с анимацией кнопки
Shared.toggleTheme = function(btn) {
  if (!btn) btn = document.getElementById('themeToggle');
  if (!btn) return;
  var html = document.documentElement;
  var current = html.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';

  // Toggle SVG icons
  var sun = btn.querySelector('.theme-sun');
  var moon = btn.querySelector('.theme-moon');
  if (sun) sun.style.display = next === 'dark' ? 'none' : '';
  if (moon) moon.style.display = next === 'dark' ? '' : 'none';

  // Spin animation
  btn.classList.remove('btn-spin');
  void btn.offsetWidth;
  btn.classList.add('btn-spin');

  // Change theme immediately
  html.setAttribute('data-theme', next);
  fetch('/api/theme', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({theme:next})});

  // Stop spin after animation
  if (btn._themeTmr) clearTimeout(btn._themeTmr);
  btn._themeTmr = setTimeout(function() {
    btn.classList.remove('btn-spin');
    btn._themeTmr = null;
  }, 500);
};

// Форматирование размера в человекочитаемый вид: B, KB, MB, GB
Shared.formatSize = function(bytes) {
  if (!bytes) return '0 B';
  var units = ['B','KB','MB','GB'];
  var i = 0, size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
};

// ─── i18n ───
var _i18nData = {
  en: {

    // Tagfetch
    tfRefresh: 'Refresh',
    tfFilterAll: 'All',
    tfFilterNoTags: 'Untagged',
    tfFilterFound: 'Found',
    tfFilterNotFound: 'Not found',
    tfFilterInDb: 'In DB',
    tfSelectFile: 'Select a file from the folder browser',
    tfLocal: 'Local',
    tfNotFetched: 'Not fetched',
    tfNoFile: 'No file selected',
    tfFetchTags: 'Fetch Tags',
    tfFetchAll: 'Fetch All',
    tfClearCache: 'Clear cache',
    tfSaveAll: 'Save All',
    tfStartAuto: 'Start Auto Scan',
    tfReady: 'Ready',
    tfSaveEarly: 'Save Early',
    tfScrollOn: 'Scroll: On',
    tfScanning: 'Scanning cache',
    // TF modal

    // Settings
    settings: 'Settings',
    settingsApiCreds: 'API Credentials',
    settingsMediaPath: '/path/to/media',
    settingsScan: 'Scan Folder',
    settingsSystemDialog: 'System Dialog',
    settingsDb: 'Database',
    settingsSaveStart: 'Save & Start',
    settingsSelectFolder: 'Select folder',
    settingsCleared: 'Cleared',
    settingsRunning: 'Running',
    settingsSkipped: 'skipped',
    settingsProcessed: 'processed',
    settingsGenerated: 'generated',
    settingsFailed: 'failed',
    settingsCancelling: 'Cancelling…',
    settingsClearCache: 'Clear thumbnail cache',
    settingsRegenThumbnails: 'Regenerate all thumbnails',
    settingsRegenMissing: 'Generate missing thumbnails',
    secConfirmClearThumb: 'Clear ALL cached thumbnails? They will be regenerated on demand.',
    secConfirmRegenThumb: 'Regenerate ALL thumbnails now? This may take a while.',
    secConfirmClearBrowser: 'Clear browser cache? All clients will reload thumbnails and media on next visit.',
    secConfirmClearTag: 'Clear tag cache for all files? Tags will need to be re-fetched.',
    secConfirmDedup: 'Deduplicate database? Duplicate file entries will be removed.',
    secConfirmClearDb: 'Clear ALL files from database? This will remove all scanned files.',
    settingsClearBrowserCache: 'Clear browser cache',
    settingsClearBrowserCacheDesc: 'Increment cache buster — forces browsers to refetch thumbnails and media.',
    settingsBrowserCache: 'Browser Cache',
    settingsBrowserCacheDefault: 'Default (24h)',
    settingsBrowserCacheReduced: 'Reduced (1h)',
    settingsBrowserCacheNoCache: 'No cache',
    settingsError: 'Error',

    // Security
    secPassword: 'Password',
    secNewPassword: 'New Password',
    secPwTooShort: 'Password too short (min 4)',
    secPwSet: 'Password set',
    secConfirmClearAll: 'Clear EVERYTHING? Tag cache, thumbnails, database all data will be wiped.',
    secUserReq: 'Username required, password min 4 chars',
    secUsername: 'Username',
    secRole: 'Role',
 
    // MediaVault
    mvHeader: 'MEDIAVAULT',
    mvSearchPlaceholder: 'Search by name...',
    mvSearchByTag: 'Search by tag',
    mvToggleSidebar: 'Sidebar',
    mvPopularTags: 'Popular Tags',
    mvCategorized: 'Categories',
    mvManageTags: 'Manage',
    home: 'Home',
    mvGallery: 'Gallery',
    mvComics: 'Comics',
    mvDesc: 'Browse and explore your media library',
    homeComicsFetch: 'Comics Fetch',
    sortByName: 'By name',
    sortByNewest: 'Newest',
    sortByOldest: 'Oldest',
    sortByNameTitle: 'Default sort (by name)',
    mvGroupColors: 'Group Colors',
    mvPageSize: 'Pg:',
    mvNoFiles: 'No files loaded',
    mvNoFilesDesc: 'Import a database to get started, or use Tagfetch to fetch tags first',
    mvBulkAdd: '+ Add',
    mvCatModalTitle: 'Tag Categories',
    mvCatModalClose: 'Close',
    mvCatModalNew: 'New category...',
    mvCatModalAssign: 'Assign tag...',
    mvCatModalNoTags: 'No tags',
    mvCatModalNoCats: 'No categories yet',
    mvCatModalFailed: 'Failed to load',

    // General
    welcome: 'Welcome to MediaVault',
    welcomeDesc: 'Import a database or use Tagfetch to get started',
    dbReady: 'Database ready',
    noFiles: 'No media files found',
    addTag: 'Add tag...',
    logout: 'Logout',
    bulkTag: 'Add to files',
    bulkTagExit: 'Exit',
    selected: '{n} selected',
    cancel: 'Cancel',
    svLoading: 'Loading...',
    svTapForTags: 'Tap image to show tags',
    svNoTags: 'No tags yet',

    // Comics
    previewComic: 'Preview comic',
    createComic: 'Create comic',
    showPreview: 'Show preview',
    openInViewer: 'Open in viewer',
    unsavedConfirm: 'You have unsaved changes. Discard them?',
    comicNamePlaceholder: 'Comic name',
    searchFiles: 'Search comic...',
    switchViewMode: 'Switch view mode',
    prevPage: 'Previous',
    nextPage: 'Next',
    delete: 'Delete',
    comicPagesLabel: 'Pages',
    save: 'Save',
    // Admin panel
    adminPanel: 'Admin Panel',
    navUsers: 'Users',
    navDatabase: 'Database',
    navApiKeys: 'API Keys',
    navTags: 'Tags',
    navFiles: 'Files',
    // Account
    accountSettings: 'Account Settings',
    accountChangeUsername: 'Change Username',
    accountCurrentPassword: 'Current Password',
    accountConfirmPassword: 'Confirm Password',
    // Content
    tagSearchPlaceholder: 'Search tags',
    alreadyExists: 'Already exists',
    addCategory: 'Add Category',
    // General admin
    userAddBtn: 'Add User',
    userSetPasswordBtn: 'Set Password',
    userRoleAdmin: 'Admin',
    userRoleUser: 'User',
    noUsers: 'No users yet',
    you: 'you',
    actions: 'Actions',
    lastAdminWarning: 'Cannot delete the last admin',
    sectionCredential: 'Credential Backend',
    sectionDatabase: 'Database Tools',
    credBackendDesc: 'Where API keys are stored',
    credStatus: 'Active backend',
    credKeyring: 'Keyring',
    secKeyring: 'Stored in GNOME Keyring',
    credPlainText: 'Plain Text',
    secPlainText: 'Stored in settings file',
    adminGalleryDir: 'Gallery folder',
    adminComicsDir: 'Comics folder',
    navFolders: 'Folders',
    sectionFolders: 'Folder Settings',
    settingsMediaPath: 'Media directory',
    settingsScan: 'Scan',
    settingsSystemDialog: 'Browse',
    settingsSaveStart: 'Save',
    settingsRunning: 'Running',
    dbImport: 'Import DB',
    settingsDb: 'Database management',
    settingsError: 'Error',
    loading: 'Loading',
    loadingError: 'Loading error',
    addTag: 'Add tag',
    tagBulkDelete: 'Delete selected',
    sortByNameTitle: 'Sort by name',
    confirmDelete: 'Confirm delete?',
    openInViewer: 'Open in viewer',
    previewComic: 'Preview',
    showPreview: 'Show preview',
    comicCreated: 'Comic created',
    createComic: 'Create Comic',
    unsavedConfirm: 'You have unsaved changes. Continue?',
    searchFiles: 'Search files',
    mediaDirEmpty: 'Media directory is empty',
    filesCountShort: 'files',
    added: "Added",
    adminSettings: "Administration & Settings",
    adminDesc: "Configure settings and manage access",
    categoryNewName: "New category name",
    created: "Created",
    deleted: "Deleted",
    effectsDescription: "Blur, animations and transitions",
    effectsOff: "Effects OFF",
    effectsOn: "Effects ON",
    effectsTitle: "Visual Effects",
    secLoginDesc: "Sign in to your account",
    secLoginTitle: "🔐 MediaVault",
    secSignIn: "Sign In",
    settingsAppearance: "Appearance",
    tagBulkDeleteConfirm: "Delete all categories and tags?",
    toAllMedia: "to all media",
    updated: "Updated",

    comicsEmpty: "No comics yet",
    comicsName: "Name",
    langToggle: "Switch language",
    sortToggle: "Toggle sort",
    themeToggle: "Switch theme",
    uncategorized: "Uncategorized",

    // Content Management
    autoFetch: "Auto",
    cleanThumbCache: "Clean Thumbnail Cache",
    cmDesc: "Manage tags, categories, and comics",
    cmHeader: "CONTENT MANAGEMENT",
    comicsEditor: "Comics Editor",
    exportDb: "Export DB",
    genMissingThumbs: "Generate Missing",
    manualFetch: "Manual",
    regenAllThumbs: "Regenerate All Thumbnails",
    settingsCleanAll: "Clean All",
    settingsCleanDb: "Clean Database",
    settingsCleanDuplicates: "Clean Duplicates",
    settingsCleanTagCache: "Clean Tag Cache",
    similarTo: "Similar to",
    similarBtn: "Similar",
    noResults: "No results",
    tagfetch: "TAGFETCH",
    tags: "TAGS",

    // Backends
    backendApiRaw: "API Raw (Rule34 / Danbooru)",
    backendGallerydl: "Gallery-DL (universal)",
    siteRule34: "Rule34",
    siteDanbooru: "Danbooru",
    siteNhentai: "NHentai",
    siteKemono: "Kemono",
    siteCoomer: "Coomer",
  },
  ru: {

    // Tagfetch
    tfRefresh: 'Обновить',
    tfFilterAll: 'Все',
    tfFilterNoTags: 'Без тегов',
    tfFilterFound: 'Найдено',
    tfFilterNotFound: 'Не найдено',
    tfFilterInDb: 'В БД',
    tfSelectFile: 'Выберите файл в обзорщике',
    tfLocal: 'Локальный',
    tfNotFetched: 'Не получено',
    tfNoFile: 'Файл не выбран',
    tfFetchTags: 'Получить теги',
    tfFetchAll: 'Получить всё',
    tfClearCache: 'Очистить кэш',
    tfSaveAll: 'Сохранить всё',
    tfStartAuto: 'Начать автосканирование',
    tfReady: 'Готов',
    tfSaveEarly: 'Сохранить досрочно',
    tfScrollOn: 'Прокрутка: Вкл',
    tfScanning: 'Сканирование кэша',

    // Settings
    settings: 'Настройки',
    settingsApiCreds: 'API доступа',
    settingsMediaPath: '/путь/к/медиа',
    settingsScan: 'Сканировать папку',
    settingsSystemDialog: 'Системный диалог',
    settingsDb: 'База данных',
    settingsSaveStart: 'Сохранить',
    settingsSelectFolder: 'Выбор папки',
    settingsCleared: 'Очищено',
    settingsRunning: 'Выполняется',
    settingsSkipped: 'пропущено',
    settingsProcessed: 'обработано',
    settingsGenerated: 'сгенерировано',
    settingsFailed: 'ошибок',
    settingsCancelling: 'Отмена…',
    settingsClearCache: 'Очистить кэш превью',
    settingsRegenThumbnails: 'Перегенерировать все превью',
    settingsRegenMissing: 'Сгенерировать недостающие',
    secConfirmClearThumb: 'Очистить ВСЕ кэшированные превью? Они будут перегенерированы при просмотре.',
    secConfirmRegenThumb: 'Перегенерировать ВСЕ превью сейчас? Это может занять время.',
    secConfirmClearBrowser: 'Сбросить кэш браузера? Все клиенты перезагрузят превью и медиа при следующем визите.',
    secConfirmClearTag: 'Очистить кэш тегов для всех файлов? Теги нужно будет получить заново.',
    secConfirmDedup: 'Дедуплицировать базу данных? Дублирующиеся записи будут удалены.',
    secConfirmClearDb: 'Удалить ВСЕ файлы из базы данных? Все отсканированные файлы будут удалены.',
    settingsClearBrowserCache: 'Сбросить кэш браузера',
    settingsClearBrowserCacheDesc: 'Инкрементировать cache buster — браузеры перезапросят превью и медиафайлы.',
    settingsError: 'Ошибка',

    // Security
    secPassword: 'Пароль',
    secNewPassword: 'Новый пароль',
    secPwTooShort: 'Пароль слишком короткий (мин. 4)',
    secPwSet: 'Пароль установлен',
    secConfirmClearAll: 'Очистить ВСЁ? Кэш тегов, миниатюры, БД все данные будут стёрты.',
    secUserReq: 'Имя пользователя обязательно, пароль мин. 4 символа',
    secUsername: 'Имя',
    secRole: 'Роль',

    // MediaVault
    mvHeader: 'MEDIAVAULT',
    mvSearchPlaceholder: 'Поиск...',
    mvSearchByTag: 'Поиск по тегу',
    mvToggleSidebar: 'Сайдбар',
    mvPopularTags: 'Популярные теги',
    mvCategorized: 'Категории',
    mvManageTags: 'Управление',
    home: 'Главная',
    mvGallery: 'Галерея',
    mvComics: 'Комиксы',
    mvDesc: 'Просмотр и управление медиатекой',
    homeComicsFetch: 'Поиск комиксов',
    mvGroupColors: 'Цвет групп',
    mvPageSize: 'Стр:',
    mvNoFiles: 'Файлы не загружены',
    mvNoFilesDesc: 'Импортируйте БД или используйте Tagfetch для получения тегов',
    mvBulkAdd: '+ Добавить',
    mvCatModalTitle: 'Категории тегов',
    mvCatModalClose: 'Закрыть',
    mvCatModalNew: 'Новая категория...',
    mvCatModalAssign: 'Назначить тег...',
    mvCatModalNoTags: 'Нет тегов',
    mvCatModalNoCats: 'Пока нет категорий',
    mvCatModalFailed: 'Ошибка загрузки категорий',

    // General
    welcome: 'Добро пожаловать в MediaVault',
    welcomeDesc: 'Импортируйте базу данных или используйте Tagfetch',
    dbReady: 'База данных готова',
    noFiles: 'Файлы не найдены',
    addTag: 'Добавить тег...',
    bulkTag: 'Добавить к файлам',
    bulkTagExit: 'Выйти',
    selected: 'Выбрано: {n}',
    cancel: 'Отмена',
    svLoading: 'Загрузка...',
    svTapForTags: 'Нажми на фото чтобы показать теги',
    svNoTags: 'Тегов пока нет',
    sortByName: 'По имени',
    sortByNewest: 'Сначала новые',
    sortByOldest: 'Сначала старые',
    sortByNameTitle: 'Стандартная сортировка (по имени)',

    // Comics
    previewComic: 'Предпросмотр',
    createComic: 'Создать комикс',
    showPreview: 'Показать',
    openInViewer: 'Открыть в просмотрщике',
    unsavedConfirm: 'У вас есть несохранённые изменения. Отменить?',
    comicNamePlaceholder: 'Название комикса',
    searchFiles: 'Поиск комикса...',
    switchViewMode: 'Переключить режим',
    prevPage: 'Предыдущая',
    nextPage: 'Следующая',
    delete: 'Удалить',
    comicPagesLabel: 'Страницы',
    save: 'Сохранить',
    // Admin panel
    adminPanel: 'Панель управления',
    navUsers: 'Пользователи',
    navDatabase: 'База данных',
    navApiKeys: 'API ключи',
    navTags: 'Теги',
    navFiles: 'Файлы',
    // Account
    accountSettings: 'Настройки аккаунта',
    accountChangeUsername: 'Сменить имя',
    accountCurrentPassword: 'Текущий пароль',
    accountConfirmPassword: 'Подтверждение пароля',
    // Content
    tagSearchPlaceholder: 'Поиск тегов',
    alreadyExists: 'Уже существует',
    addCategory: 'Добавить категорию',
    // General admin
    userAddBtn: 'Добавить',
    userSetPasswordBtn: 'Сменить пароль',
    userRoleAdmin: 'Админ',
    userRoleUser: 'Пользователь',
    noUsers: 'Нет пользователей',
    you: 'вы',
    actions: 'Действия',
    lastAdminWarning: 'Нельзя удалить последнего админа',
    sectionCredential: 'Хранилище ключей',
    sectionDatabase: 'Инструменты БД',
    credBackendDesc: 'Где хранятся API ключи',
    credStatus: 'Активный бэкенд',
    credKeyring: 'Связка ключей',
    secKeyring: 'Хранится в GNOME Keyring',
    credPlainText: 'Обычный текст',
    secPlainText: 'Хранится в файле настроек',
    adminGalleryDir: 'Папка галереи',
    adminComicsDir: 'Папка комиксов',
    navFolders: 'Папки',
    sectionFolders: 'Настройки папок',
    settingsMediaPath: 'Папка с медиа',
    settingsScan: 'Сканировать',
    settingsSystemDialog: 'Обзор',
    settingsSaveStart: 'Сохранить',
    settingsRunning: 'Выполняется',
    dbImport: 'Импорт БД',
    settingsDb: 'Управление БД',
    settingsError: 'Ошибка',
    loading: 'Загрузка',
    loadingError: 'Ошибка загрузки',
    addTag: 'Добавить тег',
    tagBulkDelete: 'Удалить выбранные',
    sortByNameTitle: 'Сортировать по имени',
    confirmDelete: 'Подтвердить удаление?',
    openInViewer: 'Открыть в просмотрщике',
    previewComic: 'Предпросмотр',
    showPreview: 'Показать превью',
    comicCreated: 'Комикс создан',
    createComic: 'Создать комикс',
    unsavedConfirm: 'Есть несохранённые изменения. Продолжить?',
    searchFiles: 'Поиск файлов',
    mediaDirEmpty: 'Папка с медиа пуста',
    filesCountShort: 'файлов',
    added: "Добавлен",
    adminSettings: "Администрирование и настройки",
    adminDesc: "Настройки и управление доступом",
    categoryNewName: "Новое имя категории",
    created: "Создан",
    deleted: "Удалён",
    effectsDescription: "Размытие, анимации и переходы",
    effectsOff: "Эффекты ВЫКЛ",
    effectsOn: "Эффекты ВКЛ",
    effectsTitle: "Визуальные эффекты",
    secLoginDesc: "Войдите в аккаунт",
    secLoginTitle: "🔐 MediaVault",
    secSignIn: "Войти",
    settingsAppearance: "Внешний вид",
    tagBulkDeleteConfirm: "Удалить все категории и теги?",
    toAllMedia: "ко всем медиа",
    updated: "Обновлён",

    comicsEmpty: "Комиксов пока нет",
    comicsName: "Название",
    langToggle: "Сменить язык",
    sortToggle: "Сменить сортировку",
    themeToggle: "Сменить тему",
    uncategorized: "Без категории",

    // Content Management
    autoFetch: "Авто",
    cleanThumbCache: "Очистить кэш превью",
    cmDesc: "Управление тегами, категориями и комиксами",
    cmHeader: "УПРАВЛЕНИЕ КОНТЕНТОМ",
    comicsEditor: "Редактор Комиксов",
    exportDb: "Экспорт БД",
    genMissingThumbs: "Сгенерировать недостающие",
    manualFetch: "Ручной",
    regenAllThumbs: "Перегенерировать все превью",
    settingsCleanAll: "Очистить всё",
    settingsCleanDb: "Очистить БД",
    settingsCleanDuplicates: "Очистить дубликаты",
    settingsCleanTagCache: "Очистить кэш тегов",
    similarTo: "Похоже на",
    similarBtn: "Похожие",
    noResults: "Нет результатов",
    tagfetch: "ПОИСК ТЕГОВ",
    tags: "ТЕГИ",

    // Backends
    backendApiRaw: "API Raw (Rule34 / Danbooru)",
    backendGallerydl: "Gallery-DL (универсальный)",
    siteRule34: "Rule34",
    siteDanbooru: "Danbooru",
    siteNhentai: "NHentai",
    siteKemono: "Kemono",
    siteCoomer: "Coomer",
  }
};

var _lang = (function() {
  try {
    var saved = localStorage.getItem('mediavault_lang');
    if (saved === 'en' || saved === 'ru') return saved;
  } catch(e) {}
  return document.documentElement.lang === 'ru' ? 'ru' : 'en';
})();

// Локализация строки по ключу с подстановкой параметров {key}
Shared.t = function(key, params) {
  var val = (_i18nData[_lang] && _i18nData[_lang][key]) || _i18nData.en[key] || key;
  if (params) {
    for (var k in params) {
      val = val.replace('{' + k + '}', params[k]);
    }
  }
  return val;
};

// Получение текущего языка
Shared.getLang = function() { return _lang; };

// Переключение языка en/ru с сохранением в localStorage и cookie
Shared.toggleLang = function(btn) {
  if (!btn) btn = document.getElementById('langToggle');
  if (!btn) return;
  var textEl = btn.querySelector('.lang-text');
  if (!textEl) return;
  var targetLang = _lang === 'en' ? 'ru' : 'en';
  _lang = targetLang;
  try { localStorage.setItem('mediavault_lang', _lang); } catch(e) {}
  document.cookie = 'mediavault_lang=' + _lang + ';path=/;max-age=31536000';
  document.documentElement.lang = _lang;
  Shared.applyI18n();
  textEl.textContent = _lang === 'en' ? 'EN' : 'RU';
  btn.classList.remove('show-text');
  void btn.offsetWidth;
  btn.classList.add('show-text');
  if (btn._langTmr) clearTimeout(btn._langTmr);
  btn._langTmr = setTimeout(function() {
    btn.classList.remove('show-text');
    btn._langTmr = null;
  }, 1200);
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: _lang } }));
};

// Переключение визуальных эффектов (blur/animations)
Shared.toggleEffects = function(btn) {
  if (!btn) btn = document.getElementById('effectsToggle');
  if (!btn) return;
  var html = document.documentElement;
  var current = html.hasAttribute('data-no-effects');
  var label = btn.querySelector('#effectsLabel');
  if (current) {
    html.removeAttribute('data-no-effects');
    btn.classList.remove('effects-off');
    btn.querySelector('.effects-on').style.display = '';
    btn.querySelector('.effects-off-icon').style.display = 'none';
    if (label) label.textContent = Shared.t ? Shared.t('effectsOn') : 'Effects ON';
  } else {
    html.setAttribute('data-no-effects', '');
    btn.classList.add('effects-off');
    btn.querySelector('.effects-on').style.display = 'none';
    btn.querySelector('.effects-off-icon').style.display = '';
    if (label) label.textContent = Shared.t ? Shared.t('effectsOff') : 'Effects OFF';
  }
  fetch('/api/effects', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({effects: current})});
};

Shared.initEffectsBtn = function() {
  var btn = document.getElementById('effectsToggle');
  if (!btn || btn._effectsInit) return;
  btn._effectsInit = true;
  var html = document.documentElement;
  var off = html.hasAttribute('data-no-effects');
  btn.classList.toggle('effects-off', off);
  var onIcon = btn.querySelector('.effects-on');
  var offIcon = btn.querySelector('.effects-off-icon');
  if (onIcon) onIcon.style.display = off ? 'none' : '';
  if (offIcon) offIcon.style.display = off ? '' : 'none';
  var label = document.getElementById('effectsLabel');
  if (label) label.textContent = Shared.t ? Shared.t(off ? 'effectsOff' : 'effectsOn') : (off ? 'Effects OFF' : 'Effects ON');
};

Shared.initThemeBtn = function() {
  var btn = document.getElementById('themeToggle');
  if (!btn || btn._themeInit) return;
  btn._themeInit = true;
  var pressTimer = null, held = false;
  btn.addEventListener('click', function(e) {
    if (!held) Shared.toggleTheme(btn);
  });
  btn.addEventListener('pointerdown', function() {
    held = false;
    pressTimer = setTimeout(function() {
      held = true;
      var textEl = btn.querySelector('.theme-text');
      if (!textEl) return;
      var html = document.documentElement;
      textEl.textContent = html.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
      btn.classList.add('show-text');
    }, 400);
  });
  btn.addEventListener('pointerup', function() {
    clearTimeout(pressTimer);
    if (!held) {
      Shared.toggleTheme(btn);
    } else {
      btn.classList.remove('show-text');
      held = false;
    }
  });
  btn.addEventListener('pointercancel', function() {
    clearTimeout(pressTimer);
    btn.classList.remove('show-text');
    held = false;
  });
  btn.addEventListener('pointerleave', function() {
    if (held) {
      clearTimeout(pressTimer);
      btn.classList.remove('show-text');
      held = false;
    }
  });
};

Shared.initLangBtn = function() {
  var btn = document.getElementById('langToggle');
  if (!btn || btn._langInit) return;
  btn._langInit = true;
  var pressTimer = null, held = false;
  btn.addEventListener('click', function(e) {
    if (!held) Shared.toggleLang(btn);
  });
  btn.addEventListener('pointerdown', function() {
    held = false;
    pressTimer = setTimeout(function() {
      held = true;
      var textEl = btn.querySelector('.lang-text');
      if (!textEl) return;
      textEl.textContent = _lang === 'en' ? 'EN' : 'RU';
      btn.classList.add('show-text');
    }, 400);
  });
  btn.addEventListener('pointerup', function() {
    clearTimeout(pressTimer);
    if (!held) {
      Shared.toggleLang(btn);
    } else {
      btn.classList.remove('show-text');
      held = false;
    }
  });
  btn.addEventListener('pointercancel', function() {
    clearTimeout(pressTimer);
    btn.classList.remove('show-text');
    held = false;
  });
  btn.addEventListener('pointerleave', function() {
    if (held) {
      clearTimeout(pressTimer);
      btn.classList.remove('show-text');
      held = false;
    }
  });
};

// Применение i18n ко всем элементам с data-i18n атрибутами на странице
Shared.applyI18n = function() {
  document.documentElement.lang = _lang;
  var langLabel = _lang === 'en' ? '🇬🇧 EN' : '🇷🇺 RU';
  try {
    document.querySelectorAll('button').forEach(function(el) {
      var t = el.textContent.trim();
      if (t === '🇬🇧 EN' || t === '🇷🇺 RU') el.textContent = langLabel;
    });
  } catch(e) {}
  var langTextEl = document.querySelector('#langToggle .lang-text');
  if (langTextEl) langTextEl.textContent = _lang === 'en' ? 'RU' : 'EN';
  try {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      try {
        var key = el.dataset.i18n;
        if (!key) return;
        var params = null;
        if (el.dataset.i18nParams) {
          try { params = JSON.parse(el.dataset.i18nParams); } catch(e) {}
        }
        var val = Shared.t(key, params);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = val;
        } else {
          var texts = [];
          el.childNodes.forEach(function(n) {
            if (n.nodeType === 3) texts.push(n);
          });
          if (texts.length === 1) {
            texts[0].textContent = val;
          } else if (texts.length === 0 && !el.children.length) {
            el.textContent = val;
          } else {
            for (var i = 0; i < el.childNodes.length; i++) {
              if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim()) {
                el.childNodes[i].textContent = val;
                break;
              }
            }
          }
        }
      } catch(e) {}
    });
  } catch(e) {}
  try {
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      el.title = Shared.t(el.dataset.i18nTitle);
    });
  } catch(e) {}
  try {
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      el.placeholder = Shared.t(el.dataset.i18nPlaceholder);
    });
  } catch(e) {}
  try {
    document.querySelectorAll('[data-i18n-banner]').forEach(function(el) {
      el.textContent = _lang === 'ru' ? el.dataset.msgRu : el.dataset.msgEn;
    });
  } catch(e) {}
  document.documentElement.classList.add('i18n-ready');
};

// CSS.escape polyfill for older browsers
if (!CSS.escape) {
  CSS.escape = function(value) {
    value = String(value);
    var length = value.length;
    var result = '';
    for (var i = 0; i < length; i++) {
      var ch = value.charCodeAt(i);
      // Escape if non-alphanumeric (simplified)
      if ((ch >= 0x30 && ch <= 0x39) || (ch >= 0x41 && ch <= 0x5A) || (ch >= 0x61 && ch <= 0x7A)) {
        result += value[i];
      } else {
        result += '\\' + value[i].charCodeAt(0).toString(16) + ' ';
      }
    }
    return result;
  };
}

// Воспроизведение короткого звукового сигнала через Web Audio API
Shared.playChime = function() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var g = ctx.createGain();
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    o.connect(g);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch(e) {}
};

// Преобразование HEX-цвета в rgba с заданной прозрачностью
Shared.hexToRgba = function(hex, alpha) {
  var v = parseInt(hex.slice(1), 16);
  return 'rgba(' + (v>>16) + ', ' + ((v>>8)&255) + ', ' + (v&255) + ', ' + alpha + ')';
};

// Парсинг строки тегов (разделитель — запятая)
Shared.parseTags = function(str) {
  return str ? str.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
};

// ─── Gallery layout utilities (shared between MV + CM) ───

Shared.getColumnCount = function(gallery) {
  if (!gallery) return 4;
  var style = getComputedStyle(gallery);
  var colW = parseFloat(style.columnWidth) || 160;
  var gap = parseFloat(style.columnGap) || 10;
  return Math.max(1, Math.round((gallery.offsetWidth + gap) / (colW + gap)));
};

Shared.reorderGalleryDOM = function(gallery, itemSelector) {
  if (!gallery) return;
  var items = gallery.querySelectorAll(itemSelector);
  if (items.length === 0) return;
  var cols = Shared.getColumnCount(gallery);
  if (cols <= 1) return;
  var rows = Math.ceil(items.length / cols);
  var ordered = [];
  for (var c = 0; c < cols; c++) {
    for (var r = 0; r < rows; r++) {
      var idx = r * cols + c;
      if (idx < items.length) ordered.push(items[idx]);
    }
  }
  ordered.forEach(function(el) { gallery.appendChild(el); });
};

Shared.getVisualOrder = function(gallery, itemSelector) {
  var items = gallery.querySelectorAll(itemSelector);
  var sorted = Array.prototype.slice.call(items);
  sorted.sort(function(a, b) {
    var ra = a.getBoundingClientRect();
    var rb = b.getBoundingClientRect();
    return ra.top - rb.top || ra.left - rb.left;
  });
  return sorted.map(function(el) { return el.dataset.path; });
};

// ─── Logout and dropdown utilities ───
Shared.logout = function() {
  fetch('/api/logout', {method:'POST'}).then(function(){ window.location.href = '/'; });
};
Shared.toggleDropdown = function(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('open');
};

window.Shared = Shared;

window._cbSuffix = function() {
  var b = window.CONFIG && CONFIG.cacheBuster;
  return b ? '&cb=' + b : '';
};
