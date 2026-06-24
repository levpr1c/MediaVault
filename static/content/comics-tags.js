import { _t, api, esc, toast } from './utils.js'
import { buildLeftPanelHtml, renderLeftTags, setupDragEvents, buildComicsGridHTML } from '../shared/grid-renderer.js'
import { initComicsSearch } from '../shared/comics/comics-search.js'

const state = { cats: [], tagToCat: {}, catCache: {} }
let _ac = null
let _comics = []
let _searchDestroy = null

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
}

function _buildHTML() {
  return `<div id="cmComicsTags" class="cm-files">` +
    `<div class="cm-files-body" style="gap:16px">` +
      buildLeftPanelHtml(_t('tagSearchPlaceholder')) +
      `<div class="cm-comics-tags-grid" id="cmComicsTagsGrid">` +
        `<div class="cm-comics-tags-grid-inner">` +
          buildComicsGridHTML(_comics) +
        `</div>` +
      `</div>` +
    `</div></div>`
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
