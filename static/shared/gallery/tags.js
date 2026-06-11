// ============================================================
// Работа с тегами: категории, чипсы, популярные теги,
// группировка по категориям, автокомплит
// ============================================================
var MediaVaultTags = (function() {
  var _catCache = {};

  // Сброс кэша категорий (после изменений в БД)
  function invalidateCatCache() { _catCache = {}; }

  // Получение цвета категории для тега (из кэша)
  function getTagCategory(tag) {
    if (_catCache[tag] !== undefined) return _catCache[tag];
    return null; // will be filled by loadCategories
  }

  // Установка кэша категорий (из данных галереи)
  function setCategoryCache(categories) {
    _catCache = categories || {};
  }

  // Парсинг строки тегов — делегирует в Shared
  var parseTags = Shared.parseTags;

  // Преобразование HEX-цвета в rgba — делегирует в Shared
  var hexToRgba = Shared.hexToRgba;

  // Отрисовка чипсов тегов (до maxCount штук) с цветом категории
  function renderTagChips(tagsStr, maxCount) {
    var all = parseTags(tagsStr);
    var chips = [];
    for (var i = 0; i < all.length && chips.length < maxCount; i++) {
      var t = all[i];
      var cat = _catCache[t] || null;
      chips.push({tag: t, cat: cat});
    }
    return chips.map(function(c) {
      var style = c.cat ? 'color:' + c.cat + ';background:' + hexToRgba(c.cat, 0.12) + ';-webkit-text-stroke:0.5px ' + c.cat : '';
      return '<span class="tag-chip" style="' + style + '">' + Shared.esc(c.tag) + '</span>';
    }).join('');
  }

  // Отрисовка тегов для отображения в БД (мелкие чипсы)
  function renderDbTags(tagsStr, categories) {
    if (!tagsStr) return '<em style="opacity:.6">empty</em>';
    var cats = categories || {};
    return parseTags(tagsStr).map(function(t) {
      var color = cats[t] || '';
      var chipStyle = color ? 'color:' + color + ';background:' + color + '22' : '';
      return '<span class="tag-chip" style="font-size:10px;padding:1px 5px;' + chipStyle + '">' + Shared.esc(t) + '</span>';
    }).join('');
  }

  // Отрисовка популярных тегов (глобальный рейтинг, кликабельны)
  function renderPopularTags(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    fetch('/api/popular_tags').then(function(r) { return r.json(); }).then(function(data) {
      var tags = data.tags || data || [];
      if (!tags.length) { container.innerHTML = ''; return; }
      container.innerHTML = tags.map(function(item) {
        var tag = item.name || item.tag || '';
        var cat = _catCache[tag] || '';
        var style = 'cursor:pointer;' + (cat ? 'color:' + cat + ';background:' + hexToRgba(cat, 0.12) + ';-webkit-text-stroke:0.5px ' + cat : '');
        return '<span class="tag-chip popular-tag" data-tag="' + tag + '" style="' + style + '">' + Shared.esc(tag) + ' <span style="opacity:0.5">(' + item.count + ')</span></span>';
      }).join('');
    }).catch(function() { container.innerHTML = ''; });
  }

  // Полная страница популярных тегов (на отдельной странице /popular-tags)
  function renderPopularTagsFull(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    fetch('/api/popular_tags').then(function(r) { return r.json(); }).then(function(data) {
      var tags = data.tags || [];
      container.innerHTML = tags.map(function(item) {
        var tag = item.name || '';
        var cat = _catCache[tag] || '';
        var style = (cat ? 'color:' + cat + ';background:' + hexToRgba(cat, 0.12) + ';-webkit-text-stroke:0.5px ' + cat : '');
        return '<span class="tag-chip popular-tag" data-tag="' + tag + '" style="cursor:pointer;' + style + '">' +
          Shared.esc(tag) + ' <span style="opacity:0.5">(' + item.count + ')</span></span>';
      }).join('');
    }).catch(function() { container.innerHTML = ''; });
  }

  // Популярные теги в контексте выбранных файлов (сайдбар)
  function renderContextualPopularTags(containerId, fileList) {
    var container = document.getElementById(containerId);
    if (!container) return;
    if (!fileList || !fileList.length) { container.innerHTML = ''; return; }
    var counter = {};
    fileList.forEach(function(f) {
      var tags = f.tags || '';
      tags.split(',').forEach(function(t) {
        t = t.trim();
        if (t) counter[t] = (counter[t] || 0) + 1;
      });
    });
    var items = Object.keys(counter).map(function(t) { return {name: t, count: counter[t]}; });
    items.sort(function(a, b) { return b.count - a.count; });
    if (!items.length) { container.innerHTML = ''; return; }
    container.innerHTML = items.map(function(item) {
      var tag = item.name;
      var cat = _catCache[tag] || '';
      var style = (cat ? 'color:' + cat + ';background:' + hexToRgba(cat, 0.12) + ';-webkit-text-stroke:0.5px ' + cat : '');
      return '<span class="tag-chip popular-tag" data-tag="' + tag + '" style="cursor:pointer;' + style + '">' +
        Shared.esc(tag) + ' <span style="opacity:0.5">(' + item.count + ')</span></span>';
    }).join('');
  }

  // Отрисовка тегов, сгруппированных по категориям (artist/copyright/general…)
  // Принимает либо массив fileList (считает локально), либо объект {tag: count}
  function renderCategorizedTags(containerId, data) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var counter;
    if (Array.isArray(data)) {
      if (!data.length) { container.innerHTML = '<div style="font-size:11px;opacity:.5">No tags</div>'; return; }
      counter = {};
      data.forEach(function(f) {
        (f.tags || '').split(',').forEach(function(t) {
          t = t.trim();
          if (t) counter[t] = (counter[t] || 0) + 1;
        });
      });
    } else if (data && typeof data === 'object') {
      counter = data;
    } else {
      container.innerHTML = '<div style="font-size:11px;opacity:.5">No tags</div>';
      return;
    }

    // Group by category
    var catNames = {};
    _catList.forEach(function(c) { catNames[c.name] = c.color; });
    var groups = { _default: { color: '', tags: [] } };
    Object.keys(counter).forEach(function(tag) {
      var catName = _tagToCatName[tag];
      if (!catName || !catNames[catName]) catName = '_default';
      if (!groups[catName]) groups[catName] = { color: catNames[catName] || '', tags: [] };
      groups[catName].tags.push({ name: tag, count: counter[tag] });
    });

    // Sort groups by priority, tags by count desc
    var priority = ['artist', 'copyright', 'general', 'character', 'meta'];
    var html = '';
    // Merge _default into general if both exist
    if (groups._default && groups._default.tags.length) {
      if (groups.general) {
        groups.general.tags = groups.general.tags.concat(groups._default.tags);
      } else {
        groups.general = groups._default;
      }
    }
    priority.forEach(function(catKey) {
      var group = groups[catKey];
      if (!group || !group.tags.length) return;
      group.tags.sort(function(a, b) { return b.count - a.count; });
      var displayName = catKey === '_default' ? 'general' : catKey;
      var displayColor = group.color || '#cccccc';
      var maxShow = 20;
      var limited = group.tags.slice(0, maxShow);
      html += '<div style="margin:6px 0 4px;font-size:12px;font-weight:700;color:' + displayColor + '">' +
        Shared.esc(displayName) + ' <span style="opacity:.5;font-weight:400">(' + group.tags.length + ')</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px">' +
        limited.map(function(item) {
          var style = 'color:' + displayColor + ';background:' + hexToRgba(displayColor, 0.12) + ';-webkit-text-stroke:0.5px ' + displayColor;
          return '<span class="tag-chip" style="cursor:pointer;font-size:12px;padding:3px 7px;' + style + '" data-tag="' + item.name + '">' +
            Shared.esc(item.name) + ' <span style="opacity:0.5">(' + item.count + ')</span></span>';
        }).join('') + '</div>';
      if (group.tags.length > maxShow) {
        html += '<div style="font-size:10px;opacity:.5;margin:2px 0 0 4px">+' + (group.tags.length - maxShow) + ' more</div>';
      }
    });
    container.innerHTML = html || '<div style="font-size:11px;opacity:.5">No tags</div>';
  }

  var _tagToCatName = {};
  var _catList = [];

  // Загрузка категорий и построение карты тег → категория
  function loadCategories() {
    return MediaVaultAPI.getCategories().then(function(data) {
      if (!data) { _catCache = {}; _tagToCatName = {}; _catList = []; return; }
      _catCache = data.cat_colors || {};
      _tagToCatName = data.cat_map || {};
      _catList = data.categories || [];
      // Also build a tag→color cache for backward compat
      var flat = {};
      _catList.forEach(function(c) {
        (data.members[c.name] || []).forEach(function(t) { flat[t] = c.color; });
      });
      _catCache = flat;
    }).catch(function() { _catCache = {}; _tagToCatName = {}; _catList = []; });
  }

  // Получение названия категории для тега (из карты _tagToCatName)
  function getTagCategoryName(tag) {
    return _tagToCatName[tag] || null;
  }

  // Получение списка всех категорий
  function getCatList() { return _catList; }

  return {
    parseTags: parseTags,
    hexToRgba: hexToRgba,
    renderTagChips: renderTagChips,
    renderDbTags: renderDbTags,
    renderPopularTags: renderPopularTags,
    renderPopularTagsFull: renderPopularTagsFull,
    renderContextualPopularTags: renderContextualPopularTags,
    renderCategorizedTags: renderCategorizedTags,
    getTagCategory: getTagCategory,
    getTagCategoryName: getTagCategoryName,
    getCatList: getCatList,
    invalidateCatCache: invalidateCatCache,
    setCategoryCache: setCategoryCache,
    loadCategories: loadCategories
  };
})();

window.MediaVaultTags = MediaVaultTags;
