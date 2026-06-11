// ============================================================
// Утилиты MediaVault: форматирование размера, определение
// типа медиа, иконки, преобразование цветов
// ============================================================
var MediaVaultUtils = window.MediaVaultUtils || {};

// Форматирование байтов в человекочитаемый вид (B, KB, MB, GB, TB)
MediaVaultUtils.formatBytes = function(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  var units = ['B','KB','MB','GB','TB'];
  var i = 0, size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(1) + ' ' + units[i];
};

// Проверка, является ли файл медиа (изображение или видео)
MediaVaultUtils.isMediaFile = function(name) {
  var ext = name.split('.').pop().toLowerCase();
  return ['jpg','jpeg','png','gif','webp','bmp','mp4','webm','mov','avi','mkv'].includes(ext);
};

// Иконка в зависимости от типа файла (🎬 для видео, 🖼️ для изображений)
MediaVaultUtils.getFileIcon = function(name) {
  var ext = name.split('.').pop().toLowerCase();
  if (['mp4','webm','mov','avi','mkv'].includes(ext)) return '🎬';
  return '🖼️';
};

// Определение видеофайла по расширению
MediaVaultUtils.isVideo = function(name) {
  var ext = name.split('.').pop().toLowerCase();
  return ['mp4','webm','mov','avi','mkv'].includes(ext);
};

// Конвертация HEX-цвета в rgba — делегирует в Shared
MediaVaultUtils.hexToRgba = function(hex, alpha) {
  return Shared.hexToRgba(hex, alpha);
};

// Парсинг строки тегов — делегирует в Shared
MediaVaultUtils.parseTags = function(str) {
  return Shared.parseTags(str);
};

window.MediaVaultUtils = MediaVaultUtils;
