// ============================================================
// Автосканирование Tagfetch: SSE-поток с результатами,
// карточки с тегами, сохранение результатов
// ============================================================
var TagfetchAuto = (function() {
  var _autoResults = [];
  var _autoAbortController = null;
  var _autoScroll = true;

  // Создание HTML-чипса для тега с цветом категории
  function makeTagChip(tag, colors) {
    var color = colors && colors[tag] || '';
    var style = color ? 'color:' + color + ';background:' + color + '22' : '';
    return '<span class="auto-tag" style="' + style + '">' + Shared.esc(tag) + '</span>';
  }

  // Показ/скрытие кнопок сохранения авто-результатов
  function showAutoSave(count) {
    var show = count > 0;
    var ba = document.getElementById('autoActions');
    var bat = document.getElementById('autoActionsTop');
    if (ba) ba.classList.toggle('hidden', !show);
    if (bat) bat.classList.toggle('hidden', !show);
    var bs = document.getElementById('autoSaveStats');
    if (bs) bs.textContent = count + ' files with tags';
    var bst = document.getElementById('autoSaveStatsTop');
    if (bst) bst.textContent = count + ' files with tags';
  }

  // SharedGrid instance (lazy)
  var _sharedGrid = null;

  // Lazy-init SharedGrid on #autoGrid
  function getSharedGrid() {
    if (_sharedGrid) return _sharedGrid;
    var el = document.getElementById('autoGrid');
    if (!el) return null;
    _sharedGrid = new SharedGrid(el, {
      layout: 'grid',
      getItemHtml: getAutoCardHtml,
      onItemClick: function() {}
    });
    return _sharedGrid;
  }

  // Генерация HTML карточки для SharedGrid.getItemHtml
  function getAutoCardHtml(data) {
    var ext = (data.name || '').split('.').pop().toLowerCase();
    var isVideo = ['mp4','webm','mov','avi','mkv'].indexOf(ext) !== -1;
    var thumbUrl = '/api/thumbnail?path=' + encodeURIComponent(data.path) + _cbSuffix();

    var sections = [
      ['dan_artist', '🎨 Artist', 'artist'],
      ['dan_character', '👤 Character', 'character'],
      ['dan_copyright', '📚 Series', 'copyright'],
      ['dan_meta', '# Meta', 'meta'],
      ['dan_general', '🏷️ General', 'general'],
    ];
    var tagHtml = '';
    var seenTags = {};
    sections.forEach(function(s) {
      var tags = data[s[0]] || [];
      if (!tags.length) return;
      tagHtml += '<div class="auto-sec-group">';
      tagHtml += '<span class="auto-sec-label">' + s[1] + '</span>';
      tags.forEach(function(t) { seenTags[t] = true; tagHtml += makeTagChip(t, data.tag_colors || {}); });
      tagHtml += '</div>';
    });
    var r34 = data.r34_tags || [];
    var uniqueR34 = r34.filter(function(t) { return !seenTags[t]; });
    if (uniqueR34.length) {
      tagHtml += '<div class="auto-sec-group">';
      tagHtml += '<span class="auto-sec-label">Rule34</span>';
      uniqueR34.forEach(function(t) { tagHtml += makeTagChip(t, data.tag_colors || {}); });
      tagHtml += '</div>';
    }

    var tagCount = 0;
    sections.forEach(function(s) { tagCount += (data[s[0]] || []).length; });
    tagCount += (data.r34_tags || []).length;

    var imgSrc = thumbUrl;
    var imgErr = isVideo ? '<span class=placeholder>🎬 video</span>' : '<span class=placeholder>🚫</span>';

    return '<div class="auto-card" data-path="' + Shared.esc(data.path) + '" data-tag-count="' + tagCount + '">' +
      '<div class="auto-card-img">' +
        '<img src="' + imgSrc + '" alt="" loading="lazy" onerror="this.outerHTML=\'' + imgErr + '\'">' +
        (isVideo ? '<span class="video-badge">🎬</span>' : '') +
      '</div>' +
      '<div class="auto-card-body">' +
        '<div class="auto-card-name">' + Shared.esc(data.name) + '</div>' +
        '<div class="auto-card-tags">' + tagHtml + '</div>' +
      '</div>' +
    '</div>';
  }

  // После загрузки картинки — ставим fallback для сломанных
  function applyCardClass(card) {
    var img = card.querySelector('img');
    if (!img || !img.complete) return;
  }

  // Добавление карточки результата автосканирования через SharedGrid
  function addAutoCard(data) {
    var g = getSharedGrid();
    if (!g) return;
    g.addItem(data);

    // Aspect-ratio class после загрузки картинки
    var cards = g._container.querySelectorAll('.auto-card');
    var card = cards[cards.length - 1];
    if (card) {
      var img = card.querySelector('img');
      if (img) {
        if (img.complete) {
          applyCardClass(card);
        } else {
          img.addEventListener('load', function() { applyCardClass(card); });
        }
      }
    }

    if (_autoScroll) {
      var content = g._container.closest('.auto-content');
      if (content) content.scrollTop = content.scrollHeight;
    }

    attachAutoHover();
  }

  // --- Hover preview for video cards ---
  var _hoverEl = null;
  var _previewOverlay = null;

  // Остановка hover-превью видео
  function stopPreview() {
    if (_previewOverlay) { _previewOverlay.remove(); _previewOverlay = null; }
  }

  // Запуск hover-превью для видео-карточки
  function playPreview(card) {
    var path = card.dataset.path;
    var name = (path || '').split('/').pop() || (path || '');
    var ext = name.split('.').pop().toLowerCase();
    var isVid = ['mp4','webm','mov','avi','mkv'].indexOf(ext) !== -1;
    if (!isVid) return;
    var wrap = card.querySelector('.auto-card-img');
    if (!wrap) return;
    stopPreview();
    var overlay = document.createElement('div');
    overlay.className = 'auto-hover-preview';
    wrap.appendChild(overlay);
    _previewOverlay = overlay;
    var url = '/api/media?path=' + encodeURIComponent(path) + _cbSuffix();
    var video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    overlay.appendChild(video);
    video.play().catch(function() {});
  }

  // Подписка на hover-события для сетки авто-карточек (один раз)
  function attachAutoHover() {
    var grid = document.getElementById('autoGrid');
    if (!grid || grid.dataset.hoverAttached) return;
    grid.dataset.hoverAttached = '1';
    grid.addEventListener('mouseover', function(e) {
      var card = e.target.closest('.auto-card');
      if (!card || card === _hoverEl) return;
      if (_hoverEl) stopPreview();
      _hoverEl = card;
      playPreview(card);
    });
    grid.addEventListener('mouseout', function(e) {
      var related = e.relatedTarget;
      if (related && related.closest && related.closest('.auto-card')) return;
      _hoverEl = null;
      stopPreview();
    });
  }

  // Включение/выключение авто-скролла к новым карточкам
  function toggleAutoScroll() {
    _autoScroll = !_autoScroll;
    var btn = document.getElementById('autoScrollBtn');
    if (btn) btn.innerHTML = Shared.t(_autoScroll ? 'tfScrollOn' : 'tfScrollOff');
  }

  // Запуск автосканирования: SSE-поток, обработка progress-событий,
  // отображение карточек и нотификаций
  function startAutoScan() {
    var btn = document.getElementById('autoScanBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Scanning…';
    var cancelBtn = document.getElementById('cancelAutoBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    var scBtn = document.getElementById('saveCancelAutoBtn');
    if (scBtn) scBtn.classList.remove('hidden');
    var grid = document.getElementById('autoGrid');
    var g = getSharedGrid();
    if (g) g.setLoading(true);
    var ba = document.getElementById('autoActions');
    if (ba) ba.classList.add('hidden');
    var bat = document.getElementById('autoActionsTop');
    if (bat) bat.classList.add('hidden');
    var bs = document.getElementById('autoStats');
    if (bs) bs.textContent = '0 files scanned';
    _autoResults = [];
    _autoAbortController = new AbortController();

    TagfetchAPI.autoScan(null, _autoAbortController.signal).then(function(response) {
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buf = '';
      var found = 0;
      var totalScanned = 0;
      var totalSkipped = 0;

      // Освобождение кнопок управления после завершения (done/cancel/error)
      function releaseControls() {
        btn.disabled = false;
        btn.innerHTML = Shared.t('tfStartAuto');
        if (cancelBtn) cancelBtn.classList.add('hidden');
        var scb = document.getElementById('saveCancelAutoBtn');
        if (scb) scb.classList.add('hidden');
        _autoAbortController = null;
      }

      function read() {
        reader.read().then(function(result) {
          if (result.done) {
            releaseControls();
            return;
          }
          buf += decoder.decode(result.value, {stream: true});
          var lines = buf.split('\n');
          buf = lines.pop();
          lines.forEach(function(line) {
            if (!line.trim()) return;
            try {
              var raw = line.trim();
              if (raw.startsWith('data: ')) raw = raw.slice(6);
              var data = JSON.parse(raw);
              if (data.type === 'progress') {
                totalScanned = data.index || totalScanned;
                var total = data.total || 0;
                if (data.status === 'ok') {
                  addAutoCard(data);
                  _autoResults.push(data);
                  found++;
                  var tagParts = [];
                  if ((data.dan_artist || []).length) tagParts.push(data.dan_artist.slice(0, 2).join(', '));
                  if ((data.dan_character || []).length) tagParts.push(data.dan_character.slice(0, 2).join(', '));
                  if ((data.dan_copyright || []).length) tagParts.push(data.dan_copyright.slice(0, 2).join(', '));
                  var ntfMsg = tagParts.length ? tagParts.join(' · ') : data.name;
                  if (ntfMsg.length > 70) ntfMsg = ntfMsg.slice(0, 67) + '...';
                  Shared.notify(ntfMsg, 'success');
                  Shared.playChime();
                } else if (data.status === 'skip' || data.status === 'no_tags') {
                  totalSkipped++;
                }
                if (bs) bs.textContent = totalScanned + '/' + total + ' scanned, ' + found + ' found, ' + totalSkipped + ' skipped';
              } else if (data.type === 'done') {
                var doneMsg = '✅ Done — ' + found + ' found, ' + totalSkipped + ' skipped' + (totalScanned > 0 ? ', ' + totalScanned + ' scanned' : '');
                if (bs) bs.textContent = doneMsg;
                releaseControls();
                if (_autoResults.length) saveAllAutoResults();
              }
            } catch(e) {}
          });
          read();
        }).catch(function(err) {
          if (err.name === 'AbortError') {
            // Аборт — сброс кнопок не делаем, saveAndCancelAuto/saveAllAutoResults управляют сам
          } else {
            releaseControls();
            if (bs) bs.textContent = '❌ Scan failed';
          }
        });
      }
      read();
    }).catch(function(err) {
      if (err.name !== 'AbortError') {
        if (bs) bs.textContent = '❌ Scan failed';
        releaseControls();
      }
    });
  }

  // Отмена автосканирования через AbortController
  function cancelAutoScan() {
    if (_autoAbortController) {
      _autoAbortController.abort();
      _autoAbortController = null;
    }
  }

  // Отмена сканирования и немедленное сохранение уже полученных результатов
  function saveAndCancelAuto() {
    cancelAutoScan();
    document.getElementById('saveCancelAutoBtn').classList.add('hidden');
    var cb = document.getElementById('cancelAutoBtn');
    if (cb) cb.classList.add('hidden');
    var bs = document.getElementById('autoStats');
    if (bs) bs.textContent = _autoResults.length ? '⛔ Cancelled, saving…' : '⛔ Cancelled';
    if (_autoResults.length) {
      showAutoSave(_autoResults.length);
      saveAllAutoResults();
    } else {
      var sb = document.getElementById('autoScanBtn');
      if (sb) { sb.disabled = false; sb.innerHTML = Shared.t('tfStartAuto'); }
      showAutoSave(0);
    }
  }

  // Сохранение всех накопленных авто-результатов (последовательно)
  function saveAllAutoResults() {
    var btn = document.getElementById('autoSaveAllBtn');
    var btnTop = document.getElementById('autoSaveAllBtnTop');
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Saving…'; }
    if (btnTop) { btnTop.disabled = true; btnTop.innerHTML = '⏳ Saving…'; }
    var saved = 0;
    var total = _autoResults.length;
    var idx = 0;

    function saveNext() {
      if (idx >= _autoResults.length) {
        if (btn) btn.innerHTML = '✅ Done';
        if (btnTop) btnTop.innerHTML = '✅ Done';
        var sb = document.getElementById('autoScanBtn');
      if (sb) { sb.disabled = false; sb.innerHTML = Shared.t('tfStartAuto'); }
        var as = document.getElementById('autoStats');
        if (as) as.textContent = '✅ Saved ' + saved + '/' + total;
        var bs = document.getElementById('autoSaveStats');
        if (bs) bs.textContent = 'Saved ' + saved + '/' + total;
        var bst = document.getElementById('autoSaveStatsTop');
        if (bst) bst.textContent = 'Saved ' + saved + '/' + total;
        return;
      }
      var r = _autoResults[idx];
      TagfetchAPI.saveFile(r.path, 'both').then(function(data) {
        if (data.ok) {
          saved++;
          var card = document.querySelector('.auto-card[data-path="' + r.path.replace(/"/g,'\\"') + '"]');
          if (card) card.classList.add('saved');
          if (saved % 5 === 0 || idx === _autoResults.length - 1) {
            Shared.notify('Saved ' + saved + '/' + total, 'success');
          }
        }
        idx++;
        var bs = document.getElementById('autoSaveStats');
        if (bs) bs.textContent = 'Saving: ' + idx + '/' + total;
        var bst = document.getElementById('autoSaveStatsTop');
        if (bst) bst.textContent = 'Saving: ' + idx + '/' + total;
        setTimeout(saveNext, 300);
      }).catch(function() {
        idx++;
        setTimeout(saveNext, 300);
      });
    }
    saveNext();
  }

  return {
    startAutoScan: startAutoScan,
    cancelAutoScan: cancelAutoScan,
    saveAndCancelAuto: saveAndCancelAuto,
    saveAllAutoResults: saveAllAutoResults,
    toggleAutoScroll: toggleAutoScroll
  };
})();

window.TagfetchAuto = TagfetchAuto;

// Global aliases for template onclick handlers
window.startAutoScan = TagfetchAuto.startAutoScan;
window.cancelAutoScan = TagfetchAuto.cancelAutoScan;
window.saveAndCancelAuto = TagfetchAuto.saveAndCancelAuto;
window.saveAllAutoResults = TagfetchAuto.saveAllAutoResults;
window.toggleAutoScroll = TagfetchAuto.toggleAutoScroll;
