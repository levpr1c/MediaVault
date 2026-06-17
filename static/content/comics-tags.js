import { _t, api, esc, hexToRgba, toast } from './utils.js'

const state = { cats: [], tagToCat: {}, catCache: {} }
let _ac = null
let _comics = []

export function comicsTagsRender(body) {
  _ac = new AbortController()
  const s = _ac.signal
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> ${_t('loading')}</div>`

  Promise.all([
    api('/api/categories'),
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
  if (_ac) { _ac.abort(); _ac = null }
}

function _buildHTML() {
  let html = `<div id="cmComicsTags" class="cm-files">`
  html += `<div class="cm-files-body" style="display:flex;gap:16px;height:100%">`
  html += `<div class="cm-files-left shared-tag-panel" style="flex:0 0 240px;overflow-y:auto">`
  html += `<input id="cmComicsTagSearchQ" class="cm-tag-search-input" placeholder="${_t('tagSearchPlaceholder')}">`
  html += `<div id="cmComicsLeftContent"></div>`
  html += `</div>`
  html += `<div class="cm-comics-grid" id="cmComicsTagsGrid" style="flex:1;overflow-y:auto">`
  _comics.forEach(c => {
    html += _comicCardHTML(c)
  })
  html += `</div></div></div>`
  return html
}

function _comicCardHTML(c) {
  let html = `<div class="cm-comic-card" data-comic-id="${c.id}" data-title="${esc(c.title)}" style="position:relative">`
  if (c.cover) {
    html += `<div class="cm-comic-cover"><img src="/api/media?path=${encodeURIComponent(c.cover)}${_cbSuffix()}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=cm-comic-fallback>&#x1F4C4;</span>'"></div>`
  } else {
    html += `<div class="cm-comic-cover"><span class="cm-comic-fallback">&#x1F4C4;</span></div>`
  }
  html += `<div class="cm-comic-info"><span class="cm-comic-title">${esc(c.title)}</span></div>`
  html += `</div>`
  return html
}

function _cbSuffix() {
  return window.Shared && Shared._cbSuffix ? Shared._cbSuffix() : ''
}

function _attachEvents(body, signal) {
  body.querySelector('#cmComicsTagSearchQ')?.addEventListener('input', e => {
    _filterLeftTags(e.target.value)
  }, { signal })

  body.addEventListener('dragstart', e => {
    const chip = e.target.closest('.tag-chip')
    if (!chip) return
    e.dataTransfer.setData('text/plain', JSON.stringify({
      tag: chip.dataset.tag,
      source: chip.dataset.source || 'manual'
    }))
    e.dataTransfer.effectAllowed = 'copy'
    chip.classList.add('dragging')
  }, { signal })

  body.addEventListener('dragend', e => {
    const chip = e.target.closest('.tag-chip')
    if (chip) chip.classList.remove('dragging')
  }, { signal })

  body.addEventListener('dragover', e => {
    const card = e.target.closest('.cm-comic-card')
    if (card) { e.preventDefault(); card.classList.add('tag-dragover') }
  }, { signal })

  body.addEventListener('dragleave', e => {
    const card = e.target.closest('.cm-comic-card')
    if (card) card.classList.remove('tag-dragover')
  }, { signal })

  body.addEventListener('drop', e => {
    document.querySelectorAll('.cm-comic-card').forEach(c => c.classList.remove('tag-dragover'))
    const card = e.target.closest('.cm-comic-card')
    if (!card) return
    let data
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')) } catch(_) { return }
    if (data && data.tag) _assignTagToComic(parseInt(card.dataset.comicId), data.tag, data.source)
  }, { signal })

  _renderLeftTags()
}

function _renderLeftTags(searchQ) {
  const container = document.getElementById('cmComicsLeftContent')
  if (!container) return
  const q = searchQ ? searchQ.toLowerCase() : ''

  let html = ''
  state.cats.forEach(cat => {
    let tags = cat.tags
    if (q) tags = tags.filter(t => t.toLowerCase().includes(q))
    if (q && !tags.length && !cat.name.toLowerCase().includes(q)) return
    html += `<div class="cm-tags-card" data-cat="${esc(cat.name)}">`
    html += `<div class="cm-tags-card-head" style="background:${hexToRgba(cat.color, 0.1)}">`
    html += `<span class="cm-tags-dot" style="background:${cat.color}"></span>`
    html += `<span class="cm-tags-name" style="color:${cat.color}">${esc(cat.name)}</span>`
    html += `<span class="cm-tags-count">${tags.length}</span>`
    html += `</div><div class="cm-tags-card-body">`
    tags.forEach(tag => {
      html += `<span class="tag-chip" draggable="true" data-tag="${esc(tag)}" data-cat="${esc(cat.name)}" style="color:${cat.color};background:${hexToRgba(cat.color, 0.12)}">${esc(tag)}</span>`
    })
    html += `</div></div>`
  })
  container.innerHTML = html
}

function _filterLeftTags(q) {
  const container = document.getElementById('cmComicsLeftContent')
  if (!container) return
  const val = q.toLowerCase().trim()
  container.querySelectorAll('.cm-tags-card').forEach(card => {
    const name = (card.dataset.cat || '').toLowerCase()
    const tags = Array.from(card.querySelectorAll('.tag-chip')).some(c => c.textContent.toLowerCase().includes(val))
    card.style.display = name.includes(val) || tags ? '' : 'none'
  })
}

function _assignTagToComic(comicId, tag, source) {
  const comic = _comics.find(c => c.id === comicId)
  if (!comic || !comic.pages) return

  let completed = 0
  const total = comic.pages.length

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
}
