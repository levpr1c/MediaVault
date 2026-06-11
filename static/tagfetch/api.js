// ============================================================
// API-клиент Tagfetch: обход директорий, получение тегов,
// автосканирование, настройки, очистка данных
// ============================================================
var TagfetchAPI = window.TagfetchAPI || {};

// Обход директории (список файлов и папок)
TagfetchAPI.browse = function(path) {
  return fetch('/api/browse?path=' + encodeURIComponent(path)).then(function(r) { return r.json(); });
};

// Получение метаданных и тегов файла из БД
TagfetchAPI.fileinfo = function(absPath) {
  return fetch('/api/fileinfo?path=' + encodeURIComponent(absPath)).then(function(r) { return r.json(); });
};

// Получение тегов с Rule34 и Danbooru по MD5 файла
TagfetchAPI.fetchFile = function(relPath) {
  return fetch('/api/fetch_file?path=' + encodeURIComponent(relPath)).then(function(r) { return r.json(); });
};

// Получение статуса автосканирования для списка путей
TagfetchAPI.autoStatus = function(paths) {
  return fetch('/api/auto_status', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:paths})}).then(function(r) { return r.json(); });
};

// Статус проверки для списка файлов (ручной режим Tagfetch).
// Используется в manual.js loadBrowser() для расстановки data-status на .path-item,
// чтобы работали кнопки фильтра (All / In DB / Found / Not Found).
TagfetchAPI.checkStatus = function(paths) {
  return fetch('/api/check_status', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({paths:paths})}).then(function(r) { return r.json(); });
};

// Сохранение тегов в БД (source: 'r34' | 'dan' | 'both')
TagfetchAPI.saveFile = function(path, source) {
  return fetch('/api/save_file', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path:path, source:source})}).then(function(r) { return r.json(); });
};

// Очистка in-memory кэша для одного файла
TagfetchAPI.clearCache = function(path) {
  return fetch('/api/clear_cache', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({path:path})}).then(function(r) { return r.json(); });
};

// Сохранение всех полученных тегов (dryRun=true — только подсчёт)
TagfetchAPI.saveAllFetched = function(paths, dryRun) {
  var body = {paths:paths};
  if (dryRun) body.dry_run = true;
  return fetch('/api/save_all_fetched', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}).then(function(r) { return r.json(); });
};

// Запуск автосканирования (SSE-поток, с возможностью отмены через AbortController)
TagfetchAPI.autoScan = function(paths, signal) {
  return fetch('/api/auto_scan', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(paths ? {paths:paths} : {}), signal: signal});
};

// Сохранение настроек (API-ключи, путь к медиа-папке)
TagfetchAPI.saveSettings = function(data) {
  return fetch('/api/settings', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}).then(function(r) { return r.json(); });
};

// Очистка кэша миниатюр
TagfetchAPI.clearThumbCache = function() {
  return fetch('/api/clear_thumb_cache', {method:'POST'}).then(function(r) { return r.json(); });
};

// Очистка in-memory кэша тегов (API cache и MD5 cache)
TagfetchAPI.clearTagCache = function() {
  return fetch('/api/clear_tag_cache', {method:'POST'}).then(function(r) { return r.json(); });
};

// Очистка БД (файлы, результаты сканирования)
TagfetchAPI.clearDatabase = function() {
  return fetch('/api/clear_database', {method:'POST'}).then(function(r) { return r.json(); });
};

// Полная очистка: кэш тегов, миниатюры, БД + повторное сканирование
TagfetchAPI.clearAll = function() {
  return fetch('/api/clear_all', {method:'POST'}).then(function(r) { return r.json(); });
};

// Перегенерация миниатюр для всех файлов
TagfetchAPI.regenerateThumbnails = function() {
  return fetch('/api/regenerate_thumbnails', {method:'POST'}).then(function(r) { return r.json(); });
};

// Генерация только недостающих миниатюр
TagfetchAPI.generateMissingThumbnails = function() {
  return fetch('/api/generate_missing_thumbnails', {method:'POST'}).then(function(r) { return r.json(); });
};

// Статус перегенерации миниатюр
TagfetchAPI.regenerateThumbnailsStatus = function() {
  return fetch('/api/regenerate_thumbnails_status').then(function(r) { return r.json(); });
};

window.TagfetchAPI = TagfetchAPI;
