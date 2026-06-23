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
    `<input id="cmComicsSearchQ" class="cm-comics-search-input" placeholder="${_t('searchComics')}">` +
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
        `<button class="action-btn" data-action="tags-comic" data-id="${c.id}" title="${_t('tags')}">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><path d="M7 7h.01"/></svg></button>` +
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
  // Search filter
  document.getElementById('cmComicsSearchQ')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase()
    const grid = document.getElementById('cmComicsGrid')
    if (!grid) return
    _comics.forEach(c => {
      const card = grid.querySelector(`.cm-comic-card[data-id="${c.id}"]`)
      if (!card) return
      const match = (c.title || '').toLowerCase().includes(q)
      card.style.display = match ? '' : 'none'
    })
  }, { signal })

  body.addEventListener('click', e => {
    const el = e.target.closest('[data-action]')
    if (!el) return
    const actions = {
      'edit-comic': () => editComic(parseInt(el.dataset.id, 10)),
      'delete-comic': () => deleteComic(parseInt(el.dataset.id, 10)),
      'add-comic': addComic,
      'tags-comic': () => manageComicTags(parseInt(el.dataset.id, 10)),
      'back-comics': backToComicsList
    }
    actions[el.dataset.action]?.()
    if (el.dataset.action === 'delete-comic') e.stopPropagation()
  }, { signal })

  // Drag-to-tag for comic pages
  body.addEventListener('dragstart', e => {
    const chip = e.target.closest('.cm-comics-tags-chip')
    if (!chip) return
    e.dataTransfer.setData('text/plain', JSON.stringify({ tag: chip.dataset.tag, source: chip.dataset.source }))
    e.dataTransfer.effectAllowed = 'copy'
    chip.classList.add('dragging')
  }, { signal })
  body.addEventListener('dragend', e => {
    const chip = e.target.closest('.cm-comics-tags-chip')
    if (chip) chip.classList.remove('dragging')
  }, { signal })
  body.addEventListener('dragover', e => {
    const page = e.target.closest('.cm-comics-tags-page')
    if (page) { e.preventDefault(); page.classList.add('tag-dragover') }
  }, { signal })
  body.addEventListener('dragleave', e => {
    const page = e.target.closest('.cm-comics-tags-page')
    if (page) page.classList.remove('tag-dragover')
  }, { signal })
  body.addEventListener('drop', e => {
    document.querySelectorAll('.cm-comics-tags-page').forEach(p => p.classList.remove('tag-dragover'))
    const page = e.target.closest('.cm-comics-tags-page')
    if (!page) return
    let data
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch (_) { return }
    if (data && data.tag && data.source) assignComicPageTag(page.dataset.path, data.tag, data.source)
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

/* ─── COMICS TAG MANAGEMENT ─── */

let _tagComicData = null
let _tagPages = []
let _tagFetched = {}

function _cbSuffix() {
  return window.Shared && Shared._cbSuffix ? Shared._cbSuffix() : ''
}

function manageComicTags(id) {
  _tagComicData = null
  _tagPages = []
  _tagFetched = {}
  api('/api/comics/get', { method: 'POST', body: { id } }).then(comic => {
    _tagComicData = comic
    _tagPages = comic.pages || []
    const body = document.getElementById('cmContentBody')
    if (body) body.innerHTML = renderTagManageView(comic)
    attachTagManageEvents()
  }).catch(e => toast(e.message, 'error'))
}

function backToComicsList() {
  _tagComicData = null
  _tagPages = []
  _tagFetched = {}
  const body = document.getElementById('cmContentBody')
  if (body) comicsRender(body)
}

function renderTagManageView(comic) {
  let html =
    `<div id="cmComicsTags" class="cm-comics-tags">` +
      `<div class="cm-comics-tags-header">` +
        `<button class="tool-btn" data-action="back-comics" style="font-size:12px;padding:5px 10px">` +
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> ${_t('cancel')}` +
        `</button>` +
        `<h3 style="margin:0;font-size:16px;font-weight:700;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(comic.title)}</h3>` +
        `<span style="font-size:12px;color:var(--text2)">${comic.pages.length} pages</span>` +
      `</div>` +
      `<div class="cm-comics-tags-body">` +
        `<div class="cm-comics-tags-pages" id="cmComicsTagsPages">`
  comic.pages.forEach((p, i) => {
    html += renderTagPageHtml(p, i)
  })
  html +=
    `</div>` +
    `<div class="cm-comics-tags-right" id="cmComicsTagsRight">` +
      `<div class="cm-comics-tags-instructions">` +
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>` +
        `<span>Select a page to fetch tags</span>` +
      `</div>` +
    `</div>` +
  `</div></div>`
  return html
}

function renderTagPageHtml(p, i) {
  return `<div class="cm-comics-tags-page" data-path="${esc(p.path)}" data-idx="${i}" onclick="ContentManager.ctSelectPage('${esc(p.path)}')">` +
    `<img src="/api/thumbnail?path=${encodeURIComponent(p.path)}${_cbSuffix()}" loading="lazy">` +
    `<span class="cm-comics-tags-page-num">${i + 1}</span>` +
  `</div>`
}

function attachTagManageEvents() {
  // Tag search filter for panels
  const searchInput = document.getElementById('cmComicsTagSearch')
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      filterTagPanels(e.target.value)
    })
  }
}

function ctSelectPage(path) {
  document.querySelectorAll('.cm-comics-tags-page').forEach(p => p.classList.remove('selected'))
  const el = document.querySelector(`.cm-comics-tags-page[data-path="${esc(path)}"]`)
  if (el) el.classList.add('selected')

  const right = document.getElementById('cmComicsTagsRight')
  if (!right) return
  right.innerHTML = `<div class="cm-comics-tags-loading">${_t('loading')}…</div>`

  fetch(`/api/fetch_file?path=${encodeURIComponent(path)}`).then(r => r.json()).then(data => {
    _tagFetched[path] = data
    right.innerHTML = renderTagPanels(data, path)
    attachTagPanelEvents()
  }).catch(() => {
    right.innerHTML = `<div class="cm-comics-tags-error">${_t('settingsError')}</div>`
  })
}

function renderTagPanels(data, path) {
  const r34Tags = data.r34 || []
  const danGeneral = data.dan_general || []
  const danArtist = data.dan_artist || []
  const danCharacter = data.dan_character || []
  const danCopyright = data.dan_copyright || []
  const danMeta = data.dan_meta || []

  let html = `<div class="cm-comics-tags-panel-content">`
  if (r34Tags.length) {
    html +=
      `<div class="cm-comics-tags-section">` +
        `<div class="cm-comics-tags-section-title">Rule34 (${r34Tags.length})</div>` +
        `<div class="cm-comics-tags-tags">` +
          r34Tags.map(t => `<span class="tag-chip cm-comics-tags-chip" draggable="true" data-tag="${esc(t)}" data-source="r34">${esc(t)}</span>`).join('') +
        `</div>` +
      `</div>`
  }
  if (danArtist.length || danCharacter.length || danCopyright.length || danMeta.length || danGeneral.length) {
    let danHtml = ''
    if (danArtist.length) danHtml += renderDanSection('🎨 Artist', danArtist, 'dan')
    if (danCharacter.length) danHtml += renderDanSection('👤 Character', danCharacter, 'dan')
    if (danCopyright.length) danHtml += renderDanSection('📚 Series', danCopyright, 'dan')
    if (danMeta.length) danHtml += renderDanSection('# Meta', danMeta, 'dan')
    if (danGeneral.length) danHtml += renderDanSection('🏷️ General', danGeneral, 'dan')
    html +=
      `<div class="cm-comics-tags-section">` +
        `<div class="cm-comics-tags-section-title">Danbooru (${danArtist.length + danCharacter.length + danCopyright.length + danMeta.length + danGeneral.length})</div>` +
        danHtml +
      `</div>`
  }
  if (!r34Tags.length && !danGeneral.length && !danArtist.length && !danCharacter.length && !danCopyright.length && !danMeta.length) {
    html += `<div class="cm-comics-tags-empty">${_t('svNoTags')}</div>`
  }

  // Fetch all buttons
  if (r34Tags.length || danGeneral.length || danArtist.length || danCharacter.length || danCopyright.length || danMeta.length) {
    html += `<div class="cm-comics-tags-actions">`
    if (r34Tags.length) html += `<button class="btn btn-sm btn-primary" onclick="ContentManager.ctSaveAll('${esc(path)}', 'r34')">📥 Save R34 (${r34Tags.length})</button>`
    if (danGeneral.length || danArtist.length || danCharacter.length || danCopyright.length || danMeta.length)
      html += `<button class="btn btn-sm btn-primary" onclick="ContentManager.ctSaveAll('${esc(path)}', 'dan')">📥 Save Dan (${danArtist.length + danCharacter.length + danCopyright.length + danMeta.length + danGeneral.length})</button>`
    html += `</div>`
  }

  html += `</div>`
  return html
}

function renderDanSection(label, tags, source) {
  return `<div class="cm-comics-tags-subsection">` +
    `<div class="cm-comics-tags-subsection-label">${label}</div>` +
    `<div class="cm-comics-tags-tags">` +
      tags.map(t => `<span class="tag-chip cm-comics-tags-chip" draggable="true" data-tag="${esc(t)}" data-source="${source}">${esc(t)}</span>`).join('') +
    `</div></div>`
}

function attachTagPanelEvents() {
  // Drag events are handled by the global listener on body
  // Tag chips in panels are already draggable
}

function filterTagPanels(q) {
  const chips = document.querySelectorAll('#cmComicsTagsRight .cm-comics-tags-chip')
  const val = q.toLowerCase().trim()
  chips.forEach(chip => {
    chip.style.display = !val || chip.dataset.tag.toLowerCase().includes(val) ? '' : 'none'
  })
}

function assignComicPageTag(path, tag, source) {
  api('/api/comics/pages/tag', { method: 'POST', body: { path, tag, source } })
    .then(data => {
      if (data.ok) {
        toast(`${tag} → ${path.split('/').pop()}`, 'success')
        // Visual feedback: mark the page as tagged
        const page = document.querySelector(`.cm-comics-tags-page[data-path="${esc(path)}"]`)
        if (page) page.classList.add('has-tags')
      }
    })
    .catch(e => toast(e.message, 'error'))
}

function ctSaveAll(path, source) {
  const data = _tagFetched[path]
  if (!data) return
  const tags = source === 'r34' ? (data.r34 || []) : [...(data.dan_general || []), ...(data.dan_artist || []), ...(data.dan_character || []), ...(data.dan_copyright || []), ...(data.dan_meta || [])]
  if (!tags.length) return

  // Save via /api/save_file which handles bulk save + categorization
  api('/api/save_file', { method: 'POST', body: { path, source } })
    .then(data => {
      if (data.ok) {
        const page = document.querySelector(`.cm-comics-tags-page[data-path="${esc(path)}"]`)
        if (page) page.classList.add('has-tags')
        toast(`${_t('tags')} ${_t('updated')}`, 'success')
      }
    })
    .catch(e => toast(e.message, 'error'))
}

export { ctSelectPage, ctSaveAll }
