// ============================================================
// Manual Tagfetch v2: file browser, fetch (R34+Dan), drag-to-tag
// ============================================================
var ManualTagfetch = (function() {
  var st = {
    currentFileAbsPath: '',
    currentFileRelPath: '',
    browsePath: '',
    fileEntries: [],
    fetchAllData: [],
    saveAllFiles: [],
    filterMode: 'all',
    sortMode: 'name',
    fetchAllCancelled: false
  };

  function isMedia(name) {
    var ext = name.split('.').pop().toLowerCase();
    return ['jpg','jpeg','png','gif','webp','bmp','mp4','webm','mov','avi','mkv'].includes(ext);
  }

  function isVideo(name) {
    var ext = name.split('.').pop().toLowerCase();
    return ['mp4','webm','mov','avi','mkv'].includes(ext);
  }

  function getIcon(name) {
    return isVideo(name) ? '🎬' : '🖼️';
  }

  function renderDbTags(tagsStr, cats) {
    if (!tagsStr) return '<em style="opacity:.6">empty</em>';
    cats = cats || {};
    return tagsStr.split(',').filter(Boolean).map(function(t) {
      var tag = t.trim();
      var color = cats[tag] || '';
      var style = color ? 'color:' + color + ';background:' + color + '22' : '';
      return '<span class="tag-chip" style="font-size:10px;padding:1px 5px;' + style + '">' + Shared.esc(tag) + '</span>';
    }).join('');
  }

  function chipStyle(cat) {
    var m = {artist:'#ff4444', character:'#44cc44', copyright:'#4488ff', meta:'#999'};
    var c = m[cat] || 'var(--text)';
    return 'color:' + c + ';background:' + c + '22';
  }

  function renderDanTags(data) {
    var html = '';
    var groups = [
      ['dan_artist', 'Artist', 'artist'],
      ['dan_character', 'Character', 'character'],
      ['dan_copyright', 'Series', 'copyright'],
      ['dan_meta', 'Meta', 'meta'],
      ['dan_general', 'General', 'general']
    ];
    groups.forEach(function(g) {
      var tags = data[g[0]] || [];
      if (!tags.length) return;
      html += '<div style="margin:4px 0;font-size:11px;opacity:.7">' + g[1] + '</div><div>' +
        tags.map(function(t) {
          return '<span class="tag-chip tag-draggable" draggable="true" data-tag="' + Shared.esc(t) + '" data-source="dan" style="' + chipStyle(g[2]) + '">' + Shared.esc(t) + '</span>';
        }).join('') + '</div>';
    });
    return html || '<span style="opacity:.5">No tags</span>';
  }

  // ── Filter ──

  function setFilter(mode) {
    st.filterMode = mode;
    document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.filter === mode); });
    applyFilter();
  }

  function applyFilter() {
    document.querySelectorAll('.path-item[data-path]').forEach(function(el) {
      var s = el.dataset.status || '';
      if (st.filterMode === 'all') { el.style.display = ''; return; }
      if (!s) { el.style.display = 'none'; return; }
      el.style.display = s === st.filterMode ? '' : 'none';
    });
  }

  function filterFiles(query) {
    var q = query.toLowerCase().trim();
    document.querySelectorAll('#browseBrowser .path-item[data-path]').forEach(function(el) {
      var name = (el.querySelector('.pname') || {}).textContent || '';
      var match = !q || name.toLowerCase().indexOf(q) !== -1;
      el.style.display = match ? '' : 'none';
    });
  }

  // ── Sort ──

  function toggleDateSort() {
    var modes = ['name', 'newest', 'oldest'];
    var idx = modes.indexOf(st.sortMode);
    st.sortMode = modes[(idx + 1) % modes.length];
    var btn = document.getElementById('tfSortDateBtn');
    if (btn) {
      var label = st.sortMode === 'name' ? Shared.t('sortByName')
        : st.sortMode === 'newest' ? Shared.t('sortByNewest')
        : Shared.t('sortByOldest');
      btn.innerHTML = label;
      btn.title = label;
    }
    sortBrowserItems();
    applyFilter();
  }

  function sortBrowserItems() {
    if (st.sortMode === 'name') return;
    var container = document.getElementById('browseBrowser');
    var items = Array.prototype.slice.call(container.querySelectorAll('.path-item[data-mtime]'));
    items.sort(function(a, b) {
      var ma = parseInt(a.dataset.mtime, 10) || 0;
      var mb = parseInt(b.dataset.mtime, 10) || 0;
      return st.sortMode === 'newest' ? mb - ma : ma - mb;
    });
    items.forEach(function(el) { container.appendChild(el); });
  }

  // ── Browser ──

  function loadBrowser(path) {
    st.browsePath = path;
    var browser = document.getElementById('browseBrowser');
    var breadcrumb = document.getElementById('browseBreadcrumb');
    var fetchAllRes = document.getElementById('fetchAllResults');
    if (fetchAllRes) fetchAllRes.classList.add('hidden');
    TagfetchAPI.browse(path).then(function(data) {
      var parts = data.path.split('/').filter(Boolean);
      var bcHtml = parts.length === 0
        ? '<span>/</span>'
        : '<span onclick="ManualTagfetch.loadBrowser(\'/\')">/</span>';
      var acc = '';
      parts.forEach(function(p, i) {
        acc += '/' + p;
        bcHtml += ' <span style="opacity:.5">›</span> <span onclick="ManualTagfetch.loadBrowser(\'' + acc.replace(/'/g, "\\'") + '\')">' + Shared.esc(p) + '</span>';
      });
      breadcrumb.innerHTML = bcHtml;

      st.fileEntries = [];
      var html = '';
      if (data.parent) {
        html += '<div class="path-item" onclick="ManualTagfetch.loadBrowser(\'' + data.parent.replace(/'/g, "\\'") + '\')"><span class="icon">📂</span><span class="pname">..</span></div>';
      }
      var mediaPaths = [];
      data.entries.forEach(function(e) {
        if (e.is_dir) {
          html += '<div class="path-item" onclick="ManualTagfetch.loadBrowser(\'' + e.path.replace(/'/g, "\\'") + '\')"><span class="icon">📁</span><span class="pname">' + Shared.esc(e.name) + '</span></div>';
        } else if (isMedia(e.name)) {
          var rp = e.rel_path || e.path;
          st.fileEntries.push(Object.assign(e, {rel_path: rp}));
          mediaPaths.push(rp);
          var sel = rp === st.currentFileRelPath ? ' selected' : '';
          var mt = e.mtime ? ' data-mtime="' + e.mtime + '"' : '';
          html += '<div class="path-item path-item-droppable' + sel + '" data-path="' + Shared.esc(rp) + '"' + mt + ' data-status="" ' +
            'ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ' +
            'ondragleave="this.classList.remove(\'drag-over\')" ' +
            'ondrop="ManualTagfetch.onTagDrop(event,\'' + rp.replace(/'/g, "\\'") + '\')" ' +
            'onclick="ManualTagfetch.selectFile(\'' + e.path.replace(/'/g, "\\'") + '\',\'' + rp.replace(/'/g, "\\'") + '\',\'' + e.name.replace(/'/g, "\\'") + '\')">' +
            '<span class="icon">' + getIcon(e.name) + '</span><span class="pname">' + Shared.esc(e.name) + '</span></div>';
        }
      });
      if (!html) {
        html = '<div class="path-item" style="cursor:default;color:var(--text2);text-align:center;padding:20px 12px">' +
          '<span data-i18n="tfEmptyDir">No media files in this directory</span></div>';
      }
      browser.innerHTML = html;
      var fc = document.getElementById('fileCount');
      if (fc) fc.textContent = '(' + st.fileEntries.length + ')';

      if (mediaPaths.length > 0) {
        TagfetchAPI.checkStatus(mediaPaths).then(function(statuses) {
          st.fileEntries.forEach(function(e) {
            var s = statuses[e.rel_path];
            if (s) {
              e._status = s.status;
              var el = document.querySelector('.path-item[data-path="' + Shared.esc(e.rel_path) + '"]');
              if (el) {
                el.dataset.status = s.status;
                var pn = el.querySelector('.pname');
                var icon = s.status === 'db' ? '💾'
                  : s.status === 'found' ? '🔍'
                  : s.status === 'not_found' ? '🚫'
                  : '❌';
                pn.innerHTML = icon + ' ' + Shared.esc(e.name);
              }
            }
          });
          sortBrowserItems();
          applyFilter();
        }).catch(function() {});
      }
    }).catch(function(err) {
      browser.innerHTML = '<div class="path-item" style="color:var(--danger);text-align:center;padding:20px">Error: ' + Shared.esc(err.message || 'load failed') + '</div>';
    });
  }

  // ── File selection ──

  function selectFile(absPath, relPath, name) {
    st.currentFileAbsPath = absPath;
    st.currentFileRelPath = relPath;
    document.querySelectorAll('.path-item').forEach(function(el) { el.classList.remove('selected'); });
    var match = document.querySelector('.path-item[data-path="' + Shared.esc(relPath) + '"]');
    if (match) match.classList.add('selected');

    document.getElementById('fileInfo').innerHTML = '<div class="path">' + Shared.esc(relPath) + '</div><div class="meta"><span>Loading preview…</span></div>';
    document.getElementById('localPreview').innerHTML = '<div class="placeholder"><span class="big">⏳</span>Loading…</div>';
    document.getElementById('r34Tags').innerHTML = '';
    document.getElementById('danTags').innerHTML = '';
    document.getElementById('r34Preview').innerHTML = '<div class="placeholder"><span class="big">🌐</span>Not fetched</div>';
    document.getElementById('danPreview').innerHTML = '<div class="placeholder"><span class="big">🌐</span>Not fetched</div>';
    document.getElementById('actions').innerHTML = '';
    document.getElementById('currentTags').innerHTML = '';
    var rc = document.getElementById('r34Count');
    if (rc) rc.textContent = '';
    var dc = document.getElementById('danCount');
    if (dc) dc.textContent = '';
    var fb = document.getElementById('fetchBtn');
    if (fb) { fb.disabled = false; fb.innerHTML = '🔍 Fetch Tags'; }

    var mediaUrl = '/api/media?path=' + encodeURIComponent(absPath) + _cbSuffix();
    if (isVideo(name)) {
      document.getElementById('localPreview').innerHTML = '<video src="' + mediaUrl + '" controls autoplay muted></video>';
    } else {
      document.getElementById('localPreview').innerHTML = '<img src="' + mediaUrl + '" alt="' + Shared.esc(name) + '" loading="lazy">';
    }

    TagfetchAPI.fileinfo(absPath).then(function(info) {
      if (info.error) return;
      var metaHtml = '';
      if (info.size) metaHtml += '<span>📦 ' + info.size + '</span>';
      if (info.dimensions) metaHtml += '<span>📐 ' + info.dimensions + '</span>';
      if (info.db_tags !== undefined) {
        var tc = renderDbTags(info.db_tags, info.tag_categories);
        metaHtml += '<span style="display:flex;flex-wrap:wrap;gap:2px;align-items:center">🏷️ ' + tc + '</span>';
        document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + tc + '</span>';
      }
      document.getElementById('fileInfo').innerHTML = '<div class="path">' + Shared.esc(relPath) + '</div><div class="meta">' + metaHtml + '</div>';
    });
  }

  function updateFileStatus(path, status) {
    var el = document.querySelector('.path-item[data-path="' + Shared.esc(path) + '"]');
    if (!el) return;
    el.dataset.status = status;
    var pn = el.querySelector('.pname');
    var entry = st.fileEntries.find(function(f) { return f.rel_path === path || f.path === path; });
    var name = entry ? entry.name : '';
    var icon = status === 'db' ? '💾' : status === 'found' ? '🔍' : status === 'not_found' ? '🚫' : '❌';
    pn.innerHTML = icon + ' ' + Shared.esc(name);
  }

  // ── Fetch tags ──

  function fetchTags() {
    if (!st.currentFileRelPath) return;
    var btn = document.getElementById('fetchBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="fetch-spinner"></span> Fetching…';
    document.getElementById('r34Tags').innerHTML = '<div class="loading">⏳ Fetching from Rule34…</div>';
    document.getElementById('danTags').innerHTML = '<div class="loading">⏳ Fetching from Danbooru…</div>';

    TagfetchAPI.fetchFile(st.currentFileRelPath).then(function(data) {
      if (data.error) {
        document.getElementById('r34Tags').innerHTML = '<span style="color:var(--danger)">' + Shared.esc(data.error) + '</span>';
        document.getElementById('danTags').innerHTML = '';
        btn.disabled = false;
        btn.innerHTML = '🔍 Fetch Tags';
        return;
      }
      // R34 tags (draggable)
      document.getElementById('r34Tags').innerHTML = data.r34.map(function(t) {
        return '<span class="tag-chip tag-draggable" draggable="true" data-tag="' + Shared.esc(t) + '" data-source="r34" style="cursor:grab">' + Shared.esc(t) + '</span>';
      }).join('');
      // Dan tags (draggable, grouped)
      document.getElementById('danTags').innerHTML = renderDanTags(data);

      var rc = document.getElementById('r34Count');
      if (rc) rc.textContent = '(' + data.r34.length + ')';
      var dc = document.getElementById('danCount');
      if (dc) {
        var totalDan = (data.dan_general||[]).length + (data.dan_artist||[]).length + (data.dan_character||[]).length + (data.dan_copyright||[]).length + (data.dan_meta||[]).length;
        dc.textContent = '(' + totalDan + ')';
      }

      // Previews
      var r34Img = data.r34_image || data.r34_preview || '';
      document.getElementById('r34Preview').innerHTML = r34Img
        ? '<img src="' + Shared.esc(r34Img) + '" alt="Rule34 preview" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=placeholder><span class=big>🚫</span>Preview unavailable</div>\'">'
        : '<div class="placeholder"><span class="big">🚫</span>No image</div>';
      var danImg = data.dan_image || data.dan_preview || '';
      document.getElementById('danPreview').innerHTML = danImg
        ? '<img src="' + Shared.esc(danImg) + '" alt="Danbooru preview" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=placeholder><span class=big>🚫</span>Preview unavailable</div>\'">'
        : '<div class="placeholder"><span class="big">🚫</span>No image</div>';

      // Action buttons
      var act = '';
      if (data.r34.length) act += '<button class="btn btn-sm btn-primary" onclick="ManualTagfetch.saveFile(\'r34\')">📥 Add from Rule34 (' + data.r34.length + ')</button>';
      if (data.dan.length) act += '<button class="btn btn-sm btn-primary" onclick="ManualTagfetch.saveFile(\'dan\')">📥 Add from Danbooru (' + data.dan.length + ')</button>';
      if (data.r34.length && data.dan.length) act += '<button class="btn btn-sm btn-success" onclick="ManualTagfetch.saveFile(\'both\')">📥 Add Both</button>';
      document.getElementById('actions').innerHTML = act;
      document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.db_tags, data.tag_categories) + '</span>';

      var hasTags = data.r34.length || data.dan.length;
      updateFileStatus(st.currentFileRelPath, hasTags ? 'found' : 'no_tags');
      if (hasTags) {
        Shared.notify('Tags found!', 'success');
        Shared.playChime();
      }
      btn.disabled = false;
      btn.innerHTML = '🔍 Fetch Tags';
    }).catch(function() {
      document.getElementById('r34Tags').innerHTML = '<span style="color:var(--danger)">Failed to fetch</span>';
      document.getElementById('danTags').innerHTML = '';
      btn.disabled = false;
      btn.innerHTML = '🔍 Fetch Tags';
    });
  }

  // ── Fetch All ──

  function fetchAllFiles() {
    if (!st.fileEntries.length) return;
    st.fetchAllCancelled = false;
    var btn = document.getElementById('fetchAllBtn');
    btn.disabled = true;
    var cancelBtn = document.getElementById('cancelFetchAllBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    var resultsDiv = document.getElementById('fetchAllResults');
    resultsDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '<div style="padding:4px;font-size:12px;opacity:.7">⏳ Processing…</div>';

    st.fetchAllData = [];
    var i = 0;
    function next() {
      if (st.fetchAllCancelled) {
        btn.disabled = false;
        btn.innerHTML = '🔍 Fetch All';
        if (cancelBtn) cancelBtn.classList.add('hidden');
        resultsDiv.innerHTML += '<div style="padding:4px;font-size:12px;opacity:.5">⛔ Cancelled</div>';
        return;
      }
      if (i >= st.fileEntries.length) {
        if (cancelBtn) cancelBtn.classList.add('hidden');
        var html = '<div style="font-size:12px;font-weight:600;padding:4px 0">📋 Results (' + st.fileEntries.length + ' files)</div>';
        st.fetchAllData.forEach(function(r, idx) {
          var icon = r.saved ? '✅' : (r.found ? '🔍' : '❌');
          html += '<div class="fetch-result" data-idx="' + idx + '" style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--border)">' +
            '<span style="width:16px;text-align:center">' + icon + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + Shared.esc(r.name) + '</span>' +
            '<span style="font-size:11px;opacity:.7">R34:' + r.r34n + ' Dan:' + r.dann + '</span>';
          if (r.found && !r.saved) {
            html += '<button class="btn btn-xs" onclick="ManualTagfetch.saveFetchResult(' + idx + ')">+</button>';
          }
          html += '</div>';
        });
        resultsDiv.innerHTML = html;
        btn.disabled = false;
        return;
      }
      var f = st.fileEntries[i];
      var rp = f.rel_path || f.path;
      selectFile(f.path, rp, f.name);
      TagfetchAPI.fetchFile(rp).then(function(data) {
        var found = !!(data.r34.length || data.dan.length);
        st.fetchAllData.push({
          name: f.name, path: rp, r34n: data.r34.length, dann: data.dan.length,
          r34: data.r34, dan: data.dan,
          dan_artist: data.dan_artist, dan_character: data.dan_character,
          dan_copyright: data.dan_copyright, dan_meta: data.dan_meta,
          found: found, saved: false,
          source: found ? (data.r34.length && data.dan.length ? 'both' : (data.r34.length ? 'r34' : 'dan')) : ''
        });
        document.getElementById('r34Tags').innerHTML = data.r34.map(function(t) {
          return '<span class="tag-chip tag-draggable" draggable="true" data-tag="' + Shared.esc(t) + '" data-source="r34" style="cursor:grab">' + Shared.esc(t) + '</span>';
        }).join('') || '<span style="opacity:.5">No tags</span>';
        var rc = document.getElementById('r34Count');
        if (rc) rc.textContent = '(' + data.r34.length + ')';
        document.getElementById('danTags').innerHTML = renderDanTags(data);
        var dc = document.getElementById('danCount');
        if (dc) {
          var td = (data.dan_general||[]).length + (data.dan_artist||[]).length + (data.dan_character||[]).length + (data.dan_copyright||[]).length + (data.dan_meta||[]).length;
          dc.textContent = '(' + td + ')';
        }
        var r34Img = data.r34_image || data.r34_preview || '';
        document.getElementById('r34Preview').innerHTML = r34Img
          ? '<img src="' + Shared.esc(r34Img) + '" alt="Rule34 preview" loading="lazy">'
          : '<div class="placeholder"><span class="big">🚫</span>No image</div>';
        var danImg = data.dan_image || data.dan_preview || '';
        document.getElementById('danPreview').innerHTML = danImg
          ? '<img src="' + Shared.esc(danImg) + '" alt="Danbooru preview" loading="lazy">'
          : '<div class="placeholder"><span class="big">🚫</span>No image</div>';

        var act = '';
        if (data.r34.length) act += '<button class="btn btn-sm btn-primary" onclick="ManualTagfetch.saveFile(\'r34\')">📥 Add from Rule34 (' + data.r34.length + ')</button>';
        if (data.dan.length) act += '<button class="btn btn-sm btn-primary" onclick="ManualTagfetch.saveFile(\'dan\')">📥 Add from Danbooru (' + data.dan.length + ')</button>';
        if (data.r34.length && data.dan.length) act += '<button class="btn btn-sm btn-success" onclick="ManualTagfetch.saveFile(\'both\')">📥 Add Both</button>';
        document.getElementById('actions').innerHTML = act;
        document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.db_tags, data.tag_categories) + '</span>';
        updateFileStatus(rp, found ? 'found' : 'no_tags');
        if (found) { Shared.notify('Tags found for ' + f.name, 'success'); Shared.playChime(); }
        i++;
        setTimeout(next, 300);
      }).catch(function() { i++; setTimeout(next, 300); });
    }
    next();
  }

  function cancelFetchAll() { st.fetchAllCancelled = true; }

  function saveFetchResult(idx) {
    var r = st.fetchAllData[idx];
    if (!r || !r.source) return;
    var prevPath = st.currentFileRelPath;
    st.currentFileRelPath = r.path;
    TagfetchAPI.saveFile(r.path, r.source).then(function(data) {
      st.currentFileRelPath = prevPath;
      if (data.ok) {
        r.saved = true;
        updateFileStatus(r.path, 'db');
        Shared.notify('Saved: ' + r.name, 'success');
        var resultEl = document.querySelector('.fetch-result[data-idx="' + idx + '"]');
        if (resultEl) {
          resultEl.querySelector('span:first-child').textContent = '✅';
          var btn = resultEl.querySelector('button');
          if (btn) btn.remove();
        }
      }
    }).catch(function() { st.currentFileRelPath = prevPath; });
  }

  // ── Clear cache ──

  function clearCurrentCache() {
    if (!st.currentFileRelPath) return;
    TagfetchAPI.clearCache(st.currentFileRelPath).then(function(data) {
      if (data.ok) {
        document.getElementById('r34Tags').innerHTML = '';
        document.getElementById('danTags').innerHTML = '';
        document.getElementById('r34Preview').innerHTML = '<div class="placeholder"><span class="big">🌐</span>Not fetched</div>';
        document.getElementById('danPreview').innerHTML = '<div class="placeholder"><span class="big">🌐</span>Not fetched</div>';
        var rc = document.getElementById('r34Count');
        if (rc) rc.textContent = '';
        var dc = document.getElementById('danCount');
        if (dc) dc.textContent = '';
        document.getElementById('actions').innerHTML = '';
      }
    });
  }

  // ── Save ──

  function saveFile(source) {
    if (!st.currentFileRelPath) return;
    TagfetchAPI.saveFile(st.currentFileRelPath, source).then(function(data) {
      if (data.ok) {
        document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.tags) + '</span>';
        var meta = document.getElementById('fileInfo').querySelector('.meta');
        var badge = meta.querySelector('.saved-badge');
        if (badge) badge.remove();
        meta.insertAdjacentHTML('beforeend', '<span class="saved-badge" style="color:var(--success)">✅ Saved</span>');
        updateFileStatus(st.currentFileRelPath, 'db');
        Shared.notify('Tags saved', 'success');
      }
    });
  }

  // ── Drag-to-tag ──

  function onTagDrop(e, relPath) {
    e.preventDefault();
    document.querySelectorAll('.path-item').forEach(function(el) { el.classList.remove('drag-over'); });
    var tag = e.dataTransfer.getData('text/plain');
    var src = e.dataTransfer.getData('application/x-source') || 'manual';
    if (!tag || !relPath) return;
    // Save single tag: source='tag_editor' tells API to use tags_str directly
    fetch('/api/save_file', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path: relPath, tags: tag, source: 'tag_editor'})
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        updateFileStatus(relPath, 'db');
        // Refresh file info if this is the current file
        if (relPath === st.currentFileRelPath) {
          TagfetchAPI.fileinfo(st.currentFileAbsPath).then(function(info) {
            if (!info.error && info.db_tags !== undefined) {
              var tc = renderDbTags(info.db_tags, info.tag_categories);
              document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + tc + '</span>';
            }
          });
        }
        Shared.notify('Tag added: ' + tag, 'success');
      }
    }).catch(function() {
      Shared.notify('Failed to save tag', 'error');
    });
  }

  // ── Save All Modal ──

  function openSaveAllModal() {
    document.getElementById('saveAllModal').classList.add('open');
    var body = document.getElementById('saveAllBody');
    body.innerHTML = '<div class="loading">⏳ Scanning cache…</div>';
    var stats = document.getElementById('saveAllStats');
    if (stats) stats.textContent = '';
    var execBtn = document.getElementById('saveAllExecBtn');
    execBtn.disabled = true;

    var paths = st.fileEntries.map(function(f) { return f.rel_path || f.path; });
    TagfetchAPI.saveAllFetched(paths, true).then(function(data) {
      st.saveAllFiles = data.results.filter(function(r) { return r.tags_count > 0; });
      if (st.saveAllFiles.length === 0) {
        body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text2)">No cached tags found.<br>Run <b>🔍 Fetch All</b> first, then try again.</div>';
        if (stats) stats.textContent = '';
        return;
      }
      var html = '';
      st.saveAllFiles.forEach(function(r) {
        html += '<div class="fetch-result" style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--border)">' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + Shared.esc(r.name) + '</span>' +
          '<span style="font-size:11px;opacity:.7">' + r.tags_count + ' tags</span></div>';
      });
      body.innerHTML = html;
      if (stats) stats.textContent = st.saveAllFiles.length + ' files with cached tags';
      execBtn.disabled = false;
    }).catch(function() {
      body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--danger)">Failed to scan cache</div>';
    });
  }

  function closeSaveAllModal() {
    document.getElementById('saveAllModal').classList.remove('open');
  }

  function executeSaveAll() {
    var btn = document.getElementById('saveAllExecBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="fetch-spinner"></span> Saving…';

    var paths = st.saveAllFiles.map(function(f) { return f.path; });
    TagfetchAPI.saveAllFetched(paths, false).then(function(data) {
      var body = document.getElementById('saveAllBody');
      var html = '';
      data.results.forEach(function(r) {
        var icon = r.saved ? '✅' : '⏭️';
        html += '<div style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--border)">' +
          '<span style="width:16px;text-align:center">' + icon + '</span>' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + Shared.esc(r.name) + '</span>' +
          '<span style="font-size:11px;opacity:.7">' + r.tags_count + ' tags</span></div>';
        if (r.saved) updateFileStatus(r.path, 'db');
      });
      body.innerHTML = html;
      var stats = document.getElementById('saveAllStats');
      if (stats) stats.textContent = '✅ Saved ' + data.saved + '/' + data.total;
      btn.innerHTML = '💾 Done';
    }).catch(function() {
      document.getElementById('saveAllBody').innerHTML = '<div style="padding:30px;text-align:center;color:var(--danger)">Save failed</div>';
      btn.innerHTML = '💾 Save All';
      btn.disabled = false;
    });
  }

  function getCurrentBrowsePath() { return st.browsePath; }

  // ── Init ──

  function init() {
    st.browsePath = window.CONFIG && CONFIG.mediaDir || '';
    if (!st.browsePath) {
      var browser = document.getElementById('browseBrowser');
      if (browser) {
        browser.innerHTML = '<div class="path-item" style="cursor:default;color:var(--text2);text-align:center;padding:30px 12px;flex-direction:column;gap:8px">' +
          '<span style="font-size:28px">📁</span>' +
          '<span style="font-weight:600" data-i18n="tfNoMediaDir">Media directory not set</span>' +
          '<span style="font-size:11px">Go to Settings and configure the media folder</span></div>';
      }
      return;
    }
    loadBrowser(st.browsePath);

    // Global drag handlers for delegated events
    document.addEventListener('dragstart', function(e) {
      var chip = e.target.closest('.tag-draggable');
      if (!chip) return;
      e.dataTransfer.setData('text/plain', chip.dataset.tag);
      e.dataTransfer.setData('application/x-source', chip.dataset.source || 'manual');
      e.dataTransfer.effectAllowed = 'copy';
      chip.classList.add('dragging');
    });
    document.addEventListener('dragend', function(e) {
      var chip = e.target.closest('.tag-draggable');
      if (chip) chip.classList.remove('dragging');
    });

    // Arrow key navigation
    document.addEventListener('keydown', function(e) {
      var browser = document.getElementById('browseBrowser');
      if (!browser || browser.style.display === 'none') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      var items = browser.querySelectorAll('.path-item[data-path]');
      if (!items.length) return;
      e.preventDefault();
      var sel = browser.querySelector('.path-item.selected');
      var idx = -1;
      if (sel) { for (var i = 0; i < items.length; i++) { if (items[i] === sel) { idx = i; break; } } }
      if (e.key === 'ArrowDown') idx = Math.min(idx + 1, items.length - 1);
      else idx = Math.max(idx - 1, 0);
      if (idx < 0) idx = 0;
      items[idx].click();
      items[idx].focus();
      items[idx].scrollIntoView({block: 'nearest'});
    });
  }

  return {
    init: init,
    loadBrowser: loadBrowser,
    selectFile: selectFile,
    fetchTags: fetchTags,
    fetchAllFiles: fetchAllFiles,
    cancelFetchAll: cancelFetchAll,
    saveFetchResult: saveFetchResult,
    clearCurrentCache: clearCurrentCache,
    saveFile: saveFile,
    onTagDrop: onTagDrop,
    openSaveAllModal: openSaveAllModal,
    closeSaveAllModal: closeSaveAllModal,
    executeSaveAll: executeSaveAll,
    setFilter: setFilter,
    filterFiles: filterFiles,
    toggleDateSort: toggleDateSort,
    getCurrentBrowsePath: getCurrentBrowsePath,
    renderDbTags: renderDbTags
  };
})();

window.ManualTagfetch = ManualTagfetch;
