import { _t, api, esc, isImageExt, isVideoExt, toast, hexToRgba, debounce } from '../utils.js'
import { buildLeftPanelHtml, renderLeftTags, setupDragEvents } from '../../shared/grid-renderer.js'

function _modal(html) {
  var overlay = document.getElementById('cmModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cmModal';
    overlay.className = 'admin-modal';
    overlay.addEventListener('click', function(e) {
      var el = e.target;
      if (el === overlay || el.closest('[data-modal-close]')) {
        _closeModal();
      }
    });
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div class="admin-modal-content" style="max-width:800px">' + html + '</div>';
  overlay.classList.add('open');
}

function _closeModal() {
  var overlay = document.getElementById('cmModal');
  if (overlay) overlay.classList.remove('open');
}

function _showFilesWithoutTags() {
  _modal(
    '<div class="admin-modal-title"><span class="fetch-spinner"></span> ' + _t('filesWithoutTags') + '</div>' +
    '<div class="admin-modal-actions"><button class="btn" data-modal-close>' + _t('cancel') + '</button></div>'
  );
  api('/api/content-mgmt/files-without-tags').then(function(data) {
    var files = data.files || [];
    if (files.length === 0) {
      _modal(
        '<div class="admin-modal-title">' + _t('filesWithoutTagsTitle') + '</div>' +
        '<p style="color:var(--text2)">' + _t('allFilesHaveTags') + '</p>' +
        '<div class="admin-modal-actions"><button class="btn" data-modal-close>' + _t('close') + '</button></div>'
      );
      return;
    }
    var html = '<div class="admin-modal-title">' + _t('filesWithoutTagsTitle') + '</div>' +
      '<div style="font-size:12px;color:var(--text2);margin-bottom:12px">' +
      _t('totalFilesWithoutTags', {n: files.length}) + '</div>' +
      '<div style="max-height:65vh;overflow-y:auto">';
    files.forEach(function(f) {
      var thumbUrl = '/api/thumbnail?path=' + encodeURIComponent(f.path);
      var tagList = (f.tags || '').split(',').filter(function(t){ return t.trim(); });
      html += '<div class="dup-file" style="display:flex;align-items:flex-start;gap:12px;padding:8px;border-radius:8px;border:2px solid transparent;margin-bottom:4px;cursor:default">' +
        '<div style="width:80px;height:80px;flex-shrink:0;background:var(--surface2);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center">' +
        '<img src="' + thumbUrl + '" loading="lazy" style="max-width:80px;max-height:80px;object-fit:contain" onerror="this.style.display=\'none\'">' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13px;font-weight:600;color:var(--text);word-break:break-all;line-height:1.3;margin-bottom:2px">' + esc(f.name) + '</div>' +
        (tagList.length > 0
          ? '<div style="display:flex;flex-wrap:wrap;gap:2px">' +
            tagList.map(function(t){ return '<span class="tag-chip" style="font-size:10px">' + esc(t.trim()) + '</span>'; }).join('') +
            '</div>'
          : '<span style="font-size:11px;color:var(--text2)">—</span>') +
        '<div style="font-size:10px;color:var(--text2);margin-top:2px">' + esc(f.path) + '</div>' +
        '</div></div>';
    });
    html += '</div>' +
      '<div class="admin-modal-actions"><button class="btn" data-modal-close>' + _t('close') + '</button></div>';
    _modal(html);
  }).catch(function(e) {
    _modal(
      '<div class="admin-modal-title">' + _t('settingsError') + '</div>' +
      '<p style="color:var(--text2)">' + esc(e.message) + '</p>' +
      '<div class="admin-modal-actions"><button class="btn" data-modal-close>' + _t('close') + '</button></div>'
    );
  });
}

let _ac = null
let _allFiles = []
let _filteredFiles = []
let _layoutMode = 'columns'
let _thumbSize = 180
let _sortMode = 'name'
let _searchQ = ''
let _pageSize = 0
let _currentPage = 1
const state = { cats: [], tagToCat: {}, catCache: {} }
let _popTags = []

let _lbInstance = null

export function filesRender(body) {
  _currentPage = 1
  _ac = new AbortController()
  const s = _ac.signal
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> ${_t('loading')}</div>`

  _loadLayoutPrefs()

  Promise.all([
    api('/api/categories'),
    api('/api/gallery?per_page=0'),
    api('/api/popular_tags')
  ]).then(([catData, galData, popData]) => {
    const cats = catData.categories || []
    const members = catData.members || {}
    state.cats = cats.map(c => ({ name: c.name, color: c.color, tags: members[c.name] || [] }))
    state.tagToCat = {}
    state.catCache = {}
    state.cats.forEach(c => c.tags.forEach(t => { state.tagToCat[t] = c.name; state.catCache[t] = c.color }))

    _allFiles = (galData.files || []).filter(f => f.path)
    _sortFiles()
    _filterFiles()

    _popTags = (popData.tags || []).slice(0, 30)

    _buildHTML(body)
    _attachEvents(body, s)
  }).catch(e => {
    body.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${_t('settingsError')}: ${esc(e.message)}</div>`
  })
}

