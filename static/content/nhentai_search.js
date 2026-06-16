import { _t, api, esc, toast } from './utils.js'

let _ac = null

const searchInput = document.getElementById('nhSearch')
const searchBtn = document.getElementById('nhSearchBtn')
const grid = document.getElementById('nhGrid')
const detail = document.getElementById('nhDetail')

searchBtn.addEventListener('click', () => doSearch())
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })

async function doSearch(page = 1) {
  const q = searchInput.value.trim()
  if (!q) return
  if (_ac) _ac.abort()
  _ac = new AbortController()
  detail.style.display = 'none'
  grid.innerHTML = ''
  const loading = document.getElementById('nhResults')
  loading.style.display = 'flex'
  try {
    const res = await fetch(`/api/nhentai/search?q=${encodeURIComponent(q)}&page=${page}`, { signal: _ac.signal })
    const data = await res.json()
    loading.style.display = 'none'
    if (data.error) { grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${esc(data.error)}</div>`; return }
    if (!data.results || !data.results.length) { grid.innerHTML = `<div class="admin-loading">No results</div>`; return }
    grid.innerHTML = data.results.map(g => cardHTML(g)).join('')
    grid.querySelectorAll('.nh-card').forEach(el => {
      el.addEventListener('click', () => showDetail(JSON.parse(el.dataset.gallery)))
    })
  } catch (e) {
    if (e.name !== 'AbortError') {
      loading.style.display = 'none'
      grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${esc(e.message)}</div>`
    }
  }
}

function cardHTML(g) {
  return `<div class="db-tool nh-card" data-gallery='${esc(JSON.stringify(g))}' style="flex-direction:column;align-items:stretch;gap:6px;cursor:pointer">
    <img src="${esc(g.thumbnail)}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:6px;background:var(--bg)" loading="lazy" onerror="this.style.display='none'">
    <div style="font-size:13px;font-weight:600;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.title)}</div>
    <div style="font-size:11px;color:var(--text2)">${g.pages}p · ${(g.tags||[]).length} tags</div>
  </div>`
}

function showDetail(g) {
  detail.style.display = 'block'
  detail.innerHTML = `<div class="admin-card">
    <div class="admin-card-header">
      <span class="admin-card-title">${esc(g.title)}</span>
      <button class="btn btn-sm btn-danger" id="nhDetailClose">✕</button>
    </div>
    <p style="margin:0 0 10px;font-size:12px;color:var(--text2)">ID: ${g.id} · Pages: ${g.pages}</p>
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">
      ${(g.tags||[]).map(t => `<span class="cm-tags-chip nh-tag-chip" draggable="true" data-tag="${esc(t)}" title="${esc(t)}">${esc(t)}</span>`).join('')}
    </div>
    <button class="btn btn-sm btn-primary" id="nhAddAllTags">Add all tags</button>
  </div>`
  document.getElementById('nhDetailClose').addEventListener('click', () => { detail.style.display = 'none' })
  // Drag tags — uses existing files.js /api/tags drop handlers
  detail.querySelectorAll('.nh-tag-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', chip.dataset.tag)
      e.dataTransfer.effectAllowed = 'copy'
    })
    chip.addEventListener('click', async () => {
      const tag = chip.dataset.tag
      try {
        await navigator.clipboard.writeText(tag)
      } catch (_) { /* fallback: no clipboard */ }
    })
  })
  document.getElementById('nhAddAllTags').addEventListener('click', () => {
    const tags = g.tags || []
    if (!tags.length) return
    Promise.all(tags.map(tag =>
      api('/api/categories', { method: 'POST', body: { action: 'assign_tag', tag, category: 'general' } })
    )).then(() => toast(`Added ${tags.length} tags to DB`, 'success'))
     .catch(e => toast(e.message, 'error'))
  })
}
