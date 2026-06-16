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
  var _previewTimer = null;
  var _previewEl = null;
  var _cpageSortMode = 'name';
  var _previewOpen = false;
  var _editingId = null;
  var _onSave = null;
  var _onCancel = null;
  var _pageSize = 30;
  var _loadedCount = 0;
  var _filteredList = [];
  var _scrollHandler = null;

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
    _initPreview();
  }

  function _initPreview() {
    _previewEl = document.createElement('div');
    _previewEl.id = 'cpagePreview';
    document.body.appendChild(_previewEl);
    var grid = document.getElementById('cpageGrid');
    if (!grid) return;
    var currentItem = null;
    var hideTimer = null;
    function cancelHide() {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    function doHide() {
      cancelHide();
      _hidePreview();
    }
    grid.addEventListener('mouseover', function(e) {
      var item = e.target.closest('.cpage-item');
      if (item === currentItem) return;
      currentItem = item;
      cancelHide();
      if (item) _schedulePreview(item);
      else hideTimer = setTimeout(doHide, 400);
    });
    grid.addEventListener('mouseleave', function() {
      currentItem = null;
      cancelHide();
      hideTimer = setTimeout(doHide, 400);
    });
    _previewEl.addEventListener('mouseenter', function() {
      cancelHide();
    });
    _previewEl.addEventListener('mouseleave', function() {
      hideTimer = setTimeout(doHide, 400);
    });
  }

  function _schedulePreview(item) {
    _hidePreview();
    _previewTimer = setTimeout(function() {
      var path = item.dataset.path;
      if (!path) return;
      var fileData = _galleryData.filter(function(f) { return f.path === path; })[0];
      if (!fileData) return;
      var scale = 2.4;
      var rect = item.getBoundingClientRect();
      var w = rect.width * scale;
      var h = rect.height * scale;
      if (fileData.width && fileData.height && fileData.type === 'image') {
        var ar = fileData.width / fileData.height;
        if (ar > 1) h = w / ar;
        else w = h * ar;
      }
      var maxH = window.innerHeight - 40;
      if (h > maxH) { h = maxH; w = h * (fileData.width && fileData.height ? fileData.width / fileData.height : 1); }
      var maxW = window.innerWidth - 40;
      if (w > maxW) { w = maxW; h = fileData.width ? w / (fileData.width / fileData.height) : w; }
      var left = rect.right + 15;
      if (left + w > window.innerWidth - 10) left = rect.left - 15 - w;
      var top = rect.top + (rect.height - h) / 2;
      if (top < 5) top = 5;
      if (top + h > window.innerHeight - 5) top = window.innerHeight - 5 - h;
      _previewEl.style.width = w + 'px';
      _previewEl.style.height = h + 'px';
      _previewEl.style.left = left + 'px';
      _previewEl.style.top = top + 'px';
      if (fileData.type === 'video') {
        _previewEl.innerHTML = '<video src="/api/media?path=' + encodeURIComponent(path) + _cbSuffix() + '" autoplay muted loop playsinline controls></video>';
      } else {
        _previewEl.innerHTML = '<img src="/api/media?path=' + encodeURIComponent(path) + _cbSuffix() + '" alt="">';
      }
      _previewEl.classList.add('show');
    }, 300);
  }

  function _hidePreview() {
    clearTimeout(_previewTimer);
    _previewTimer = null;
    if (_previewEl) {
      _previewEl.classList.remove('show');
      _previewEl.innerHTML = '';
    }
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
    _detachScrollListener();

    document.getElementById('comicTitle').value = opts.editData ? (opts.editData.title || '') : '';
    document.getElementById('cpageSearch').value = '';
    document.getElementById('comicsModalOverlay').classList.add('open');

    var prev = document.getElementById('comicPreviewOverlay');
    if (prev) prev.classList.remove('preview-open');
    var toggle = document.getElementById('previewToggleBtn') || document.getElementById('comicPreviewToggle');
    if (toggle) toggle.querySelector('svg').innerHTML = '<path d="M9 18l6-6-6-6"/>';

    _updateSelected();
    fetch('/api/gallery').then(function(r) { return r.json(); }).then(function(data) {
      _galleryData = data.files || [];
      _renderGallery();
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
    var prev = document.getElementById('comicPreviewOverlay');
    var toggle = document.getElementById('previewToggleBtn') || document.getElementById('comicPreviewToggle');
    if (_previewOpen) {
      prev.classList.add('preview-open');
      toggle.querySelector('svg').innerHTML = '<path d="M15 18l-6-6 6-6"/>';
    } else {
      prev.classList.remove('preview-open');
      toggle.querySelector('svg').innerHTML = '<path d="M9 18l6-6-6-6"/>';
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
    container.innerHTML = items.map(function(f) { return _itemHtml(f); }).join('');
    container.scrollTop = scrollTop;
    var openViewerBtn = document.getElementById('openViewerBtn');
    if (openViewerBtn) openViewerBtn.disabled = !_selectedFiles.length;
  }

  function _renderGallery() {
    var q = document.getElementById('cpageSearch').value.toLowerCase().trim();
    _filteredList = _galleryData.slice();
    if (q) {
      _filteredList = _filteredList.filter(function(f) {
        return f.name.toLowerCase().indexOf(q) !== -1 || (f.tags && f.tags.toLowerCase().indexOf(q) !== -1);
      });
    }
    if (_cpageSortMode !== 'name') {
      _filteredList.sort(function(a, b) {
        var ma = a.mtime || 0;
        var mb = b.mtime || 0;
        return _cpageSortMode === 'newest' ? mb - ma : ma - mb;
      });
    }
    _loadedCount = q ? _filteredList.length : Math.min(_pageSize, _filteredList.length);
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

  function filterGallery() {
    _renderGallery();
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
      var fileData = _galleryData.filter(function(f) { return f.path === p; })[0];
      var isVideo = fileData && fileData.type === 'video';
      var mediaTag = isVideo
        ? '<video src="/api/media?path=' + encodeURIComponent(p) + _cbSuffix() + '" autoplay muted loop playsinline style="max-height:400px;max-width:400px;display:block"></video>'
        : '<img src="/api/thumbnail?path=' + encodeURIComponent(p) + _cbSuffix() + '" alt="" loading="lazy">';
      return '<div class="preview-page' + (isCover ? ' preview-cover' : '') + '" draggable="true" data-idx="' + i + '" data-path="' + _escHtml(p) + '">' +
        (isCover ? '<span class="preview-star">★</span>' : '') +
        '<button class="preview-remove" onclick="event.stopPropagation();ComicsPicker.removeFile(' + i + ')" title="' + Shared.t('delete') + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>' +
        mediaTag +
        '<span class="page-num">' + (i + 1) + '</span></div>';
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
    setCoverFromPreview: setCoverFromPreview
  };
})();

window.ComicsPicker = ComicsPicker;

