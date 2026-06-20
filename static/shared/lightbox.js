/* ─── Shared Lightbox ───
 * Extracted from MediaVault gallery lightbox.
 * Used by MV gallery (tag panel enabled) and Content Management (tag panel disabled).
 *
 * Usage:
 *   var lb = new Lightbox({ prefix: 'cm' });  // CM: no tag panel
 *   lb.open(index, data);                      // data = [{path, name, width, height, tags}]
 *
 *   var mv = new Lightbox({                    // MV: with tag panel
 *     prefix: 'lb',
 *     tagPanel: true,
 *     mediaUrlFn: MediaVaultAPI.mediaUrl,
 *     nameFn: function(f) { return f.name; },
 *     onSaveTags: function(path, tags) { ... },
 *     onSearchByTag: function(tag) { ... },
 *     onRefreshItem: function(path, tags) { ... }
 *   });
 */
var Lightbox = (function() {
  var _idxCounter = 0;

  function Lightbox(opts) {
    opts = opts || {};
    this._prefix = opts.prefix || 'lb';
    this._tagPanel = opts.tagPanel === true;
    this._data = [];
    this._index = -1;
    this._fullscreen = false;
    this._zoomMode = 'fit';
    this._zoomScale = 1;
    this._panX = 0;
    this._panY = 0;
    this._dragState = null;
    this._lastDragTime = 0;
    this._hideTimer = null;
    this._deleteMode = false;
    this._deleteSelected = [];
    this._deleteMode = false;
    this._uniqueId = (++_idxCounter) + '_' + Date.now();
    this._mediaUrlFn = opts.mediaUrlFn || function(path) { var b = window.CONFIG && CONFIG.cacheBuster; return '/api/media?path=' + encodeURIComponent(path) + (b ? '&cb=' + b : ''); };
    this._nameFn = opts.nameFn || function(f) { return f.name || f.path.split('/').pop(); };
    this._onSaveTags = opts.onSaveTags || null;
    this._onSearchByTag = opts.onSearchByTag || null;
    this._onRefreshItem = opts.onRefreshItem || null;
    this._onNavigate = opts.onNavigate || null;
    this._onClose = opts.onClose || null;
    this._readonly = opts.readonly || false;
    this._onDownload = opts.onDownload || null;
    this._downloadLabelFn = opts.downloadLabelFn || null;
    this._hexToRgba = opts.hexToRgba || function(hex, a) { 
      var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return 'rgba('+r+','+g+','+b+','+a+')';
    };
    this._getVisualOrderFn = opts.getVisualOrderFn || function() { return []; };
    this._getFilteredDataFn = opts.getFilteredDataFn || function() { return []; };
    this._getCatListFn = opts.getCatListFn || function() { return []; };
    this._getTagCategoryNameFn = opts.getTagCategoryNameFn || function() { return ''; };
    this._galleryRefreshFn = opts.galleryRefreshFn || null;
    this._gallerySetSearchFn = opts.gallerySetSearchFn || null;
    this._galleryApplyFilterFn = opts.galleryApplyFilterFn || null;
    this._eventsBound = false;
  }

  Lightbox.prototype._id = function(name) {
    return this._prefix + name.charAt(0).toUpperCase() + name.slice(1);
  };

  Lightbox.prototype._el = function(name) {
    return document.getElementById(this._id(name));
  };

  Lightbox.prototype._ensureDOM = function() {
    var id = this._id('Overlay');
    if (document.getElementById(id)) return;

    var overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'shared-lightbox';

    var panelHtml = this._tagPanel
      ? '<div class="lightbox-panel" id="' + this._id('Panel') + '"></div>'
      : '';

    overlay.innerHTML =
      '<div class="sl-overlay-bg"></div>' +
      '<button class="lightbox-close" id="' + this._id('Close') + '">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="lightbox-content">' +
        '<div class="lightbox-media" id="' + this._id('Media') + '">' +
          '<div class="lb-nav-zone left" id="' + this._id('NavLeft') + '"></div>' +
          '<div class="lb-nav-zone right" id="' + this._id('NavRight') + '"></div>' +
        '</div>' +
        '<div class="lightbox-toolbar" id="' + this._id('Toolbar') + '">' +
          '<button id="' + this._id('ZoomOutBtn') + '" title="Zoom Out"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>' +
          '<span class="zoom-level" id="' + this._id('ZoomLevel') + '">100%</span>' +
          '<span class="lb-pos" id="' + this._id('Position') + '"></span>' +
          '<button id="' + this._id('ZoomInBtn') + '" title="Zoom In"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="12" y1="5" x2="12" y2="19"/></svg></button>' +
          '<button id="' + this._id('ZoomResetBtn') + '" title="Reset Zoom"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg></button>' +
          '<button id="' + this._id('ScrollModeBtn') + '" title="Scroll Mode"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="m8 6 4-4 4 4"/><path d="M12 2v20"/><path d="m8 18 4 4 4-4"/></svg></button>' +
          (this._tagPanel
            ? '<button id="' + this._id('StandaloneViewBtn') + '" title="Open in new tab"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>'
            : '') +
        '</div>' +
        panelHtml +
      '</div>';

    document.body.appendChild(overlay);
  };

  Lightbox.prototype._bindEvents = function() {
    if (this._eventsBound) return;
    this._eventsBound = true;
    var self = this;
    var overlay = this._el('Overlay');
    if (!overlay) return;

    this._el('Close').addEventListener('click', function() { self.close(); });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay || e.target.closest('.sl-overlay-bg')) {
        if (Date.now() - self._lastDragTime > 200) self.close();
      }
    });

    overlay.addEventListener('mousemove', function() { self._resetHideTimer(); });
    overlay.addEventListener('touchstart', function() { self._resetHideTimer(); }, { passive: true });

    var media = this._el('Media');

    this._el('ZoomInBtn').addEventListener('click', function() { self._zoomIn(); });
    this._el('ZoomOutBtn').addEventListener('click', function() { self._zoomOut(); });
    this._el('ZoomResetBtn').addEventListener('click', function() {
      var img = media.querySelector('img');
      if (img) {
        self._resetZoom(img);
        if (img.naturalWidth) self._sizeLb(img.naturalWidth, img.naturalHeight);
      }
    });
    this._el('ScrollModeBtn').addEventListener('click', function() { self._toggleScrollMode(); });

    if (this._tagPanel) {
      var standaloneBtn = this._el('StandaloneViewBtn');
      if (standaloneBtn) {
        standaloneBtn.addEventListener('click', function() {
          if (self._data && self._data[self._index]) {
            var path = self._data[self._index].path;
            var paths = self._getVisualOrderFn();
            var orderParam = paths.length > 1 ? '&order=' + encodeURIComponent(paths.join('|')).slice(0, 8000) : '';
            window.open('/mediavault/view?path=' + encodeURIComponent(path) + orderParam, '_blank');
          }
        });
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      var lb = document.getElementById(self._id('Overlay'));
      if (!lb || !lb.classList.contains('open')) return;
      if (e.key === 'Escape') { self.close(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); self._prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); self._next(); }
    });

    // Wheel zoom
    media.addEventListener('wheel', function(e) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); e.deltaY < 0 ? self._zoomIn() : self._zoomOut(); }
    }, { passive: false });

    // Click to toggle zoom
    media.addEventListener('click', function(e) {
      if (e.target.tagName === 'IMG' && e.target.classList.contains('zoom-fit') && (!self._dragState || !self._dragState.grabbed)) self._toggleZoom();
    });

    // Navigation zones
    this._el('NavLeft').addEventListener('click', function(e) { e.stopPropagation(); self._prev(); });
    this._el('NavRight').addEventListener('click', function(e) { e.stopPropagation(); self._next(); });

    if (this._tagPanel) {
      // Tag input events
      document.addEventListener('input', function(e) {
        if (e.target.id === self._id('TagInput')) {
          self._showAutocomplete(e.target.value);
        }
      });
      document.addEventListener('focusin', function(e) {
        if (e.target.id === self._id('TagInput')) {
          if (!e.target.value) self._showRelatedTags();
        }
      });
      document.addEventListener('click', function(e) {
        var chip = e.target.closest('#' + self._id('Panel') + ' .tag-chip');
        if (chip) {
          if (self._deleteMode) {
            self._toggleTagDeletion(chip.dataset.tag);
          } else if (self._onSearchByTag) {
            var tag = chip.dataset.tag;
            if (self._gallerySetSearchFn) self._gallerySetSearchFn(tag);
            if (self._galleryApplyFilterFn) self._galleryApplyFilterFn();
            self.close();
          }
        }
      });
      // Tag input Enter
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.target.id === self._id('TagInput')) {
          self._addTagFromInput();
        }
      });
    }

    // Drag-to-pan
    this._initDragPan(media);

    // Touch swipe
    (function() {
      var _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;
      media.addEventListener('touchstart', function(e) {
        var t = e.changedTouches[0];
        _touchStartX = t.screenX;
        _touchStartY = t.screenY;
        _touchStartTime = Date.now();
      }, { passive: true });
      media.addEventListener('touchend', function(e) {
        var dt = Date.now() - _touchStartTime;
        if (dt > 400) return;
        var t = e.changedTouches[0];
        var dx = t.screenX - _touchStartX;
        var dy = t.screenY - _touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (dx < 0) self._next(); else self._prev();
      }, { passive: true });
    })();

    // Resize
    (function() {
      var resizeRAF;
      window.addEventListener('resize', function() {
        cancelAnimationFrame(resizeRAF);
        resizeRAF = requestAnimationFrame(function() {
          if (document.getElementById(self._id('Overlay')).classList.contains('open')) {
            self._sizeAuto();
          }
        });
      });
    })();
  };

  /* ─── OPEN / CLOSE ─── */

  Lightbox.prototype.open = function(index, data) {
    this._ensureDOM();
    this._bindEvents();
    this._data = data || this._data;
    if (!this._data.length || index < 0 || index >= this._data.length) return;
    this._index = index;
    var file = this._data[index];
    var overlay = this._el('Overlay');

    // Zoom-from-thumbnail animation
    var overlayEl = this._el('Overlay');
    if (this._tagPanel) {
      var el = document.querySelector('.gallery-item[data-path="' + CSS.escape(file.path) + '"]');
      if (el) {
        var rect = el.getBoundingClientRect();
        overlayEl.style.setProperty('--zoom-x', ((rect.left + rect.width / 2) / window.innerWidth * 100) + '%');
        overlayEl.style.setProperty('--zoom-y', ((rect.top + rect.height / 2) / window.innerHeight * 100) + '%');
      } else {
        overlayEl.style.removeProperty('--zoom-x');
        overlayEl.style.removeProperty('--zoom-y');
      }
    }

    overlayEl.classList.remove('closing');
    void overlayEl.offsetHeight;
    overlayEl.classList.add('open');
    this._renderContent();
    try { history.pushState({lightbox: true}, ''); } catch(e) {}
  };

  Lightbox.prototype.close = function() {
    var media = this._el('Media');
    if (!media) return;
    var video = media.querySelector('video');
    if (video) { video.pause(); video.src = ''; }
    var overlay = this._el('Overlay');
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(function() { overlay.classList.remove('closing'); }, 180);
    this._cancelHideTimer();
    if (this._onClose) this._onClose();
  };

  window.addEventListener('popstate', function() {
    var lb = document.querySelector('.shared-lightbox.open');
    if (lb) {
      // Find which Lightbox instance this belongs to
      for (var k in window) {
        if (window[k] instanceof Lightbox) {
          var inst = window[k];
          if (inst._el('Overlay') === lb) {
            inst.close();
            break;
          }
        }
      }
    }
  });

  /* ─── RENDER ─── */

  Lightbox.prototype._renderContent = function(nav) {
    if (this._index < 0 || this._index >= this._data.length) return;
    var file = this._data[this._index];
    this._resetZoom();
    if (!nav) this._resetSize();
    this._renderMedia(file);
    if (this._tagPanel) this._renderPanel(file);
    var pos = this._el('Position');
    if (pos) {
      var visOrder = this._getVisualOrderFn();
      var curPath = file && file.path;
      var visIdx = curPath ? visOrder.indexOf(curPath) : -1;
      pos.textContent = (visIdx >= 0 ? visIdx + 1 : this._index + 1) + ' / ' + (visOrder.length || this._data.length);
    }
  };

  Lightbox.prototype._renderMedia = function(file) {
    var media = this._el('Media');
    var video = media.querySelector('video');
    if (video) { video.pause(); video.src = ''; }
    media.innerHTML =
      '<div class="lb-nav-zone left" id="' + this._id('NavLeft') + '"></div>' +
      '<div class="lb-nav-zone right" id="' + this._id('NavRight') + '"></div>';

    var mediaUrl = this._mediaUrlFn(file.path);
    var ext = file.name ? file.name.split('.').pop().toLowerCase() : (file.path || '').split('.').pop().toLowerCase();
    var isVideo = ['mp4','webm','mov','avi','mkv'].indexOf(ext) !== -1;

    var toolbar = this._el('Toolbar');
    if (toolbar) {
      toolbar.style.display = 'none';
      toolbar.classList.remove('lb-toolbar-hidden');
    }
    this._cancelHideTimer();

    if (isVideo) {
      media.innerHTML += '<video src="' + mediaUrl + '" controls autoplay style="max-width:100%;max-height:100%"></video>';
      var vw = file.width || 16;
      var vh = file.height || 9;
      this._sizeLb(vw, vh);
    } else {
      if (toolbar) toolbar.style.display = 'flex';
      media.innerHTML += '<img src="' + mediaUrl + '" class="zoom-fit" alt="' + this._esc(file.name || '') + '">';
      var img = media.querySelector('img');
      var self = this;
      img.onload = function() {
        self._sizeLb(img.naturalWidth, img.naturalHeight);
        if (img.naturalHeight > img.naturalWidth * 2.5) {
          self._setZoomScroll(img);
        }
        self._resetHideTimer();
      };
    }

    // Re-bind nav events
    var self = this;
    setTimeout(function() {
      var nl = document.getElementById(self._id('NavLeft'));
      var nr = document.getElementById(self._id('NavRight'));
      if (nl) nl.addEventListener('click', function(e) { e.stopPropagation(); self._prev(); });
      if (nr) nr.addEventListener('click', function(e) { e.stopPropagation(); self._next(); });
    }, 0);
  };

  /* ─── TOOLBAR AUTO-HIDE ─── */

  Lightbox.prototype._resetHideTimer = function() {
    var self = this;
    this._cancelHideTimer();
    var toolbar = this._el('Toolbar');
    if (!toolbar || toolbar.style.display === 'none') return;
    toolbar.classList.remove('lb-toolbar-hidden');
    this._hideTimer = setTimeout(function() {
      var tb = self._el('Toolbar');
      if (tb && tb.style.display !== 'none') tb.classList.add('lb-toolbar-hidden');
    }, 3200);
  };

  Lightbox.prototype._cancelHideTimer = function() {
    clearTimeout(this._hideTimer);
    this._hideTimer = null;
  };

  /* ─── TAG PANEL (MV only) ─── */

  Lightbox.prototype._renderPanel = function(file) {
    if (!this._tagPanel) return;
    var panel = this._el('Panel');
    if (!panel) return;
    var tags = file.tags || '';
    var tagList = this._parseTags(tags);
    var catList = this._getCatListFn();
    var catLookup = {};
    catList.forEach(function(c) { catLookup[c.name] = c; });

    var groups = {};
    var noCatTags = [];
    var self = this;
    tagList.forEach(function(t) {
      var catName = self._getTagCategoryNameFn(t);
      if (catName && catLookup[catName]) {
        if (!groups[catName]) groups[catName] = [];
        groups[catName].push(t);
      } else {
        noCatTags.push(t);
      }
    });

    var isDel = this._deleteMode;
    var tagsHtml = '';
    catList.forEach(function(c) {
      var items = groups[c.name];
      if (!items || !items.length) return;
      tagsHtml += '<div class="lb-section-grp" style="margin-bottom:10px">';
      tagsHtml += '<div class="lb-section-header" style="color:' + c.color + '">';
      tagsHtml += '<span style="width:6px;height:6px;border-radius:50%;background:' + c.color + '"></span>';
      tagsHtml += self._esc(c.name) + '</div>';
      tagsHtml += '<div class="lb-section-grp">';
      tagsHtml += items.map(function(t) {
        var sel = self._deleteSelected.indexOf(t) !== -1;
        var extra = isDel ? ';user-select:none' : '';
        var selStyle = sel ? ' class="tag-chip sel"' : ' class="tag-chip"';
        var prefix = isDel ? (sel ? '\u2713 ' : '\u25CB ') : '';
        return '<span' + selStyle + ' style="color:' + c.color + ';background:' + self._hexToRgba(c.color, 0.08) + ';-webkit-text-stroke:0.5px ' + c.color + extra + '" data-tag="' + self._esc(t) + '">' + prefix + self._esc(t) + '</span>';
      }).join('');
      tagsHtml += '</div></div>';
    });
    if (noCatTags.length) {
      tagsHtml += '<div class="lb-section-grp" style="margin-bottom:8px">';
      tagsHtml += noCatTags.map(function(t) {
        var sel = self._deleteSelected.indexOf(t) !== -1;
        var extra = isDel ? ';user-select:none' : '';
        var selStyle = sel ? ' class="tag-chip sel"' : ' class="tag-chip"';
        var prefix = isDel ? (sel ? '\u2713 ' : '\u25CB ') : '';
        return '<span' + selStyle + ' style="' + extra + '" data-tag="' + self._esc(t) + '">' + prefix + self._esc(t) + '</span>';
      }).join('');
      tagsHtml += '</div>';
    }

    var isAdmin = window.CONFIG && CONFIG.isAdmin;
    var lblClass = isDel ? 'lb-del-btn active' : 'lb-del-btn';
    var delBarHtml = '';
    if (isDel && isAdmin && !this._readonly) {
      var selCount = this._deleteSelected.length;
      delBarHtml = '<div id="lbDelBar" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:6px 0;border-top:1px solid var(--border)">' +
        '<span style="font-size:12px;color:var(--text2);flex:1">' + selCount + ' selected</span>' +
        (selCount > 0
          ? '<button id="lbDelConfirm" class="btn-sm" style="background:#ff4444;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px">Delete</button>'
          : '') +
        '<button id="lbDelCancel" class="btn-sm" style="background:var(--surface2);color:var(--text);border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px">Done</button>' +
        '</div>';
    }

    panel.innerHTML =
      '<div class="lb-header">' +
        '<h3>' + this._esc(file.name || '') + '</h3>' +
        (this._onDownload && file.path ? '<button class="lb-download-btn" id="' + this._id('DownloadBtn') + '" title="Download">' + (this._downloadLabelFn ? this._downloadLabelFn(file) : '\u2B07') + '</button>' : '') +
        (isAdmin && !this._readonly ? '<button id="lbDelToggle" class="' + lblClass + '" title="' + (isDel ? 'Exit delete mode' : 'Delete tags') + '">\u2715</button>' : '') +
      '</div>' +
      '<div class="meta">' + (file.width > 0 ? file.width + '\u00D7' + file.height : '') + '</div>' +
      (isDel && this._deleteMode && isAdmin && !this._readonly ? '<div style="font-size:11px;color:#ff4444;margin-bottom:6px">Select tags to delete</div>' : '') +
      delBarHtml +
      (tagsHtml || '<div class="lb-meta-text">No tags</div>') +
      (!this._readonly && isAdmin ? '<div class="lb-input-row">' +
      '<input type="text" id="' + this._id('TagInput') + '" placeholder="Add tag">' +
      '</div>' +
      '<div id="lbAutocomplete"></div>' : '');

    // Wire download button
    var dlBtn = document.getElementById(this._id('DownloadBtn'));
    if (dlBtn) {
      dlBtn.onclick = function() {
        if (self._onDownload) self._onDownload(file);
      };
    }

    // Wire delete mode controls (admin only)
    if (isAdmin) {
      var delToggle = document.getElementById('lbDelToggle');
      if (delToggle) delToggle.onclick = this._toggleDeleteMode.bind(this);
      var delConfirm = document.getElementById('lbDelConfirm');
      if (delConfirm) delConfirm.onclick = this._deleteSelectedTags.bind(this);
      var delCancel = document.getElementById('lbDelCancel');
      if (delCancel) delCancel.onclick = function() { self._deleteMode = false; self._deleteSelected = []; self._renderContent(true); };
    }
  };

  /* ─── NAVIGATION ─── */

  Lightbox.prototype._prev = function() {
    var paths = this._getVisualOrderFn();
    if (!paths || paths.length === 0) {
      // Fallback: navigate by data array order
      if (this._index > 0) { this._index--; this._renderContent(true); }
      return;
    }
    var curPath = this._data[this._index].path;
    var curPos = paths.indexOf(curPath);
    if (curPos > 0) {
      var idx = this._data.findIndex(function(r) { return r.path === paths[curPos - 1]; });
      if (idx >= 0) { this._index = idx; this._renderContent(true); }
    }
    if (this._onNavigate) this._onNavigate(-1, this._data[this._index]);
  };

  Lightbox.prototype._next = function() {
    var paths = this._getVisualOrderFn();
    if (!paths || paths.length === 0) {
      if (this._index < this._data.length - 1) { this._index++; this._renderContent(true); }
      return;
    }
    var curPath = this._data[this._index].path;
    var curPos = paths.indexOf(curPath);
    if (curPos < paths.length - 1) {
      var idx = this._data.findIndex(function(r) { return r.path === paths[curPos + 1]; });
      if (idx >= 0) { this._index = idx; this._renderContent(true); }
    }
    if (this._onNavigate) this._onNavigate(1, this._data[this._index]);
  };

  /* ─── SIZING ─── */

  Lightbox.prototype._sizeLb = function(iw, ih) {
    if (this._fullscreen) return;
    if (!iw || !ih) return;
    var maxW = window.innerWidth * 0.95;
    var maxH = window.innerHeight * 0.9;
    var box = document.querySelector('#' + this._id('Overlay') + ' .lightbox-content');
    if (!box) return;
    var boxW, boxH;
    var LB_PANEL_W = this._tagPanel ? 300 : 0;
    if (ih > iw * 1.2) {
      boxH = maxH;
      boxW = Math.min(boxH * 4 / 3, maxW);
    } else {
      boxH = maxH;
      var mediaW = boxH * (iw / ih);
      boxW = Math.min(mediaW + LB_PANEL_W, maxW);
    }
    var oldW = box.offsetWidth, oldH = box.offsetHeight;
    var same = Math.abs(oldW - boxW) <= 2 && Math.abs(oldH - boxH) <= 2;
    if (same) {
      box.classList.remove('lb-pulse');
      void box.offsetWidth;
      box.classList.add('lb-pulse');
      setTimeout(function() { box.classList.remove('lb-pulse'); }, 300);
    } else {
      box.classList.remove('lb-resize');
      void box.offsetWidth;
      box.classList.add('lb-resize');
      box.style.width = boxW + 'px';
      box.style.height = boxH + 'px';
      setTimeout(function() { box.classList.remove('lb-resize'); }, 250);
    }
  };

  Lightbox.prototype._resetSize = function() {
    this._fullscreen = false;
    var box = document.querySelector('#' + this._id('Overlay') + ' .lightbox-content');
    if (box) {
      box.classList.remove('fullscreen');
      box.style.width = '';
      box.style.height = '';
    }
  };

  Lightbox.prototype._toggleFullscreen = function() {
    this._fullscreen = !this._fullscreen;
    var box = document.querySelector('#' + this._id('Overlay') + ' .lightbox-content');
    if (!box) return;
    box.classList.toggle('fullscreen', this._fullscreen);
    if (!this._fullscreen) this._sizeAuto();
  };

  Lightbox.prototype._sizeAuto = function() {
    var img = this._el('Media').querySelector('img');
    if (img && img.naturalWidth) this._sizeLb(img.naturalWidth, img.naturalHeight);
  };

  /* ─── ZOOM ─── */

  Lightbox.prototype._resetZoom = function(img) {
    this._zoomMode = 'fit';
    this._zoomScale = 1;
    this._panX = 0; this._panY = 0;
    this._dragState = null;
    var media = this._el('Media');
    media.style.alignItems = 'center';
    media.style.justifyContent = 'center';
    media.style.cursor = 'zoom-in';
    media.style.overflow = '';
    if (img) { img.className = 'zoom-fit'; img.style.transform = ''; }
    else {
      var i = this._el('Media').querySelector('img');
      if (i) { i.className = 'zoom-fit'; i.style.transform = ''; }
    }
    var zl = this._el('ZoomLevel');
    if (zl) zl.textContent = '100%';
  };

  Lightbox.prototype._setZoomScroll = function(img) {
    this._zoomMode = 'scroll';
    this._zoomScale = 1;
    this._panX = 0; this._panY = 0;
    var media = this._el('Media');
    img.className = 'zoom-scroll';
    img.style.transform = '';
    img.style.transformOrigin = 'center center';
    media.style.alignItems = 'flex-start';
    media.style.justifyContent = 'center';
    media.style.cursor = 'zoom-in';
    var zl = this._el('ZoomLevel');
    if (zl) zl.textContent = '100%';
  };

  Lightbox.prototype._toggleZoom = function() {
    var img = this._el('Media').querySelector('img');
    if (!img) return;
    var media = this._el('Media');
    if (this._zoomMode === 'full' || this._zoomMode === 'scroll') {
      this._resetZoom(img);
    } else {
      this._zoomMode = 'full';
      this._zoomScale = 1;
      img.className = 'zoom-full';
      img.style.transform = '';
      media.style.alignItems = 'flex-start';
      media.style.justifyContent = 'flex-start';
      media.style.overflow = 'auto';
      media.style.cursor = 'grab';
      var zl = this._el('ZoomLevel');
      if (zl) zl.textContent = '100%';
      if (img.naturalWidth && img.naturalHeight) {
        var mr = media.getBoundingClientRect();
        media.scrollLeft = Math.max(0, (img.naturalWidth - mr.width) / 2);
        media.scrollTop = Math.max(0, (img.naturalHeight - mr.height) / 2);
      }
    }
  };

  Lightbox.prototype._zoomFull = function(factor) {
    var img = this._el('Media').querySelector('img');
    if (!img) return;
    var media = this._el('Media');
    var zl = this._el('ZoomLevel');
    if (!zl) return;
    if (this._zoomMode !== 'full') { this._toggleZoom(); return; }
    var oldScale = this._zoomScale;
    this._zoomScale = Math.max(0.3, oldScale * factor);
    if (this._zoomScale < 0.3) { this._resetZoom(img); return; }
    // Keep viewport center stable
    var mr = media.getBoundingClientRect();
    var cx = mr.width / 2, cy = mr.height / 2;
    var ratio = this._zoomScale / oldScale;
    media.scrollLeft = (media.scrollLeft + cx) * ratio - cx;
    media.scrollTop = (media.scrollTop + cy) * ratio - cy;
    img.style.transform = 'scale(' + this._zoomScale + ')';
    zl.textContent = Math.round(this._zoomScale * 100) + '%';
  };

  Lightbox.prototype._zoomIn = function() {
    var img = this._el('Media').querySelector('img');
    if (!img) return;
    var zl = this._el('ZoomLevel');
    if (!zl) return;
    if (this._zoomMode === 'scroll') {
      this._zoomScale *= 1.4;
      img.style.transform = 'translate(' + this._panX + 'px, ' + this._panY + 'px) scale(' + this._zoomScale + ')';
      zl.textContent = Math.round(this._zoomScale * 100) + '%';
    } else if (this._zoomMode === 'full') {
      this._zoomFull(1.4);
    } else {
      this._toggleZoom();
    }
  };

  Lightbox.prototype._zoomOut = function() {
    var img = this._el('Media').querySelector('img');
    if (!img) return;
    var zl = this._el('ZoomLevel');
    if (!zl) return;
    if (this._zoomMode === 'scroll') {
      this._zoomScale = Math.max(1, this._zoomScale / 1.4);
      img.style.transform = 'translate(' + this._panX + 'px, ' + this._panY + 'px) scale(' + this._zoomScale + ')';
      zl.textContent = Math.round(this._zoomScale * 100) + '%';
    } else if (this._zoomMode === 'full') {
      this._zoomFull(1 / 1.4);
    } else {
      this._resetZoom(img);
    }
  };

  Lightbox.prototype._toggleScrollMode = function() {
    var img = this._el('Media').querySelector('img');
    if (!img) return;
    if (this._zoomMode === 'scroll') {
      this._resetZoom(img);
    } else {
      var media = this._el('Media');
      if (media) media.style.overflow = 'auto';
      this._setZoomScroll(img);
    }
  };

  /* ─── DRAG-TO-PAN ─── */

  Lightbox.prototype._initDragPan = function(media) {
    var self = this;
    media.addEventListener('mousedown', function(e) {
      if (self._zoomMode === 'fit') return;
      if (e.button !== 0) return;
      if (e.target.tagName !== 'IMG') return;
      self._dragState = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: media.scrollLeft,
        scrollTop: media.scrollTop,
        startPanX: self._panX,
        startPanY: self._panY,
        grabbed: false
      };
      media.style.cursor = 'grabbing';
    });
    media.addEventListener('mousemove', function(e) {
      if (!self._dragState) return;
      var dx = e.clientX - self._dragState.startX;
      var dy = e.clientY - self._dragState.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) { self._dragState.grabbed = true; self._lastDragTime = Date.now(); }
      if (self._dragState.grabbed) {
        e.preventDefault();
        if (self._zoomMode === 'scroll') {
          self._panX = self._dragState.startPanX + dx;
          self._panY = self._dragState.startPanY + dy;
          var img = self._el('Media').querySelector('img');
          if (img) img.style.transform = 'translate(' + self._panX + 'px, ' + self._panY + 'px) scale(' + self._zoomScale + ')';
        } else {
          media.scrollLeft = self._dragState.scrollLeft - dx;
          media.scrollTop = self._dragState.scrollTop - dy;
        }
      }
    });
    media.addEventListener('mouseup', function() {
      if (!self._dragState) return;
      var grabbed = self._dragState.grabbed;
      self._dragState = null;
      if (!grabbed && self._zoomMode !== 'fit') self._toggleZoom();
      media.style.cursor = self._zoomMode === 'fit' ? 'zoom-in' : 'grab';
    });
    media.addEventListener('mouseleave', function() {
      if (!self._dragState) return;
      self._dragState = null;
      media.style.cursor = self._zoomMode === 'fit' ? 'zoom-in' : 'grab';
    });
  };

  /* ─── TAG OPERATIONS (MV only) ─── */

  Lightbox.prototype._parseTags = function(str) {
    if (!str || !str.trim()) return [];
    return str.split(',').map(function(t) { return t.trim(); }).filter(Boolean);
  };

  Lightbox.prototype._esc = function(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  Lightbox.prototype._showAutocomplete = function(query) {
    if (!this._tagPanel) return;
    var container = document.getElementById('lbAutocomplete');
    if (!query && this._index >= 0) {
      this._showRelatedTags();
      return;
    }
    if (!query || !query.trim()) { container.innerHTML = ''; return; }
    var q = query.trim().toLowerCase();
    var matches = [];
    var allData = this._getFilteredDataFn();
    var self = this;
    for (var i = 0; i < allData.length; i++) {
      var tags = self._parseTags(allData[i].tags);
      for (var j = 0; j < tags.length; j++) {
        if (tags[j].toLowerCase().indexOf(q) !== -1 && matches.indexOf(tags[j]) === -1) {
          matches.push(tags[j]);
        }
      }
      if (matches.length >= 20) break;
    }
    matches.sort();
    if (matches.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '<div style="position:absolute;top:0;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;z-index:10;max-height:200px;overflow-y:auto">' +
      matches.slice(0, 10).map(function(tag) {
        var cat = self._getTagCategoryNameFn(tag);
        var style = cat ? 'color:' + cat + ';border-left:3px solid ' + cat + ';padding-left:9px;background:' + self._hexToRgba(cat, 0.08) : '';
        return '<div class="ac-item" data-tag="' + self._esc(tag) + '" style="' + style + '">' + self._esc(tag) + '</div>';
      }).join('') + '</div>';
    container.querySelectorAll('.ac-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        document.getElementById(self._id('TagInput')).value = el.dataset.tag;
        self._addTag();
      });
    });
  };

  Lightbox.prototype._showRelatedTags = function() {
    if (!this._tagPanel) return;
    var container = document.getElementById('lbAutocomplete');
    if (this._index < 0) { container.innerHTML = ''; return; }
    var fileTags = this._parseTags(this._data[this._index].tags);
    var allData = this._getFilteredDataFn();
    var tagCounts = {};
    var self = this;
    for (var i = 0; i < allData.length; i++) {
      var tags = self._parseTags(allData[i].tags);
      for (var j = 0; j < tags.length; j++) {
        if (fileTags.indexOf(tags[j]) === -1) {
          tagCounts[tags[j]] = (tagCounts[tags[j]] || 0) + 1;
        }
      }
    }
    var sorted = Object.keys(tagCounts).sort(function(a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 10);
    if (sorted.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '<div style="position:absolute;top:0;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:4px;z-index:10;max-height:200px;overflow-y:auto">' +
      '<div style="padding:4px 8px;font-size:11px;color:var(--text2)">Related tags</div>' +
      sorted.map(function(tag) {
        var cat = self._getTagCategoryNameFn(tag);
        var style = cat ? 'color:' + cat + ';border-left:3px solid ' + cat + ';padding-left:9px;background:' + self._hexToRgba(cat, 0.08) : '';
        return '<div class="ac-item" data-tag="' + self._esc(tag) + '" style="' + style + '">' + self._esc(tag) + ' <span style="opacity:0.45;font-size:11px">(' + tagCounts[tag] + ')</span></div>';
      }).join('') + '</div>';
    container.querySelectorAll('.ac-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        document.getElementById(self._id('TagInput')).value = el.dataset.tag;
        self._addTag();
      });
    });
  };

  Lightbox.prototype._addTag = function() {
    if (!this._tagPanel) return;
    var input = this._el('TagInput');
    if (!input) return;
    var tag = input.value.trim();
    if (!tag || this._index < 0) return;
    input.value = '';
    var ac = document.getElementById('lbAutocomplete');
    if (ac) ac.innerHTML = '';
    var file = this._data[this._index];
    var currentTags = this._parseTags(file.tags);
    if (currentTags.indexOf(tag) !== -1) return;
    currentTags.push(tag);
    var joined = currentTags.join(',');
    var self = this;
    if (this._onSaveTags) {
      this._onSaveTags(file.path, joined).then(function(data) {
        if (data && data.ok !== false) {
          file.tags = joined;
          self._renderContent(true);
          if (self._galleryRefreshFn) self._galleryRefreshFn(file.path, joined);
        }
      }).catch(function() {});
    }
  };

  Lightbox.prototype._addTagFromInput = function() {
    var input = this._el('TagInput');
    if (input) {
      input.value = input.value.trim();
      this._addTag();
    }
  };

  Lightbox.prototype._toggleDeleteMode = function() {
    this._deleteMode = !this._deleteMode;
    if (!this._deleteMode) this._deleteSelected = [];
    this._renderContent(true);
  };

  Lightbox.prototype._toggleTagDeletion = function(tag) {
    var idx = this._deleteSelected.indexOf(tag);
    if (idx !== -1) {
      this._deleteSelected.splice(idx, 1);
    } else {
      this._deleteSelected.push(tag);
    }
    this._renderContent(true);
  };

  Lightbox.prototype._deleteSelectedTags = function() {
    if (!this._deleteSelected.length || this._index < 0) return;
    var file = this._data[this._index];
    var currentTags = this._parseTags(file.tags);
    var newTags = currentTags.filter(function(t) { return this._deleteSelected.indexOf(t) === -1; }.bind(this));
    var joined = newTags.join(',');
    var self = this;
    if (this._onSaveTags) {
      this._onSaveTags(file.path, joined).then(function(data) {
        if (data && data.ok !== false) {
          file.tags = joined;
          self._deleteMode = false;
          self._deleteSelected = [];
          self._renderContent(true);
          if (self._galleryRefreshFn) self._galleryRefreshFn(file.path, joined);
        }
      }).catch(function() {});
    }
  };

  return Lightbox;
})();

