// ============================================================
// Модуль работы с БД: импорт/экспорт базы, управление
// категориями, получение популярных тегов
// ============================================================
var MediaVaultDB = (function() {
  var _dbPath = null;

  // Установка пути к файлу БД
  function setDbPath(path) { _dbPath = path; }

  // Получение текущего пути к БД
  function getDbPath() { return _dbPath; }

  // Импорт БД из выбранного пользователем файла
  function importDB(input) {
    var file = input.files[0];
    if (!file) return;
    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/import_db', {method:'POST', body:fd}).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        alert('✅ ' + Shared.t('dbReady'));
        MediaVaultTags.invalidateCatCache();
        MediaVaultTags.loadCategories();
      } else {
        alert('❌ Import failed: ' + (data.error || 'unknown'));
      }
    }).catch(function(e) {
      alert('❌ Import failed: ' + e.message);
    });
    input.value = '';
  }

  // Экспорт БД — открывает загрузку файла в новой вкладке
  function exportDB() {
    window.open('/api/export_db', '_blank');
  }

  // Получение карты тег → цвет категории
  function getCategories() {
    return MediaVaultAPI.getCategories();
  }

  // Получение полной структуры категорий (с участниками)
  function getCategoriesFull() {
    return MediaVaultAPI.getCategories();
  }

  // Создание новой категории с указанным цветом
  function addCategory(name, color) {
    return SharedAPI.post('/api/categories', {action:'add_category', name:name, color:color || '#888888'});
  }

  // Удаление категории
  function deleteCategory(name) {
    return SharedAPI.post('/api/categories', {action:'delete_category', name:name});
  }

  // Получение списка популярных тегов (глобальный рейтинг)
  function getPopularTags() {
    return SharedAPI.get('/api/popular_tags');
  }

  return {
    setDbPath: setDbPath,
    getDbPath: getDbPath,
    importDB: importDB,
    exportDB: exportDB,
    getCategories: getCategories,
    getCategoriesFull: getCategoriesFull,
    addCategory: addCategory,
    deleteCategory: deleteCategory,
    getPopularTags: getPopularTags
  };
})();

window.MediaVaultDB = MediaVaultDB;
