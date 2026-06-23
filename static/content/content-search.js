import { _t, api, esc, toast } from './utils.js'

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

let _csGrid = null
let _csPageStart = 0

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
  _csGrid.setLoading(true)
  pagination.style.display = 'none'
  var sites = getActiveSites()
  if (!sites) {
    _csGrid.clear()
    grid.innerHTML = '<div class="admin-loading" style="color:var(--text2)">' + _t('contentSearchSelectSource') + '</div>'
    return
  }
  await fetchPage(query, sites, 1)
  // Auto-fetch more pages until first page fills or API exhausted
  while (_allResults.length > 0 && _allResults.length < PER_PAGE) {
    var prevLen = _allResults.length
    await fetchPage(query, sites, _apiPage + 1, true)
    if (_allResults.length <= prevLen) break
  }
  loading.style.display = 'none'
}

var aiFilter = document.getElementById('csAiFilter')
if (aiFilter) {
  aiFilter.addEventListener('change', function() {
    var q = searchInput.value.trim()
    if (q) doSearch(q)
  })
}

async function fetchPage(rawQuery, sites, pageNum, keepLoading) {
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
      _csGrid.clear()
      grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + _t('contentSearchError') + ': ' + esc(errMsg) + '</div>'
      loading.style.display = 'none'
      return
    }
    var data = await res.json()
    if (_ac.signal.aborted) return
    window._csCatColors = data.cat_colors || {}
    if (data.nhentai_warning) {
      var warnEl = document.getElementById('csNhWarning')
      if (!warnEl) {
        warnEl = document.createElement('div')
        warnEl.id = 'csNhWarning'
        warnEl.style.cssText = 'background:var(--warning,#f59e0b);color:#fff;padding:8px 14px;border-radius:8px;margin-bottom:12px;font-size:13px'
        grid.parentNode.insertBefore(warnEl, grid)
      }
      warnEl.textContent = _t('contentSearchNhWarning')
      warnEl.style.display = 'block'
    } else {
      var warnEl = document.getElementById('csNhWarning')
      if (warnEl) warnEl.style.display = 'none'
    }
    if (data.error) {
      _csGrid.clear()
      grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + _t('contentSearchError') + ': ' + esc(data.error) + '</div>'
      loading.style.display = 'none'
      return
    }
    var siteMap = { rule34: 'r34', danbooru: 'dan', nhentai: 'nhentai', ehentai: 'eh' }
    var newItems = []
    for (var siteKey in (data.results || {})) {
      var siteData = data.results[siteKey]
      var shortName = siteMap[siteKey] || siteKey
      var items = siteData.results || []
      items.forEach(function(r) { r._source = shortName; newItems.push(r) })
    }
    if (!newItems.length && _allResults.length === 0) {
      _csGrid.setEmpty(true)
      loading.style.display = 'none'
      return
    }
    _apiPage = pageNum
    _allResults = _allResults.concat(newItems)
    _totalPages = Math.max(1, Math.ceil(_allResults.length / PER_PAGE))
    renderPage()
    updateLoadMoreBtn()
    // Show total count from each source
    var totalCounts = []
    for (var sk in (data.results || {})) {
      var sd = data.results[sk]
      var st = sd.total || 0
      if (st > 0) {
        var siteLabel = {rule34: 'R34', danbooru: 'Dan', nhentai: 'NH', ehentai: 'EH'}[sk] || sk
        totalCounts.push(siteLabel + ': ' + st)
      }
    }
    var csTotal = document.getElementById('csTotal')
    if (!csTotal) {
      csTotal = document.createElement('div')
      csTotal.id = 'csTotal'
      csTotal.style.cssText = 'font-size:12px;color:var(--text2);margin-top:8px;text-align:center'
      loadMoreBtn.parentNode.insertBefore(csTotal, loadMoreBtn.nextSibling)
    }
    csTotal.textContent = totalCounts.length ? 'Total: ' + totalCounts.join(' | ') : ''
  } catch(e) {
    if (e.name === 'AbortError' || (_ac && _ac.signal.aborted)) return
    _csGrid.clear()
    grid.innerHTML = '<div class="admin-loading" style="color:var(--danger)">' + esc(e.message) + '</div>'
  }
  if (!keepLoading) loading.style.display = 'none'
}

