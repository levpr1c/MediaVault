// ============================================================
// Галерея медиафайлов: загрузка, фильтрация, поиск, пагинация,
// bulk-тегирование, переключение раскладки
// ============================================================
var MediaVaultGallery = (function() {
  var _galleryData = [];
  var _filteredData = [];
  var _searchQuery = '';
  var _searchMode = 'both';
  var _layoutMode = 'columns'; // 'columns' | 'fixed' | 'scroll'
  var _pageSize = 0; // 0 = All
  var _currentPage = 1;
  var _selectMode = false;
  var _selectedPaths = new Set();
  var _pathIndex = null;
  var _galleryDelegationAttached = false;
  var _observer = null;
  var _hoverEl = null;
  var _previewUrl = null;
  var _previewOverlay = null;
  var _fetchedOnly = false;
  var _sortMode = 'name'; // 'name' | 'newest' | 'oldest'
  var _selectedFolders = ['all'];

  var parseTags = Shared.parseTags;

  // Сериализация текущего состояния (страница, размер, раскладка, поиск)
  function _serializeState() {
    var params = {};
    var isComics = window.CONFIG && CONFIG.subview === 'comics';
    if (_currentPage > 1) params.page = _currentPage;
    if (!isComics && _pageSize > 0) params.pics = _pageSize;
    if (_layoutMode !== 'columns') params.mode = _layoutMode;
    if (_searchQuery) params.q = _searchQuery;
    if (_searchMode !== 'both') params.sm = _searchMode;
    if (_selectedFolders.length > 0 && !_selectedFolders.includes('all')) {
      params.folders = _selectedFolders.join(',');
    }
    return params;
  }

  // Синхронизация URL с текущим состоянием (для history/закладок)
  function _syncURL() {
    var params = _serializeState();
    var keys = Object.keys(params);
    var qs = keys.length ? '?' + keys.map(function(k) { return k + '=' + encodeURIComponent(params[k]); }).join('&') : '';
    var url = window.location.pathname + qs;
    try { history.replaceState(params, '', url); } catch(e) {}
  }

  // Восстановление состояния из URL-параметров при загрузке
  function _applyURLParams() {
    try {
      var isComics = window.CONFIG && CONFIG.subview === 'comics';
      var p = new URLSearchParams(window.location.search);
      if (p.has('page')) _currentPage = parseInt(p.get('page')) || 1;
      if (!isComics && p.has('pics')) _pageSize = parseInt(p.get('pics')) || 30;
      if (p.has('mode')) _layoutMode = p.get('mode');
      if (p.has('q')) _searchQuery = p.get('q');
      if (p.has('sm')) _searchMode = p.get('sm');
      if (p.has('folders')) {
        _selectedFolders = p.get('folders').split(',');
      } else if (p.has('folder')) {
        _selectedFolders = [p.get('folder')];
      }
    } catch(e) {}
  }

  // Установка фильтра по типу папки (gallery/comics/downloads) и перезагрузка
  function _setFolder(folder) {
    if (folder === 'all') {
      if (_selectedFolders.length === 1 && _selectedFolders[0] === 'all') return;
      _selectedFolders = ['all'];
    } else {
      if (_selectedFolders.length === 1 && _selectedFolders[0] === folder) return;
      _selectedFolders = [folder];
    }
    _currentPage = 1;
    loadGallery();
  }

  function _toggleFolder(folder) {
    if (folder === 'all') {
      if (_selectedFolders.length === 1 && _selectedFolders[0] === 'all') return;
      _selectedFolders = ['all'];
    } else {
      var idx = _selectedFolders.indexOf(folder);
      if (idx >= 0) {
        _selectedFolders.splice(idx, 1);
      } else {
        _selectedFolders = _selectedFolders.filter(function(f) { return f !== 'all'; });
        _selectedFolders.push(folder);
      }
      if (_selectedFolders.length === 0) {
        _selectedFolders = ['all'];
      }
    }
    try { localStorage.setItem('mediavault_folder_filter', _selectedFolders.join(',')); } catch(e) {}
    _currentPage = 1;
    loadGallery();
  }

  // Отрисовка кнопок для фильтрации по типу папки (мультиселект, кроме All)
  function _renderFolderButtons(folder_counts, selected_folders) {
    var labels = { 'all': 'All', 'gallery': 'Gallery', 'comics': 'Comics', 'downloads': 'D/L' };
    var html = '';
    ['all', 'gallery', 'comics', 'downloads'].forEach(function(ft) {
      var active = selected_folders && selected_folders.includes(ft) ? ' active' : '';
      var count = (folder_counts && folder_counts[ft] > 0) ? ' <span class="folder-btn-count">' + folder_counts[ft] + '</span>' : '';
      html += '<button class="tool-btn' + active + '" data-folder="' + ft + '">' + labels[ft] + count + '</button>';
    });
    ['galleryFolderFilters', 'drawerFolderButtons'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  var _drawerFolderEl = document.getElementById('drawerFolderButtons');
  if (_drawerFolderEl) {
    _drawerFolderEl.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-folder]');
      if (!btn) return;
      _toggleFolder(btn.dataset.folder);
    });
  }

  var _galleryFolderEl = document.getElementById('galleryFolderFilters');
  if (_galleryFolderEl) {
    _galleryFolderEl.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-folder]');
      if (!btn) return;
      _toggleFolder(btn.dataset.folder);
    });
  }

  // Построение индекса путь → {row} для быстрого доступа
  function rebuildPathIndex(data) {
    var m = new Map();
    for (var i = 0; i < data.length; i++) m.set(data[i].path, [i, data[i]]);
    _pathIndex = m;
  }

  // Получение строки данных по пути файла
  function rowByPath(path) {
    var entry = _pathIndex && _pathIndex.get(path);
    return entry ? entry[1] : null;
  }

  // Загрузка списка файлов галереи с сервера
  function loadGallery() {
    var status = document.getElementById('statusText');
    if (status) status.textContent = 'Loading\u2026';
    var apiUrl = '/api/gallery';
    if (_selectedFolders.length > 0 && !_selectedFolders.includes('all')) {
      apiUrl += '?folders=' + encodeURIComponent(_selectedFolders.join(','));
    }
    fetch(apiUrl).then(function(r) { return r.json(); }).then(function(data) {
      if (data.error) {
        if (status) status.textContent = 'Error: ' + data.error;
        return;
      }
      var urlParams = {};
      try { urlParams = new URLSearchParams(window.location.search); } catch(e) {}
      _galleryData = data.files || [];
      MediaVaultTags.setCategoryCache(data.categories || {});
      if (!urlParams.has('page')) _currentPage = 1;
      if (!urlParams.has('q')) _searchQuery = '';
      if (!urlParams.has('sm')) _searchMode = 'both';
      var searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = _searchQuery;
      _renderFolderButtons(data.folder_counts || {}, _selectedFolders);
      if (!data.media_dir_set && _galleryData.length > 0) {
        var gallery = document.getElementById('gallery');
        gallery.innerHTML = '<div class="gallery-empty"><h2>\uD83D\uDCC1 Media folder not set</h2>' +
          '<p>' + _galleryData.length + ' files in database, but no media directory configured.</p>' +
          '<p>Choose a folder to load images from:</p>' +
          '</div>';
        document.getElementById('galleryPagination').style.display = 'none';
        if (status) status.textContent = _galleryData.length + ' files \u2014 needs media folder';
        return;
      }
      applyFilter();
      if (status) status.textContent = _galleryData.length + ' files';
    }).catch(function(e) {
      if (status) status.textContent = 'Failed to load gallery';
    });
  }

  // Быстрое сканирование медиа-папки (добавление новых файлов)
  function scanFolder() {
    var scanBtn = document.getElementById('scanFolderBtn');
    if (scanBtn) scanBtn.disabled = true;
    fetch('/api/scan_folder', {method:'POST'}).then(function(r) { return r.json(); }).then(function(result) {
      if (scanBtn) scanBtn.disabled = false;
      if (result.error) {
        Shared.notify('Scan error: ' + result.error, 'error');
        return;
      }
      if (result.scanned > 0) {
        loadGallery();
        Shared.notify('Found ' + result.scanned + ' new files', 'success');
      } else {
        Shared.notify('No new files found', 'info');
      }
    }).catch(function(e) {
      if (scanBtn) scanBtn.disabled = false;
      Shared.notify('Scan failed', 'error');
    });
  }

  // Применение поискового фильтра по имени и/или тегам
  function applyFilter() {
    var q = _searchQuery.trim().toLowerCase();
    if (!q) {
      _filteredData = _galleryData.slice();
    } else {
      _filteredData = _galleryData.filter(function(f) {
        if (_searchMode === 'name') {
          return f.name.toLowerCase().includes(q);
        } else if (_searchMode === 'tags') {
          var tags = (f.tags || '').toLowerCase();
          return tags.indexOf(q) !== -1;
        } else {
          return f.name.toLowerCase().includes(q) || (f.tags || '').toLowerCase().indexOf(q) !== -1;
        }
      });
    }
    _currentPage = 1;
    if (_fetchedOnly) {
      _filteredData = _filteredData.filter(function(f) { return f.fetched; });
    }
    if (_sortMode !== 'name') {
      _filteredData.sort(function(a, b) {
        var ma = a.mtime || 0;
        var mb = b.mtime || 0;
        return _sortMode === 'newest' ? mb - ma : ma - mb;
      });
    }
    renderGalleryContent();
    _syncURL();
    updateFileCount();
  }

  function toggleDateSort() {
    var modes = ['name', 'newest', 'oldest'];
    var idx = modes.indexOf(_sortMode);
    _sortMode = modes[(idx + 1) % modes.length];
    var btn = document.getElementById('sortDateBtn');
    if (btn) {
      var modeKey = _sortMode === 'name' ? 'sortByName' : _sortMode === 'newest' ? 'sortByNewest' : 'sortByOldest';
      var titleKey = modeKey + 'Title';
      var svg;
      if (_sortMode === 'name') {
        svg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/></svg>';
      } else if (_sortMode === 'newest') {
        svg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      } else {
        svg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
      }
      btn.innerHTML = svg + ' <span>' + Shared.t(modeKey) + '</span>';
      btn.title = Shared.t(titleKey);
      btn.dataset.i18n = modeKey;
      btn.dataset.i18nTitle = titleKey;
    }
    var dbtn = document.getElementById('drawerSortBtn');
    if (dbtn) {
      var dsvg;
      if (_sortMode === 'name') {
        dsvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/></svg>';
      } else if (_sortMode === 'newest') {
        dsvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      } else {
        dsvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
      }
      dbtn.innerHTML = dsvg + ' <span>' + Shared.t(modeKey) + '</span>';
    }
    loadGallery();
  }

  // Отрисовка категоризированных тегов (глобальные счётчики с сервера)
  function _renderCategorizedTags() {
    var containerId = window.innerWidth <= 768 ? 'categorizedTagsMobile' : 'categorizedTagsList';
    fetch('/api/popular_tags').then(function(r) { return r.json(); }).then(function(data) {
      var counter = {};
      (data.tags || []).forEach(function(t) { counter[t.name] = t.count; });
      MediaVaultTags.renderCategorizedTags(containerId, counter);
    }).catch(function() {
      MediaVaultTags.renderCategorizedTags(containerId, getVisibleData());
    });
  }

  // Получение данных текущей страницы (с учётом пагинации)
  function getVisibleData() {
    if (_pageSize <= 0) return _filteredData;
    var start = (_currentPage - 1) * _pageSize;
    return _filteredData.slice(start, start + _pageSize);
  }

  // Вычисление общего количества страниц
  function getTotalPages() {
    return _pageSize > 0 ? Math.max(1, Math.ceil(_filteredData.length / _pageSize)) : 1;
  }

  // Полная отрисовка содержимого галереи: элементы, пагинация, теги
  function renderGalleryContent() {
    var gallery = document.getElementById('gallery');
    if (!gallery) return;
    if (_observer) { _observer.disconnect(); _observer = null; }
    stopPreview();
    _hoverEl = null;

    if (_filteredData.length === 0) {
      gallery.innerHTML = '<div class="gallery-empty"><h2>' + Shared.t('welcome') + '</h2><p>' +
        (_galleryData.length === 0 ? Shared.t('welcomeDesc') : Shared.t('noFiles')) +
        '</p></div>';
      gallery.className = 'shared-grid';
      _pathIndex = null;
      document.getElementById('galleryPagination').style.display = 'none';
      return;
    }

    var visible = getVisibleData();
    var isGrid = _layoutMode === 'fixed';
    var isScroll = _layoutMode === 'scroll';

    // Set gallery class based on layout mode
    if (isScroll) {
      gallery.className = 'scroll';
    } else {
      gallery.className = 'shared-grid' + (isGrid ? ' shared-grid-fixed' : '');
    }

    gallery.innerHTML = visible.map(buildGalleryItemHtml).join('');

    // Reorder DOM for masonry visual order
    if (_layoutMode === 'columns') {
      Shared.reorderGalleryDOM(gallery, '.file-card');
    }

    rebuildPathIndex(_filteredData);

    var cols = getColumnCount();
    if (_layoutMode === 'columns' && visible.length > 0 && visible.length < cols * 1.5) {
      gallery.classList.add('few-items');
    } else {
      gallery.classList.remove('few-items');
    }

    _observer = createLazyLoader();
    if (!_galleryDelegationAttached) { attachGalleryEvents(); _galleryDelegationAttached = true; }
    renderPaginationControls();
    _renderCategorizedTags();
  }


  // Генерация HTML для одного элемента галереи с new .file-card структурой
  function buildGalleryItemHtml(file) {
    var tagChips = MediaVaultTags.renderTagChips(file.tags, 5);
    var ext = (file.name || '').split('.').pop().toLowerCase();
    var isVideo = ['mp4','webm','mov','avi','mkv'].indexOf(ext) !== -1;
    var thumbUrl = MediaVaultAPI.thumbnailUrl(file.path);
    var selected = _selectedPaths.has(file.path) ? ' selected' : '';
    var selectOverlay = _selectMode ? '<div class="select-overlay">' + (_selectedPaths.has(file.path) ? '\u2713' : '') + '</div>' : '';
    var orient = '';
    if (file.width > 0 && file.height > 0) {
      orient = file.width > file.height ? 'landscape' : (file.height > file.width ? 'portrait' : 'square');
    }
    var orientAttr = orient ? ' data-orient="' + orient + '"' : '';
    var tagsHtml = isVideo ? '<span class="video-label">\u25B6 ' + ext.toUpperCase() + '</span>' : (tagChips || '');
    var videoBadge = isVideo ? '<svg class="file-card-video-badge" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : '';
    return '<div class="file-card' + selected + '" data-path="' + Shared.esc(file.path) + '"' + orientAttr + '>' +
      '<div class="file-card-thumb" data-src="' + thumbUrl + '">' + selectOverlay +
      '<div class="file-card-spinner"></div>' + videoBadge + '</div>' +
      '<div class="file-card-body">' +
      '<div class="file-card-bg" style="--thumb:url(' + thumbUrl + ')"></div>' +
      '<div class="file-card-content">' +
      '<div class="file-card-name">' + Shared.esc(file.name) + '</div>' +
      '<div class="file-card-tags">' + tagsHtml + '</div>' +
      '</div></div></div>';
  }

  // Загрузка миниатюры в .file-card-thumb (с обработкой ошибок и иконкой видео)
  function loadThumbnail(el, src) {
    el.dataset.loaded = '1';
    var card = el.closest('.file-card');
    var bgEl = card && card.querySelector('.file-card-bg');
    var isVid = el.querySelector('.file-card-video-badge');
    var spinner = el.querySelector('.file-card-spinner');
    var img = document.createElement('img');
    img.alt = '';
    img.style.cssText = 'width:100%;display:block';
    img.onload = function() {
      // Set orientation from natural dimensions if not already set
      if (card && !card.dataset.orient) {
        card.dataset.orient = img.naturalWidth > img.naturalHeight ? 'landscape' :
          (img.naturalHeight > img.naturalWidth ? 'portrait' : 'square');
      }
      // Set background on .file-card-bg
      if (bgEl) bgEl.style.cssText += ';--thumb:url(' + src + ')';
      // Remove spinner
      if (spinner) spinner.remove();
      el.appendChild(img);
      if (isVid) el.appendChild(isVid);
    };
    img.onerror = function() {
      if (spinner) spinner.remove();
      if (isVid) {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100px;font-size:48px;background:var(--surface2);color:var(--text2)">\uD83C\uDFAC</div>';
      } else {
        el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100px;font-size:32px;background:var(--surface2);color:var(--text2)">\uD83D\uDC80</div><div style="padding:4px;font-size:10px;text-align:center;color:var(--text2)">not found</div>';
      }
    };
    img.src = src;
  }

  // Создание IntersectionObserver для ленивой загрузки превью
  function createLazyLoader() {
    var observer = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isIntersecting) {
          var el = entry.target;
          var src = el.dataset.src;
          if (src && !el.dataset.loaded) {
            loadThumbnail(el, src);
          }
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '300px' });

    var els = document.querySelectorAll('.file-card-thumb[data-src]');
    for (var i = 0; i < els.length; i++) observer.observe(els[i]);
    return observer;
  }

  // Единый обработчик клика по элементу галереи
  function _handleItemClick(path, idx) {
    if (_selectMode) {
      if (_selectedPaths.has(path)) _selectedPaths.delete(path);
      else _selectedPaths.add(path);
      var item = document.querySelector('.file-card[data-path="' + CSS.escape(path) + '"]');
      if (item) item.classList.toggle('selected');
      var overlay = item && item.querySelector('.select-overlay');
      if (overlay) overlay.textContent = _selectedPaths.has(path) ? '\u2713' : '';
      updateBulkBar();
      return;
    }
    // Find index in full filtered data by path (visual order != array index in masonry)
    var actualIdx = _filteredData.findIndex(function(f) { return f.path === path; });
    if (actualIdx < 0) return;
    MediaVaultLightbox.open(actualIdx, _filteredData);
  }

  // Подписка на события: клик по .file-card + hover-превью для видео
  function attachGalleryEvents() {
    var gallery = document.getElementById('gallery');
    // Click handler for all modes (SharedGrid no longer handles clicks)
    gallery.addEventListener('click', function(e) {
      var item = e.target.closest('.file-card');
      if (!item) return;
      var path = item.dataset.path;
      if (!path) return;
      var idx = _filteredData.findIndex(function(r) { return r.path === path; });
      _handleItemClick(path, idx);
    });

    // Hover preview
    gallery.addEventListener('mouseover', function(e) {
      var item = e.target.closest('.file-card');
      if (!item || item === _hoverEl) return;
      if (_hoverEl) stopPreview();
      _hoverEl = item;
      playPreview(item);
    });
    gallery.addEventListener('mouseout', function(e) {
      var item = e.target.closest('.file-card');
      if (!item || item !== _hoverEl) return;
      var related = e.relatedTarget;
      if (related && related.closest && related.closest('.file-card') === item) return;
      _hoverEl = null;
      stopPreview();
    });
  }

  // Воспроизведение hover-превью (видео или изображение)
  function playPreview(item) {
    var path = item.dataset.path;
    var thumb = item.querySelector('.file-card-thumb');
    if (!thumb || !path) return;
    var row = rowByPath(path);
    if (!row) return;
    var name = row.name || '';
    var ext = name.split('.').pop().toLowerCase();
    var isVid = ['mp4','webm','mov','avi','mkv'].indexOf(ext) !== -1;

    stopPreview();
    var overlay = document.createElement('div');
    overlay.className = 'gallery-thumb-preview';
    thumb.appendChild(overlay);
    _previewOverlay = overlay;

    var url = MediaVaultAPI.mediaUrl(path);
    _previewUrl = url;
    if (isVid) {
      var video = document.createElement('video');
      video.src = url;
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      overlay.appendChild(video);
      video.play().catch(function() {});
    } else {
      var img = document.createElement('img');
      img.src = url;
      overlay.appendChild(img);
    }
  }

  // Остановка hover-превью и очистка оверлея
  function stopPreview() {
    if (_previewOverlay) {
      _previewOverlay.remove();
      _previewOverlay = null;
    }
    _previewUrl = null;
  }

  // Вычисление количества колонок в masonry-раскладке
  function getColumnCount() {
    return Shared.getColumnCount(document.getElementById('gallery'));
  }

  // Отрисовка элементов пагинации (кнопки prev/next, номера страниц)
  function renderPaginationControls() {
    var total = getTotalPages();
    var show = _pageSize > 0 && total > 1;
    ['galleryPagination','galleryPaginationTop'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = show ? 'flex' : 'none';
    });
    var row2 = document.getElementById('toolbarRow2');
    if (row2) row2.style.display = show ? 'flex' : 'none';
    if (!show) return;
    document.getElementById('pagePrev').disabled = _currentPage <= 1;
    document.getElementById('pageNext').disabled = _currentPage >= total;
    var prevT = document.getElementById('pagePrevTop');
    if (prevT) prevT.disabled = _currentPage <= 1;
    var nextT = document.getElementById('pageNextTop');
    if (nextT) nextT.disabled = _currentPage >= total;

    var html = '';
    var maxVisible = 7;
    var start = 1, end = total;
    if (total > maxVisible) {
      var half = Math.floor(maxVisible / 2);
      if (_currentPage <= half + 1) { end = maxVisible; }
      else if (_currentPage >= total - half) { start = total - maxVisible + 1; }
      else { start = _currentPage - half; end = _currentPage + half; }
    }
    if (start > 1) { html += '<button class="page-num" data-page="1">1</button>'; if (start > 2) html += '<span class="page-num-ellipsis">\u2026</span>'; }
    for (var i = start; i <= end; i++) {
      html += '<button class="page-num' + (i === _currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
    }
    if (end < total) { if (end < total - 1) html += '<span class="page-num-ellipsis">\u2026</span>'; html += '<button class="page-num" data-page="' + total + '">' + total + '</button>'; }
    document.getElementById('pageNumbers').innerHTML = html;
    var numT = document.getElementById('pageNumbersTop');
    if (numT) numT.innerHTML = html;
  }

  // Переход на указанную страницу
  function goToPage(page) {
    var total = getTotalPages();
    _currentPage = Math.max(1, Math.min(page, total));
    var lb = document.querySelector('.shared-lightbox.open');
    if (lb) MediaVaultLightbox.close();
    renderGalleryContent();
    _syncURL();
    var container = document.getElementById('mvMain');
    if (container) container.scrollTop = 0;
    else window.scrollTo(0, 0);
  }

  // Установка режима раскладки: columns (masonry) | fixed (grid) | scroll (list)
  function setLayoutMode(mode) {
    _layoutMode = mode;
    try { localStorage.setItem('mediavault_layout', mode); } catch(e) {}
    document.querySelectorAll('[data-layout]').forEach(function(b) {
      b.classList.toggle('active', b.dataset.layout === mode);
    });
    renderGalleryContent();
    _syncURL();
  }

  // Установка количества элементов на странице
  function setPageSize(size) {
    _pageSize = size;
    _currentPage = 1;
    try { localStorage.setItem('mediavault_page_size', '' + size); } catch(e) {}
    document.querySelectorAll('[data-pagesize]').forEach(function(b) {
      b.classList.toggle('active', parseInt(b.dataset.pagesize) === size);
    });
    var lb = document.querySelector('.shared-lightbox.open');
    if (lb) MediaVaultLightbox.close();
    renderGalleryContent();
    _syncURL();
  }

  // Обновление колонок — больше не нужно (SharedGrid / flexbox адаптивны)
  function updateFixedColumns() {}

  // Установка размера миниатюр (значение в пикселях, сохранение в localStorage)
  function setThumbSize(size) {
    var g = document.getElementById('gallery');
    g.style.setProperty('--thumb-col-width', size + 'px');
    g.style.setProperty('--shared-grid-col-width', size + 'px');
    document.querySelectorAll('.thumb-size').forEach(function(b) {
      b.classList.toggle('active', b.dataset.size === size);
    });
    try { localStorage.setItem('mediavault_thumb_size', size); } catch(e) {}
    updateFixedColumns();
  }

  // Обработка ввода в поисковую строку (показ автокомплита)
  function onSearchInput(value) {
    _searchQuery = value;
    showSearchAutocomplete(value);
  }

  // Установка поискового запроса (без применения фильтра)
  function setSearchQuery(value) {
    _searchQuery = value;
  }

  // Показ выпадающего списка автокомплита для поиска по тегам
  function showSearchAutocomplete(query) {
    var container = document.getElementById('searchAutocomplete');
    if (!query || !query.trim()) { container.innerHTML = ''; return; }
    var q = query.trim().toLowerCase();
    var matches = [];
    var tagCounts = {};
    for (var i = 0; i < _galleryData.length; i++) {
      var tags = parseTags(_galleryData[i].tags);
      for (var j = 0; j < tags.length; j++) {
        tagCounts[tags[j]] = (tagCounts[tags[j]] || 0) + 1;
        if (tags[j].toLowerCase().indexOf(q) !== -1 && matches.indexOf(tags[j]) === -1) {
          matches.push(tags[j]);
        }
      }
      if (matches.length >= 20) break;
    }
    matches.sort();
    if (matches.length === 0) { container.innerHTML = ''; return; }
    var maxCnt = 1;
    for (var k = 0; k < matches.length; k++) {
      if ((tagCounts[matches[k]] || 0) > maxCnt) maxCnt = tagCounts[matches[k]];
    }
    container.innerHTML = '<div style="position:absolute;top:0;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;z-index:10;max-height:200px;overflow-y:auto">' +
      matches.slice(0, 10).map(function(tag) {
        var cat = MediaVaultTags.getTagCategory(tag);
        var color = cat || '';
        var style = color ? 'color:' + color + ';border-left:3px solid ' + color + ';padding-left:9px;background:' + MediaVaultTags.hexToRgba(color, 0.08) : '';
        var pct = Math.round((tagCounts[tag] || 0) / maxCnt * 100);
        return '<div class="ac-item" data-tag="' + Shared.esc(tag) + '" style="' + style + '">' + Shared.esc(tag) + ' <span style="opacity:0.45;font-size:11px">(' + (tagCounts[tag] || 0) + ')</span><span style="flex:1"></span><span style="width:' + pct + '%;min-width:2px;height:3px;background:var(--accent);border-radius:2px;display:inline-block;opacity:0.3"></span></div>';
      }).join('') + '</div>';
    container.querySelectorAll('.ac-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        var tag = el.dataset.tag;
        document.getElementById('searchInput').value = tag;
        _searchQuery = tag;
        container.innerHTML = '';
        applyFilter();
      });
    });
  }

  // Установка режима поиска: 'both' | 'name' | 'tags'
  function setSearchMode(mode) {
    _searchMode = mode;
    if (_searchQuery) applyFilter();
  }

  // Получение визуального порядка элементов (сортировка по позиции на экране)
  function getVisualOrder() {
    return Shared.getVisualOrder(document.getElementById('gallery'), '.file-card');
  }

  // Обновление счетчика файлов в статусной строке
  function updateFileCount() {
    var status = document.getElementById('statusText');
    if (status) status.textContent = _filteredData.length + ' / ' + _galleryData.length + ' files';
  }

  // --- Bulk tag bar ---
  // Включение/выключение режима массового выбора файлов
  function toggleSelectMode() {
    _selectMode = !_selectMode;
    if (!_selectMode) _selectedPaths.clear();
    var btn = document.getElementById('bulkTagBtn');
    btn.textContent = _selectMode ? Shared.t('bulkTagExit') : Shared.t('bulkTag');
    var bar = document.getElementById('bulkTagBar');
    bar.classList.toggle('active', _selectMode);
    document.getElementById('bulkTagInput').value = '';
    document.getElementById('bulkAutocomplete').innerHTML = '';
    updateBulkBar();
    renderGalleryContent();
  }

  // Переключение фильтра "только файлы с полученными тегами"
  function toggleFetchedOnly() {
    _fetchedOnly = !_fetchedOnly;
    var btn = document.getElementById('fetchedOnlyBtn');
    if (btn) btn.classList.toggle('active', _fetchedOnly);
    var dbtn = document.getElementById('drawerFetchedBtn');
    if (dbtn) dbtn.classList.toggle('active', _fetchedOnly);
    applyFilter();
  }

  // Обновление панели массового тегирования (счётчик выбранных)
  function updateBulkBar() {
    var count = _selectedPaths.size;
    var el = document.getElementById('bulkCount');
    el.textContent = count + ' selected';
    el.style.background = count ? 'var(--accent)' : '';
    el.style.color = count ? '#fff' : '';
    el.style.padding = count ? '2px 8px' : '';
    el.style.borderRadius = count ? '4px' : '';
    document.getElementById('bulkAddBtn').textContent = count ? 'Add to ' + count : '+ Add';
  }

  // Добавление тега ко всем выбранным файлам
  function addTagToSelected() {
    var input = document.getElementById('bulkTagInput');
    var tag = input.value.trim();
    if (!tag || _selectedPaths.size === 0) return;
    document.getElementById('bulkAutocomplete').innerHTML = '';
    var paths = Array.from(_selectedPaths);
    var completed = 0;
    paths.forEach(function(path) {
      var row = rowByPath(path);
      if (!row) { completed++; return; }
      var currentTags = parseTags(row.tags);
      if (currentTags.indexOf(tag) === -1) currentTags.push(tag);
      var joined = currentTags.join(',');
      MediaVaultAPI.saveFile(path, joined).then(function(data) {
        if (data.ok) {
          var r = rowByPath(path);
          if (r) r.tags = joined;
          refreshGalleryItem(path, joined);
        }
        completed++;
        if (completed >= paths.length) {
          input.value = '';
          _selectedPaths.clear();
          updateBulkBar();
          _renderCategorizedTags();
        }
      }).catch(function() {
        completed++;
      });
    });
  }

  // Обновление чипсов тегов в элементе галереи после сохранения
  function refreshGalleryItem(path, tags) {
    var el = document.querySelector('.file-card[data-path="' + CSS.escape(path) + '"]');
    if (el) {
      var tagsEl = el.querySelector('.file-card-tags');
      if (tagsEl) tagsEl.innerHTML = MediaVaultTags.renderTagChips(tags, 5);
    }
  }

  // Инициализация галереи: восстановление состояния, загрузка данных,
  // подписка на resize и popstate
  function init() {
    var isComics = window.CONFIG && CONFIG.subview === 'comics';
    _applyURLParams();

    // Restore folder filter from localStorage (only if URL doesn't override)
    if (!window.location.search.includes('folder') && !window.location.search.includes('folders')) {
      try {
        var saved = localStorage.getItem('mediavault_folder_filter');
        if (saved) {
          _selectedFolders = saved === 'all' ? ['all'] : saved.split(',');
        }
      } catch(e) {}
    }

    // For comics, clear any stale URL params (pics/page/etc)
    if (isComics) {
      try { history.replaceState({}, '', window.location.pathname); } catch(e) {}
    }

    loadGallery();

    // Restore layout/pagination state (URL overrides localStorage)
    var savedLayout = null;
    try { savedLayout = localStorage.getItem('mediavault_layout'); } catch(e) {}
    if (savedLayout && !_serializeState().mode) setLayoutMode(savedLayout);
    else if (_serializeState().mode) setLayoutMode(_layoutMode);
    else setLayoutMode('columns');

    var savedSize = null;
    try { savedSize = localStorage.getItem('mediavault_page_size'); } catch(e) {}
    if (!isComics && _serializeState().pics) setPageSize(_pageSize);
    else if (!isComics && savedSize) setPageSize(parseInt(savedSize));

    var savedThumb = null;
    try { savedThumb = localStorage.getItem('mediavault_thumb_size'); } catch(e) {}
    if (savedThumb) setThumbSize(savedThumb);

    // Resize handler
    var resizeRAF;
    window.addEventListener('resize', function() {
      cancelAnimationFrame(resizeRAF);
      resizeRAF = requestAnimationFrame(function() {
        updateFixedColumns();
      });
    });

    // Back/forward navigation
    window.addEventListener('popstate', function(e) {
      _applyURLParams();
      renderGalleryContent();
    });
  }

  return {
    init: init,
    loadGallery: loadGallery,
    scanFolder: scanFolder,
    applyFilter: applyFilter,
    goToPage: goToPage,
    setLayoutMode: setLayoutMode,
    setPageSize: setPageSize,
    setThumbSize: setThumbSize,
    setSearchMode: setSearchMode,
    onSearchInput: onSearchInput,
    setSearchQuery: setSearchQuery,
    showSearchAutocomplete: showSearchAutocomplete,
    toggleSelectMode: toggleSelectMode,
    addTagToSelected: addTagToSelected,
    getFilteredData: function() { return _filteredData; },
    getVisualOrder: getVisualOrder,
    refreshGalleryItem: refreshGalleryItem,
    rowByPath: rowByPath,
    isSelectMode: function() { return _selectMode; },
    toggleFetchedOnly: toggleFetchedOnly,
    toggleDateSort: toggleDateSort,
    setFolder: _setFolder,
    toggleFolder: _toggleFolder
  };
})();

window.MediaVaultGallery = MediaVaultGallery;
