/* ─── ComicsPicker ───
 * Shared comic picker modal (file selection, preview, save).
 * Used by MV pages (gallery.html, comics.html) and CM (via picker-bridge.js).
 */
var ComicsPicker = (function() {
  var _selectedFiles = [];
  var _galleryData = [];
  var _coverPath = null;
  var _dragIdx = -1;
  var _dragAttached = false;
  var _cpageSortMode = 'name';
  var _previewOpen = false;
  var _editingId = null;
  var _onSave = null;
  var _onCancel = null;
  var _pageSize = 30;
  var _loadedCount = 0;
  var _filteredList = [];
  var _scrollHandler = null;
  var _currentDir = '';
  var _dirEntryCache = [];
  var _sourceFilter = 'all';

  function _getFilteredGalleryData() {
    if (_sourceFilter === 'gallery') {
      return _galleryData.filter(function(f) {
        if (f.path.indexOf('Comics/') === 0) return false;
        if (f.path.indexOf('Downloads/nHentai/') === 0) return false;
        if (f.path.indexOf('Gallery/') === 0) return true;
        if (f.path.indexOf('Downloads/rule34/') === 0) return true;
        if (f.path.indexOf('Downloads/danbooru/') === 0) return true;
        if (f.path.indexOf('/') === -1) return true;
        return false;
      });
    }
    if (_sourceFilter === 'downloads') {
      return _galleryData.filter(function(f) {
        return f.path.indexOf('Downloads/') === 0 && f.path.indexOf('Downloads/nHentai/') !== 0;
      });
    }
    if (_sourceFilter === 'comics') {
      return _galleryData.filter(function(f) {
        return f.path.indexOf('Comics/') === 0 || f.path.indexOf('Downloads/nHentai/') === 0;
      });
    }
    return _galleryData;
  }

  function _buildSourceBar() {
    var bar = document.getElementById('cpageSourceBar');
    if (!bar) return;
    var active = function(s) { return _sourceFilter === s ? ' active' : ''; };
    bar.innerHTML =
      '<button class="cpage-source-btn' + active('all') + '" data-source="all" onclick="ComicsPicker.setSource(\'all\')">' + Shared.t('allFiles') + '</button>' +
      '<button class="cpage-source-btn' + active('gallery') + '" data-source="gallery" onclick="ComicsPicker.setSource(\'gallery\')">Gallery</button>' +
      '<button class="cpage-source-btn' + active('downloads') + '" data-source="downloads" onclick="ComicsPicker.setSource(\'downloads\')">Downloads</button>' +
      '<button class="cpage-source-btn' + active('comics') + '" data-source="comics" onclick="ComicsPicker.setSource(\'comics\')">Comics</button>';
  }

  function setSource(source) {
    if (_sourceFilter === source) return;
    _sourceFilter = source;
    _buildSourceBar();
    _currentDir = '';
    _loadedCount = 0;
    _filteredList = [];
    _detachScrollListener();
    _renderGallery();
  }

  function _escHandler(e) {
    if (e.key === 'Escape') {
      if (_selectedFiles.length > 0) {
        if (confirm(Shared.t('unsavedConfirm'))) closePicker();
      } else {
        closePicker();
      }
    }
  }

  function init() {
    var titleEl = document.getElementById('comicTitle');
    if (titleEl) {
      titleEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') saveComic();
      });
    }
    document.addEventListener('keydown', _escHandler);
    _attachDragDrop();
  }


  function openPicker(opts) {
    opts = opts || {};
    _selectedFiles = opts.editData ? (opts.editData.paths || []).slice() : [];
    _coverPath = opts.editData ? (opts.editData.cover_path || (_selectedFiles.length > 0 ? _selectedFiles[0] : null)) : null;
    _editingId = opts.editData ? opts.editData.id : null;
    _onSave = typeof opts.onSave === 'function' ? opts.onSave : null;
    _onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : null;
    _previewOpen = false;
    _loadedCount = 0;
    _filteredList = [];
    _currentDir = '';
    _dirEntryCache = [];
    _detachScrollListener();

    document.getElementById('comicTitle').value = opts.editData ? (opts.editData.title || '') : '';
    document.getElementById('cpageSearch').value = '';
    document.getElementById('comicsModalOverlay').classList.add('open');

    _sourceFilter = opts.sourceFilter || 'all';
    _buildSourceBar();
    _updateSelected();
    fetch('/api/gallery').then(function(r) { return r.json(); }).then(function(data) {
      _galleryData = data.files || [];
      _renderGallery();
      _updateSelected();
    }).catch(function() {});
  }

  function closePicker() {
    _detachScrollListener();
    _loadedCount = 0;
    _filteredList = [];
    document.getElementById('comicsModalOverlay').classList.remove('open');
    if (_onCancel) _onCancel();
    _selectedFiles = [];
    _coverPath = null;
    _onSave = null;
    _onCancel = null;
    _dragAttached = false;
    _editingId = null;
    var previewPanel = document.getElementById('comicPreviewContent');
    if (previewPanel) { _abortImages(previewPanel); previewPanel.innerHTML = ''; }
    var grid = document.getElementById('cpageGrid');
    if (grid) { _abortImages(grid); grid.innerHTML = ''; }
  }

  function _abortImages(container) {
    var imgs = container.querySelectorAll('img, video');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].removeAttribute('src');
    }
  }

  function togglePreview() {
    _previewOpen = !_previewOpen;
    var overlay = document.getElementById('comicPreviewOverlay');
    if (overlay) {
      overlay.classList.toggle('preview-open', _previewOpen);
    }
  }

  function _escHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function _itemHtml(f) {
    var sel = _selectedFiles.indexOf(f.path) !== -1;
    var isCover = f.path === _coverPath;
    var thumb = '/api/thumbnail?path=' + encodeURIComponent(f.path) + _cbSuffix();
    var ratio = f.width && f.height ? 'auto ' + f.width + '/' + f.height : 'auto 4/3';
    return '<div class="cpage-item' + (sel ? ' selected' : '') + (isCover ? ' cover' : '') + '" data-path="' + _escHtml(f.path) + '" onclick="ComicsPicker.selectFile(this)">' +
      '<img src="' + thumb + '" alt="" loading="lazy" style="aspect-ratio:' + ratio + '">' +
      (sel ? '<button class="cpage-star" onclick="event.stopPropagation();ComicsPicker.toggleCover(this.parentElement)" title="Set as cover">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="' + (isCover ? '#ffd700' : 'none') + '" stroke="' + (isCover ? '#ffd700' : 'currentColor') + '" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
        '</button>' : '') +
      '</div>';
  }

  function _renderItems() {
    var container = document.getElementById('cpageGrid');
    var scrollTop = container.scrollTop;
    var items = _filteredList.slice(0, _loadedCount);
    var q = document.getElementById('cpageSearch').value.trim();
    var html = '';
    if (!q) {
      var parts = _currentDir ? _currentDir.split('/') : [];
      _dirEntryCache.forEach(function(d) {
        var fullPath = parts.length > 0 ? parts.join('/') + '/' + d : d;
        html += '<div class="cpage-dir-item" onclick="ComicsPicker.navigateToDir(\'' + _escHtml(fullPath) + '\')">' +
          '<svg class="cpage-dir-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>' +
          '<span class="cpage-dir-name">' + _escHtml(d) + '</span></div>';
      });
    }
    html += items.map(function(f) { return _itemHtml(f); }).join('');
    container.innerHTML = html;
    container.scrollTop = scrollTop;
    var openViewerBtn = document.getElementById('openViewerBtn');
    if (openViewerBtn) openViewerBtn.disabled = !_selectedFiles.length;
  }

  function _renderGallery() {
    var entries = _getDirEntries(_currentDir);
    _dirEntryCache = entries.dirs;
    var q = document.getElementById('cpageSearch').value.toLowerCase().trim();
    var filtered = entries.files.slice();
    if (q) {
      filtered = filtered.filter(function(f) {
        return f.name.toLowerCase().indexOf(q) !== -1 || (f.tags && f.tags.toLowerCase().indexOf(q) !== -1);
      });
    }
    if (_cpageSortMode !== 'name') {
      filtered.sort(function(a, b) {
        var ma = a.mtime || 0;
        var mb = b.mtime || 0;
        return _cpageSortMode === 'newest' ? mb - ma : ma - mb;
      });
    }
    _filteredList = filtered;
    _loadedCount = q ? _filteredList.length : Math.min(_pageSize, _filteredList.length);
    _renderFolderBar();
    _renderItems();
    _attachScrollListener();
  }

  function _loadMore() {
    if (_loadedCount >= _filteredList.length) return;
    var prev = _loadedCount;
    _loadedCount = Math.min(_loadedCount + _pageSize, _filteredList.length);
    var container = document.getElementById('cpageGrid');
    for (var i = prev; i < _loadedCount; i++) {
      container.insertAdjacentHTML('beforeend', _itemHtml(_filteredList[i]));
    }
    _attachScrollListener();
  }

  function _getScrollContainer() {
    return document.querySelector('#comicsModalOverlay .comic-modal-body');
  }

  function _attachScrollListener() {
    _detachScrollListener();
    if (_loadedCount >= _filteredList.length) return;
    var container = _getScrollContainer();
    if (!container) return;
    var ticking = false;
    _scrollHandler = function() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function() {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 400) {
          _loadMore();
        }
        ticking = false;
      });
    };
    container.addEventListener('scroll', _scrollHandler, {passive: true});
  }

  function _detachScrollListener() {
    var container = _getScrollContainer();
    if (container && _scrollHandler) {
      container.removeEventListener('scroll', _scrollHandler);
    }
    _scrollHandler = null;
  }

  function _getDirEntries(dirPath) {
    var data = _getFilteredGalleryData();
    var dirMap = {};
    var fileList = [];
    var prefix = dirPath ? dirPath + '/' : '';
    data.forEach(function(f) {
      if (dirPath && f.path.indexOf(prefix) !== 0) return;
      var rel = dirPath ? f.path.slice(prefix.length) : f.path;
      var parts = rel.split('/');
      if (parts.length === 1) {
        fileList.push(f);
      } else if (parts.length >= 2) {
        dirMap[parts[0]] = true;
      }
    });
    return { dirs: Object.keys(dirMap).sort(), files: fileList };
  }

  function _collectAllDirs() {
    var data = _getFilteredGalleryData();
    var allDirs = {};
    data.forEach(function(f) {
      var parts = f.path.split('/');
      for (var i = 0; i < parts.length - 1; i++) {
        allDirs[parts.slice(0, i + 1).join('/')] = true;
      }
    });
    return Object.keys(allDirs).sort();
  }

  function _renderFolderBar() {
    var bar = document.getElementById('cpageFolderBar');
    if (!bar) return;
    var parts = _currentDir ? _currentDir.split('/') : [];
    var html = '';
    if (parts.length > 0) {
      html += '<span class="cpage-folder-up" onclick="ComicsPicker.navigateUp()" title="Up">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>' +
        '</span>';
    }
    var cum = '';
    parts.forEach(function(p, i) {
      cum += (i > 0 ? '/' : '') + p;
      html += '<span class="cpage-folder-sep">/</span>';
      html += '<span class="cpage-folder-seg" onclick="ComicsPicker.navigateToDir(\'' + _escHtml(cum) + '\')">' + _escHtml(p) + '</span>';
    });
    html += '<span style="flex:1;min-width:4px"></span>';
    html += '<button class="cpage-folder-dropdown-btn" id="cpageFolderDropdownBtn" onclick="ComicsPicker.openFolderPicker()" title="' + Shared.t('allFiles') + '">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>' +
      '</button>';
    bar.innerHTML = html;
  }

  function filterGallery() {
    _renderGallery();
  }

  function navigateToDir(dir) {
    _currentDir = dir;
    _loadedCount = 0;
    _filteredList = [];
    _detachScrollListener();
    _renderGallery();
  }

  function navigateUp() {
    if (!_currentDir) return;
    var parts = _currentDir.split('/');
    parts.pop();
    navigateToDir(parts.join('/'));
  }

  function openFolderPicker() {
    var existing = document.getElementById('cpageFolderDropdown');
    if (existing) {
      existing.classList.toggle('open');
      return;
    }
    var btn = document.getElementById('cpageFolderDropdownBtn');
    if (!btn) return;
    var allDirs = _collectAllDirs();
    var dropdown = document.createElement('div');
    dropdown.id = 'cpageFolderDropdown';
    dropdown.className = 'cpage-folder-dropdown';
    dropdown.style.position = 'absolute';
    var rect = btn.getBoundingClientRect();
    dropdown.style.top = rect.bottom + 4 + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    dropdown.style.left = 'auto';
    allDirs.forEach(function(d) {
      var item = document.createElement('div');
      item.className = 'cpage-folder-dropdown-item';
      item.textContent = d;
      item.addEventListener('click', function() {
        navigateToDir(d);
        dropdown.classList.remove('open');
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
    document.body.appendChild(dropdown);
    var closeHandler = function(e) {
      if (!dropdown.contains(e.target) && e.target !== btn) {
        dropdown.classList.remove('open');
        setTimeout(function() { document.body.removeChild(dropdown); }, 200);
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(function() { document.addEventListener('click', closeHandler); }, 0);
  }

  function toggleDateSort() {
    var modes = ['name', 'newest', 'oldest'];
    var idx = modes.indexOf(_cpageSortMode);
    _cpageSortMode = modes[(idx + 1) % modes.length];
    var btn = document.getElementById('cpageSortDateBtn');
    if (btn) {
      var modeKey = _cpageSortMode === 'name' ? 'sortByName' : _cpageSortMode === 'newest' ? 'sortByNewest' : 'sortByOldest';
      var titleKey = modeKey + 'Title';
      var svg;
      if (_cpageSortMode === 'name') {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/></svg>';
      } else if (_cpageSortMode === 'newest') {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      } else {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
      }
      btn.innerHTML = svg + ' <span data-i18n="' + modeKey + '">' + Shared.t(modeKey) + '</span>';
      btn.title = Shared.t(titleKey);
      btn.dataset.i18n = modeKey;
      btn.dataset.i18nTitle = titleKey;
    }
    _renderGallery();
  }

  function selectFile(el) {
    var path = el.dataset.path;
    var idx = _selectedFiles.indexOf(path);
    if (idx !== -1) {
      var previewPage = document.querySelector('.preview-page[data-idx="' + idx + '"]');
      if (previewPage) {
        previewPage.classList.add('preview-page-exit');
        setTimeout(function() {
          _selectedFiles.splice(idx, 1);
          el.classList.remove('selected');
          if (_coverPath === path) {
            _coverPath = _selectedFiles.length > 0 ? _selectedFiles[0] : null;
          }
          _updateSelected();
          _renderItems();
        }, 250);
        return;
      }
      _selectedFiles.splice(idx, 1);
      el.classList.remove('selected');
      if (_coverPath === path) {
        _coverPath = _selectedFiles.length > 0 ? _selectedFiles[0] : null;
      }
    } else {
      _selectedFiles.push(path);
      el.classList.add('selected');
      if (!_coverPath) {
        _coverPath = path;
      }
    }
    _updateSelected();
    _renderItems();
  }

  function toggleCover(el) {
    var path = el.dataset.path;
    if (_selectedFiles.indexOf(path) === -1) return;
    _coverPath = path;
    _updateSelected();
    _renderGallery();
  }

  function _updateSelected() {
    var info = document.getElementById('fileCountInfo');
    if (info) info.textContent = Shared.t('selected', {n: _selectedFiles.length || 0});
    _renderPreview();
    var openViewerBtn = document.getElementById('openViewerBtn');
    if (openViewerBtn) openViewerBtn.disabled = !_selectedFiles.length;
  }

  function _renderPreview() {
    var panel = document.getElementById('comicPreviewContent');
    if (!panel) return;
    if (!_selectedFiles.length) {
      panel.innerHTML = '<div style="color:var(--text2);font-size:12px;text-align:center;padding:20px">' + Shared.t('comicsEmpty') + '</div>';
      return;
    }
    panel.innerHTML = _selectedFiles.map(function(p, i) {
      var isCover = p === _coverPath;
      var name = p.split('/').pop();
      return '<div class="preview-page' + (isCover ? ' preview-cover' : '') + '" draggable="true" data-idx="' + i + '" data-path="' + _escHtml(p) + '">' +
        '<span class="preview-drag-handle">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h8"/><path d="M8 12h8"/><path d="M8 18h8"/></svg></span>' +
        '<img class="preview-thumb" src="/api/thumbnail?path=' + encodeURIComponent(p) + _cbSuffix() + '" alt="" loading="lazy">' +
        '<span class="preview-name">' + _escHtml(name) + '</span>' +
        (isCover ? '<span class="preview-star">&bigstar;</span>' : '') +
        '<span class="page-num">' + (i + 1) + '</span>' +
        '<button class="preview-remove" onclick="event.stopPropagation();ComicsPicker.removeFile(' + i + ')" title="' + Shared.t('delete') + '">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>' +
        '</div>';
    }).join('');
  }

  function _attachDragDrop() {
    if (_dragAttached) return;
    var container = document.getElementById('comicPreviewContent');
    if (!container) return;
    _dragAttached = true;
    container.addEventListener('dragstart', function(e) {
      var el = e.target.closest('[draggable]');
      if (!el) return;
      _dragIdx = parseInt(el.dataset.idx);
      el.classList.add('sel-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    container.addEventListener('dragend', function(e) {
      var el = e.target.closest('[draggable]');
      if (el) el.classList.remove('sel-dragging');
      container.querySelectorAll('[draggable]').forEach(function(f) { f.classList.remove('sel-drag-over'); });
      _dragIdx = -1;
    });
    container.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var el = e.target.closest('[draggable]');
      if (!el) return;
      var overIdx = parseInt(el.dataset.idx);
      if (overIdx === _dragIdx) { el.classList.remove('sel-drag-over'); return; }
      container.querySelectorAll('[draggable]').forEach(function(f) { f.classList.remove('sel-drag-over'); });
      el.classList.add('sel-drag-over');
    });
    container.addEventListener('drop', function(e) {
      e.preventDefault();
      container.querySelectorAll('[draggable]').forEach(function(f) { f.classList.remove('sel-drag-over'); });
      var el = e.target.closest('[draggable]');
      if (!el || _dragIdx < 0) return;
      var overIdx = parseInt(el.dataset.idx);
      if (overIdx === _dragIdx) return;
      var item = _selectedFiles.splice(_dragIdx, 1)[0];
      _selectedFiles.splice(overIdx, 0, item);
      _dragIdx = -1;
      _updateSelected();
      _renderGallery();
    });
  }

  function setCoverFromList(idx) {
    _coverPath = _selectedFiles[idx];
    _updateSelected();
    _renderGallery();
  }

  function setCoverFromPreview(path) {
    if (_selectedFiles.indexOf(path) === -1) return;
    _coverPath = path;
    _updateSelected();
    _renderGallery();
  }

  function removeFile(idx) {
    var previewPage = document.querySelector('.preview-page[data-idx="' + idx + '"]');
    if (previewPage) {
      previewPage.classList.add('preview-page-exit');
      setTimeout(function() { _doRemoveFile(idx); }, 250);
      return;
    }
    _doRemoveFile(idx);
  }

  function _doRemoveFile(idx) {
    var path = _selectedFiles[idx];
    _selectedFiles.splice(idx, 1);
    if (_coverPath === path) {
      _coverPath = _selectedFiles.length > 0 ? _selectedFiles[0] : null;
    }
    _updateSelected();
    var items = document.getElementById('cpageGrid').querySelectorAll('.cpage-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i].dataset.path === path) {
        items[i].classList.remove('selected');
        break;
      }
    }
    _renderGallery();
  }

  function moveFile(idx, dir) {
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= _selectedFiles.length) return;
    var tmp = _selectedFiles[idx];
    _selectedFiles[idx] = _selectedFiles[newIdx];
    _selectedFiles[newIdx] = tmp;
    _updateSelected();
    _renderGallery();
  }

  function saveComic() {
    var title = document.getElementById('comicTitle').value.trim();
    if (!title) { alert('Enter a title'); return; }
    if (!_selectedFiles.length) { alert('Select at least one file'); return; }
    var btn = document.getElementById('saveComicBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    var body = {title: title, paths: _selectedFiles};
    if (_coverPath) body.cover_path = _coverPath;
    if (_editingId) body.id = _editingId;
    fetch(_editingId ? '/api/comics/update' : '/api/comics/add', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        btn.disabled = false;
        btn.textContent = 'Save';
        if (data.error) { alert('Error: ' + data.error); return; }
        if (_onSave) _onSave();
        closePicker();
      })
      .catch(function(err) {
        btn.disabled = false;
        btn.textContent = 'Save';
        alert('Error: ' + err.message);
      });
  }

  function openInViewer() {
    if (!_selectedFiles.length) return;
    var paths = _selectedFiles.map(function(p) { return encodeURIComponent(p); }).join('|');
    window.open('/comics/view?preview=1&paths=' + paths, '_blank');
  }

  return {
    init: init,
    openPicker: openPicker,
    closePicker: closePicker,
    selectFile: selectFile,
    toggleCover: toggleCover,
    saveComic: saveComic,
    removeFile: removeFile,
    moveFile: moveFile,
    toggleDateSort: toggleDateSort,
    filterGallery: filterGallery,
    togglePreview: togglePreview,
    openInViewer: openInViewer,
    setCoverFromList: setCoverFromList,
    setCoverFromPreview: setCoverFromPreview,
    navigateToDir: navigateToDir,
    navigateUp: navigateUp,
    openFolderPicker: openFolderPicker,
    setSource: setSource
  };
})();

window.ComicsPicker = ComicsPicker;

