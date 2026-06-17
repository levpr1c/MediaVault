import { _t, api, esc, hexToRgba, toast } from './utils.js'

const state = { cats: [], tagToCat: {}, catCache: {} }
let _ac = null

export function tagsRender(body) {
  _ac = new AbortController()
  const s = _ac.signal
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> ${_t('loading')}</div>`
  api('/api/categories').then(data => {
    const categories = data.categories || []
    const members = data.members || {}
    state.cats = categories.map(c => ({ name: c.name, color: c.color, tags: members[c.name] || [] }))
    state.tagToCat = {}
    state.catCache = {}
    state.cats.forEach(c => c.tags.forEach(t => { state.tagToCat[t] = c.name; state.catCache[t] = c.color }))
    body.innerHTML = _buildHTML()
    _attachEvents(body, s)
    _loadPopular()
  }).catch(e => {
    body.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${_t('settingsError')}: ${esc(e.message)}</div>`
  })
}

export function tagsDestroy() {
  if (_ac) { _ac.abort(); _ac = null }
}

function _buildHTML() {
  let html =
    `<div id="cmTags" class="cm-tags">` +
      `<div class="cm-tags-toolbar shared-toolbar">` +
        `<input id="cmTagsSearch" class="cm-tags-search-input" placeholder="${_t('tagSearchPlaceholder')}">` +
        `<div class="cm-tags-toolbar-right">` +
          `<input type="color" id="cmNewCatColor" class="cm-tags-color" value="#64b5f6">` +
          `<input id="cmNewCatName" class="cm-tags-name-input" placeholder="${_t('addCategory')}">` +
          `<button class="btn btn-sm btn-primary" data-action="add-cat">+</button>` +
          `<button class="btn btn-sm btn-danger" data-action="bulk-delete">${_t('tagBulkDelete')}</button>` +
        `</div>` +
      `</div>` +
      `<div class="cm-tags-scroll" id="cmTagsScroll">` +
        `<div class="cm-tags-card cm-tags-all" id="cmTagsUncategorized" data-cat="">` +
          `<div class="cm-tags-card-head" style="background:rgba(153,153,153,0.1)">` +
            `<span class="cm-tags-dot" style="background:#999"></span>` +
            `<span class="cm-tags-name" style="color:#999">${_t('uncategorized')}</span>` +
          `</div>` +
          `<div class="cm-tags-card-body" id="cmTagsUncatList"></div>` +
        `</div>`
  state.cats.forEach(cat => {
    html +=
      `<div class="cm-tags-card" data-cat="${esc(cat.name)}">` +
        `<div class="cm-tags-card-head" data-action="edit-cat" data-cat="${esc(cat.name)}" style="background:${hexToRgba(cat.color, 0.1)}">` +
          `<span class="cm-tags-dot" style="background:${cat.color}"></span>` +
          `<span class="cm-tags-name" style="color:${cat.color}">${esc(cat.name)}</span>` +
          `<span class="cm-tags-count">${cat.tags.length}</span>` +
        `</div>` +
        `<div class="cm-tags-card-body">`
    cat.tags.forEach(tag => {
      html +=
        `<span class="tag-chip cm-tags-chip" draggable="true" data-tag="${esc(tag)}" data-cat="${esc(cat.name)}" style="color:${cat.color};background:${hexToRgba(cat.color, 0.12)}">` +
          `${esc(tag)} <span class="cm-tags-chip-rm" data-action="remove-tag" data-tag="${esc(tag)}" data-cat="${esc(cat.name)}">×</span>` +
        `</span>`
    })
    html +=
        `</div>` +
        `<div class="cm-tags-add">` +
          `<input class="cm-tags-add-input" placeholder="+ ${_t('addTag')}" data-cat="${esc(cat.name)}">` +
        `</div>` +
      `</div>`
  })
  html += `</div></div>`
  return html
}

function _attachEvents(body, signal) {
  body.querySelector('#cmTagsSearch')?.addEventListener('input', filterCats, { signal })
  body.addEventListener('click', e => {
    const el = e.target.closest('[data-action]')
    if (!el) {
      const chip = e.target.closest('.cm-tags-chip.popular-tag')
      if (chip) addTagToAll(chip.dataset.tag)
      return
    }
    const actions = {
      'add-cat': addCat,
      'bulk-delete': bulkDelete,
      'edit-cat': () => editCat(el.dataset.cat),
      'remove-tag': () => removeTag(el.dataset.tag, el.dataset.cat)
    }
    actions[el.dataset.action]?.()
  }, { signal })
  body.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('cm-tags-add-input')) {
      addTagToCat(e.target, e.target.dataset.cat)
    }
  }, { signal })
  body.addEventListener('dragstart', e => {
    const chip = e.target.closest('.cm-tags-chip')
    if (!chip) return
    e.dataTransfer.setData('text/plain', chip.dataset.tag)
    e.dataTransfer.effectAllowed = 'move'
    chip.classList.add('dragging')
  }, { signal })
  body.addEventListener('dragend', e => {
    const chip = e.target.closest('.cm-tags-chip')
    if (chip) chip.classList.remove('dragging')
  }, { signal })
  body.addEventListener('dragover', e => {
    const card = e.target.closest('.cm-tags-card')
    if (card && card.dataset.cat) { e.preventDefault(); card.classList.add('drag-over') }
  }, { signal })
  body.addEventListener('dragleave', e => {
    const card = e.target.closest('.cm-tags-card')
    if (card) card.classList.remove('drag-over')
  }, { signal })
  body.addEventListener('drop', e => {
    e.preventDefault()
    document.querySelectorAll('.cm-tags-card').forEach(c => c.classList.remove('drag-over'))
    const card = e.target.closest('.cm-tags-card')
    if (!card || !card.dataset.cat) return
    const tag = e.dataTransfer.getData('text/plain')
    if (tag) onTagDrop(tag, card.dataset.cat)
  }, { signal })
}

