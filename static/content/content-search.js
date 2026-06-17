import { _t, api, esc } from './utils.js'

console.log('[content-search] module loaded')
let _ac = null
let _autocompleteTimer = null
let _currentData = []

const searchInput = document.getElementById('csInput')
const searchBtn = document.getElementById('csSearchBtn')
const grid = document.getElementById('csGrid')
const loading = document.getElementById('csLoading')
const empty = document.getElementById('csEmpty')
const autocomplete = document.getElementById('csAutocomplete')
const tabs = document.querySelectorAll('.cs-tab')

let _activeSites = 'r34,dan'

// ── Tab switching ──
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    _activeSites = tab.dataset.sites
    tab.dataset.i18n && window.Shared && Shared.applyI18n()
    const q = searchInput.value.trim()
    if (q) doSearch(q, _activeSites)
  })
})

// ── Search handlers ──
searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim()
  console.log('[content-search] searchBtn clicked, q:', q, 'sites:', _activeSites)
  if (q) doSearch(q, _activeSites)
})
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    hideAutocomplete()
    const q = searchInput.value.trim()
    if (q) doSearch(q, _activeSites)
  }
})

// ── Autocomplete ──
searchInput.addEventListener('input', () => {
  clearTimeout(_autocompleteTimer)
  const q = searchInput.value.trim()
  if (q.length < 2) {
    hideAutocomplete()
    return
  }
  _autocompleteTimer = setTimeout(() => fetchAutocomplete(q), 150)
})

searchInput.addEventListener('blur', () => {
  setTimeout(hideAutocomplete, 200)
})
searchInput.addEventListener('focus', () => {
  const q = searchInput.value.trim()
  if (q.length >= 2) fetchAutocomplete(q)
})

function hideAutocomplete() {
  autocomplete.style.display = 'none'
  autocomplete.innerHTML = ''
}

async function fetchAutocomplete(q) {
  try {
    const res = await fetch(`/api/tags/autocomplete?q=${encodeURIComponent(q)}`)
    if (!res.ok) return
    const tags = await res.json()
    if (!tags || !tags.length) {
      hideAutocomplete()
      return
    }
    autocomplete.innerHTML = tags.map(t =>
      `<div class="cs-autocomplete-item" data-tag="${esc(t)}">${esc(t)}</div>`
    ).join('')
    autocomplete.style.display = 'block'
    autocomplete.querySelectorAll('.cs-autocomplete-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault()
        searchInput.value = el.dataset.tag
        hideAutocomplete()
        doSearch(el.dataset.tag, _activeSites)
      })
    })
  } catch (_) {
    hideAutocomplete()
  }
}

