// ============================================================
// Ручной режим Tagfetch: обзор файловой системы, получение
// тегов (Rule34 + Danbooru), сохранение, fetch all
// ============================================================
var TagfetchManual = (function() {
  var currentFileAbsPath = '';
  var currentFileRelPath = '';
  var browsePath = '';
  var _fileEntries = [];
  var _fetchAllData = [];
  var _saveAllFiles = [];
  var _filterMode = 'all';
  var _fetchAllCancelled = false;
  var _tfSortMode = 'name'; // 'name' | 'newest' | 'oldest'

  // Проверка, является ли файл медиа по расширению
  function isMediaFile(name) {
    var ext = name.split('.').pop().toLowerCase();
    return ['jpg','jpeg','png','gif','webp','bmp','mp4','webm','mov','avi','mkv'].includes(ext);
  }

  // Иконка файла (🎬 для видео, 🖼️ для изображений)
  function getFileIcon(name) {
    var ext = name.split('.').pop().toLowerCase();
    if (['mp4','webm','mov','avi','mkv'].includes(ext)) return '🎬';
    return '🖼️';
  }

  // Отрисовка тегов из БД в виде мелких чипсов с цветом категории
  function renderDbTags(tagsStr, categories) {
    if (!tagsStr) return '<em style="opacity:.6">empty</em>';
    var cats = categories || {};
    return tagsStr.split(',').filter(Boolean).map(function(t) {
      var tag = t.trim();
      var color = cats[tag] || '';
      var chipStyle = color ? 'color:' + color + ';background:' + color + '22' : '';
      return '<span class="tag-chip" style="font-size:10px;padding:1px 5px;' + chipStyle + '">' + Shared.esc(tag) + '</span>';
    }).join('');
  }

  // Чипс тега с цветом в зависимости от категории (artist/character/copyright/meta)
  function tagChip(tag, cat) {
    var colors = {artist:'#ff4444', character:'#44cc44', copyright:'#4488ff', meta:'#999'};
    var c = colors[cat] || 'var(--text)';
    return '<span class="tag-chip" style="color:' + c + ';background:' + c + '22">' + Shared.esc(tag) + '</span>';
  }

  // Отрисовка Danbooru-тегов, сгруппированных по категориям
  function renderDanTags(data) {
    var html = '';
    var sections = [
      ['dan_artist', '🎨 Artist', 'artist'],
      ['dan_character', '👤 Character', 'character'],
      ['dan_copyright', '📚 Series', 'copyright'],
      ['dan_meta', '# Meta', 'meta'],
      ['dan_general', '🏷️ General', 'general'],
    ];
    sections.forEach(function(s) {
      var tags = data[s[0]] || [];
      if (!tags.length) return;
      html += '<div style="margin:4px 0;font-size:11px;opacity:.7">' + s[1] + '</div><div>' +
        tags.map(function(t) { return tagChip(t, s[2]); }).join('') + '</div>';
    });
    return html || '<span style="opacity:.5">No tags</span>';
  }

  // Установка фильтра списка файлов (all/db/found/not_found)
  function setFilter(mode) {
    _filterMode = mode;
    document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.filter === mode); });
    applyFilter();
  }

  // Применение фильтра к списку файлов (скрытие/показ элементов)
  function applyFilter() {
    document.querySelectorAll('.path-item[data-path]').forEach(function(el) {
      var st = el.dataset.status || '';
      if (_filterMode === 'all') { el.style.display = ''; return; }
      if (!st) { el.style.display = 'none'; return; }
      el.style.display = st === _filterMode ? '' : 'none';
    });
  }

  function toggleDateSort() {
    var modes = ['name', 'newest', 'oldest'];
    var idx = modes.indexOf(_tfSortMode);
    _tfSortMode = modes[(idx + 1) % modes.length];
    var btn = document.getElementById('tfSortDateBtn');
    if (btn) {
      var modeKey = _tfSortMode === 'name' ? 'sortByName' : _tfSortMode === 'newest' ? 'sortByNewest' : 'sortByOldest';
      var svg;
      if (_tfSortMode === 'name') {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l-4 4 4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h10"/><path d="M20 17H10"/></svg>';
      } else if (_tfSortMode === 'newest') {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>';
      } else {
        svg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
      }
      btn.innerHTML = svg + ' <span>' + Shared.t(modeKey) + '</span>';
      btn.title = Shared.t(modeKey + 'Title');
      btn.dataset.i18n = modeKey;
      btn.dataset.i18nTitle = modeKey + 'Title';
    }
    _sortBrowserItems();
    applyFilter();
  }

  function _sortBrowserItems() {
    if (_tfSortMode === 'name') return;
    var container = document.getElementById('browseBrowser');
    var items = Array.prototype.slice.call(container.querySelectorAll('.path-item[data-mtime]'));
    items.sort(function(a, b) {
      var ma = parseInt(a.dataset.mtime, 10) || 0;
      var mb = parseInt(b.dataset.mtime, 10) || 0;
      return _tfSortMode === 'newest' ? mb - ma : ma - mb;
    });
    items.forEach(function(el) { container.appendChild(el); });
  }

  // Загрузка содержимого директории в обзорщик файлов
  // с получением статусов через batch API
  function loadBrowser(path) {
    browsePath = path;
    var browser = document.getElementById('browseBrowser');
    var breadcrumb = document.getElementById('browseBreadcrumb');
    var fetchAllRes = document.getElementById('fetchAllResults');
    if (fetchAllRes) fetchAllRes.style.display = 'none';
    TagfetchAPI.browse(path).then(function(data) {
      var parts = data.path.split('/').filter(Boolean);
      var bcHtml = '';
      if (parts.length === 0) {
        bcHtml = '<span>/</span>';
      } else {
        var acc = '';
        bcHtml = '<span onclick="TagfetchManual.loadBrowser(\'/\')">/</span>';
        parts.forEach(function(p, i) {
          acc += '/' + p;
          bcHtml += ' <span style="opacity:.5">›</span> <span onclick="TagfetchManual.loadBrowser(\'' + acc.replace(/'/g,"\\'") + '\')">' + Shared.esc(p) + '</span>';
        });
      }
      breadcrumb.innerHTML = bcHtml;

      _fileEntries = [];
      var html = '';
      if (data.parent) {
        html += '<div class="path-item" onclick="TagfetchManual.loadBrowser(\'' + data.parent.replace(/'/g,"\\'") + '\')"><span class="icon">📂</span><span class="pname">..</span></div>';
      }
      var mediaPaths = [];
      data.entries.forEach(function(e) {
        if (e.is_dir) {
          html += '<div class="path-item" onclick="TagfetchManual.loadBrowser(\'' + e.path.replace(/'/g,"\\'") + '\')"><span class="icon">📁</span><span class="pname">' + Shared.esc(e.name) + '</span></div>';
        } else if (isMediaFile(e.name)) {
          var rp = e.rel_path || e.path;
          _fileEntries.push(Object.assign(e, {rel_path: rp}));
          mediaPaths.push(rp);
          var sel = rp === currentFileRelPath ? ' selected' : '';
          var mt = e.mtime ? ' data-mtime="' + e.mtime + '"' : '';
          html += '<div class="path-item' + sel + '" data-path="' + Shared.esc(rp) + '"' + mt + ' data-status="" onclick="TagfetchManual.selectFile(\'' + e.path.replace(/'/g,"\\'") + '\',\'' + rp.replace(/'/g,"\\'") + '\',\'' + e.name.replace(/'/g,"\\'") + '\')"><span class="icon">' + getFileIcon(e.name) + '</span><span class="pname">' + Shared.esc(e.name) + '</span></div>';
        }
      });
      if (!html) {
        html = '<div class="path-item" style="cursor:default;color:var(--text2);text-align:center;padding:20px 12px">' +
          '<span data-i18n="tfEmptyDir">No media files in this directory</span></div>';
      }
      browser.innerHTML = html;
      var fc = document.getElementById('fileCount');
      if (fc) fc.textContent = '(' + _fileEntries.length + ')';

      if (mediaPaths.length > 0) {
        TagfetchAPI.checkStatus(mediaPaths).then(function(statuses) {
          _fileEntries.forEach(function(e) {
            var st = statuses[e.rel_path];
            if (st) {
              e._status = st.status;
              var el = document.querySelector('.path-item[data-path="' + Shared.esc(e.rel_path) + '"]');
              if (el) {
                el.dataset.status = st.status;
                var pname = el.querySelector('.pname');
                if (st.status === 'db') pname.innerHTML = '💾 ' + Shared.esc(e.name);
                else if (st.status === 'found') pname.innerHTML = '🔍 ' + Shared.esc(e.name);
                else if (st.status === 'not_found') pname.innerHTML = '🚫 ' + Shared.esc(e.name);
                else if (st.status === 'no_tags') pname.innerHTML = '❌ ' + Shared.esc(e.name);
              }
            }
          });
          var fb = document.getElementById('filterBar');
          if (fb) fb.style.display = 'flex';
          _sortBrowserItems();
          applyFilter();
        }).catch(function() {});
      }
    });
  }

  // Выбор файла: загрузка превью, информации, сброс панели тегов
  function selectFile(absPath, relPath, name) {
    currentFileAbsPath = absPath;
    currentFileRelPath = relPath;
    document.querySelectorAll('.path-item').forEach(function(el) { el.classList.remove('selected'); });
    var match = document.querySelector('.path-item[data-path="' + Shared.esc(relPath) + '"]');
    if (match) match.classList.add('selected');

    document.getElementById('fileInfo').innerHTML =
      '<div class="path">' + Shared.esc(relPath) + '</div><div class="meta"><span>Loading preview…</span></div>';
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

    var ext = name.split('.').pop().toLowerCase();
    var isVideo = ['mp4','webm','mov','avi','mkv'].includes(ext);
    var mediaUrl = '/api/media?path=' + encodeURIComponent(absPath);

    if (isVideo) {
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

  // Обновление статуса файла в списке (иконка в зависимости от статуса)
  function updateFileStatus(path, status) {
    var el = document.querySelector('.path-item[data-path="' + Shared.esc(path) + '"]');
    if (!el) return;
    el.dataset.status = status;
    var pname = el.querySelector('.pname');
    var entry = _fileEntries.find(function(f) { return f.rel_path === path || f.path === path; });
    var name = entry ? entry.name : '';
    if (status === 'db') pname.innerHTML = '💾 ' + Shared.esc(name);
    else if (status === 'found') pname.innerHTML = '🔍 ' + Shared.esc(name);
  }

  // Получение тегов для текущего выбранного файла с Rule34 и Danbooru
  function fetchTags() {
    if (!currentFileRelPath) return;
    var btn = document.getElementById('fetchBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="fetch-spinner"></span> Fetching…';
    document.getElementById('r34Tags').innerHTML = '<div class="loading">⏳ Fetching from Rule34…</div>';
    document.getElementById('danTags').innerHTML = '<div class="loading">⏳ Fetching from Danbooru…</div>';

    TagfetchAPI.fetchFile(currentFileRelPath).then(function(data) {
      if (data.error) {
        document.getElementById('r34Tags').innerHTML = '<span style="color:var(--danger)">' + Shared.esc(data.error) + '</span>';
        document.getElementById('danTags').innerHTML = '';
        btn.disabled = false;
        btn.innerHTML = '🔍 Fetch Tags';
        return;
      }
      document.getElementById('r34Tags').innerHTML = data.r34.map(function(t) { return '<span class="tag">' + Shared.esc(t) + '</span>'; }).join('');
      document.getElementById('danTags').innerHTML = renderDanTags(data);
      var rc = document.getElementById('r34Count');
      if (rc) rc.textContent = '(' + data.r34.length + ')';
      var dc = document.getElementById('danCount');
      if (dc) {
        var allDanTags = (data.dan_general||[]).length + (data.dan_artist||[]).length + (data.dan_character||[]).length + (data.dan_copyright||[]).length + (data.dan_meta||[]).length;
        dc.textContent = '(' + allDanTags + ')';
      }
      if (data.r34_preview) {
        document.getElementById('r34Preview').innerHTML = '<img src="' + Shared.esc(data.r34_preview) + '" alt="Rule34 preview" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=placeholder><span class=big>🚫</span>Preview unavailable</div>\'">';
      } else {
        document.getElementById('r34Preview').innerHTML = '<div class="placeholder"><span class="big">🚫</span>No image</div>';
      }
      if (data.dan_preview) {
        document.getElementById('danPreview').innerHTML = '<img src="' + Shared.esc(data.dan_preview) + '" alt="Danbooru preview" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=placeholder><span class=big>🚫</span>Preview unavailable</div>\'">';
      } else {
        document.getElementById('danPreview').innerHTML = '<div class="placeholder"><span class="big">🚫</span>No image</div>';
      }
      var actionsHtml = '';
      if (data.r34.length) actionsHtml += '<button class="btn btn-sm btn-primary" onclick="TagfetchManual.saveFile(\'r34\')">📥 Add from Rule34 (' + data.r34.length + ')</button>';
      if (data.dan.length) actionsHtml += '<button class="btn btn-sm btn-primary" onclick="TagfetchManual.saveFile(\'dan\')">📥 Add from Danbooru (' + data.dan.length + ')</button>';
      if (data.r34.length && data.dan.length) actionsHtml += '<button class="btn btn-sm btn-success" onclick="TagfetchManual.saveFile(\'both\')">📥 Add Both</button>';
      document.getElementById('actions').innerHTML = actionsHtml;
      document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.db_tags, data.tag_categories) + '</span>';
      var hasTags = data.r34.length || data.dan.length;
      updateFileStatus(currentFileRelPath, hasTags ? 'found' : 'no_tags');
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

  // Пакетное получение тегов для всех файлов в текущей директории
  function fetchAllFiles() {
    if (!_fileEntries.length) return;
    _fetchAllCancelled = false;
    var btn = document.getElementById('fetchAllBtn');
    btn.disabled = true;
    var cancelBtn = document.getElementById('cancelFetchAllBtn');
    if (cancelBtn) cancelBtn.style.display = '';
    var resultsDiv = document.getElementById('fetchAllResults');
    resultsDiv.style.display = 'block';
    resultsDiv.innerHTML = '<div style="padding:4px;font-size:12px;opacity:.7">⏳ Processing…</div>';

    _fetchAllData = [];
    var i = 0;
    function next() {
      if (_fetchAllCancelled) {
        btn.disabled = false;
        btn.innerHTML = '🔍 Fetch All';
        if (cancelBtn) cancelBtn.style.display = 'none';
        resultsDiv.innerHTML += '<div style="padding:4px;font-size:12px;opacity:.5">⛔ Cancelled</div>';
        return;
      }
      if (i >= _fileEntries.length) {
        if (cancelBtn) cancelBtn.style.display = 'none';
        var html = '<div style="font-size:12px;font-weight:600;padding:4px 0">📋 Results (' + _fileEntries.length + ' files)</div>';
        _fetchAllData.forEach(function(r, idx) {
          var icon = r.saved ? '✅' : (r.found ? '🔍' : '❌');
          html += '<div class="fetch-result" data-idx="' + idx + '" style="display:flex;align-items:center;gap:4px;padding:2px 0;border-bottom:1px solid var(--border)">' +
            '<span style="width:16px;text-align:center">' + icon + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + Shared.esc(r.name) + '</span>' +
            '<span style="font-size:11px;opacity:.7">R34:' + r.r34n + ' Dan:' + r.dann + '</span>';
          if (r.found && !r.saved) {
            html += '<button class="btn btn-xs" onclick="TagfetchManual.saveFetchResult(' + idx + ')">+</button>';
          }
          html += '</div>';
        });
        resultsDiv.innerHTML = html;
        btn.disabled = false;
        return;
      }
      var f = _fileEntries[i];
      var rp = f.rel_path || f.path;
      selectFile(f.path, rp, f.name);
      TagfetchAPI.fetchFile(rp).then(function(data) {
        var found = !!(data.r34.length || data.dan.length);
        _fetchAllData.push({
          name: f.name, path: rp, r34n: data.r34.length, dann: data.dan.length,
          r34: data.r34, dan: data.dan, dan_artist: data.dan_artist,
          dan_character: data.dan_character, dan_copyright: data.dan_copyright,
          dan_meta: data.dan_meta,
          found: found, saved: false,
          source: found ? (data.r34.length && data.dan.length ? 'both' : (data.r34.length ? 'r34' : 'dan')) : ''
        });
        var r34Html = data.r34.map(function(t) { return '<span class="tag">' + Shared.esc(t) + '</span>'; }).join('');
        document.getElementById('r34Tags').innerHTML = r34Html || '<span style="opacity:.5">No tags</span>';
        var rc = document.getElementById('r34Count');
        if (rc) rc.textContent = '(' + data.r34.length + ')';
        document.getElementById('danTags').innerHTML = renderDanTags(data);
        var dc = document.getElementById('danCount');
        if (dc) {
          var allDanTags = (data.dan_general||[]).length + (data.dan_artist||[]).length + (data.dan_character||[]).length + (data.dan_copyright||[]).length + (data.dan_meta||[]).length;
          dc.textContent = '(' + allDanTags + ')';
        }
        if (data.r34_preview) {
          document.getElementById('r34Preview').innerHTML = '<img src="' + Shared.esc(data.r34_preview) + '" alt="Rule34 preview" loading="lazy">';
        } else {
          document.getElementById('r34Preview').innerHTML = '<div class="placeholder"><span class="big">🚫</span>No image</div>';
        }
        if (data.dan_preview) {
          document.getElementById('danPreview').innerHTML = '<img src="' + Shared.esc(data.dan_preview) + '" alt="Danbooru preview" loading="lazy">';
        } else {
          document.getElementById('danPreview').innerHTML = '<div class="placeholder"><span class="big">🚫</span>No image</div>';
        }
        var actionsFetch = '';
        if (data.r34.length) actionsFetch += '<button class="btn btn-sm btn-primary" onclick="TagfetchManual.saveFile(\'r34\')">📥 Add from Rule34 (' + data.r34.length + ')</button>';
        if (data.dan.length) actionsFetch += '<button class="btn btn-sm btn-primary" onclick="TagfetchManual.saveFile(\'dan\')">📥 Add from Danbooru (' + data.dan.length + ')</button>';
        if (data.r34.length && data.dan.length) actionsFetch += '<button class="btn btn-sm btn-success" onclick="TagfetchManual.saveFile(\'both\')">📥 Add Both</button>';
        document.getElementById('actions').innerHTML = actionsFetch;
        document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.db_tags, data.tag_categories) + '</span>';
        updateFileStatus(rp, found ? 'found' : 'no_tags');
        if (found) { Shared.notify('Tags found for ' + f.name, 'success'); Shared.playChime(); }
        i++;
        setTimeout(next, 300);
      }).catch(function() { i++; setTimeout(next, 300); });
    }
    next();
  }

  // Отмена пакетного получения тегов
  function cancelFetchAll() {
    _fetchAllCancelled = true;
  }

  // Сохранение одного результата из списка fetchAll
  function saveFetchResult(idx) {
    var r = _fetchAllData[idx];
    if (!r || !r.source) return;
    var prevPath = currentFileRelPath;
    currentFileRelPath = r.path;
    TagfetchAPI.saveFile(r.path, r.source).then(function(data) {
      currentFileRelPath = prevPath;
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
    }).catch(function() { currentFileRelPath = prevPath; });
  }

  // Очистка in-memory кэша для текущего файла
  function clearCurrentCache() {
    if (!currentFileRelPath) return;
    TagfetchAPI.clearCache(currentFileRelPath).then(function(data) {
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

  // Сохранение тегов в БД для текущего файла из указанного источника
  function saveFile(source) {
    if (!currentFileRelPath) return;
    TagfetchAPI.saveFile(currentFileRelPath, source).then(function(data) {
      if (data.ok) {
        document.getElementById('currentTags').innerHTML = '<b>DB Tags:</b> <span style="display:inline-flex;flex-wrap:wrap;gap:2px;vertical-align:middle">' + renderDbTags(data.tags) + '</span>';
        var meta = document.getElementById('fileInfo').querySelector('.meta');
        var savedBadge = meta.querySelector('.saved-badge');
        if (savedBadge) savedBadge.remove();
        meta.insertAdjacentHTML('beforeend', '<span class="saved-badge" style="color:var(--success)">✅ Saved</span>');
        updateFileStatus(currentFileRelPath, 'db');
        Shared.notify('Tags saved', 'success');
      }
    });
  }

  // Открытие модального окна "Save All" с предпросмотром кэшированных тегов
  function openSaveAllModal() {
    document.getElementById('saveAllModal').classList.add('open');
    var body = document.getElementById('saveAllBody');
    body.innerHTML = '<div class="loading">⏳ Scanning cache…</div>';
    var stats = document.getElementById('saveAllStats');
    if (stats) stats.textContent = '';
    var execBtn = document.getElementById('saveAllExecBtn');
    execBtn.disabled = true;

    var paths = _fileEntries.map(function(f) { return f.rel_path || f.path; });
    TagfetchAPI.saveAllFetched(paths, true).then(function(data) {
      _saveAllFiles = data.results.filter(function(r) { return r.tags_count > 0; });
      if (_saveAllFiles.length === 0) {
        body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text2)">No cached tags found.<br>Run <b>🔍 Fetch All</b> first, then try again.</div>';
        if (stats) stats.textContent = '';
        return;
      }
      var html = '';
      _saveAllFiles.forEach(function(r, idx) {
        html += '<div class="fetch-result" style="display:flex;align-items:center;gap:4px;padding:3px 0;border-bottom:1px solid var(--border)">' +
          '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">' + Shared.esc(r.name) + '</span>' +
          '<span style="font-size:11px;opacity:.7">' + r.tags_count + ' tags</span></div>';
      });
      body.innerHTML = html;
      if (stats) stats.textContent = _saveAllFiles.length + ' files with cached tags';
      execBtn.disabled = false;
    }).catch(function() {
      body.innerHTML = '<div style="padding:30px;text-align:center;color:var(--danger)">Failed to scan cache</div>';
    });
  }

  // Закрытие модального окна "Save All"
  function closeSaveAllModal() {
    document.getElementById('saveAllModal').classList.remove('open');
  }

  // Выполнение массового сохранения всех кэшированных тегов
  function executeSaveAll() {
    var btn = document.getElementById('saveAllExecBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="fetch-spinner"></span> Saving…';

    var paths = _saveAllFiles.map(function(f) { return f.path; });
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

  // Получение текущего пути в обзорщике
  function getCurrentBrowsePath() { return browsePath; }

  // Инициализация: загрузка обзорщика, навигация стрелками
  function init() {
    browsePath = window.CONFIG && CONFIG.mediaDir || '';
    if (!browsePath) {
      var browser = document.getElementById('browseBrowser');
      if (browser) {
        browser.innerHTML = '<div class="path-item" style="cursor:default;color:var(--text2);text-align:center;padding:30px 12px;flex-direction:column;gap:8px">' +
          '<span style="font-size:28px">📁</span>' +
          '<span style="font-weight:600" data-i18n="tfNoMediaDir">Media directory not set</span>' +
          '<span style="font-size:11px">Go to Settings and configure the media folder</span></div>';
      }
      return;
    }
    loadBrowser(browsePath);

    // Arrow key navigation in file browser
    document.addEventListener('keydown', function(e) {
      var browser = document.getElementById('browseBrowser');
      if (!browser || browser.style.display === 'none') return;
      var isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (isInput) return;
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
    openSaveAllModal: openSaveAllModal,
    closeSaveAllModal: closeSaveAllModal,
    executeSaveAll: executeSaveAll,
    setFilter: setFilter,
    getCurrentBrowsePath: getCurrentBrowsePath,
    renderDbTags: renderDbTags,
    toggleDateSort: toggleDateSort
  };
})();

window.TagfetchManual = TagfetchManual;

// Global aliases for template onclick handlers
window.loadBrowser = TagfetchManual.loadBrowser;
window.getCurrentBrowsePath = TagfetchManual.getCurrentBrowsePath;
window.selectFile = TagfetchManual.selectFile;
window.fetchTags = TagfetchManual.fetchTags;
window.fetchAllFiles = TagfetchManual.fetchAllFiles;
window.cancelFetchAll = TagfetchManual.cancelFetchAll;
window.saveFetchResult = TagfetchManual.saveFetchResult;
window.clearCurrentCache = TagfetchManual.clearCurrentCache;
window.saveFile = TagfetchManual.saveFile;
window.openSaveAllModal = TagfetchManual.openSaveAllModal;
window.closeSaveAllModal = TagfetchManual.closeSaveAllModal;
window.executeSaveAll = TagfetchManual.executeSaveAll;
window.setFilter = TagfetchManual.setFilter;