function renderPage() {
  var start = (_currentPage - 1) * PER_PAGE
  var end = Math.min(start + PER_PAGE, _allResults.length)
  var pageItems = _allResults.slice(start, end)
  _csPageStart = start
  _csGrid.render(pageItems)
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
  var sourceLabel = { r34: 'R34', dan: 'Dan', nhentai: 'NH', eh: 'EH' }[r._source] || r._source
  return '<div class="cs-card"' + (r._source === 'nhentai' ? ' data-gid="' + esc(r.id) + '"' : '') + '>' +
    '<img class="cs-card-thumb" src="' + esc(imgSrc) + '" alt="" loading="lazy"' +
    ' onerror="this.src=\'\'; this.classList.add(\'cs-img-error\'); this.parentElement.classList.add(\'cs-thumb-fail\')">' +
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

// ── SharedGrid ──
_csGrid = new SharedGrid(grid, {
  getItemHtml: function(r) { return cardHTML(r) },
  onItemClick: function(item, idx) { showLightbox(_csPageStart + idx) },
  layout: 'masonry',
  loadingHtml: '<div class="shared-grid-loading cs-grid-loading">' + renderSkeletons(12) + '</div>',
  emptyHtml: '<div class="shared-grid-empty">' + _t('mediaDirEmpty') + '</div>'
})

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
      var src = file._source || 'unknown';

      function pollTask(taskId, onDone) {
        var iv = setInterval(function() {
          fetch('/api/content-search/task/' + taskId)
            .then(function(r) { return r.json(); })
            .then(function(status) {
              if (status.status === 'completed') {
                clearInterval(iv);
                onDone(null, status.result);
              } else if (status.status === 'failed') {
                clearInterval(iv);
                onDone(status.message || _t('downloadFailed'));
              } else if (status.status === 'running' && status.total > 0) {
                toast(_t('downloadRunning').replace('{p}', status.progress || 0).replace('{t}', status.total), 'info');
              }
            }).catch(function() {});
        }, 2000);
      }

      // NHentai: download ALL pages of the gallery
      if (file._gid && file._mid) {
        var gid = file._gid;
        var payload = {
          source: 'nhentai',
          gid: gid,
          media_id: file._mid,
          num_pages: file._numPages || 1,
          title: file._galleryTitle || '',
          tags: file.tags || '',
        };

        // Check if already downloaded
        var checkUrl = '/api/content-search/check-manga-dir?gid=' + encodeURIComponent(gid) +
          '&media_id=' + encodeURIComponent(file._mid) +
          '&title=' + encodeURIComponent(file._galleryTitle || '');
        fetch(checkUrl).then(function(r) { return r.json(); }).then(function(check) {
          if (check.error) { toast(check.error, 'error'); return; }

          if (check.exists && !confirm(_t('downloadExists') + '\n' + check.dir + '\n\n' + _t('downloadOverwrite'))) {
            toast(_t('downloadCancelled'), 'info');
            return;
          }

          payload.overwrite = check.exists;

          fetch('/api/content-search/download-manga-async', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
          }).then(function(r) { return r.json(); }).then(function(data) {
            if (data.error) { toast(data.error, 'error'); return; }
            toast(_t('downloadStarted'), 'info');
            pollTask(data.task_id, function(err, result) {
              if (err) { toast(err, 'error'); return; }
              var msg = _t('downloadCompleted').replace('{count}', (result && result.count) || 0);
              if (result && result.comics_id) {
                msg += ' <a href="/comics/view?id=' + result.comics_id + '" style="color:#fff;text-decoration:underline">' + _t('contentSearchViewComics') + '</a>';
              }
              toast(msg, 'success');
            });
          });
        });
        return;
      }

      var payload = {
        url: file.path,
        source: src.toLowerCase(),
        tags: file.tags || '',
        tags_by_category: file._tagsByCategory || {}
      };
      fetch('/api/content-search/download-async', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.error) { toast(data.error, 'error'); return; }
        toast(_t('downloadStarted'), 'info');
        pollTask(data.task_id, function(err, result) {
          if (err) { toast(err, 'error'); return; }
          toast(_t('downloadCompleted').replace('{count}', '1'), 'success');
        });
      });
    },
    onRenderMedia: function(file, media, lb) {
      // Clean up previous manga keyboard handler
      var oldViewer = document.getElementById(lb._id('MangaViewer'));
      if (oldViewer && oldViewer._kbCleanup) { oldViewer._kbCleanup(); }
      // NHentai multi-page manga viewer
      if (file._gid && file._mid) {
        var doFetchGallery = function(cb) {
          fetch('/api/content-search/nhentai-gallery?gid=' + file._gid)
            .then(function(r) { return r.json(); })
            .then(function(meta) {
              if (!meta || meta.error) { cb && cb(); return; }
              file._galleryTitle = meta.title || file._galleryTitle;
              file._displayName = meta.title || file._displayName;
              if (meta.page_urls && meta.page_urls.length) {
                file._pageUrls = meta.page_urls;
                file._numPages = meta.num_pages || meta.page_urls.length;
                var tbc = {};
                if (meta.tag_artist && meta.tag_artist.length) tbc.artist = meta.tag_artist;
                if (meta.tag_character && meta.tag_character.length) tbc.character = meta.tag_character;
                if (meta.tag_copyright && meta.tag_copyright.length) tbc.copyright = meta.tag_copyright;
                if (meta.tag_general && meta.tag_general.length) tbc.general = meta.tag_general;
                if (meta.tag_language && meta.tag_language.length) tbc.language = meta.tag_language;
                if (meta.tag_category && meta.tag_category.length) tbc.category = meta.tag_category;
                file._tagsByCategory = tbc;
                if (meta.tags && meta.tags.length) file.tags = meta.tags.join(', ');
                updateNhCategories(lb, tbc);
              }
              cb && cb();
            })
            .catch(function() { cb && cb(); });
        };
        if (!file._pageUrls || file._pageUrls.length === 0) {
          doFetchGallery(function() {
            var overlay = document.getElementById('csOverlay');
            if (overlay && overlay.classList.contains('open')) lb._renderContent(true);
          });
          return false;
        }
        buildMangaViewer(file, media, lb);
        return true;
      }
      return false;
    },
    onOpenSource: function(file) {
      return file._sourceUrl || null;
    }
  })
} catch(e) {
  console.warn('[content-search] Lightbox init failed:', e)
  csLightbox = { close: function(){}, open: function(){} }
}