// ── Search ──
async function doSearch(query, sites) {
  console.log('[content-search] doSearch called:', { query, sites })
  if (_ac) _ac.abort()
  _ac = new AbortController()
  const signal = _ac.signal

  if (csLightbox) csLightbox.close()
  hideAutocomplete()
  grid.innerHTML = renderSkeletons(12)
  loading.style.display = 'none'
  empty.style.display = 'none'

  try {
    const url = `/api/content-search?q=${encodeURIComponent(query)}&sites=${encodeURIComponent(sites)}&page=1`
    console.log('[content-search] fetch:', url)
    const res = await fetch(url, { signal })
    console.log('[content-search] response status:', res.status)
    if (signal.aborted) return

    if (!res.ok) {
      var errText = await res.text()
      var errMsg
      try { errMsg = JSON.parse(errText).error || 'HTTP ' + res.status } catch(_) { errMsg = errText || 'HTTP ' + res.status }
      grid.innerHTML = '<div class=\"admin-loading\" style=\"color:var(--danger)\">' + _t('contentSearchError') + ': ' + esc(errMsg) + '</div>'
      return
    }
    const data = await res.json()
    if (signal.aborted) return
    updateURL(query, sites)

    if (data.error) {
      grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${_t('contentSearchError')}: ${esc(data.error)}</div>`
      return
    }

    const allResults = []
    const siteMap = { rule34: 'r34', danbooru: 'dan', nhentai: 'nhentai' }
    for (const [siteKey, siteData] of Object.entries(data.results || {})) {
      const shortName = siteMap[siteKey] || siteKey
      const items = siteData.results || []
      items.forEach(r => { r._source = shortName; allResults.push(r) })
    }

    _currentData = allResults

    if (!allResults.length) {
      empty.style.display = 'block'
      grid.innerHTML = ''
      return
    }

    grid.innerHTML = allResults.map(r => cardHTML(r)).join('')
    grid.querySelectorAll('.cs-card').forEach((el, i) => {
      el.addEventListener('click', () => showLightbox(i))
    })
  } catch (e) {
    if (e.name === 'AbortError' || signal.aborted) return
    grid.innerHTML = `<div class="admin-loading" style="color:var(--danger)">${esc(e.message)}</div>`
  }
}

// ── Card HTML ──
function cardHTML(r) {
  const imgSrc = r.preview_url || r.sample_url || r.thumbnail || r.file_url || ''
  const tagsStr = Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || '')
  const sourceLabel = { r34: 'R34', dan: 'Dan', nhentai: 'NH' }[r._source] || r._source
  return `<div class="cs-card" data-index="">
    <img class="cs-card-thumb" src="${esc(imgSrc)}" alt="" loading="lazy"
      onerror="this.classList.add('cs-img-error')">
    <div class="cs-card-body">
      <div class="cs-card-id">#${esc(String(r.id))} &middot; ${sourceLabel}</div>
      <div class="cs-card-tags" title="${esc(tagsStr)}">${esc(truncate(tagsStr, 80))}</div>
    </div>
  </div>`
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ── Skeleton ──
function renderSkeletons(n) {
  let html = ''
  for (let i = 0; i < n; i++) {
    html += `<div class="cs-skeleton">
      <div class="cs-skeleton-thumb"></div>
      <div class="cs-skeleton-body">
        <div class="cs-skeleton-line"></div>
        <div class="cs-skeleton-line"></div>
      </div>
    </div>`
  }
  return html
}

// ── Shared Lightbox ──
var csLightbox;
try {
  csLightbox = new Lightbox({
    prefix: 'cs',
    mediaUrlFn: function(path) { return path; },
    nameFn: function(item) { return item.title || item.id || ''; }
  });
} catch (e) {
  console.warn('[content-search] Lightbox init failed:', e);
  csLightbox = { close: function(){}, open: function(){} };
}

function showLightbox(index) {
  var items = _currentData.map(function(r) {
    var path;
    if (r._source === 'nhentai') {
      path = r.thumbnail || 'https://t.nhentai.net/galleries/' + r.mid + '/thumb.jpg';
    } else {
      path = r.file_url || r.sample_url || r.preview_url;
    }
    return {
      path: path,
      name: r._source === 'nhentai' ? (r.title || 'NHentai #' + r.id) : ('Rule34 #' + r.id),
      width: r.width || null,
      height: r.height || null,
      tags: r.tags || []
    };
  });
  csLightbox.open(index, items);
}

// ── URL state ──
function updateURL(query, sites) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (sites && sites !== 'r34,dan') params.set('site', sites === 'nhentai' ? 'nhentai' : 'all')
  const url = params.toString() ? '?' + params.toString() : window.location.pathname
  history.replaceState({ q: query, sites }, '', url)
}

// ── Init: read URL params ──
const params = new URLSearchParams(window.location.search)
const siteParam = params.get('site')
const qParam = params.get('q')
if (siteParam === 'nhentai') {
  tabs.forEach(t => t.classList.remove('active'))
  document.querySelector('.cs-tab[data-sites="nhentai"]').classList.add('active')
  _activeSites = 'nhentai'
} else if (siteParam === 'all') {
  tabs.forEach(t => t.classList.remove('active'))
  document.querySelector('.cs-tab[data-sites="r34,dan,nhentai"]').classList.add('active')
  _activeSites = 'r34,dan,nhentai'
}
if (qParam) {
  searchInput.value = qParam
  doSearch(qParam, _activeSites)
}

window.addEventListener('popstate', e => {
  const state = e.state || {}
  const q = state.q || ''
  const sites = state.sites || 'r34,dan'
  searchInput.value = q
  tabs.forEach(t => t.classList.remove('active'))
  const tab = document.querySelector(`.cs-tab[data-sites="${sites}"]`)
  if (tab) tab.classList.add('active')
  _activeSites = sites
  if (q) doSearch(q, sites)
})
