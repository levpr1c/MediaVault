import { _t, api, esc, toast } from './utils.js'

console.log('[content-search] module loaded')
let _ac = null
let _autocompleteTimer = null
let _allResults = []
let _currentPage = 1
let _apiPage = 1
let _totalPages = 1
const PER_PAGE = 30

const searchInput = document.getElementById('csInput')
const searchBtn = document.getElementById('csSearchBtn')
const grid = document.getElementById('csGrid')
const loading = document.getElementById('csLoading')
const empty = document.getElementById('csEmpty')
const autocomplete = document.getElementById('csAutocomplete')
const pagination = document.getElementById('csPagination')
const pageInfo = document.getElementById('csPageInfo')
const prevBtn = document.getElementById('csPrevPage')
const nextBtn = document.getElementById('csNextPage')
const loadMoreBtn = document.getElementById('csLoadMore')
const sourceCbs = document.querySelectorAll('.cs-source input')

function getActiveSites() {
  return Array.from(sourceCbs).filter(cb => cb.checked).map(cb => cb.value).join(',')
}

sourceCbs.forEach(function(cb) {
  cb.addEventListener('change', function() {
    var q = searchInput.value.trim()
    if (q) doSearch(q)
  })
})

// ── Search handlers ──
searchBtn.addEventListener('click', function() {
  var q = searchInput.value.trim()
  if (q) doSearch(q)
})
searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    hideAutocomplete()
    var q = searchInput.value.trim()
    if (q) doSearch(q)
  }
})

// ── Autocomplete ──
searchInput.addEventListener('input', function() {
  clearTimeout(_autocompleteTimer)
  var q = searchInput.value.trim()
  if (q.length < 2) { hideAutocomplete(); return }
  _autocompleteTimer = setTimeout(function() { fetchAutocomplete(q) }, 150)
})
searchInput.addEventListener('blur', function() { setTimeout(hideAutocomplete, 200) })
searchInput.addEventListener('focus', function() {
  var q = searchInput.value.trim()
  if (q.length >= 2) fetchAutocomplete(q)
})

function hideAutocomplete() {
  autocomplete.style.display = 'none'
  autocomplete.innerHTML = ''
}

async function fetchAutocomplete(q) {
  try {
    var res = await fetch('/api/tags/autocomplete?q=' + encodeURIComponent(q))
    if (!res.ok) return
    var tags = await res.json()
    if (!tags || !tags.length) { hideAutocomplete(); return }
    autocomplete.innerHTML = tags.map(function(t) {
      return '<div class="cs-autocomplete-item" data-tag="' + esc(t) + '">' + esc(t) + '</div>'
    }).join('')
    autocomplete.style.display = 'block'
    autocomplete.querySelectorAll('.cs-autocomplete-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault()
        searchInput.value = el.dataset.tag
        hideAutocomplete()
        doSearch(el.dataset.tag)
      })
    })
  } catch(_) { hideAutocomplete() }
}

// ── Search ──
async function doSearch(query) {
  if (_ac) _ac.abort()
  _ac = new AbortController()
  var signal = _ac.signal
  try { if (window.csLightbox) csLightbox.close() } catch(e) {}
  hideAutocomplete()
  _apiPage = 1
  _allResults = []
  grid.innerHTML = renderSkeletons(12)
  pagination.style.display = 'none'
  loading.style.display = 'none'
  empty.style.display = 'none'
  var sites = getActiveSites()
  if (!sites) {
    grid.innerHTML = '<div class="admin-loading" style="color:var(--text2)">' + _t('contentSearchSelectSource') + '</div>'
    return
  }
  await fetchPage(query, sites, 1)
}

var aiFilter = document.getElementById('csAiFilter')
if (aiFilter) {
  aiFilter.addEventListener('change', function() {
    var q = searchInput.value.trim()
    if (q) doSearch(q)
  })
}

