import { _t, api, esc, toast } from './utils.js'
import * as Picker from '../shared/comics/picker-bridge.js'

let _ac = null
let _comics = []

export function comicsRender(body) {
  _ac = new AbortController()
  const s = _ac.signal
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> ${_t('loading')}</div>`
  api('/api/comics/list').then(data => {
    _comics = data || []
    body.innerHTML = _buildHTML()
    _attachEvents(body, s)
  }).catch(e => {
    body.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${_t('settingsError')}: ${esc(e.message)}</div>`
  })
}

export function comicsDestroy() {
  if (_ac) { _ac.abort(); _ac = null }
  Picker.closePicker()
}

function _buildHTML() {
  let html = `<div id="cmComics" class="cm-comics">` +
    `<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">` +
      `<span style="font-size:14px;font-weight:600;color:var(--text);flex:1">${_t('comics')}</span>` +
      `<button class="action-btn" id="cmAutoFetchComicsBtn" title="${_t('autoFetchComics')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>` +
        `<span>${_t('autoFetchComics')}</span>` +
      `</button>` +
      `<button class="action-btn" id="cmEnrichMetaBtn" title="${_t('enrichMetadata')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>` +
        `<span>${_t('enrichMetadata')}</span>` +
      `</button>` +
    `</div>` +
    `<div class="cm-comics-grid" id="cmComicsGrid">`
  _comics.forEach(c => {
    html +=
      `<div class="cm-comic-card" data-action="edit-comic" data-id="${c.id}">`
    if (c.cover) {
      html +=
        `<div class="cm-comic-cover">` +
          `<img src="/api/media?path=${encodeURIComponent(c.cover)}${_cbSuffix()}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=cm-comic-fallback>&#x1F4C4;</span>'">` +
        `</div>`
    } else {
      html += `<div class="cm-comic-cover"><span class="cm-comic-fallback">&#x1F4C4;</span></div>`
    }
    html +=
      `<div class="cm-comic-info">` +
        `<span class="cm-comic-title">${esc(c.title)}</span>` +
        `<div style="display:flex;gap:2px">` +
        `<button class="action-btn" data-action="export-metadata" data-id="${c.id}" title="${_t('exportMetadata')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>` +
        `<button class="action-btn" data-action="import-metadata" data-id="${c.id}" title="${_t('importMetadata')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></button>` +
        `<button class="action-btn" data-action="delete-comic" data-id="${c.id}" title="${_t('delete')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>` +
        `</div>` +
      `</div></div>`
  })
  html +=
    `<div class="cm-comic-add-card" data-action="add-comic">` +
      `<div class="cm-comic-add-icon">+</div>` +
      `<div class="cm-comic-add-label">${_t('createComic')}</div>` +
    `</div>`
  html += `</div></div>`
  return html
}

