var FindOriginals = (function() {
  var _toastTimer = null;
  var _renderedMd5s = {};
  var _taskId = null;
  var _pollTimer = null;
  var _allResults = {};
  var _lbInstance = null;
  var _autoScroll = true;

  function _t(key, params) {
    if (window._i18nData) {
      var lang = document.documentElement.getAttribute('lang') || 'en';
      var d = _i18nData[lang] || _i18nData.en || {};
      var val = d[key];
      if (val !== undefined) {
        if (params) {
          for (var k in params) {
            val = val.replace('{' + k + '}', params[k]);
          }
        }
        return val;
      }
      val = _i18nData.en && _i18nData.en[key];
      if (val !== undefined) {
        if (params) {
          for (var k in params) {
            val = val.replace('{' + k + '}', params[k]);
          }
        }
        return val;
      }
    }
    return key;
  }

  function _toast(msg, type) {
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    var old = document.querySelector('.admin-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'admin-toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    _toastTimer = setTimeout(function() { if (t.parentNode) t.remove(); _toastTimer = null; }, 3000);
  }

  function _esc(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/[&<>"']/g, function(m) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function _api(url, opts) {
    opts = opts || {};
    return fetch(url, {
      method: opts.method || 'GET',
      headers: opts.body ? {'Content-Type':'application/json'} : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r) {
      return r.json().then(function(d) {
        if (!r.ok) { throw new Error(d.error || _t('settingsError')); }
        return d;
      });
    });
  }

  function _closeModal() {
    var overlay = document.getElementById('foModal');
    if (overlay) overlay.classList.remove('open');
  }

  function _ensureModalStructure() {
    var overlay = document.getElementById('foModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'foModal';
      overlay.className = 'admin-modal';
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) _closeModal();
      });
      document.body.appendChild(overlay);
    }
    var content = overlay.querySelector('.admin-modal-content');
    if (!content) {
      var c = document.createElement('div');
      c.className = 'admin-modal-content';
      c.style.cssText = 'max-width:95vw;width:1400px;max-height:90vh;display:flex;flex-direction:column';
      c.innerHTML =
        '<div class="admin-modal-title" id="foTitle" style="flex-shrink:0"></div>' +
        '<div id="foProgressWrap" style="margin:4px 0 6px;flex-shrink:0">' +
        '<div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">' +
        '<div id="foProgressFill" style="height:100%;width:0%;background:var(--accent);border-radius:3px;transition:width .3s"></div></div>' +
        '<div id="foProgressText" style="font-size:11px;color:var(--text2);margin-top:2px"></div>' +
        '</div>' +
        '<div id="foBody" style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding-right:4px"></div>' +
        '<div class="admin-modal-actions" id="foActions" style="flex-shrink:0;margin-top:6px;display:flex;justify-content:space-between;align-items:center">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<button class="btn btn-danger" id="foCancelBtn" onclick="FindOriginals._cancelSearch()">' + _t('cancel') + '</button>' +
        '<button class="btn" id="foAutoScrollBtn" onclick="FindOriginals._toggleAutoScroll()" style="font-size:11px;display:flex;align-items:center;gap:4px">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>' +
        '<span>' + _t('autoScroll') + '</span></button>' +
        '</div>' +
        '<button class="btn action-btn-primary" id="foReplaceAllBtn" disabled onclick="FindOriginals._replaceAll()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        '<span>' + _t('replaceAll') + '</span></button>' +
        '</div>';
      overlay.appendChild(c);
    }
    overlay.classList.add('open');
    return overlay;
  }

  function _setProgress(pct, text) {
    var fill = document.getElementById('foProgressFill');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
    var txt = document.getElementById('foProgressText');
    if (txt) txt.textContent = text || '';
  }

  function _showCloseButton() {
    var actions = document.getElementById('foActions');
    if (!actions) return;
    actions.innerHTML =
      '<div>' +
      '<button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button>' +
      '</div>' +
      '<button class="btn action-btn-primary" id="foReplaceAllBtn" onclick="FindOriginals._replaceAll()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
      '<span>' + _t('replaceAll') + '</span></button>';
  }

  function _toggleAutoScroll() {
    _autoScroll = !_autoScroll;
    var btn = document.getElementById('foAutoScrollBtn');
    if (btn) {
      btn.style.opacity = _autoScroll ? '1' : '0.4';
      btn.title = _autoScroll ? _t('autoScrollOn') : _t('autoScrollOff');
    }
  }

  function _openLightbox(md5, sampleIdx) {
    var group = _allResults[md5];
    if (!group) return;
    var files = group.sample_files.map(function(f, i) {
      return { path: f.path, name: f.name, tags: '', width: 0, height: 0 };
    });
    var idx = sampleIdx || 0;
    if (!_lbInstance) {
      _lbInstance = new Lightbox({
        prefix: 'fo',
        tagPanel: false,
        arrowNav: true,
        mediaUrlFn: function(path) {
          return '/api/media?path=' + encodeURIComponent(path);
        }
      });
    }
    _lbInstance.open(idx, files);
  }

  function _buildCardHtml(md5, group) {
    var sample = group.sample_files[0];
    var sampleUrl = sample ? '/api/thumbnail?path=' + encodeURIComponent(sample.path) + '&size=600' : '';
    var cardId = 'foCard_' + md5;

    // Tags (deduplicated across all originals)
    var allTags = [];
    group.originals.forEach(function(orig) {
      if (orig.tags) orig.tags.forEach(function(t) { if (allTags.indexOf(t) === -1) allTags.push(t); });
    });

    // Card height determined by tags + originals content; sample fills height
       var html = '<div id="' + cardId + '" class="fo-card" style="display:flex;gap:12px;border-radius:12px;background:var(--surface2);padding:10px;flex-shrink:0;align-items:stretch">';

      // LEFT: sample photo fills card height (stretched by flex)
      if (sampleUrl) {
        html += '<div class="fo-sample-wrap" style="width:35%;flex-shrink:0;overflow:hidden;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="FindOriginals._openLightbox(\'' + _esc(md5) + '\',0)">' +
          '<img src="' + sampleUrl + '" loading="lazy" style="width:100%;height:100%;object-fit:contain;display:block">' +
          '</div>';
      }

      // MIDDLE: tags (determines card height)
      html += '<div style="width:20%;flex-shrink:0;display:flex;flex-direction:column;gap:6px;padding-right:4px">';
      html += '<div style="font-size:10px;color:var(--text2);font-weight:600;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0">' + _esc(md5) + '</div>';
      if (allTags.length > 0) {
        html += '<div class="fo-tags" style="display:flex;flex-wrap:wrap;gap:3px">';
        allTags.forEach(function(t) {
          html += '<span class="tag-chip" style="font-size:12px;padding:2px 7px;background:var(--surface);color:var(--text);border-radius:5px;font-weight:500;line-height:1.3">' + _esc(t) + '</span>';
        });
        html += '</div>';
      } else {
        html += '<div style="font-size:11px;color:var(--text2)">' + _t('noOriginalsFound') + '</div>';
      }
      html += '</div>';

      // RIGHT: originals with normal-size preview + source label below
      html += '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;overflow-y:auto;padding-right:4px">';
      group.originals.forEach(function(orig) {
        var origUrl = _esc(orig.file_url);
        var sourceDir = 'unknown';
        var displaySource = 'unknown';
        if (orig.source === 'r34' || orig.source === 'rule34') {
          sourceDir = 'rule34';
          displaySource = 'Rule34';
        } else if (orig.source === 'danbooru' || orig.source === 'dan') {
          sourceDir = 'danbooru';
          displaySource = 'Danbooru';
        } else if (orig.source) {
          sourceDir = orig.source;
          displaySource = orig.source.charAt(0).toUpperCase() + orig.source.slice(1);
        }
        html += '<div class="fo-original-entry" style="border-radius:8px;background:var(--surface);padding:8px;flex-shrink:0">' +
          '<img src="' + origUrl + '" loading="lazy" style="width:100%;max-height:260px;object-fit:contain;display:block;border-radius:6px;background:var(--surface2)" onerror="this.style.display=\'none\'">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-top:6px">' +
          '<span class="tag-chip" style="font-size:10px;text-transform:uppercase;background:var(--accent-glow);color:var(--accent);padding:2px 6px;border-radius:4px;font-weight:600">' + _esc(displaySource) + '</span>' +
          '<span style="font-size:10px;color:var(--text2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + origUrl + '</span>' +
          '<button class="action-btn action-btn-primary fo-dl-btn" data-md5="' + md5 + '" data-source="' + _esc(sourceDir) + '" data-url="' + origUrl + '" data-tags="' + _esc(orig.tags.join(',')) + '" data-original-source="' + _esc(orig.source) + '" style="flex-shrink:0;font-size:11px;padding:4px 8px">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          '<span>' + _t('downloadOriginal') + '</span></button>' +
          '</div></div>';
      });
      html += '</div>';

      html += '</div>';
      return html;
  }

  function _appendResults(results) {
    var body = document.getElementById('foBody');
    if (!body) return;
    var hasNew = false;
    Object.entries(results).forEach(function(_ref) {
      var md5 = _ref[0], group = _ref[1];
      if (_renderedMd5s[md5]) return;
      _renderedMd5s[md5] = true;
      if (!_allResults[md5]) _allResults[md5] = group;
      hasNew = true;
      body.insertAdjacentHTML('beforeend', _buildCardHtml(md5, group));
    });
    if (hasNew) {
      _attachDownloadHandlers();
      if (_autoScroll) {
        var cards = body.querySelectorAll('.fo-card');
        var lastCard = cards[cards.length - 1];
        if (lastCard) {
          setTimeout(function() {
            lastCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      }
    }
    var count = Object.keys(_allResults).length;
    var title = document.getElementById('foTitle');
    if (title && count > 0) title.textContent = _t('findOriginalsFound', {n: count});
  }

  function _pollProgress(taskId) {
    _api('/api/find-originals-progress/' + taskId).then(function(data) {
      var pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0;
      _setProgress(pct, data.done + '/' + data.total);
      if (data.status === 'running') {
        if (data.results) _appendResults(data.results);
        _pollTimer = setTimeout(function() { _pollProgress(taskId); }, 1000);
      } else if (data.status === 'done') {
        if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
        _setProgress(100, data.done + '/' + data.total);
        if (data.results) _appendResults(data.results);
        _showCloseButton();
        var count = Object.keys(_allResults).length;
        var title = document.getElementById('foTitle');
        if (count === 0) {
          if (title) title.textContent = _t('noOriginalsFound');
        } else {
          if (title) title.textContent = _t('findOriginalsFound', {n: count});
        }
      } else if (data.status === 'cancelled') {
        if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
        _setProgress(pct, _t('cancelled'));
        _showCloseButton();
        var title = document.getElementById('foTitle');
        if (title) title.textContent = _t('cancelled');
      } else if (data.status === 'error') {
        if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
        _showCloseButton();
        var title = document.getElementById('foTitle');
        if (title) title.textContent = _t('findOriginalsError');
        _setProgress(0, data.error || '');
      }
    }).catch(function(e) {
      if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
      _showCloseButton();
      var title = document.getElementById('foTitle');
      if (title) title.textContent = _t('findOriginalsError');
      _setProgress(0, e.message);
    });
  }

  function _cancelSearch() {
    if (!_taskId) return;
    var btn = document.getElementById('foCancelBtn');
    if (btn) btn.disabled = true;
    _api('/api/find-originals-cancel/' + _taskId, {method:'POST'}).then(function() {
      if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
      _showCloseButton();
      var title = document.getElementById('foTitle');
      if (title) title.textContent = _t('cancelled');
      _setProgress(0, _t('cancelled'));
    }).catch(function(e) {
      if (btn) btn.disabled = false;
      _toast(e.message, 'error');
    });
  }

  function _replaceAll() {
    var btn = document.getElementById('foReplaceAllBtn');
    if (btn) btn.disabled = true;
    var promises = [];
    Object.keys(_allResults).forEach(function(md5) {
      var group = _allResults[md5];
      // Priority: Danbooru > Rule34 (one download per MD5)
      var best = group.originals.find(function(o) { return o.source === 'danbooru'; })
        || group.originals[0];
      if (best) {
        promises.push(
          _api('/api/download-original', {method:'POST', body:{
            md5: md5,
            file_url: best.file_url,
            source: best.source,
            tags: best.tags || []
          }}).then(function() {
            _toast(_t('downloadOriginalDone'), 'success');
          }).catch(function(e) {
            _toast(e.message, 'error');
          })
        );
      }
    });
    Promise.all(promises).then(function() {
      if (btn) btn.disabled = false;
      _toast(_t('replaceAllDone'), 'success');
    }).catch(function() {
      if (btn) btn.disabled = false;
    });
  }

  function open() {
    _renderedMd5s = {};
    _allResults = {};
    _taskId = null;
    _autoScroll = true;
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
    _ensureModalStructure();
    var title = document.getElementById('foTitle');
    if (title) title.textContent = _t('findOriginalsRunning');
    _setProgress(0, '');
    var body = document.getElementById('foBody');
    if (body) body.innerHTML = '';
    var actions = document.getElementById('foActions');
    if (actions) {
      actions.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<button class="btn btn-danger" id="foCancelBtn" onclick="FindOriginals._cancelSearch()">' + _t('cancel') + '</button>' +
        '<button class="btn" id="foAutoScrollBtn" onclick="FindOriginals._toggleAutoScroll()" style="font-size:11px;display:flex;align-items:center;gap:4px">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>' +
        '<span>' + _t('autoScroll') + '</span></button>' +
        '</div>' +
        '<button class="btn action-btn-primary" id="foReplaceAllBtn" disabled>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>' +
        '<span>' + _t('replaceAll') + '</span></button>';
    }
    _api('/api/find-originals', {method:'POST'}).then(function(data) {
      _taskId = data.task_id;
      _pollProgress(data.task_id);
    }).catch(function(e) {
      _showCloseButton();
      if (title) title.textContent = _t('findOriginalsError');
      _setProgress(0, e.message);
    });
  }

  function _attachDownloadHandlers() {
    document.querySelectorAll('.fo-dl-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var el = e.currentTarget;
        el.disabled = true;
        el.innerHTML = '<span class="fetch-spinner" style="width:14px;height:14px"></span>';
        _api('/api/download-original', {method:'POST', body:{
          md5: el.dataset.md5,
          file_url: el.dataset.url,
          source: el.dataset.originalSource || el.dataset.source,
          tags: el.dataset.tags ? el.dataset.tags.split(',') : []
        }}).then(function() {
          var parent = el.closest('.fo-original-row');
          if (parent) {
            parent.style.opacity = '0.5';
            var done = parent.querySelector('.fo-dl-done');
            if (!done) {
              done = document.createElement('div');
              done.className = 'fo-dl-done';
              done.style.cssText = 'display:flex;align-items:center;gap:4px;color:var(--accent);font-size:11px;font-weight:600;margin-left:auto';
              done.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
                '<span>' + _t('downloadOriginalDone') + '</span>';
              el.parentNode.appendChild(done);
            }
          }
          el.remove();
          _toast(_t('downloadOriginalDone'), 'success');
        }).catch(function(e) {
          el.disabled = false;
          el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            '<span>' + _t('downloadOriginal') + '</span>';
          _toast(e.message, 'error');
        });
      });
    });
  }

  return {
    open: open,
    _closeModal: _closeModal,
    _cancelSearch: _cancelSearch,
    _replaceAll: _replaceAll,
    _openLightbox: _openLightbox,
    _toggleAutoScroll: _toggleAutoScroll,
    _t: _t
  };
})();
