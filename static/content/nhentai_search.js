import { _t, api, esc, toast } from './utils.js'

let _ac = null

const searchInput = document.getElementById('nhSearch')
const searchBtn = document.getElementById('nhSearchBtn')
const grid = document.getElementById('nhGrid')
const detail = document.getElementById('nhDetail')

searchBtn.addEventListener('click', () => doSearch())
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

/**
 * Colour mapping for nhentai tag categories.
 */
const _TAG_CATS = {
  tag:       '#5dade2',
  artist:    '#af7ac5',
  parody:    '#52be80',
  character: '#f39c12',
  language:  '#95a5a6',
  category:  '#e74c3c',
  group:     '#48c9b0',
}

/**
 * Parse a nhentai tag string ("category:name") into parts.
 */
function _parseTag(s) {
  const idx = s.indexOf(':')
  if (idx > 0) return { cat: s.substring(0, idx), name: s.substring(idx + 1) }
  return { cat: '', name: s }
}

async function doSearch(page = 1) {
  const q = searchInput.value.trim()
  if (!q) return

  // Abort any in-flight request
  if (_ac) _ac.abort()
  _ac = new AbortController()
  const signal = _ac.signal

  // Reset UI for new search
  detail.style.display = 'none'
  grid.innerHTML = ''
  const loading = document.getElementById('nhResults')
  loading.style.display = 'flex'

  try {
    const res = await fetch(`/api/nhentai/search?q=${encodeURIComponent(q)}&page=${page}`, { signal })
    if (signal.aborted) return

    const data = await res.json()
    if (signal.aborted) return

    // ── Results received, hide loading ──
    loading.style.display = 'none'

    if (data.error) {
      console.error(`[NHentai] server error: ${data.error}`)
      grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${esc(data.error)}</div>`
      return
    }
    if (!data.results || !data.results.length) {
      grid.innerHTML = `<div class="admin-loading" style="color:var(--text2)">No results</div>`
      return
    }

    // Render gallery cards
    grid.innerHTML = data.results.map(g => cardHTML(g)).join('')
    grid.querySelectorAll('.nh-card').forEach(el => {
      el.addEventListener('click', () => showDetail(JSON.parse(el.dataset.gallery)))
    })
  } catch (e) {
    // AbortError → another search was started, loading handled by the new call
    if (e.name === 'AbortError' || signal.aborted) {
      return
    }
    console.error(`[NHentai] fetch error: ${e.message}`, e)
    loading.style.display = 'none'
    grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${esc(e.message)}</div>`
  }
}

function cardHTML(g) {
  const cover = g.mid
    ? `https://t.nhentai.net/galleries/${g.mid}/cover.jpg`
    : (g.thumbnail || '')
  return `<div class="db-tool nh-card" data-gallery='${esc(JSON.stringify(g))}' style="flex-direction:column;align-items:stretch;gap:6px;cursor:pointer">
    <div class="nh-card-thumb">
      <img src="${esc(cover)}" alt="" loading="lazy" onerror="this.closest('.nh-card-thumb').classList.add('nh-thumb-missing')">
    </div>
    <div class="nh-card-title">${esc(g.title)}</div>
    <div class="nh-card-meta">${g.pages}p · ${(g.tags||[]).length} tags</div>
  </div>`
}

function showDetail(g) {
  detail.style.display = 'block'

  const coverUrl = g.mid
    ? `https://t.nhentai.net/galleries/${g.mid}/cover.jpg`
    : (g.thumbnail || '')

  const tags = g.tags || []

  detail.innerHTML = `<div class="admin-card nh-detail-card">
    <div class="admin-card-header">
      <span class="admin-card-title">${esc(g.title)}</span>
      <button class="btn btn-sm btn-icon" id="nhDetailClose" aria-label="Close" style="font-size:18px;width:32px;height:32px">✕</button>
    </div>
    <div class="nh-detail-body">
      <div class="nh-detail-cover${coverUrl ? '' : ' nh-cover-missing'}">
        ${coverUrl ? `<img src="${esc(coverUrl)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('nh-cover-missing');this.style.display='none'">` : ''}
      </div>
      <div class="nh-detail-meta">
        <div class="nh-detail-stats">
          <span class="nh-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            ID: ${esc(String(g.id))}
          </span>
          <span class="nh-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ${g.pages} pages
          </span>
          <span class="nh-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            ${tags.length} tags
          </span>
        </div>

        <div class="nh-detail-tags">
          ${tags.map(t => _tagHTML(t)).join('')}
        </div>

        <button class="btn btn-sm btn-primary" id="nhAddAllTags" style="align-self:flex-start;margin-top:4px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          Add all tags
        </button>
      </div>
    </div>
  </div>`

  // ── Close button ──
  document.getElementById('nhDetailClose').addEventListener('click', () => { detail.style.display = 'none' })

  // ── Drag / click tags ──
  detail.querySelectorAll('.nh-tag-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', chip.dataset.tag)
      e.dataTransfer.effectAllowed = 'copy'
    })
    chip.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(chip.dataset.tag) } catch (_) { /* no clipboard */ }
    })
  })

  // ── Add all tags button ──
  document.getElementById('nhAddAllTags').addEventListener('click', () => {
    if (!tags.length) return
    Promise.all(tags.map(tag =>
      api('/api/categories', { method: 'POST', body: { action: 'assign_tag', tag, category: 'general' } })
    )).then(() => toast(`Added ${tags.length} tags to DB`, 'success'))
     .catch(e => toast(e.message, 'error'))
  })
}

/**
 * Render a single tag chip with optional category colour bar.
 */
function _tagHTML(s) {
  const { cat, name } = _parseTag(s)
  const color = _TAG_CATS[cat] || ''
  const barStyle = color ? `border-left:3px solid ${color}` : 'padding-left:8px'
  return `<span class="nh-tag-chip" draggable="true" data-tag="${esc(s)}" title="${esc(s)}" style="${barStyle}">
    ${cat ? `<span class="nh-tag-cat">${esc(cat)}</span>` : ''}
    <span class="nh-tag-name">${esc(name)}</span>
  </span>`
}