async function fetchPage(rawQuery, sites, pageNum) {
  if (_ac && _ac.signal.aborted) return
  loading.style.display = 'block'
  try {
    var filterAi = document.getElementById('csAiFilter') && document.getElementById('csAiFilter').checked
    var url = '/api/content-search?q=' + encodeURIComponent(rawQuery) + '&sites=' + encodeURIComponent(sites) + '&page=' + pageNum + (filterAi ? '&filter_ai=1' : '')
    var res = await fetch(url, { signal: _ac.signal })
    if (_ac.signal.aborted) return
    if (!res.ok) {
      var errText = await res.text()
      var errMsg
      try { errMsg = JSON.parse(errText).error || 'HTTP ' + res.status } catch(_) { errMsg = errText || 'HTTP ' + res.status }
      grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + _t('contentSearchError') + ': ' + esc(errMsg) + '</div>'
      loading.style.display = 'none'
      return
    }
    var data = await res.json()
    if (_ac.signal.aborted) return
    window._csCatColors = data.cat_colors || {}
    if (data.error) {
      grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + _t('contentSearchError') + ': ' + esc(data.error) + '</div>'
      loading.style.display = 'none'
      return
    }
    var siteMap = { rule34: 'r34', danbooru: 'dan', nhentai: 'nhentai' }
    var newItems = []
    for (var siteKey in (data.results || {})) {
      var siteData = data.results[siteKey]
      var shortName = siteMap[siteKey] || siteKey
      console.log('[content-search] site=' + siteKey + ' backend=' + (siteData.backend || '?') + ' results=' + (siteData.results || []).length)
      var items = siteData.results || []
      items.forEach(function(r) { r._source = shortName; newItems.push(r) })
    }
    if (!newItems.length && _allResults.length === 0) {
      empty.style.display = 'block'
      grid.innerHTML = ''
      loading.style.display = 'none'
      return
    }
    _apiPage = pageNum
    _allResults = _allResults.concat(newItems)
    _totalPages = Math.max(1, Math.ceil(_allResults.length / PER_PAGE))
    renderPage()
    updateLoadMoreBtn()
  } catch(e) {
    if (e.name === 'AbortError' || (_ac && _ac.signal.aborted)) return
    grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + esc(e.message) + '</div>'
  }
  loading.style.display = 'none'
}

function renderPage() {
  var start = (_currentPage - 1) * PER_PAGE
  var end = Math.min(start + PER_PAGE, _allResults.length)
  var pageItems = _allResults.slice(start, end)
  grid.innerHTML = pageItems.map(function(r) { return cardHTML(r) }).join('')
  grid.querySelectorAll('.cs-card').forEach(function(el, i) {
    el.addEventListener('click', function() { showLightbox(start + i) })
  })
  pageInfo.textContent = _currentPage + '/' + _totalPages
  prevBtn.disabled = _currentPage <= 1
  nextBtn.disabled = _currentPage >= _totalPages
  pagination.style.display = 'flex'
}

function updateLoadMoreBtn() {
  loadMoreBtn.style.display = _allResults.length > 0 ? 'inline-flex' : 'none'
}

// ── Pagination ──
prevBtn.addEventListener('click', function() {
  if (_currentPage > 1) { _currentPage--; renderPage() }
})
nextBtn.addEventListener('click', function() {
  if (_currentPage < _totalPages) { _currentPage++; renderPage() }
})
loadMoreBtn.addEventListener('click', function() {
  var q = searchInput.value.trim()
  var sites = getActiveSites()
  if (q && sites) fetchPage(q, sites, _apiPage + 1)
})

// ── Card HTML ──
function cardHTML(r) {
  var imgSrc = r.preview_url || r.large_file_url || r.sample_url || r.thumbnail || r.file_url || ''
  var tagsStr = Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || '')
  var sourceLabel = { r34: 'R34', dan: 'Dan', nhentai: 'NH' }[r._source] || r._source
  return '<div class="cs-card">' +
    '<img class="cs-card-thumb" src="' + esc(imgSrc) + '" alt="" loading="lazy"' +
    ' onerror="this.classList.add(\'cs-img-error\')">' +
    '<div class="cs-card-body">' +
    '<div class="cs-card-id">#' + esc(String(r.id)) + ' &middot; ' + sourceLabel + '</div>' +
    '<div class="cs-card-tags" title="' + esc(tagsStr) + '">' + esc(truncate(tagsStr, 80)) + '</div>' +
    '</div></div>'
}

function truncate(s, n) { return s.length > n ? s.slice(0, n) + '...' : s }

// ── Skeleton ──
function renderSkeletons(n) {
  var html = ''
  for (var i = 0; i < n; i++) {
    html += '<div class="cs-skeleton"><div class="cs-skeleton-thumb"></div><div class="cs-skeleton-body"><div class="cs-skeleton-line"></div><div class="cs-skeleton-line"></div></div></div>'
  }
  return html
}