function _attachEvents(body, signal) {
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-action]')
    if (!el) return
    const actions = {
      'edit-comic': () => editComic(parseInt(el.dataset.id, 10)),
      'delete-comic': () => deleteComic(parseInt(el.dataset.id, 10)),
      'add-comic': addComic,
      'export-metadata': function() {
        var cid = parseInt(el.dataset.id, 10)
        fetch('/api/comics/metadata-export?comic_id=' + cid).then(function(r) { return r.json() }).then(function(d) {
          if (d.ok) { toast(_t('metadataExported'), 'success') }
          else { toast(d.error || _t('exportFailed'), 'error') }
        }).catch(function(e) { toast(e.message, 'error') })
        e.stopPropagation()
      },
      'import-metadata': function() {
        var cid = parseInt(el.dataset.id, 10)
        fetch('/api/comics/metadata-import?comic_id=' + cid, { method: 'POST' }).then(function(r) { return r.json() }).then(function(d) {
          if (d.ok) { toast(_t('metadataImported'), 'success'); reloadComics() }
          else { toast(d.error || _t('importFailed'), 'error') }
        }).catch(function(e) { toast(e.message, 'error') })
        e.stopPropagation()
      }
    }
    actions[el.dataset.action]?.()
    if (el.dataset.action === 'delete-comic') e.stopPropagation()
  }, { signal })

  body.querySelector('#cmAutoFetchComicsBtn')?.addEventListener('click', function() {
    if (this.disabled) return
    this.disabled = true
    this.innerHTML = '<span class="fetch-spinner"></span>'
    fetch('/api/comics/auto-fetch', { method: 'POST' }).then(function(r) { return r.json() }).then(function(d) {
      if (d.skipped === 'scan_in_progress') {
        toast('Scan already in progress', 'warning')
        return
      }
      var pollTimer = setInterval(function() {
        fetch('/api/admin/scan-progress').then(function(r2) { return r2.json() }).then(function(pd) {
          if (pd.status === 'done' || pd.status === 'idle') {
            clearInterval(pollTimer)
            reloadComics()
            toast('Done!', 'success')
            return
          }
          if (pd.status === 'error') {
            clearInterval(pollTimer)
            toast(pd.error || 'Error', 'error')
            return
          }
        }).catch(function() { clearInterval(pollTimer) })
      }, 2000)
    }).catch(function(e) {
      toast(e.message, 'error')
    }).finally(function() {
      setTimeout(function() {
        var btn = document.getElementById('cmAutoFetchComicsBtn')
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg><span>' + _t('autoFetchComics') + '</span>' }
      }, 5000)
    })
  }, { signal })

  body.querySelector('#cmEnrichMetaBtn')?.addEventListener('click', function() {
    if (this.disabled) return
    this.disabled = true
    this.innerHTML = '<span class="fetch-spinner"></span>'
    fetch('/api/comics/enrich-metadata', { method: 'POST' }).then(function(r) { return r.json() }).then(function(d) {
      if (d.skipped === 'scan_in_progress') {
        toast('Scan already in progress', 'warning')
        return
      }
      var pollTimer = setInterval(function() {
        fetch('/api/admin/scan-progress').then(function(r2) { return r2.json() }).then(function(pd) {
          if (pd.status === 'done' || pd.status === 'idle') {
            clearInterval(pollTimer)
            reloadComics()
            toast('Done!', 'success')
            return
          }
          if (pd.status === 'error') {
            clearInterval(pollTimer)
            toast(pd.error || 'Error', 'error')
            return
          }
        }).catch(function() { clearInterval(pollTimer) })
      }, 2000)
    }).catch(function(e) {
      toast(e.message, 'error')
    }).finally(function() {
      setTimeout(function() {
        var btn = document.getElementById('cmEnrichMetaBtn')
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg><span>' + _t('enrichMetadata') + '</span>' }
      }, 5000)
    })
  }, { signal })
}

/* ─── COMIC CRUD ─── */

function editComic(id) {
  api('/api/comics/get', { method: 'POST', body: { id } }).then(comic => {
    Picker.openPicker({
      editData: { id, title: comic.title, paths: comic.pages.map(p => p.path), cover_path: comic.cover },
      onSave: () => {
        toast(_t('updated'), 'success')
        reloadComics()
      }
    })
  }).catch(e => toast(e.message, 'error'))
}

function addComic() {
  Picker.openPicker({
    onSave: () => {
      toast(_t('comicCreated'), 'success')
      reloadComics()
    }
  })
}

function deleteComic(id) {
  const comic = _comics.find(c => c.id === id)
  if (!comic) return
  if (!confirm(`${_t('delete')} "${comic.title}"?`)) return
  api('/api/comics/delete', { method: 'POST', body: { id } })
    .then(() => { toast(_t('deleted'), 'success'); reloadComics() })
    .catch(e => toast(e.message, 'error'))
}

function reloadComics() {
  const body = document.getElementById('cmContentBody')
  if (!body) return
  comicsDestroy()
  comicsRender(body)
}

export function initModalEvents() {
  Picker.init()
}

function _cbSuffix() {
  return window.Shared && Shared._cbSuffix ? Shared._cbSuffix() : ''
}
