var FindOriginals = (function() {
  var _toastTimer = null;

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

  function _modal(html) {
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
    overlay.innerHTML = '<div class="admin-modal-content" style="max-width:800px">' + html + '</div>';
    overlay.classList.add('open');
  }

  function _closeModal() {
    var overlay = document.getElementById('foModal');
    if (overlay) overlay.classList.remove('open');
  }

  function _pollProgress(taskId) {
    _api('/api/find-originals-progress/' + taskId).then(function(data) {
      if (data.status === 'running') {
        var pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0
        _modal(
          '<div class="admin-modal-title">' + _t('findOriginalsRunning') + '</div>' +
          '<p style="color:var(--text2)">' + data.done + '/' + data.total + ' (' + pct + '%)</p>' +
          '<div class="admin-modal-actions"><button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button></div>'
        );
        setTimeout(function() { _pollProgress(taskId); }, 1000);
      } else if (data.status === 'done') {
        var results = data.results || {};
        var count = Object.keys(results).length;
        if (count === 0) {
          _modal(
            '<div class="admin-modal-title">' + _t('noOriginalsFound') + '</div>' +
            '<div class="admin-modal-actions"><button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button></div>'
          );
          return;
        }
        _renderResults(results, count);
      } else if (data.status === 'error') {
        _modal(
          '<div class="admin-modal-title">' + _t('findOriginalsError') + '</div>' +
          '<p style="color:var(--text2)">' + _esc(data.error || '') + '</p>' +
          '<div class="admin-modal-actions"><button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button></div>'
        );
      }
    }).catch(function(e) {
      setTimeout(function() { _pollProgress(taskId); }, 1000);
    });
  }

  function open() {
    _modal(
      '<div class="admin-modal-title">' + _t('findOriginalsRunning') + '</div>' +
      '<p style="color:var(--text2)"><span class="fetch-spinner"></span></p>'
    );
    _api('/api/find-originals', {method:'POST'}).then(function(data) {
      _pollProgress(data.task_id);
    }).catch(function(e) {
      _modal(
        '<div class="admin-modal-title">' + _t('findOriginalsError') + '</div>' +
        '<p style="color:var(--text2)">' + _esc(e.message) + '</p>' +
        '<div class="admin-modal-actions"><button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button></div>'
      );
    });
  }

  function _renderResults(results, count) {
    var entries = Object.entries(results);
    var html = '<div class="admin-modal-title">' + _t('findOriginalsFound', {n: count}) + '</div>' +
      '<div style="max-height:70vh;overflow-y:auto">';
    entries.forEach(function(_ref) {
      var md5 = _ref[0], group = _ref[1];
      html += '<div class="fo-group" style="margin-bottom:16px;border:1px solid var(--border);border-radius:10px;padding:12px">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;font-weight:600">' + _esc(md5) + '</div>';
      // Sample files
      html += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">' + _t('files') + ':</div>';
      html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">';
      group.sample_files.forEach(function(f) {
        var thumbUrl = '/api/thumbnail?path=' + encodeURIComponent(f.path);
        html += '<div style="width:80px;text-align:center">' +
          '<div style="width:80px;height:80px;background:var(--surface2);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center;margin-bottom:2px">' +
          '<img src="' + thumbUrl + '" loading="lazy" style="max-width:80px;max-height:80px;object-fit:contain" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div style="font-size:9px;color:var(--text2);word-break:break-all;line-height:1.2">' + _esc(f.name) + '</div>' +
          '</div>';
      });
      html += '</div>';
      // Originals
      if (group.originals.length > 0) {
        html += '<div style="font-size:11px;color:var(--text2);margin-bottom:4px">' + _t('findOriginalsFound', {n: group.originals.length}) + ':</div>';
        group.originals.forEach(function(orig) {
          var downloadBtnId = 'foDl_' + md5 + '_' + orig.source;
          html += '<div class="fo-original" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:8px;background:var(--surface2);margin-bottom:6px">' +
            '<div style="flex:1;min-width:0">' +
            '<span class="tag-chip" style="font-size:10px;text-transform:uppercase">' + _esc(orig.source) + '</span>' +
            '<div style="font-size:11px;color:var(--text2);margin-top:4px;word-break:break-all">' + _esc(orig.file_url) + '</div>' +
            (orig.tags && orig.tags.length > 0
              ? '<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:4px">' +
                orig.tags.slice(0, 15).map(function(t) {
                  return '<span class="tag-chip" style="font-size:9px">' + _esc(t) + '</span>';
                }).join('') +
                (orig.tags.length > 15 ? '<span style="font-size:9px;color:var(--text2)"> +' + (orig.tags.length - 15) + '</span>' : '') +
                '</div>'
              : '') +
            '</div>' +
            '<button class="action-btn action-btn-primary fo-dl-btn" data-md5="' + md5 + '" data-source="' + _esc(orig.source) + '" data-url="' + _esc(orig.file_url) + '" data-tags="' + _esc(orig.tags.join(',')) + '" style="flex-shrink:0">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
            '<span>' + _t('downloadOriginal') + '</span></button>' +
            '</div>';
        });
      }
      html += '</div>';
    });
    html += '</div>' +
      '<div class="admin-modal-actions"><button class="btn" onclick="FindOriginals._closeModal()">' + _t('close') + '</button></div>';
    _modal(html);
    // Attach download handlers
    document.querySelectorAll('.fo-dl-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var el = e.currentTarget;
        el.disabled = true;
        el.innerHTML = '<span class="fetch-spinner" style="width:14px;height:14px"></span>';
        _api('/api/download-original', {method:'POST', body:{
          md5: el.dataset.md5,
          file_url: el.dataset.url,
          source: el.dataset.source,
          tags: el.dataset.tags ? el.dataset.tags.split(',') : []
        }}).then(function(data) {
          var parent = el.closest('.fo-original');
          if (parent) {
            parent.innerHTML = '<div style="display:flex;align-items:center;gap:8px;color:var(--accent);font-size:13px;font-weight:600">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
              '<span>' + _t('downloadOriginalDone') + '</span></div>';
          }
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
    _t: _t
  };
})();