// ── Shared Lightbox ──
var csLightbox;
try {
  csLightbox = new Lightbox({
    prefix: 'cs',
    tagPanel: true,
    readonly: true,
    mediaUrlFn: function(path) { return path; },
    nameFn: function(item) { return item._displayName || ''; },
    onSaveTags: function(path, tags) { return Promise.resolve({ok: true}) },
    downloadLabelFn: function(file) {
      var site = file._sourceSite || 'unknown';
      return '\u2B07 ' + _t('contentSearchDownload').replace('{site}', site);
    },
    onDownload: function(file) {
      var src = file._sourceSite || 'unknown';

      // NHentai: download ALL pages of the gallery
      if (file._gid && file._mid) {
        var payload = {
          source: 'nhentai',
          gid: file._gid,
          media_id: file._mid,
          num_pages: file._numPages || 1,
          title: file._galleryTitle || '',
          tags: file.tags || '',
        };
        fetch('/api/content-search/download-manga', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        }).then(function(r) { return r.json(); }).then(function(data) {
          if (data.error) {
            var msg = data.message || data.error;
            toast(msg, 'error');
            return;
          }
          toast(_t('settingsSaveStart') + ' (' + data.count + ' ' + _t('contentSearchPages') + ')', 'success');
          console.log('[content-search] Downloaded manga:', data.count, 'pages');
        });
        return;
      }

      var payload = {
        url: file.path,
        source: src.toLowerCase(),
        tags: file.tags || '',
        tags_by_category: file._tagsByCategory || {}
      };
      fetch('/api/content-search/download', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) {
          var msg = data.message || data.error;
          toast(msg, 'error');
          return;
        }
        toast(_t('settingsSaveStart'), 'success');
        console.log('[content-search] Downloaded:', data.path);
      });
    }
  })
} catch(e) {
  console.warn('[content-search] Lightbox init failed:', e)
  csLightbox = { close: function(){}, open: function(){} }
}

function showLightbox(index) {
  // Build tag→category map and category list from all results
  var tagToCat = {};
  var catNames = {};
  var catColors = {};
  _allResults.forEach(function(r) {
    var tbc = r.tags_by_category || {};
    for (var cat in tbc) {
      catNames[cat] = true;
      tbc[cat].forEach(function(t) { tagToCat[t] = cat; });
    }
  });
  // Also read cat_colors from last API response
  if (window._csCatColors) {
    for (var c in window._csCatColors) { catColors[c] = window._csCatColors[c]; }
  }
  var fallbackColors = {artist:'#ff4444',character:'#44cc44',copyright:'#4488ff',general:'#cccccc',meta:'#999999',uncategorized:'#666666'};
  var catList = Object.keys(catNames).map(function(n) {
    return {name: n, color: catColors[n] || fallbackColors[n] || '#888'};
  });
  csLightbox._getCatListFn = function() { return catList; };
  csLightbox._getTagCategoryNameFn = function(tag) { return tagToCat[tag] || ''; };

  var items = _allResults.map(function(r) {
    var path
    if (r._source === 'nhentai') {
      path = r.thumbnail || 'https://t.nhentai.net/galleries/' + r.mid + '/thumb.jpg'
    } else {
      path = r.file_url || r.sample_url || r.preview_url
    }
    var srcSite = r._source === 'nhentai' ? 'NHentai' : (r._source === 'r34' ? 'Rule34' : (r._source === 'dan' ? 'Danbooru' : r._source))
    var item = {
      path: path,
      name: '',
      _displayName: r._source === 'nhentai' ? (r.title || 'NHentai #' + r.id) : (r._source.toUpperCase() + ' #' + r.id),
      _sourceSite: srcSite,
      _tagsByCategory: r.tags_by_category || {},
      width: r.width || null,
      height: r.height || null,
      tags: Array.isArray(r.tags) ? r.tags.join(', ') : (r.tags || '')
    }
    if (r._source === 'nhentai') {
      item._gid = r.id;
      item._mid = r.mid;
      item._numPages = r.pages || 1;
      item._galleryTitle = r.title || '';
    }
    return item
  })
  csLightbox.open(index, items)
}

// ── Init: read URL params ──
var params = new URLSearchParams(window.location.search)
var siteParam = params.get('site')
var qParam = params.get('q')
if (siteParam === 'nhentai') {
  sourceCbs.forEach(function(cb) { cb.checked = false })
  document.querySelector('.cs-source[data-site="nhentai"] input').checked = true
} else if (siteParam === 'all') {
  sourceCbs.forEach(function(cb) { cb.checked = true })
} else if (siteParam === 'r34,dan') {
  sourceCbs.forEach(function(cb) { cb.checked = false })
  document.querySelector('.cs-source[data-site="r34"] input').checked = true
  document.querySelector('.cs-source[data-site="dan"] input').checked = true
}
if (qParam) {
  searchInput.value = qParam
  doSearch(qParam)
}
