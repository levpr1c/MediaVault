var AdminDashboard = (function() {
  var _sections = {}, _current = 'users', _users = [], _toastTimer = null;

  function _t(key) {
    if (window._i18nData) {
      var lang = document.documentElement.getAttribute('lang') || 'en';
      var d = _i18nData[lang] || _i18nData.en || {};
      var val = d[key];
      if (val !== undefined) return val;
      val = _i18nData.en && _i18nData.en[key];
      if (val !== undefined) return val;
    }
    return key;
  }

  function _loading(body) {
    body.innerHTML = '<div class="admin-loading"><span class="fetch-spinner"></span> <span data-i18n="loading">' + _t('loading') + '</span></div>';
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

  function _modal(html) {
    var overlay = document.getElementById('adminModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'adminModal';
      overlay.className = 'admin-modal';
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) _closeModal();
      });
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '<div class="admin-modal-content">' + html + '</div>';
    overlay.classList.add('open');
  }

  function _closeModal() {
    var overlay = document.getElementById('adminModal');
    if (overlay) overlay.classList.remove('open');
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

  /* ─── SECTIONS ─── */

  // ─── USERS ───
  _sections.users = {
    render: function(body) {
      _loading(body);
      var self = this;
      _api('/api/admin/users').then(function(data) {
        _users = data.users || [];
        self._renderTable(body);
      }).catch(function(e) { _errorFallback(body, e); });
    },

    _renderTable: function(body) {
      var self = this;
      var html = '<div class="admin-card"><div class="admin-card-header">' +
        '<span class="admin-card-title"><span data-i18n="navUsers">' + _t('navUsers') + '</span></span>' +
        '<button class="action-btn action-btn-primary" onclick="AdminDashboard._addUser()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>' +
        '<span data-i18n="userAddBtn">' + _t('userAddBtn') + '</span></button>' +
        '</div><div class="admin-table-wrap">';
      if (_users.length === 0) {
        html += '<div style="padding:20px;text-align:center;color:var(--text2)"><span data-i18n="noUsers">' + _t('noUsers') + '</span></div>';
      } else {
        html += '<table class="admin-table"><thead><tr>' +
          '<th><span data-i18n="secUsername">' + _t('secUsername') + '</span></th>' +
          '<th><span data-i18n="secRole">' + _t('secRole') + '</span></th>' +
          '<th style="text-align:right"><span data-i18n="actions">' + _t('actions') + '</span></th>' +
          '</tr></thead><tbody>';
        _users.forEach(function(u) {
          var isSelf = u.id === _selfId;
          var isLastAdmin = u.role === 'admin' && _users.filter(function(x) { return x.role === 'admin'; }).length <= 1;
          html += '<tr>' +
            '<td><strong>' + _esc(u.username) + '</strong>' + (isSelf ? ' <span style="color:var(--text2);font-size:11px">(<span data-i18n="you">' + _t('you') + '</span>)</span>' : '') + '</td>' +
            '<td>' + self._roleBadge(u.role) + '</td>' +
            '<td style="text-align:right"><div class="action-group" style="justify-content:flex-end">' +
            '<button class="action-btn" onclick="AdminDashboard._setPassword(' + u.id + ')">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<span data-i18n="userSetPasswordBtn">' + _t('userSetPasswordBtn') + '</span></button>';
          if (!isSelf) {
            html += '<button class="action-btn" onclick="AdminDashboard._toggleRole(' + u.id + ')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
              '<span data-i18n="' + (u.role === 'admin' ? 'userRoleUser' : 'userRoleAdmin') + '">' + _t(u.role === 'admin' ? 'userRoleUser' : 'userRoleAdmin') + '</span></button>';
          }
          if (!isSelf && !isLastAdmin) {
            html += '<button class="action-btn danger" onclick="AdminDashboard._deleteUser(' + u.id + ', \'' + _esc(u.username) + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
              '<span data-i18n="delete">' + _t('delete') + '</span></button>';
          }
          html += '</div></td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '</div></div>';
      body.innerHTML = html;
    },

    _roleBadge: function(role) {
      var icon = role === 'admin'
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:middle;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      return '<span class="role-badge ' + role + '">' + icon +
        '<span data-i18n="' + (role === 'admin' ? 'userRoleAdmin' : 'userRoleUser') + '">' + _t(role === 'admin' ? 'userRoleAdmin' : 'userRoleUser') + '</span></span>';
    }
  };

  // ─── DATABASE (includes Folders card) ───
  _sections.database = {
    _settings: null,

    render: function(body) {
      _loading(body);
      var self = this;
      _api('/api/settings').then(function(data) {
        self._settings = data;
        self._renderContent(body);
        _startMountWatch();
      }).catch(function(e) { _errorFallback(body, e); });
    },

    _renderContent: function(body) {
      var s = this._settings;
      body.innerHTML =
        '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="sectionDatabase">' + _t('sectionDatabase') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsDb">' + _t('settingsDb') + '</span></div>' +
        '<div class="db-grid">' +
        this._tool('exportDb', 'exportDb', 'export', false) +
        this._tool('dbImport', 'dbImport', 'import', false) +
        this._tool('findDuplicates', 'findDuplicatesDesc', 'findDup', false) +
        this._tool('rehashBtn', 'rehashDesc', 'rehash', false) +
        this._tool('settingsCleanDuplicates', 'settingsCleanDuplicates', 'dedup', false) +
        this._tool('cleanThumbCache', 'settingsClearCache', 'clearThumbs', true) +
        this._tool('settingsCleanTagCache', 'settingsCleanTagCache', 'clearTags', true) +
        this._tool('settingsCleanDb', 'settingsCleanDb', 'clearFiles', true) +
        this._tool('regenAllThumbs', 'settingsRegenThumbnails', 'regenThumbs', false) +
        this._tool('genMissingThumbs', 'settingsRegenMissing', 'regenMissing', false) +
        this._tool('findOriginals', 'findOriginalsDesc', 'findOriginals', false) +
        this._tool('settingsCleanAll', 'settingsCleanAll', 'clearAll', true) +
        '</div></div>' +
        // Folders card
        '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="sectionFolders">' + _t('sectionFolders') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsMediaPath">' + _t('settingsMediaPath') + '</span></div>' +
        '<div class="admin-field"><input class="admin-field-input" id="admMediaDirFolders" value="' + _esc(s.media_dir || '') + '" readonly style="background:var(--surface2);cursor:default"></div>' +
        '<div class="admin-field"><input class="admin-field-input" id="admMediaDir" value="' + _esc(s.media_dir || '') + '" placeholder="/path/to/media"></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;margin-bottom:16px">' +
        '<button class="action-btn" onclick="AdminDashboard._pickFolder()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span data-i18n="settingsSystemDialog">' + _t('settingsSystemDialog') + '</span></button>' +
        '<button class="action-btn action-btn-primary" onclick="AdminDashboard._scanFolder()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span data-i18n="settingsScan">' + _t('settingsScan') + '</span></button>' +
        '<button class="action-btn" onclick="AdminDashboard._rescanFolder()" id="admRescanBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span>&#x21bb; Rescan</span></button>' +
        '<span id="admScanStatus" style="font-size:12px;color:var(--text2);margin-left:4px"></span>' +
        '</div>' +
        '<div id="admScanProgress" class="scan-progress" style="display:none">' +
        '<div class="scan-progress-row">' +
        '<span class="fetch-spinner"></span>' +
        '<span id="admScanProgressText" style="font-size:13px;color:var(--text)">' + _t('settingsRunning') + '...</span>' +
        '</div>' +
        '<div class="scan-progress-bar-wrap">' +
        '<div id="admScanProgressBar" class="scan-progress-bar"></div>' +
        '</div></div>' +
        '<div class="admin-field-row three-col">' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="adminGalleryDir">' + _t('adminGalleryDir') + '</span></label><input class="admin-field-input" id="galleryDir" value="' + _esc(s.gallery_dir || 'Gallery') + '" placeholder="Gallery"></div>' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="adminComicsDir">' + _t('adminComicsDir') + '</span></label><input class="admin-field-input" id="comicsDir" value="' + _esc(s.comics_dir || 'Comics') + '" placeholder="Comics"></div>' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="settingsDownloadsDir">' + _t('settingsDownloadsDir') + '</span></label><input class="admin-field-input" id="downloadsDir" value="' + _esc(s.downloads_dir || 'Downloads') + '" placeholder="Downloads"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-top:8px">' +
        '<button class="action-btn action-btn-primary" onclick="AdminDashboard._saveFolderSettings()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span data-i18n="settingsSaveStart">' + _t('settingsSaveStart') + '</span></button>' +
        '<button class="action-btn" onclick="AdminDashboard._createFolders()" id="admCreateFolders"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg><span data-i18n="settingsCreateFolders">' + _t('settingsCreateFolders') + '</span></button>' +
        '</div>' +
        '</div>' +
        '<div class="admin-card" id="adminProgressCard" style="display:none">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="settingsRunning">' + _t('settingsRunning') + '</span></span>' +
        '<button class="action-btn danger" id="adminCancelRegenBtn" style="display:none" onclick="AdminDashboard._cancelRegen()"><span data-i18n="cancel">' + _t('cancel') + '</span></button>' +
        '</div>' +
        '<div class="progress-bar-wrap" style="background:var(--surface2);border-radius:8px;height:8px;overflow:hidden;margin:8px 0">' +
        '<div id="adminProgressBar" style="height:100%;width:0%;background:var(--accent);border-radius:8px;transition:width .3s"></div></div>' +
        '<div id="adminProgressText" style="font-size:12px;color:var(--text2)"></div></div>';
    },

        _tool: function(labelKey, descKey, action, danger) {
      var icons = {
        export: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        import: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        findDup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M9 11h4"/><path d="M11 9v4"/></svg>',
        rehash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        dedup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        clearThumbs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        clearTags: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        clearFiles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
        regenThumbs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        regenMissing: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/><circle cx="12" cy="12" r="1"/></svg>',
        findOriginals: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>',
        clearAll: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
      };
      return '<div class="db-tool' + (danger ? ' danger' : '') + '" onclick="AdminDashboard._dbAction(\'' + action + '\')">' +
        '<div class="db-tool-icon">' + (icons[action] || '') + '</div>' +
        '<div><div class="db-tool-label"><span data-i18n="' + labelKey + '">' + _t(labelKey) + '</span></div>' +
        '<div class="db-tool-desc"><span data-i18n="' + descKey + '">' + _t(descKey) + '</span></div></div></div>';
    }
  };

  // ─── API KEYS & BACKENDS ───
  _sections['api-keys'] = {
    _settings: null,
    _cred: null,
    _backendStatus: null,

    render: function(body) {
      _loading(body);
      var self = this;
      Promise.all([
        _api('/api/settings'),
        _api('/api/credential_status'),
        _api('/api/admin/backends/status').catch(function() { return {}; })
      ]).then(function(results) {
        self._settings = results[0];
        self._cred = results[1];
        self._backendStatus = results[2] || {};
        self._renderForm(body);
      }).catch(function(e) { _errorFallback(body, e); });
    },

    _renderForm: function(body) {
      var s = this._settings;
      var cred = s.credentials || {};
      var r34 = cred.rule34 || {};
      var dan = cred.danbooru || {};
      var fb = s.fetch_backend || {};
      var bs = this._backendStatus || {};
      var backendLabels = {
        api_raw: _t('backendApiRaw'),
        gallerydl: _t('backendGallerydl'),
      };
      var backendIcons = {
        api_raw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
        gallerydl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
      };
      var sites = [
        {id:'rule34', nameKey:'siteRule34', icon:'rule34',
          creds:[{id:'uid', label:'UID'}, {id:'key', label:'API Key'}],
          vals:{uid: r34.uid || '', key: r34.key || ''},
          backends:['api_raw','gallerydl']},
        {id:'danbooru', nameKey:'siteDanbooru', icon:'danbooru',
          creds:[{id:'login', label:'Login'}, {id:'key', label:'API Key'}],
          vals:{login: dan.login || '', key: dan.key || ''},
          backends:['api_raw','gallerydl']},
        {id:'nhentai', nameKey:'siteNhentai', icon:'nhentai',
          creds:[{id:'key', label:'API Key'}],
          vals:{key: (s.credentials?.nhentai?.key || '')},
          backends:['api_raw','gallerydl']},
        {id:'ehentai', nameKey:'siteEhentai', icon:'ehentai',
          creds:[{id:'key', label:'API Key'}],
          vals:{key: (s.credentials?.ehentai?.key || '')},
          backends:['api_raw','gallerydl']},
        {id:'kemono', nameKey:'siteKemono', icon:'kemono',
          creds:[], backends:['gallerydl']},
        {id:'coomer', nameKey:'siteCoomer', icon:'coomer',
          creds:[], backends:['gallerydl']},
      ];
      var html =
        '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="navApiKeys">' + _t('navApiKeys') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsApiCreds">' + _t('settingsApiCreds') + '</span></div>';
      var hasCred = [], noCred = [];
      sites.forEach(function(s) { (s.creds.length > 0 ? hasCred : noCred).push(s); });

      hasCred.forEach(function(site) {
        var currentBackend = fb[site.id] || site.backends[0];
        var isAvail = bs[currentBackend] !== false;
        var optsHtml = '';
        site.backends.forEach(function(b) {
          var bAvail = bs[b] !== false;
          optsHtml += '<option value="' + b + '"' + (currentBackend === b ? ' selected' : '') + '>' +
            (backendLabels[b] || b) + (bAvail ? '' : ' (N/A)') + '</option>';
        });
        html += '<div class="backend-card">' +
          '<div class="backend-card-header">' +
          '<div class="backend-card-site">' +
          '<span class="backend-icon" id="admIcon' + site.id + '"></span>' +
          '<span class="backend-card-name"><span data-i18n="' + site.nameKey + '">' + _t(site.nameKey) + '</span></span>' +
          '</div>' +
          '<div class="backend-header-actions">' +
          '<span class="backend-badge ' + (isAvail ? 'backend-badge-ok' : 'backend-badge-err') + '">' +
          (backendIcons[currentBackend] || '') +
          '<span>' + (backendLabels[currentBackend] || currentBackend) + '</span></span>' +
          '<select class="admin-field-input backend-select backend-select-sm" data-site="' + site.id + '">' + optsHtml + '</select>' +
          '</div>' +
          '</div>';
        if (site.creds.length > 0) {
          html += '<div class="backend-card-credentials">';
          site.creds.forEach(function(k) {
            html += '<div class="backend-field-wrap"><label class="admin-field-label">' + k.label + '</label>' +
              '<input class="admin-field-input" id="adm' + site.id + k.id + '" value="' + _esc(site.vals[k.id] || '') + '" placeholder="' + k.label + '"></div>';
          });
          html += '</div>';
        }
        html += '</div>';
      });

      if (noCred.length > 0) {
        html += '<div class="backend-nokey-row">';
        noCred.forEach(function(site) {
          var currentBackend = fb[site.id] || site.backends[0];
          var optsHtml = '';
          site.backends.forEach(function(b) {
            var bAvail = bs[b] !== false;
            optsHtml += '<option value="' + b + '"' + (currentBackend === b ? ' selected' : '') + '>' +
              (backendLabels[b] || b) + (bAvail ? '' : ' (N/A)') + '</option>';
          });
          html += '<div class="backend-nokey-item">' +
            '<span class="backend-icon" id="admIcon' + site.id + '"></span>' +
            '<span class="backend-nokey-name"><span data-i18n="' + site.nameKey + '">' + _t(site.nameKey) + '</span></span>' +
            '<select class="backend-select backend-select-sm" data-site="' + site.id + '">' + optsHtml + '</select>' +
            '</div>';
        });
        html += '</div>';
      }
      html +=
        '<button class="btn btn-primary" onclick="AdminDashboard._saveApiKeys()" style="margin-top:12px"><span data-i18n="settingsSaveStart">' + _t('settingsSaveStart') + '</span></button>' +
        '</div>';
      html += '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="sectionCredential">' + _t('sectionCredential') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="credBackendDesc">' + _t('credBackendDesc') + '</span></div>';
      var active = this._cred.active || 'plain';
      var available = this._cred.available || ['KeyringStore', 'plain'];
      available.forEach(function(name) {
        var isActive = (name === active) || (name === 'KeyringStore' && active === 'KeyringStore');
        var labelKey = name === 'KeyringStore' ? 'credKeyring' : 'credPlainText';
        var descKey = name === 'KeyringStore' ? 'secKeyring' : 'secPlainText';
        html += '<div class="cred-option' + (isActive ? ' active' : '') + '" onclick="AdminDashboard._saveCredBackend(\'' + name + '\', this)">' +
          '<input type="radio" name="credBackend" value="' + name + '"' + (isActive ? ' checked' : '') + '>' +
          '<div class="cred-option-info">' +
          '<div class="cred-option-title"><span data-i18n="' + labelKey + '">' + _t(labelKey) + '</span></div>' +
          '<div class="cred-option-desc"><span data-i18n="' + descKey + '">' + _t(descKey) + '</span></div></div></div>';
      });
      html += '<div id="credStatus" style="font-size:12px;color:var(--text2);margin-top:8px">' +
        '<span data-i18n="credStatus">' + _t('credStatus') + '</span>: <strong>' + active + '</strong></div></div>';
      body.innerHTML = html;
      sites.forEach(function(site) {
        var iconEl = document.getElementById('admIcon' + site.id);
        if (iconEl && window.SiteIcons) {
          var img = window.SiteIcons.getIconImg(site.id, 20);
          if (img) iconEl.innerHTML = img;
        }
      });
    }
  };

  // ─── FOLDERS (redirect to Database — folded into Database section) ───
  _sections.folders = {
    render: function(body) {
      loadSection('database');
    }
  };



  /* ─── USER ACTIONS ─── */

  function _togglePw(id, el) {
    var input = document.getElementById(id);
    if (!input) return;
    var isPw = input.type === 'password';
    input.type = isPw ? 'text' : 'password';
    el.querySelector('svg').innerHTML = isPw
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  }

  function _addUser() {
    _modal(
      '<div class="admin-modal-title"><span data-i18n="userAddBtn">' + _t('userAddBtn') + '</span></div>' +
      '<div class="admin-field"><label class="admin-field-label"><span data-i18n="secUsername">' + _t('secUsername') + '</span></label><input class="admin-field-input" id="newUserName" placeholder="' + _t('secUsername') + '"></div>' +
      '<div class="admin-field"><label class="admin-field-label"><span data-i18n="secPassword">' + _t('secPassword') + '</span></label><div class="pw-field"><input class="admin-field-input" id="newUserPass" type="password" placeholder="' + _t('secPassword') + '"><button class="pw-toggle" onclick="AdminDashboard._togglePw(\'newUserPass\', this)" tabindex="-1" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>' +
      '<div class="admin-field"><label class="admin-field-label"><span data-i18n="secRole">' + _t('secRole') + '</span></label>' +
      '<select class="admin-field-input" id="newUserRole"><option value="user"><span data-i18n="userRoleUser">' + _t('userRoleUser') + '</span></option><option value="admin"><span data-i18n="userRoleAdmin">' + _t('userRoleAdmin') + '</span></option></select></div>' +
      '<div class="admin-modal-actions">' +
      '<button class="btn" onclick="AdminDashboard._closeModal()"><span data-i18n="cancel">' + _t('cancel') + '</span></button>' +
      '<button class="btn btn-primary" onclick="AdminDashboard._createUser()"><span data-i18n="userAddBtn">' + _t('userAddBtn') + '</span></button></div>'
    );
  }

  function _createUser() {
    var username = document.getElementById('newUserName').value.trim();
    var password = document.getElementById('newUserPass').value;
    var role = document.getElementById('newUserRole').value;
    if (!username || !password) { _toast(_t('secUserReq'), 'error'); return; }
    _api('/api/admin/users', {method:'POST', body:{username:username, password:password, role:role}}).then(function() {
      _toast(_t('userAddBtn') + ' — OK', 'success');
      _closeModal();
      _sections.users.render(document.getElementById('adminContentBody'));
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _deleteUser(id, username) {
    _modal(
      '<div class="admin-modal-title"><span data-i18n="delete">' + _t('delete') + '</span></div>' +
      '<div class="admin-modal-actions">' +
      '<button class="btn" onclick="AdminDashboard._closeModal()"><span data-i18n="cancel">' + _t('cancel') + '</span></button>' +
      '<button class="btn btn-danger" onclick="AdminDashboard._confirmDeleteUser(' + id + ')"><span data-i18n="delete">' + _t('delete') + '</span></button></div>'
    );
  }

  function _confirmDeleteUser(id) {
    _api('/api/admin/users/' + id, {method:'DELETE'}).then(function() {
      _toast(_t('delete') + ' — OK', 'success');
      _closeModal();
      _sections.users.render(document.getElementById('adminContentBody'));
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _toggleRole(id) {
    var u = _users.find(function(x) { return x.id === id; });
    if (!u) return;
    var newRole = u.role === 'admin' ? 'user' : 'admin';
    // Warn if demoting the last admin
    if (u.role === 'admin') {
      var adminCount = _users.filter(function(x) { return x.role === 'admin'; }).length;
      if (adminCount <= 1 && !confirm(_t('lastAdminWarning') || 'This is the last admin! Are you sure?')) return;
    }
    _api('/api/admin/users/' + id + '/role', {method:'POST', body:{role:newRole}}).then(function() {
      _toast(_t('secRole') + ' → ' + _t(newRole === 'admin' ? 'userRoleAdmin' : 'userRoleUser'), 'success');
      _sections.users.render(document.getElementById('adminContentBody'));
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _setPassword(id) {
    _modal(
      '<div class="admin-modal-title"><span data-i18n="userSetPasswordBtn">' + _t('userSetPasswordBtn') + '</span></div>' +
      '<div class="admin-field"><label class="admin-field-label"><span data-i18n="secNewPassword">' + _t('secNewPassword') + '</span></label><div class="pw-field"><input class="admin-field-input" id="admSetPass" type="password" placeholder="' + _t('secNewPassword') + '"><button class="pw-toggle" onclick="AdminDashboard._togglePw(\'admSetPass\', this)" tabindex="-1" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>' +
      '<div class="admin-modal-actions">' +
      '<button class="btn" onclick="AdminDashboard._closeModal()"><span data-i18n="cancel">' + _t('cancel') + '</span></button>' +
      '<button class="btn btn-primary" onclick="AdminDashboard._confirmSetPassword(' + id + ')"><span data-i18n="save">' + _t('save') + '</span></button></div>'
    );
  }

  function _confirmSetPassword(id) {
    var pwd = document.getElementById('admSetPass').value;
    if (!pwd || pwd.length < 4) { _toast(_t('secPwTooShort'), 'error'); return; }
    _api('/api/admin/users/' + id + '/password', {method:'POST', body:{password:pwd}}).then(function() {
      _toast(_t('secPwSet'), 'success');
      _closeModal();
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  /* ─── DB ACTIONS ─── */

  var _regenES = null;

  function _dbAction(action) {
    var confirmKey = '';
    var apiPath = '';
    switch (action) {
      case 'export': return _exportDb();
      case 'import': return _importDb();
      case 'findDup': return _findDuplicates();
      case 'rehash': return _rehashAction();
      case 'dedup': confirmKey = 'secConfirmDedup'; apiPath = '/api/deduplicate'; break;
      case 'clearThumbs': confirmKey = 'secConfirmClearThumb'; apiPath = '/api/clear_thumb_cache'; break;
      case 'clearBrowserCache': confirmKey = 'secConfirmClearBrowser'; apiPath = '/api/clear_browser_cache'; break;
      case 'clearTags': confirmKey = 'secConfirmClearTag'; apiPath = '/api/clear_tags'; break;
      case 'clearFiles': confirmKey = 'secConfirmClearDb'; apiPath = '/api/clear_database'; break;
      case 'clearAll': confirmKey = 'secConfirmClearAll'; apiPath = '/api/delete_all'; break;
      case 'regenThumbs': confirmKey = 'secConfirmRegenThumb'; apiPath = 'sse'; break;
      case 'regenMissing': apiPath = '/api/generate_missing_thumbnails'; break;
      case 'findOriginals': return FindOriginals.open();
    }
    if (confirmKey) {
      _modal(
        '<div class="admin-modal-title"><span data-i18n="confirmDelete">' + _t('confirmDelete') + '</span></div>' +
        '<p style="color:var(--text2);margin-bottom:16px"><span data-i18n="' + confirmKey + '">' + _t(confirmKey) + '</span></p>' +
        '<div class="admin-modal-actions">' +
        '<button class="btn" onclick="AdminDashboard._closeModal()"><span data-i18n="cancel">' + _t('cancel') + '</span></button>' +
        '<button class="btn btn-danger" onclick="AdminDashboard._execDbAction(\'' + apiPath + '\')"><span data-i18n="confirmDelete">' + _t('confirmDelete') + '</span></button></div>'
      );
    } else {
      _execDbAction(apiPath);
    }
  }

  function _execDbAction(apiPath) {
    _closeModal();
    if (apiPath === 'sse') {
      _startRegenSSE();
      return;
    }
    var bodyEl = document.getElementById('adminContentBody');
    if (apiPath === '/api/generate_missing_thumbnails') {
      _showProgress();
      _showCancelBtn(false);
    }
    _api(apiPath, {method:'POST'}).then(function(data) {
      _toast(_t('settingsCleared'), 'success');
      if (apiPath === '/api/generate_missing_thumbnails') {
        _pollProgress();
      }
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _showProgress() {
    var card = document.getElementById('adminProgressCard');
    if (card) card.style.display = 'block';
  }

  function _hideProgress() {
    var card = document.getElementById('adminProgressCard');
    if (card) card.style.display = 'none';
  }

  function _showCancelBtn(show) {
    var btn = document.getElementById('adminCancelRegenBtn');
    if (btn) btn.style.display = show ? '' : 'none';
  }

  /* ─── FIND DUPLICATES ─── */

  function _findDuplicates() {
    _modal(
      '<div class="admin-modal-title">' + _t('findDuplicatesRunning') + '</div>' +
      '<p style="color:var(--text2)"><span class="fetch-spinner"></span></p>'
    );
    _api('/api/find-duplicates', {method:'POST'}).then(function(data) {
      if (!data.groups || data.groups.length === 0) {
        _modal(
          '<div class="admin-modal-title">' + _t('noDuplicates') + '</div>' +
          '<div class="admin-modal-actions"><button class="btn" onclick="AdminDashboard._closeModal()">' + _t('close') + '</button></div>'
        );
        return;
      }
      _renderDuplicateModal(data.groups);
    var content = document.querySelector('#adminModal .admin-modal-content');
    if (content) content.style.maxWidth = '900px';
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _renderDuplicateModal(groups) {
    var html = '<div class="admin-modal-title">' + _t('duplicatesFound') + ' ' + groups.length + '</div>' +
      '<div class="dup-groups" style="max-height:70vh;overflow-y:auto">';
    groups.forEach(function(g, gi) {
      html += '<div class="dup-group" style="margin-bottom:16px;border:1px solid var(--border);border-radius:10px;padding:12px">' +
        '<div style="font-size:12px;color:var(--text2);margin-bottom:10px;font-weight:600">' +
        _esc(g.key) + ' (' + g.files.length + ' ' + _t('files') + ')</div>';
      g.files.forEach(function(f, fi) {
        var thumbUrl = '/api/thumbnail?path=' + encodeURIComponent(f.path);
        var checked = f.keeper ? '' : 'checked';
        var tagList = (f.tags || '').split(',').filter(function(t){ return t.trim(); });
        html += '<div class="dup-file" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;padding:8px;border-radius:8px;border:2px solid transparent;transition:border-color .15s;margin-bottom:4px">' +
          '<input type="checkbox" class="dup-cb" ' + checked + ' style="display:none" data-path="' + _esc(f.path) + '" data-group="' + gi + '">' +
          '<div style="width:150px;height:150px;flex-shrink:0;background:var(--surface2);border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center">' +
          '<img src="' + thumbUrl + '" loading="lazy" style="max-width:150px;max-height:150px;object-fit:contain" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13px;font-weight:600;color:var(--text);word-break:break-all;line-height:1.3;margin-bottom:4px">' + _esc(f.name) + '</div>' +
          (f.is_sample ? '<span style="display:inline-block;font-size:10px;background:var(--accent-glow);color:var(--accent);padding:1px 6px;border-radius:3px;margin-bottom:4px">sample</span>' : '') +
          (tagList.length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:4px">' + tagList.slice(0, 20).map(function(t){
            return '<span class="tag-chip" style="font-size:10px">' + _esc(t.trim()) + '</span>';
          }).join('') + (tagList.length > 20 ? '<span style="font-size:10px;color:var(--text2)"> +' + (tagList.length - 20) + '</span>' : '') + '</div>' : '') +
          '<div style="font-size:11px;color:var(--text2);margin-top:4px">' + _esc(f.path || '') + '</div>' +
          '</div></div>';
      });
      html += '</div>';
    });
    html += '</div><div class="admin-modal-actions">' +
      '<button class="btn" onclick="AdminDashboard._closeModal()">' + _t('cancel') + '</button>' +
      '<button class="btn btn-danger" onclick="AdminDashboard._removeDupSelected()">' + _t('remDupSelected') + '</button></div>';
    _modal(html);
    document.querySelectorAll('.dup-file').forEach(function(el) {
      el.addEventListener('click', function(e) {
        if (e.target.closest('.dup-cb') || e.target.closest('.tag-chip')) return;
        var cb = el.querySelector('.dup-cb');
        if (cb) { cb.checked = !cb.checked; }
      });
    });
  }

  function _removeDupSelected() {
    var paths = [];
    document.querySelectorAll('.dup-cb:checked').forEach(function(cb) {
      paths.push(cb.getAttribute('data-path'));
    });
    if (paths.length === 0) { _toast('No files selected', 'error'); return; }
    _api('/api/remove-duplicates', {method:'POST', body: {paths: paths}}).then(function(data) {
      _closeModal();
      _toast(_t('settingsCleared'), 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  /* ─── REHASH ─── */

  function _rehashAction() {
    _modal(
      '<div class="admin-modal-title">' + _t('rehashRunning') + '</div>' +
      '<p style="color:var(--text2)"><span class="fetch-spinner"></span></p>'
    );
    _api('/api/rehash', {method:'POST'}).then(function(data) {
      if (data.total === 0) {
        _modal(
          '<div class="admin-modal-title">' + _t('noDuplicates') + '</div>' +
          '<div class="admin-modal-actions"><button class="btn" onclick="AdminDashboard._closeModal()">' + _t('close') + '</button></div>'
        );
        return;
      }
      _pollRehash();
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _pollRehash() {
    var timer = setInterval(function() {
      _api('/api/rehash-progress').then(function(data) {
        if (data.status === 'done') {
          clearInterval(timer);
          _modal(
            '<div class="admin-modal-title">' + _t('settingsCleared') + '</div>' +
            '<div class="admin-modal-actions"><button class="btn" onclick="AdminDashboard._closeModal();AdminDashboard._findDuplicates()">' + _t('findDuplicates') + '</button></div>'
          );
        } else if (data.status === 'error') {
          clearInterval(timer);
          _toast(data.error || 'Rehash error', 'error');
          _closeModal();
        } else {
          var pct = data.total > 0 ? Math.round(data.done / data.total * 100) : 0;
          _modal(
            '<div class="admin-modal-title">' + _t('rehashRunning') + '</div>' +
            '<div class="progress-bar-wrap" style="background:var(--surface2);border-radius:8px;height:8px;overflow:hidden;margin:8px 0"><div style="height:100%;width:' + pct + '%;background:var(--accent);border-radius:8px;transition:width .3s"></div></div>' +
            '<p style="color:var(--text2);font-size:13px">' + data.done + '/' + data.total + '</p>'
          );
        }
      }).catch(function() { clearInterval(timer); });
    }, 1000);
  }

  /* ─── REGEN SSE ─── */

  function _startRegenSSE() {
    if (_regenES) { _regenES.close(); _regenES = null; }
    _showProgress();
    _showCancelBtn(true);
    var bar = document.getElementById('adminProgressBar');
    var txt = document.getElementById('adminProgressText');
    if (bar) bar.style.width = '0%';
    if (txt) txt.textContent = _t('settingsRunning');

    _regenES = new EventSource('/api/regenerate_thumbnails/stream');
    _regenES.addEventListener('message', function(e) {
      try {
        var data = JSON.parse(e.data);
        if (data.type === 'start') {
          if (bar && txt) {
            txt.textContent = '0 / ' + data.total + ' (' + _t('settingsRunning') + '...)';
          }
        } else if (data.type === 'progress') {
          var pct = data.total > 0 ? Math.round(data.current / data.total * 100) : 0;
          if (bar) bar.style.width = pct + '%';
          if (txt) {
            var label = data.current + ' / ' + data.total;
            if (data.generated > 0) label += ' (' + _t('settingsGenerated') + ': ' + data.generated + ')';
            if (data.skipped > 0) label += ' (' + _t('settingsSkipped') + ': ' + data.skipped + ')';
            if (data.failed > 0) label += ' (' + _t('settingsFailed') + ': ' + data.failed + ')';
            txt.textContent = label + ' (' + _t('settingsRunning') + '...)';
          }
        } else if (data.type === 'done') {
          _regenES.close();
          _regenES = null;
          _showCancelBtn(false);
          if (bar) bar.style.width = '100%';
          if (txt) {
            var label = data.total + ' ' + _t('settingsProcessed');
            if (data.generated > 0) label += ' (' + _t('settingsGenerated') + ': ' + data.generated + ')';
            if (data.skipped > 0) label += ' (' + _t('settingsSkipped') + ': ' + data.skipped + ')';
            if (data.failed > 0) label += ' (' + _t('settingsFailed') + ': ' + data.failed + ')';
            txt.textContent = label;
          }
          _toast(_t('settingsCleared'), 'success');
          setTimeout(_hideProgress, 4000);
        } else if (data.type === 'cancelled') {
          _regenES.close();
          _regenES = null;
          _showCancelBtn(false);
          if (txt) {
            var label = _t('cancel') + ' — ' + data.current + ' / ' + data.total;
            if (data.generated > 0) label += ' (' + _t('settingsGenerated') + ': ' + data.generated + ')';
            txt.textContent = label;
          }
          setTimeout(_hideProgress, 3000);
        } else if (data.type === 'error') {
          _regenES.close();
          _regenES = null;
          _showCancelBtn(false);
          if (txt) txt.textContent = _t('settingsError') + ': ' + data.message;
          _toast(data.message || _t('settingsError'), 'error');
          setTimeout(_hideProgress, 4000);
        }
      } catch(e) {}
    });
    _regenES.addEventListener('error', function() {
      if (_regenES) {
        _regenES.close();
        _regenES = null;
      }
      _showCancelBtn(false);
      if (txt) txt.textContent = _t('settingsError');
    });
  }

  function _cancelRegen() {
    var btn = document.getElementById('adminCancelRegenBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = _t('settingsCancelling'); }
    _api('/api/cancel_regen', {method:'POST'}).then(function() {
    }).catch(function() {});
  }

  function _pollProgress() {
    var interval = setInterval(function() {
      _api('/api/regenerate_thumbnails_status').then(function(data) {
        var bar = document.getElementById('adminProgressBar');
        var txt = document.getElementById('adminProgressText');
        if (bar && txt) {
          var pct = data.total > 0 ? Math.round(data.current / data.total * 100) : 0;
          bar.style.width = pct + '%';
          var label = data.current + ' / ' + data.total;
          if (data.skipped > 0) label += ' (' + _t('settingsSkipped') + ': ' + data.skipped + ')';
          txt.textContent = label + ' (' + _t('settingsRunning') + '...)';
        }
        if (!data.running) {
          clearInterval(interval);
          var label = data.total + ' ' + _t('settingsProcessed');
          if (data.skipped > 0) label += ' (' + _t('settingsSkipped') + ': ' + data.skipped + ')';
          if (txt) txt.textContent = label;
          setTimeout(function() {
            var card = document.getElementById('adminProgressCard');
            if (card) card.style.display = 'none';
          }, 3000);
        }
      }).catch(function() { clearInterval(interval); });
    }, 1000);
  }

  function _exportDb() {
    window.open('/api/export_db', '_blank');
  }

  function _importDb() {
    _modal(
      '<div class="admin-modal-title"><span data-i18n="dbImport">' + _t('dbImport') + '</span></div>' +
      '<p style="font-size:12px;color:var(--text2);margin-top:4px"><span data-i18n="secConfirmClearAll">' + _t('secConfirmClearAll') + '</span></p>' +
      '<div class="adm-import-file-wrap">' +
        '<button class="btn" onclick="document.getElementById(\'admImportFile\').click()">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
          '<span id="admImportLabel" data-i18n="chooseFile">Choose .db file...</span>' +
        '</button>' +
        '<input type="file" id="admImportFile" accept=".db,.sqlite,.sqlite3" onchange="document.getElementById(\'admImportLabel\').textContent=this.files[0]?.name||\'Choose .db file...\'" style="display:none">' +
      '</div>' +
      '<button class="btn btn-danger admin-import-btn" onclick="AdminDashboard._confirmImport()"><span data-i18n="dbImport">' + _t('dbImport') + '</span></button></div>'
    );
  }

  function _confirmImport() {
    var fileInput = document.getElementById('admImportFile');
    if (!fileInput || !fileInput.files || !fileInput.files[0]) { _toast(_t('settingsSelectFolder'), 'error'); return; }
    var formData = new FormData();
    formData.append('file', fileInput.files[0]);
    fetch('/api/import_db', {method:'POST', body:formData}).then(function(r) { return r.json(); }).then(function(d) {
      if (d.error) throw new Error(d.error);
      _toast(_t('dbImport') + ' — OK', 'success');
      _closeModal();
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  /* ─── API KEYS ACTIONS ─── */

  function _saveApiKeys() {
    function _val(id) { return (document.getElementById(id) || {}).value || ''; }
    var data = {
      credentials: {
        rule34: { uid: _val('admrule34uid'), key: _val('admrule34key') },
        danbooru: { login: _val('admdanboorulogin'), key: _val('admdanboorukey') },
        nhentai: { key: _val('admnhentaikey') },
        ehentai: { key: _val('admehentaikey') }
      }
    };
    var selects = document.querySelectorAll('.backend-select');
    var fetch_backend = {};
    selects.forEach(function(sel) {
      fetch_backend[sel.dataset.site] = sel.value;
    });
    data.fetch_backend = fetch_backend;
    _saveSettings(data);
  }

  function _saveCredBackend(name, el) {
    document.querySelectorAll('.cred-option').forEach(function(o) { o.classList.remove('active'); });
    el.classList.add('active');
    el.querySelector('input[type="radio"]').checked = true;
    _api('/api/set_credential_backend', {method:'POST', body:{backend:name}}).then(function(d) {
      var st = document.getElementById('credStatus');
      if (st) st.innerHTML = _t('credStatus') + ': <strong>' + (d.current || name) + '</strong>';
      _toast(_t('settingsSaveStart') + ' — OK', 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  /* ─── FOLDER ACTIONS ─── */

  function _saveFolderSettings() {
    var data = {
      media_dir: document.getElementById('admMediaDir').value.trim(),
      gallery_dir: document.getElementById('galleryDir').value.trim(),
      comics_dir: document.getElementById('comicsDir').value.trim(),
      downloads_dir: document.getElementById('downloadsDir').value.trim(),
    };
    _saveSettings(data);
  }

  function _pickFolder() {
    _api('/api/pick_folder', {method:'POST', body:{}}).then(function(d) {
      if (d.path) {
        document.getElementById('admMediaDir').value = d.path;
      }
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _scanFolder() {
    var dir = document.getElementById('admMediaDir').value.trim();
    if (!dir) { _toast(_t('settingsSelectFolder'), 'error'); return; }
    _api('/api/settings', {method:'POST', body:{media_dir:dir}}).then(function() {
      return _api('/api/scan_folder', {method:'POST'});
    }).then(function(d) {
      if (d.skipped === 'scan_in_progress') {
        _toast('Scan already in progress', 'error');
        return;
      }
      _toast('Scan started', 'success');
      _startScanProgressPoll();
    }).catch(function(e) { 
      _toast(e.message, 'error'); 
    });
  }

  function _rescanFolder() {
    _api('/api/scan_folder', {method:'POST'}).then(function(d) {
      if (d.skipped === 'scan_in_progress') {
        _toast('Scan already in progress', 'error');
        return;
      }
      _toast('Rescan started', 'success');
      _startScanProgressPoll();
    }).catch(function(e) {
      _toast(e.message, 'error');
    });
  }

  /* ─── SCAN PROGRESS POLLING ─── */

  var _scanPollTimer = null;

  function _startScanProgressPoll() {
    _stopScanProgressPoll();
    var el = document.getElementById('admScanProgress');
    if (el) el.style.display = 'block';
    var bar = document.getElementById('admScanProgressBar');
    if (bar) bar.style.width = '0%';
    _updateScanProgress();
    _scanPollTimer = setInterval(_updateScanProgress, 2000);
  }

  function _stopScanProgressPoll() {
    if (_scanPollTimer) { clearInterval(_scanPollTimer); _scanPollTimer = null; }
  }

  function _updateScanProgress() {
    _api('/api/admin/scan-progress').then(function(data) {
      var bar = document.getElementById('admScanProgressBar');
      var text = document.getElementById('admScanProgressText');
      if (!bar || !text) return;
      if (data.status === 'scanning') {
        var pct = data.total_folders > 0
          ? Math.round(data.folders_done / data.total_folders * 100)
          : 50;
        bar.style.width = Math.min(pct, 100) + '%';
        if (data.total_folders > 0 && data.current_folder) {
          text.textContent = _t('settingsRunning') + ' — ' + _t('settingsFolder') + ' ' + data.folders_done + '/' + data.total_folders + ': ' + data.current_folder;
        } else {
          text.textContent = _t('settingsRunning') + '...';
        }
      } else if (data.status === 'done') {
        bar.style.width = '100%';
        text.textContent = 'Scan complete';
        _stopScanProgressPoll();
        setTimeout(_hideScanProgress, 3000);
      } else if (data.status === 'error') {
        text.textContent = _t('settingsError') + ': ' + (data.error || '');
        _stopScanProgressPoll();
        setTimeout(_hideScanProgress, 5000);
      } else if (data.status === 'idle') {
        _hideScanProgress();
        _stopScanProgressPoll();
      }
    }).catch(function() {
      _stopScanProgressPoll();
    });
  }

  function _hideScanProgress() {
    var el = document.getElementById('admScanProgress');
    if (el) el.style.display = 'none';
  }

  var _mountTimer = null;

  function _checkMount() {
    _api('/api/content-search/mount-check', {method:'GET'}).then(function(d) {
      var ok = d.mounted && !d.empty;
      var html = ok
        ? '<span class="mount-dot mount-dot-green"></span><span class="mount-badge mount-ok">' + _t('settingsMountOk') + '</span>'
        : '<span class="mount-dot mount-dot-red"></span><span class="mount-badge mount-fail">' + _t('settingsMountFail') + '</span>';
      var headEl = document.getElementById('admMountIndicator');
      if (headEl) headEl.innerHTML = html;
    }).catch(function(e) {
      var msg = '<span class="mount-dot mount-dot-red"></span><span class="mount-badge mount-fail">' + e.message + '</span>';
      var headEl = document.getElementById('admMountIndicator');
      if (headEl) headEl.innerHTML = msg;
    });
  }

  function _checkScanStatus() {
    _api('/api/admin/scan-progress').then(function(data) {
      var st = document.getElementById('admScanStatus');
      if (st) {
        if (data.status === 'scanning') {
          var folderLabel = data.current_folder || '';
          st.textContent = 'scanning' + (folderLabel ? ': ' + folderLabel : '...');
        } else if (data.status === 'idle') {
          st.textContent = '';
        }
      }
    }).catch(function() {});
  }

  // Auto-recheck mount every 30s while section is visible
  function _startMountWatch() {
    _stopMountWatch();
    _checkMount();
    _checkScanStatus();
    _mountTimer = setInterval(function() {
      _checkMount();
      _checkScanStatus();
    }, 300000);
  }
  function _stopMountWatch() {
    if (_mountTimer) { clearInterval(_mountTimer); _mountTimer = null; }
  }

  function _createFolders() {
    _api('/api/content-search/create-folders', {method:'POST'}).then(function(d) {
      var parts = [];
      if (d.created && d.created.length) parts.push(_t('settingsCreateFoldersDone') + ': ' + d.created.join(', '));
      if (d.existing && d.existing.length) parts.push(_t('settingsFoldersExist') + ': ' + d.existing.join(', '));
      _toast(parts.join('; ') || _t('settingsCreateFoldersDone'), 'success');
      _checkMount();
    }).catch(function(e) {
      _toast(e.message, 'error');
    });
  }

  /* ─── UTILITIES ─── */

  function _esc(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function _saveSettings(data, msg) {
    _api('/api/settings', {method:'POST', body:data}).then(function() {
      _toast((msg || _t('settingsSaveStart')) + ' — OK', 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _errorFallback(body, e) {
    body.innerHTML = '<div class="admin-loading" style="color:var(--danger)"><span data-i18n="settingsError">' + _t('settingsError') + '</span>: ' + e.message + '</div>';
  }

  var _selfId = null;

  /* ─── ROUTER ─── */

  function loadSection(name) {
    if (!_sections[name]) return;
    _stopMountWatch();
    _current = name;
    var navEls = document.querySelectorAll('.admin-nav-item, .mv-mh-icon[data-section], .admin-header a[data-section]');
    navEls.forEach(function(el) {
      el.classList.toggle('active', el.dataset.section === name);
    });
    var titleEl = document.getElementById('adminPageTitle');
    if (titleEl) {
      var names = {users: 'navUsers', database: 'navDatabase', 'api-keys': 'navApiKeys'};
      var key = names[name] || name;
      titleEl.innerHTML = '<span data-i18n="' + key + '">' + _t(key) + '</span>';
    }
    var body = document.getElementById('adminContentBody');
    _loading(body);
    setTimeout(function() { _sections[name].render(body); }, 50);
  }

  function init() {
    _selfId = parseInt(document.getElementById('adminView').dataset.selfId || '0', 10);
    loadSection('users');
    _startMountWatch();
  }

  return {
    init: init,
    load: loadSection,

    _addUser: _addUser,
    _createUser: _createUser,
    _deleteUser: _deleteUser,
    _confirmDeleteUser: _confirmDeleteUser,
    _toggleRole: _toggleRole,
    _setPassword: _setPassword,
    _confirmSetPassword: _confirmSetPassword,
    _dbAction: _dbAction,
    _execDbAction: _execDbAction,
    _saveApiKeys: _saveApiKeys,
    _saveCredBackend: _saveCredBackend,
    _pickFolder: _pickFolder,
    _scanFolder: _scanFolder,
    _rescanFolder: _rescanFolder,
    _checkMount: _checkMount,
    _createFolders: _createFolders,
    _saveFolderSettings: _saveFolderSettings,
    _closeModal: _closeModal,
    _findDuplicates: _findDuplicates,
    _removeDupSelected: _removeDupSelected,
    _rehashAction: _rehashAction,
    _togglePw: _togglePw,
    _startScanProgressPoll: _startScanProgressPoll,
    _stopScanProgressPoll: _stopScanProgressPoll,
    _updateScanProgress: _updateScanProgress,
    _hideScanProgress: _hideScanProgress
  };
})();
