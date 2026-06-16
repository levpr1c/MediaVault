// ============================================================
// API-клиент MediaVault: получение файлов, превью, информации,
// сохранение тегов, категории
// ============================================================
var MediaVaultAPI = window.MediaVaultAPI || {};

// Обход директории (список файлов и папок)
MediaVaultAPI.browse = function(path) {
  return fetch('/api/browse?path=' + encodeURIComponent(path)).then(function(r) { return r.json(); });
};

function _cb() {
  var b = window.CONFIG && CONFIG.cacheBuster;
  return b ? '&cb=' + b : '';
}

// Фомирование URL для загрузки медиафайла (с поддержкой Range)
MediaVaultAPI.mediaUrl = function(path) {
  return '/api/media?path=' + encodeURIComponent(path) + _cb();
};

// URL для получения миниатюры (AVIF)
MediaVaultAPI.thumbnailUrl = function(path) {
  return '/api/thumbnail?path=' + encodeURIComponent(path) + _cb();
};

// Получение метаданных файла и тегов из БД
MediaVaultAPI.fileinfo = function(path) {
  return fetch('/api/fileinfo?path=' + encodeURIComponent(path)).then(function(r) { return r.json(); });
};

// Запрос к API для получения тегов с Rule34 и Danbooru по MD5
MediaVaultAPI.fetchFile = function(relPath) {
  return fetch('/api/fetch_file?path=' + encodeURIComponent(relPath)).then(function(r) { return r.json(); });
};

// Сохранение тегов в БД (source: 'r34' | 'dan' | 'both' | строка тегов)
MediaVaultAPI.saveFile = function(path, source) {
  return fetch('/api/save_file', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path:path, source:source})}).then(function(r) { return r.json(); });
};

// Получение категорий (категории + теги + цвета)
MediaVaultAPI.getCategories = function() {
  return fetch('/api/categories').then(function(r) { return r.json(); });
};

window.MediaVaultAPI = MediaVaultAPI;