// ── Lazy-load manga viewer helpers ──
function buildMangaViewer(file, media, lb) {
  var CHUNK = 10;
  var totalPages = file._pageUrls.length;
  var totalSpreads = Math.ceil(totalPages / 2);
  var currentSpread = 0;
  var loadedUpTo = 0;

  media.innerHTML =
    '<div class="lb-manga-viewer" id="' + lb._id('MangaViewer') + '">' +
      '<div class="manga-track" id="' + lb._id('MangaTrack') + '"></div>' +
      '<button class="manga-nav manga-prev" id="' + lb._id('MangaPrev') + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<button class="manga-nav manga-next" id="' + lb._id('MangaNext') + '"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6"/></svg></button>' +
      '<span class="manga-counter" id="' + lb._id('MangaCounter') + '">1 / ' + totalSpreads + '</span>' +
    '</div>';

  var viewerEl = document.getElementById(lb._id('MangaViewer'));
  var track = document.getElementById(lb._id('MangaTrack'));
  var prevBtn = document.getElementById(lb._id('MangaPrev'));
  var nextBtn = document.getElementById(lb._id('MangaNext'));
  var counterEl = document.getElementById(lb._id('MangaCounter'));

  viewerEl.style.cssText = 'width:100%;height:100%;position:relative;display:flex;overflow:hidden';
  track.style.cssText = 'display:flex;height:100%;gap:3px;transition:transform .25s cubic-bezier(.4,0,.2,1)';
  prevBtn.style.cssText = 'position:absolute;top:50%;left:8px;transform:translateY(-50%);z-index:10;background:rgba(0,0,0,.5);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s';
  nextBtn.style.cssText = 'position:absolute;top:50%;right:8px;transform:translateY(-50%);z-index:10;background:rgba(0,0,0,.5);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s';
  counterEl.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);z-index:10;background:rgba(0,0,0,.7);color:#fff;padding:4px 14px;border-radius:12px;font-size:13px;font-weight:600;pointer-events:none';

  lb._sizeLb(Math.min(window.innerWidth - 60, 1400), window.innerHeight * 0.92);
  media.style.overflow = 'hidden';

  function loadSpreads() {
    if (loadedUpTo >= totalPages) return;
    var start = loadedUpTo;
    var count = Math.min(CHUNK, totalPages - loadedUpTo);
    for (var i = 0; i < count; i += 2) {
      var spread = document.createElement('div');
      spread.className = 'manga-spread';
      spread.style.cssText = 'flex:0 0 100%;height:100%;display:flex;justify-content:center;align-items:center;gap:3px';
      var idx1 = start + i;
      if (idx1 < totalPages) {
        var img1 = document.createElement('img');
        img1.src = file._pageUrls[idx1];
        img1.style.cssText = 'max-height:100%;max-width:calc(50% - 2px);object-fit:contain;border-radius:2px';
        img1.loading = 'lazy';
        spread.appendChild(img1);
      }
      var idx2 = start + i + 1;
      if (idx2 < totalPages) {
        var img2 = document.createElement('img');
        img2.src = file._pageUrls[idx2];
        img2.style.cssText = 'max-height:100%;max-width:calc(50% - 2px);object-fit:contain;border-radius:2px';
        img2.loading = 'lazy';
        spread.appendChild(img2);
      }
      track.appendChild(spread);
    }
    loadedUpTo = start + count;
  }

  function goToSpread(idx) {
    if (idx < 0) idx = 0;
    if (idx >= totalSpreads) idx = totalSpreads - 1;
    if (idx === currentSpread) return;
    currentSpread = idx;
    track.style.transform = 'translateX(-' + (idx * 100) + '%)';
    updateCounter();
    // Pre-load next chunk
    if (loadedUpTo < totalPages && currentSpread >= Math.floor(loadedUpTo / 2) - 2) {
      loadSpreads();
    }
  }

  function updateCounter() {
    var pageStart = currentSpread * 2 + 1;
    var pageEnd = Math.min(pageStart + 1, totalPages);
    var label = pageStart === pageEnd ? pageStart + ' / ' + totalPages : pageStart + '-' + pageEnd + ' / ' + totalPages;
    counterEl.textContent = label;
    var posEl = lb._el('Position');
    if (posEl) posEl.textContent = label;
  }

  loadSpreads();
  updateCounter();

  prevBtn.addEventListener('click', function() { goToSpread(currentSpread - 1); });
  nextBtn.addEventListener('click', function() { goToSpread(currentSpread + 1); });
  prevBtn.addEventListener('mouseenter', function() { this.style.background = 'rgba(0,0,0,.8)'; });
  prevBtn.addEventListener('mouseleave', function() { this.style.background = 'rgba(0,0,0,.5)'; });
  nextBtn.addEventListener('mouseenter', function() { this.style.background = 'rgba(0,0,0,.8)'; });
  nextBtn.addEventListener('mouseleave', function() { this.style.background = 'rgba(0,0,0,.5)'; });

  // Document keyboard: PgUp/PgDn navigate spreads, arrows stay for lightbox item nav
  var kbHandler = function(e) {
    var v = document.getElementById(lb._id('MangaViewer'));
    if (!v) return;
    if (e.key === 'PageUp') { e.preventDefault(); goToSpread(currentSpread - 1); }
    if (e.key === 'PageDown') { e.preventDefault(); goToSpread(currentSpread + 1); }
  };
  document.addEventListener('keydown', kbHandler);
  viewerEl._kbCleanup = function() { document.removeEventListener('keydown', kbHandler); };
}