export function filesDestroy() {
  if (_ac) { _ac.abort(); _ac = null }
}

function _loadLayoutPrefs() {
  try {
    _layoutMode = localStorage.getItem('content_files_layout') || 'columns'
    _thumbSize = parseInt(localStorage.getItem('content_files_thumb') || '160', 10)
    _sortMode = localStorage.getItem('content_files_sort') || 'name'
    _pageSize = parseInt(localStorage.getItem('content_files_pagesize') || '0', 10)
  } catch (e) {}
}

function _saveLayoutPrefs() {
  try {
    localStorage.setItem('content_files_layout', _layoutMode)
    localStorage.setItem('content_files_thumb', '' + _thumbSize)
    localStorage.setItem('content_files_sort', _sortMode)
    localStorage.setItem('content_files_pagesize', '' + _pageSize)
  } catch (e) {}
}

function _sortFiles() {
  const sorted = _allFiles.slice()
  if (_sortMode === 'newest') sorted.sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
  else if (_sortMode === 'oldest') sorted.sort((a, b) => (a.mtime || 0) - (b.mtime || 0))
  else sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  _allFiles = sorted
}

function _filterFiles() {
  if (!_searchQ || typeof _searchQ !== 'string') { _filteredFiles = _allFiles.slice(); return }
  const q = _searchQ.toLowerCase()
  _filteredFiles = _allFiles.filter(f => (f.name || '').toLowerCase().includes(q))
}

function _buildHTML(body) {
  body.innerHTML =
    `<div id="cmFiles" class="cm-files">` +
      _buildToolbar() +
      `<div class="cm-files-body">` +
        buildLeftPanelHtml(_t('tagSearchPlaceholder')) +
        _buildRightPanel() +
      `</div>` +
    `</div>`

  _renderLeftTags((document.getElementById('cmFilesTagSearchQ') || {}).value || '')
  _renderGallery()
}