function _loadPopular() {
  const uncatContainer = document.getElementById('cmTagsUncatList')
  if (!uncatContainer) return
  api('/api/popular_tags').then(data => {
    const tags = data.tags || data || []
    const uncat = tags.filter(item => {
      const tag = item.name || item.tag || item
      return !state.tagToCat[tag]
    })
    if (uncat.length) {
      uncatContainer.innerHTML = uncat.map(item => {
        const tag = item.name || item.tag || item
        const count = item.count || 0
        return `<span class="tag-chip cm-tags-chip popular-tag uncat-tag" draggable="true" data-tag="${esc(tag)}" style="cursor:grab">${esc(tag)} <span class="cm-tags-count-badge">(${count})</span></span>`
      }).join('')
    } else {
      uncatContainer.innerHTML = `<div class="cm-tags-empty">—</div>`
    }
  }).catch(() => {})
}

function filterCats() {
  const q = (document.getElementById('cmTagsSearch')?.value || '').toLowerCase()
  document.querySelectorAll('.cm-tags-card').forEach(card => {
    if (card.id === 'cmTagsUncategorized') {
      card.querySelectorAll('.tag-chip').forEach(chip => {
        chip.style.display = !q || chip.textContent.toLowerCase().includes(q) ? '' : 'none'
      })
      return
    }
    const name = (card.dataset.cat || '').toLowerCase()
    const tags = Array.from(card.querySelectorAll('.tag-chip')).some(c => c.textContent.toLowerCase().includes(q))
    card.style.display = name.includes(q) || tags ? '' : 'none'
  })
}

function addCat() {
  const name = document.getElementById('cmNewCatName')
  const color = document.getElementById('cmNewCatColor')
  if (!name || !name.value.trim()) return
  api('/api/categories', { method: 'POST', body: { action: 'add_category', name: name.value.trim(), color: color.value } })
    .then(() => { name.value = ''; toast(_t('created'), 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function editCat(name) {
  const cat = state.cats.find(c => c.name === name)
  if (!cat) return
  const newName = prompt(_t('categoryNewName'), name)
  if (!newName || newName === name) return
  api('/api/categories', { method: 'POST', body: { action: 'rename', old_name: name, new_name: newName } })
    .then(() => { toast(_t('updated'), 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function removeTag(tag, catName) {
  api('/api/categories', { method: 'POST', body: { action: 'remove_tag', tag, category: catName } })
    .then(() => { toast(tag + ' ' + _t('deleted'), 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function addTagToCat(inputEl, catName) {
  const tag = inputEl.value.trim()
  if (!tag) return
  inputEl.value = ''
  api('/api/categories', { method: 'POST', body: { action: 'add_tag', tag, category: catName } })
    .then(() => { toast(tag + ' ' + _t('added'), 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function addTagToAll(tag) {
  if (!tag) return
  api('/api/tags/bulk', { method: 'POST', body: { tag, action: 'add' } })
    .then(() => toast(`${tag} ${_t('added')} ${_t('toAllMedia')}`, 'success'))
    .catch(e => toast(e.message, 'error'))
}

function bulkDelete() {
  if (!confirm(_t('tagBulkDeleteConfirm'))) return
  api('/api/categories', { method: 'POST', body: { action: 'delete_all' } })
    .then(() => { toast(_t('deleted'), 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function onTagDrop(tag, catName) {
  if (catName === '') {
    api('/api/categories', { method: 'POST', body: { action: 'remove_tag', tag } })
      .then(() => { toast(`${tag} → ${_t('uncategorized')}`, 'success'); _reload() })
      .catch(e => toast(e.message, 'error'))
    return
  }
  const dest = state.cats.find(c => c.name === catName)
  if (dest && dest.tags.includes(tag)) { toast(`${tag} ${_t('alreadyExists')}`, 'warn'); return }
  const srcCat = state.tagToCat[tag]
  let p
  if (srcCat && srcCat !== catName) {
    p = api('/api/categories', { method: 'POST', body: { action: 'remove_tag', tag } })
      .then(() => api('/api/categories', { method: 'POST', body: { action: 'add_tag', tag, category: catName } }))
  } else {
    p = api('/api/categories', { method: 'POST', body: { action: 'add_tag', tag, category: catName } })
  }
  p.then(() => { toast(`${tag} → ${catName}`, 'success'); _reload() })
    .catch(e => toast(e.message, 'error'))
}

function _reload() {
  const body = document.getElementById('cmContentBody')
  if (!body) return
  tagsDestroy()
  tagsRender(body)
}
