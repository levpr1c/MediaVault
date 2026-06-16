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
  let html = `<div id="cmComics" class="cm-comics"><div class="cm-comics-grid">`
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
        `<button class="action-btn" data-action="delete-comic" data-id="${c.id}" title="${_t('delete')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></button>` +
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
      'add-comic': addComic
    }
    actions[el.dataset.action]?.()
    if (el.dataset.action === 'delete-comic') e.stopPropagation()
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