function _buildToolbar() {
  const sortLabels = { name: _t('sortByName'), newest: _t('sortByNewest'), oldest: _t('sortByOldest') }
  const sortSvg = name => name === 'name'
    ? '<path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/>'
    : '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>'

  const pages = [0, 30, 60, 90]
  const pageLabels = { 0: _t('tfFilterAll'), 30: '30', 60: '60', 90: '90' }

  return `<div class="cm-files-toolbar shared-toolbar">` +
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;color:var(--text2)"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>` +
    `<input id="cmFilesSearch" class="cm-files-toolbar-search" placeholder="${_t('searchFiles')}...">` +
    `<span class="cm-files-count" id="cmFilesCount">${_filteredFiles.length}</span>` +
    `<span class="cm-files-tb-sep"></span>` +
    `<button class="cm-files-tb-action" id="cmSortBtn" data-action="toggle-sort" title="${sortLabels[_sortMode]}">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">${sortSvg(_sortMode)}</svg>` +
    `</button>` +
    `<span class="cm-files-tb-label" id="cmSortLabel">${sortLabels[_sortMode]}</span>` +
    pages.map(s => `<button class="cm-files-tb-action${_pageSize === s ? ' active' : ''}" data-action="pagesize" data-size="${s}">${pageLabels[s]}</button>`).join('') +
    `<span class="cm-files-tb-sep"></span>` +
    `<button class="cm-files-tb-action thumb-size ${_thumbSize === 140 ? 'active' : ''}" data-action="thumbsize" data-size="140" title="S">S</button>` +
    `<button class="cm-files-tb-action thumb-size ${_thumbSize === 180 ? 'active' : ''}" data-action="thumbsize" data-size="180" title="M">M</button>` +
    `<button class="cm-files-tb-action thumb-size ${_thumbSize === 220 ? 'active' : ''}" data-action="thumbsize" data-size="220" title="L">L</button>` +
    `<span class="cm-files-tb-sep"></span>` +
    `<button class="action-btn" data-action="files-without-tags" title="${_t('filesWithoutTags')}">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 14l2 2 4-4"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>` +
      `<span>${_t('filesWithoutTags')}</span>` +
    `</button>` +
    `<button class="action-btn" data-action="find-originals" title="${_t('findOriginals')}">` +
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>` +
      `<span>${_t('findOriginals')}</span>` +
    `</button>` +
  `</div>`
}

function _getUncategorizedTags(q) {
  return _popTags.filter(item => {
    const tag = item.name || item.tag || item
    if (q && !tag.toLowerCase().includes(q)) return false
    return !state.tagToCat[tag]
  }).slice(0, 20)
}

function _renderLeftTags(searchQ) {
  const container = document.getElementById('cmFilesLeftContent')
  if (!container) return
  const q = searchQ ? searchQ.toLowerCase() : ''
  renderLeftTags(container, state.cats, q, {
    uncatTags: _getUncategorizedTags(q)
  })
}

function _buildRightPanel() {
  return `<div class="cm-files-right">` +
    `<div class="cm-files-right-scroll">` +
      `<div class="cm-files-gallery shared-grid" id="cmFilesGallery">` +
      `</div>` +
    `</div>` +
    `<div class="cm-files-pagination" id="cmFilesPagination">` +
      `<button class="cm-files-tb-action" data-action="page" data-dir="-1">‹</button>` +
      `<span id="cmFilesPageInfo"></span>` +
      `<button class="cm-files-tb-action" data-action="page" data-dir="1">›</button>` +
    `</div>` +
  `</div>`
}

function _getPageItems() {
  if (_pageSize <= 0) return _filteredFiles
  const start = (_currentPage - 1) * _pageSize
  return _filteredFiles.slice(start, start + _pageSize)
}

function _totalPages() {
  return _pageSize > 0 ? Math.max(1, Math.ceil(_filteredFiles.length / _pageSize)) : 1
}

function _renderGallery() {
  const gallery = document.getElementById('cmFilesGallery')
  if (!gallery) return
  gallery.className = 'cm-files-gallery' + (_layoutMode !== 'columns' ? ' ' + _layoutMode : '')
  gallery.style.setProperty('--thumb-size', _thumbSize + 'px')

  if (_layoutMode === 'fixed') {
    const w = gallery.offsetWidth || 600
    const gap = 10
    const cols = Math.max(2, Math.round((w + gap) / (_thumbSize + gap)))
    gallery.style.setProperty('--grid-cols', cols)
  }

  const items = _getPageItems()

  if (!items.length) {
    gallery.innerHTML = `<div class="cm-files-gallery-empty">${_t('mediaDirEmpty')}</div>`
    _renderPagination()
    return
  }

  gallery.innerHTML = items.map(f => {
    const thumbSrc = '/api/thumbnail?path=' + encodeURIComponent(f.path) + _cbSuffix()
    const isImg = isImageExt(f.name)
    const isVideo = isVideoExt(f.name)
    const orient = (f.width > 0 && f.height > 0) ? (f.width > f.height ? 'landscape' : (f.height > f.width ? 'portrait' : 'square')) : ''
    return `<div class="file-card" data-path="${esc(f.path)}" data-filepath="${esc(f.path)}" data-action="view-file"${orient ? ' data-orient="' + orient + '"' : ''}>` +
      `<div class="file-card-thumb">` +
      (isImg || isVideo ? `<img src="${thumbSrc}" loading="lazy">` :
       `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`) +
      (isVideo ? '<svg class="file-card-video-badge" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>' : '') +
      `</div>` +
      `<div class="file-card-body">` +
        `<div class="file-card-bg"${isImg || isVideo ? ' style="--thumb:url(' + thumbSrc + ')"' : ''}></div>` +
        `<div class="file-card-content">` +
          `<div class="file-card-name">${esc(f.name)}</div>` +
        `</div>` +
      `</div>` +
    `</div>`
  }).join('')
  if (_layoutMode === 'columns') {
    Shared.reorderGalleryDOM(document.getElementById('cmFilesGallery'), '.file-card')
  }
  _renderPagination()
}

function getVisualOrder() {
  var gallery = document.getElementById('cmFilesGallery')
  if (!gallery) return []
  return Shared.getVisualOrder(gallery, '.file-card')
}

function _renderPagination() {
  const el = document.getElementById('cmFilesPagination')
  if (!el) return
  if (_pageSize <= 0 || _filteredFiles.length <= _pageSize) {
    el.style.display = 'none'
    return
  }
  el.style.display = 'flex'
  const total = _totalPages()
  const info = document.getElementById('cmFilesPageInfo')
  if (info) info.textContent = `${_currentPage} / ${total}`
  const btns = el.querySelectorAll('[data-action="page"]')
  if (btns.length >= 2) {
    btns[0].disabled = _currentPage <= 1
    btns[1].disabled = _currentPage >= total
  }
}

function _attachEvents(body, signal) {
  // File search (debounced)
  const doSearch = debounce(e => {
    _searchQ = e.target.value
    _filterFiles()
    _currentPage = 1
    _renderGallery()
    const count = document.getElementById('cmFilesCount')
    if (count) count.textContent = '' + _filteredFiles.length
  }, 150)
  body.querySelector('#cmFilesSearch')?.addEventListener('input', doSearch, { signal })

  // Tag search
  body.querySelector('#cmFilesTagSearchQ')?.addEventListener('input', e => {
    _renderLeftTags(e.target.value)
  }, { signal })

  // Delegated clicks
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-action]')
    if (!el) return
    const actions = {
      'view-file': () => viewFile(el.dataset.filepath),
      'toggle-sort': toggleSort,
      'thumbsize': () => setThumbSize(parseInt(el.dataset.size, 10)),
      'pagesize': () => setPageSize(parseInt(el.dataset.size, 10)),
      'page': () => _goToPage(_currentPage + parseInt(el.dataset.dir, 10)),
      'files-without-tags': _showFilesWithoutTags,
      'find-originals': function() {
        if (window.FindOriginals) window.FindOriginals.open();
      }
    }
    actions[el.dataset.action]?.()
  }, { signal })

  // Drag-to-tag using shared setup
  setupDragEvents(body, signal, {
    targetSelector: '.file-card',
    onDrop(target, tag) {
      const path = target.dataset.filepath
      if (path) assignTag(path, tag)
    }
  })
}

function setPageSize(size) {
  _pageSize = size
  _currentPage = 1
  _saveLayoutPrefs()
  _renderGallery()
  document.querySelectorAll('#cmFiles [data-action="pagesize"]').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.size, 10) === size)
  })
}

function _goToPage(page) {
  const total = _totalPages()
  _currentPage = Math.max(1, Math.min(page, total))
  _renderGallery()
}

function toggleSort() {
  const modes = ['name', 'newest', 'oldest']
  const idx = modes.indexOf(_sortMode)
  _sortMode = modes[(idx + 1) % modes.length]
  _saveLayoutPrefs()
  _sortFiles()
  _filterFiles()
  _currentPage = 1
  _renderGallery()
  const btn = document.getElementById('cmSortBtn')
  if (!btn) return
  const labels = { name: _t('sortByName'), newest: _t('sortByNewest'), oldest: _t('sortByOldest') }
  const svg = _sortMode === 'name'
    ? '<path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/>'
    : _sortMode === 'newest'
    ? '<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>'
    : '<path d="M12 19V5"/><path d="M19 12l-7-7-7 7"/>'
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">${svg}</svg>`
  btn.title = labels[_sortMode]
  const label = document.getElementById('cmSortLabel')
  if (label) label.textContent = labels[_sortMode]
}

