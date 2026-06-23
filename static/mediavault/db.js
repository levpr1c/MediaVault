// ============================================================
// Модуль работы с БД: импорт/экспорт базы, управление
// категориями, получение популярных тегов
// ============================================================
var MediaVaultDB = (function() {

  function getCategoriesFull() {
    return MediaVaultAPI.getCategories();
  }

  function addCategory(name, color) {
    return SharedAPI.post('/api/categories', {action:'add_category', name:name, color:color || '#888888'});
  }

  function deleteCategory(name) {
    return SharedAPI.post('/api/categories', {action:'delete_category', name:name});
  }

  return {
    getCategoriesFull: getCategoriesFull,
    addCategory: addCategory,
    deleteCategory: deleteCategory
  };
})();

window.MediaVaultDB = MediaVaultDB;