function updateNhCategories(lb, tbc) {
  var curCatList = lb._getCatListFn ? lb._getCatListFn() : [];
  var newCats = {};
  curCatList.forEach(function(c) { newCats[c.name] = true; });
  var fallbackColors = {artist:'#ff4444',character:'#44cc44',copyright:'#4488ff',general:'#cccccc',meta:'#999999',language:'#aa66cc',category:'#ffaa00',uncategorized:'#666666'};
  var hasNew = false;
  for (var cat in tbc) {
    if (!newCats[cat]) { newCats[cat] = true; hasNew = true; }
  }
  if (hasNew) {
    var fc = window._csCatColors || {};
    var updatedCatList = Object.keys(newCats).map(function(n) {
      return {name: n, color: (fc[n] || fallbackColors[n] || '#888')};
    });
    lb._getCatListFn = function() { return updatedCatList; };
    var mergedTagToCat = {};
    _allResults.forEach(function(r) {
      var rbc = r.tags_by_category || {};
      for (var rc in rbc) rbc[rc].forEach(function(t) { mergedTagToCat[t] = rc; });
    });
    for (var cat2 in tbc) tbc[cat2].forEach(function(t) { mergedTagToCat[t] = cat2; });
    lb._getTagCategoryNameFn = function(tag) { return mergedTagToCat[tag] || ''; };
  }
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
      path = r.file_url || r.thumbnail || 'https://t.nhentai.net/galleries/' + r.mid + '/thumb.jpg'
    } else if (r._source === 'eh') {
      path = r.thumbnail || r.preview_url || ''
    } else {
      path = r.file_url || r.sample_url || r.preview_url
    }
    var srcSite = r._source === 'nhentai' ? 'NHentai' : (r._source === 'eh' ? 'E-Hentai' : (r._source === 'r34' ? 'Rule34' : (r._source === 'dan' ? 'Danbooru' : r._source)))
    // Source URL to open on original website
    var srcUrl = ''
    if (r._source === 'nhentai') srcUrl = 'https://nhentai.net/g/' + r.id + '/'
    else if (r._source === 'dan') srcUrl = 'https://danbooru.donmai.us/posts/' + r.id
    else if (r._source === 'r34') srcUrl = 'https://rule34.xxx/index.php?page=post&s=view&id=' + r.id
    else if (r._source === 'eh') srcUrl = 'https://e-hentai.org/g/' + r.id + '/' + (r.token || '') + '/'
    var item = {
      path: path,
      name: r._source === 'nhentai' ? (r.title || 'NHentai #' + r.id) : '',
      _displayName: r._source === 'nhentai' ? (r.title || 'NHentai #' + r.id) : (r._source === 'eh' ? (r.title || 'E-Hentai #' + r.id) : (r._source.toUpperCase() + ' #' + r.id)),
      _sourceSite: srcSite,
      _sourceUrl: srcUrl,
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
      item._pageUrls = r.page_urls || [];
    } else if (r._source === 'eh') {
      item._gid = r.id;
      item._token = r.token || '';
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
if (siteParam === 'nhentai' || siteParam === 'eh') {
  sourceCbs.forEach(function(cb) { cb.checked = false })
  if (siteParam === 'eh') {
    document.querySelector('.cs-source[data-site="eh"] input').checked = true
  } else {
    document.querySelector('.cs-source[data-site="nhentai"] input').checked = true
  }
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

// Register with MobileSearch
MobileSearch.register('content-search', {
  onSearch: function(val) {
    searchInput.value = val
    if (val.trim()) doSearch(val.trim())
  },
  onClear: function() {
    if (_ac) _ac.abort()
    searchInput.value = ''
    _allResults = []
    _csGrid.clear()
    grid.innerHTML = ''
    loading.style.display = 'none'
    pagination.style.display = 'none'
    empty.style.display = 'none'
  },
  getInitialValue: function() {
    return searchInput.value
  }
})
