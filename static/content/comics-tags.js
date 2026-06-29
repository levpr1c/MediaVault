import { _t, api, esc, toast } from './utils.js'
import { buildLeftPanelHtml, renderLeftTags, setupDragEvents, buildComicsGridHTML } from '../shared/grid-renderer.js'
import { initComicsSearch } from '../shared/comics/comics-search.js'

const state = { cats: [], tagToCat: {}, catCache: {} }
let _ac = null
let _comics = []
let _searchDestroy = null
let _lbCbInstance = null
let _cmScanPollTimer = null

export function comicsTagsRender(body) {
  _ac = new AbortController()
  const s = _ac.signal
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> ${_t('loading')}</div>`

  Promise.all([
    api('/api/categories?sources=auto,rule34,danbooru'),
    api('/api/comics/list')
  ]).then(([catData, comicsData]) => {
    const categories = catData.categories || []
    const members = catData.members || {}
    state.cats = categories.map(c => ({ name: c.name, color: c.color, tags: members[c.name] || [] }))
    state.tagToCat = {}
    state.catCache = {}
    state.cats.forEach(c => c.tags.forEach(t => { state.tagToCat[t] = c.name; state.catCache[t] = c.color }))

    _comics = comicsData || []

    body.innerHTML = _buildHTML()
    _attachEvents(body, s)
  }).catch(e => {
    body.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${_t('settingsError')}: ${esc(e.message)}</div>`
  })
}

export function comicsTagsDestroy() {
  if (_searchDestroy) { _searchDestroy(); _searchDestroy = null }
  if (_ac) { _ac.abort(); _ac = null }
  _stopCmScanProgressPoll()
  if (_lbCbInstance) { try { _lbCbInstance.close() } catch(e) {} _lbCbInstance = null }
}

function _buildHTML() {
  return '<div id="cmComicsTags" class="cm-files">' +
    '<div class="cm-files-toolbar" style="display:flex;gap:8px;align-items:center;padding:0 16px;flex-wrap:wrap">' +
      '<button class="action-btn action-btn-primary" id="cmScanBtn">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<span data-i18n="settingsScan">Scan</span></button>' +
      '<button class="action-btn" id="cmTagfetchBtn" style="flex-shrink:0">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>' +
        '<span data-i18n="tfAutoScanned">Auto-Tagfetch</span></button>' +
    '</div>' +
    '<div class="cm-files-body" style="gap:16px">' +
      buildLeftPanelHtml(_t('tagSearchPlaceholder')) +
      '<div class="cm-comics-tags-grid" id="cmComicsTagsGrid">' +
        '<div class="cm-comics-tags-grid-inner">' +
          buildComicsGridHTML(_comics) +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div id="cmScanProgress" class="scan-progress" style="display:none">' +
      '<div class="scan-progress-row">' +
        '<span class="fetch-spinner"></span>' +
        '<span id="cmScanProgressText" style="font-size:13px;color:var(--text)">Running...</span>' +
      '</div>' +
      '<div class="scan-progress-bar-wrap">' +
        '<div id="cmScanProgressBar" class="scan-progress-bar"></div>' +
      '</div>' +
    '</div></div>'
}

function _attachEvents(body, signal) {
  // Render tags FIRST before anything that might throw
  document.getElementById('cmFilesTagSearchQ')?.addEventListener('input', e => {
    renderLeftTags(document.getElementById('cmFilesLeftContent'), state.cats, e.target.value)
  }, { signal })
  _renderLeftTags()

  const gridDiv = document.getElementById('cmComicsTagsGrid')
  if (gridDiv) {
    try {
      _searchDestroy = initComicsSearch(gridDiv, null, null, {
        _t,
        onFilter(grid, q) {
          const inner = grid.querySelector('.cm-comics-tags-grid-inner')
          if (inner) {
            inner.innerHTML = buildComicsGridHTML(
              _comics.filter(c => (c.title || '').toLowerCase().includes(q))
            )
          }
        }
      })
    } catch (_e) {}
  }

  setupDragEvents(body, signal, {
    targetSelector: '.cm-comic-card',
    onDrop(target, tag) {
      const comicId = parseInt(target.dataset.comicId)
      const source = state.tagToCat[tag] ? 'manual' : ''
      _assignTagToComic(comicId, tag, source)
    }
  })

  body.addEventListener('click', function(e) {
    var card = e.target.closest('.cm-comic-card')
    if (!card) return
    var comicId = parseInt(card.dataset.comicId)
    var comic = _comics.find(function(c) { return c.id === comicId })
    if (!comic) return
    api('/api/comics/get', { method: 'POST', body: { id: comicId } }).then(function(data) {
      if (!data || !data.pages || !data.pages.length) return
      var pages = data.pages.map(function(p, idx) {
        return { 
          path: p.path, 
          name: 'Page ' + (idx + 1), 
          tags: '',
          width: 800,
          height: 1200
        }
      })
      if (!_lbCbInstance) {
        _lbCbInstance = new Lightbox({
          prefix: 'cmct',
          tagPanel: false,
          arrowNav: true,
          onClose: function() { _lbCbInstance = null }
        })
      }
      _lbCbInstance.open(0, pages)
    }).catch(function(e) { console.warn('Lightbox open failed:', e) })
  }, { signal })

  document.getElementById('cmScanBtn')?.addEventListener('click', _startCmScan, { signal })
  document.getElementById('cmTagfetchBtn')?.addEventListener('click', _startCmTagfetch, { signal })
}