/* ─── Inject CSS once ─── */
(function() {
  var id = 'sl-css';
  if (document.getElementById(id)) return;
  var css = document.createElement('style');
  css.id = id;
  css.textContent =
    '.shared-lightbox{position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;transform:scale(.96)}' +
    '.shared-lightbox.open{opacity:1;pointer-events:auto;transform:scale(1)}' +
    '.shared-lightbox.closing{opacity:0;transform:scale(.96)}' +
    '.shared-lightbox .lightbox-close{position:absolute;top:16px;right:16px;z-index:20;background:rgba(0,0,0,.3);border:none;color:#fff;width:36px;height:36px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}' +
    '.shared-lightbox .lightbox-close:hover{background:rgba(255,255,255,.2)}' +
    '.shared-lightbox .sl-overlay-bg{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}' +
    '.shared-lightbox .lightbox-content{display:flex;position:relative;max-width:95vw;max-height:90vh;border-radius:12px;overflow:hidden;background:rgba(32,32,32,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 8px 40px rgba(0,0,0,.5);transition:width .25s ease,height .25s ease}' +
    '.shared-lightbox .lightbox-content.fullscreen{width:100vw!important;height:100vh!important;max-width:100vw;max-height:100vh;border-radius:0}' +
    '.shared-lightbox .lightbox-media{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;min-width:300px;min-height:200px}' +
    '.shared-lightbox .lightbox-media video{max-width:100%;max-height:100%;display:block}' +
    '.shared-lightbox .lightbox-media img{display:block;user-select:none;-webkit-user-drag:none}' +
    '.shared-lightbox .lightbox-media img.zoom-fit{max-width:100%;max-height:100%;object-fit:contain}' +
    '.shared-lightbox .lightbox-media img.zoom-fill{object-fit:fill}' +
    '.shared-lightbox .lightbox-media img.zoom-full{position:absolute;top:0;left:0;max-width:none;max-height:none}' +
    '.shared-lightbox .lightbox-media img.zoom-scroll{max-width:100%;object-fit:contain;transform-origin:center center}' +
    '.lb-nav-zone{position:absolute;top:0;bottom:0;width:35%;z-index:5;cursor:pointer}' +
    '.lb-nav-zone.left{left:0}' +
    '.lb-nav-zone.right{right:0}' +
    '.shared-lightbox .lightbox-toolbar{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:4px;z-index:15;background:rgba(0,0,0,.65);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.15);padding:4px 6px;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.3);transition:opacity .4s ease}' +
    '.shared-lightbox .lightbox-toolbar.lb-toolbar-hidden{opacity:0;pointer-events:none}' +
    '.shared-lightbox .lightbox-toolbar button{background:transparent;border:none;color:rgba(255,255,255,.8);width:30px;height:30px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}' +
    '.shared-lightbox .lightbox-toolbar button:hover{background:rgba(255,255,255,.12);color:#fff}' +
    '.shared-lightbox .lightbox-toolbar .zoom-level{color:rgba(255,255,255,.5);font-size:11px;min-width:36px;text-align:center;font-variant-numeric:tabular-nums}' +
    '.shared-lightbox .lightbox-toolbar .lb-pos{color:rgba(255,255,255,.5);font-size:11px;min-width:48px;text-align:center;font-variant-numeric:tabular-nums}' +
    '.shared-lightbox .lightbox-panel{width:300px;background:rgba(32,32,32,0.85);padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;color:#e0e0e0}' +
    '.shared-lightbox .lightbox-panel h3{font-size:14px;font-weight:600;word-break:break-all;flex:1;margin:0}' +
    '.shared-lightbox .lightbox-panel .meta{font-size:12px;color:var(--text2,#888)}' +
    '.shared-lightbox .lightbox-panel .tag-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;line-height:1.5;cursor:pointer;transition:opacity .15s}' +
    '.shared-lightbox .lightbox-panel .tag-chip:hover{opacity:.85}' +
    '.shared-lightbox .lightbox-panel .tag-chip.sel{outline:2px solid #ff4444;outline-offset:1px;background:rgba(255,68,68,0.15)}' +
    '.shared-lightbox .lightbox-panel input[type="text"]{flex:1;width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:13px}' +
    '.shared-lightbox .lightbox-panel .lb-section-header{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;display:flex;align-items:center;gap:4px}' +
    '.shared-lightbox .lightbox-panel .lb-section-grp{display:flex;flex-wrap:wrap;gap:4px}' +
    '.shared-lightbox .lightbox-panel .lb-meta-text{margin-bottom:10px;font-size:13px;color:var(--text2)}' +
    '.shared-lightbox .lightbox-panel .ac-item{padding:6px 10px;font-size:13px;cursor:pointer;transition:background .1s}' +
    '.shared-lightbox .lightbox-panel .ac-item:hover{background:rgba(255,255,255,.08)}' +
    '.shared-lightbox .lightbox-panel .lb-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}' +
    '.shared-lightbox .lightbox-panel .lb-input-row{display:flex;gap:6px}' +
    '.shared-lightbox .lightbox-panel #lbAutocomplete{position:relative}' +
    '.shared-lightbox .lightbox-content.lb-pulse{animation:lbPulse .25s ease}' +
    '.shared-lightbox .lightbox-content.lb-resize{transition:width .2s ease,height .2s ease}' +
    '.lb-del-btn{background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;padding:4px;border-radius:4px;display:flex;opacity:.4;transition:opacity .15s}' +
    '.lb-del-btn.active{opacity:1;color:#ff4444}' +
    '.lb-del-btn:hover{opacity:1}' +
    '@media(max-width:768px){' +
    '.shared-lightbox .lightbox-content{width:100vw;height:100vh;max-width:100vw;max-height:100vh;border-radius:0;border:none;flex-direction:column}' +
    '.shared-lightbox .lightbox-panel{width:100%;max-height:35vh;padding:12px;border-top:1px solid var(--border)}' +
    '.shared-lightbox .lightbox-content.fullscreen .lightbox-panel{flex:0;height:0;min-height:0;overflow:hidden;opacity:0;padding:0;border:none}' +
    '.shared-lightbox .lightbox-toolbar{bottom:auto;top:12px;font-size:12px;padding:4px 8px}' +
    '.shared-lightbox .lightbox-toolbar button{font-size:13px;padding:4px 8px}' +
    '.shared-lightbox .lightbox-close{top:8px;right:8px;width:36px;height:36px}' +
    '.lb-nav-zone{display:block}' +
    '}' +
    '.shared-lightbox .lb-download-btn{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;color:var(--text);font-size:16px;line-height:1;transition:all .15s}' +
    '.shared-lightbox .lb-download-btn:hover{background:var(--accent);color:#fff;border-color:var(--accent)}';
  document.head.appendChild(css);
})();