function setThumbSize(size) {
  _thumbSize = size
  _saveLayoutPrefs()
  _renderGallery()
  document.querySelectorAll('#cmFiles [data-action="thumbsize"]').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.size, 10) === size)
  })
}

export function onFileSearch(q) {
  _searchQ = q || ''
  _filterFiles()
  _currentPage = 1
  _renderGallery()
  const count = document.getElementById('cmFilesCount')
  if (count) count.textContent = '' + _filteredFiles.length
  const searchInput = document.getElementById('cmFilesSearch')
  if (searchInput) searchInput.value = _searchQ
}

function assignTag(path, tag) {
  api('/api/tags', { method: 'POST', body: { path, tags: [tag], action: 'add' } })
    .then(() => {
      const name = path.split('/').pop()
      toast(`${tag} → ${name}`, 'success')
    })
    .catch(e => toast(e.message, 'error'))
}

/* ─── KEYBOARD ─── */

/* ─── LIGHTBOX ─── */

function viewFile(path) {
  if (!_lbInstance) {
    _lbInstance = new Lightbox({
      prefix: 'cm',
      tagPanel: true,
      onSaveTags: function(path, tags) {
        return api('/api/save_file', { method: 'POST', body: { path: path, source: tags } })
          .catch(function(e) { toast(e.message, 'error'); throw e })
      },
      getCatListFn: function() {
        return state.cats.map(function(c) { return { name: c.name, color: c.color } })
      },
      getTagCategoryNameFn: function(tag) {
        return state.catCache[tag] || ''
      },
      getVisualOrderFn: function() { return getVisualOrder() },
      hexToRgba: hexToRgba
    })
  }
  const idx = _filteredFiles.findIndex(f => f.path === path)
  if (idx >= 0) _lbInstance.open(idx, _filteredFiles)
}

function _cbSuffix() {
  return window.Shared && Shared._cbSuffix ? Shared._cbSuffix() : ''
}