function _renderLeftTags() {
  const container = document.getElementById('cmFilesLeftContent')
  if (!container) return
  const q = document.getElementById('cmFilesTagSearchQ')?.value || ''
  renderLeftTags(container, state.cats, q)
}

function _assignTagToComic(comicId, tag, source) {
  api('/api/comics/get', { method: 'POST', body: { id: comicId } }).then(comic => {
    if (!comic || !comic.pages || !comic.pages.length) return
    const total = comic.pages.length
    let completed = 0

    comic.pages.forEach(page => {
      api('/api/comics/pages/tag', { method: 'POST', body: { path: page.path, tag, source } })
        .then(data => {
          completed++
          if (data && data.ok) {
            const card = document.querySelector(`.cm-comic-card[data-comic-id="${comicId}"]`)
            if (card) card.classList.add('has-tags')
          }
          if (completed === total) {
            toast(`${_t('tags')} ${_t('updated')}: ${tag} → ${comic.title}`, 'success')
          }
        })
        .catch(e => {
          completed++
          if (completed === total) {
            toast(`${_t('settingsError')}: ${e.message}`, 'error')
          }
        })
    })
  }).catch(e => {
    toast(`${_t('settingsError')}: ${e.message}`, 'error')
  })
}

function _startCmScan() {
  api('/api/scan_folder', { method: 'POST' }).then(function(d) {
    if (d.skipped === 'scan_in_progress') { toast('Scan already in progress', 'error'); return }
    toast('Scan started', 'success')
    _startCmScanProgressPoll()
  }).catch(function(e) { toast(e.message, 'error') })
}

function _startCmTagfetch() {
  api('/api/comics/auto-tagfetch', { method: 'POST' }).then(function(d) {
    if (d.skipped === 'scan_in_progress') { toast('Scan already in progress', 'error'); return }
    toast('Comics tagfetch started', 'success')
    _startCmScanProgressPoll()
  }).catch(function(e) { toast(e.message, 'error') })
}

function _startCmScanProgressPoll() {
  _stopCmScanProgressPoll()
  var el = document.getElementById('cmScanProgress')
  if (el) el.style.display = 'block'
  var bar = document.getElementById('cmScanProgressBar')
  if (bar) bar.style.width = '0%'
  _updateCmScanProgress()
  _cmScanPollTimer = setInterval(_updateCmScanProgress, 2000)
}

function _stopCmScanProgressPoll() {
  if (_cmScanPollTimer) { clearInterval(_cmScanPollTimer); _cmScanPollTimer = null }
}

function _updateCmScanProgress() {
  api('/api/admin/scan-progress').then(function(data) {
    var bar = document.getElementById('cmScanProgressBar')
    var text = document.getElementById('cmScanProgressText')
    if (!bar || !text) return
    if (data.status === 'scanning' || data.status === 'full_scan') {
      var pct = data.total_folders > 0 ? Math.round(data.folders_done / data.total_folders * 100) : 50
      bar.style.width = Math.min(pct, 100) + '%'
      if (data.type === 'comics_tagfetch') {
        text.textContent = 'Tagfetch: ' + (data.current_folder || 'Running...')
      } else {
        text.textContent = (data.type === 'full' ? 'Full scan' : 'Scan') + ': ' + (data.current_folder || 'Running...')
      }
    } else if (data.status === 'done') {
      bar.style.width = '100%'
      text.textContent = data.type === 'comics_tagfetch' ? 'Tagfetch complete' : 'Scan complete'
      _stopCmScanProgressPoll()
      setTimeout(function() {
        var el = document.getElementById('cmScanProgress')
        if (el) el.style.display = 'none'
      }, 3000)
    } else if (data.status === 'error') {
      text.textContent = 'Error: ' + (data.error || '')
      _stopCmScanProgressPoll()
      setTimeout(function() {
        var el = document.getElementById('cmScanProgress')
        if (el) el.style.display = 'none'
      }, 5000)
    } else if (data.status === 'idle') {
      var el = document.getElementById('cmScanProgress')
      if (el) el.style.display = 'none'
      _stopCmScanProgressPoll()
    }
  }).catch(function() { _stopCmScanProgressPoll() })
}
