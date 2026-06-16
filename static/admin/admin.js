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
      }).catch(function(e) {
        body.innerHTML = '<div class="admin-loading" style="color:var(--danger)"><span data-i18n="settingsError">' + _t('settingsError') + '</span>: ' + e.message + '</div>';
      });
    },

    _renderTable: function(body) {
      var self = this;
      var html = '<div class="admin-card"><div class="admin-card-header">' +
        '<span class="admin-card-title"><span data-i18n="navUsers">' + _t('navUsers') + '</span></span>' +
        '<button class="btn btn-sm btn-primary" onclick="AdminDashboard._addUser()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="vertical-align:middle;margin-right:4px"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>' +
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
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:middle;margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<span data-i18n="userSetPasswordBtn">' + _t('userSetPasswordBtn') + '</span></button>';
          if (!isSelf) {
            html += '<button class="action-btn" onclick="AdminDashboard._toggleRole(' + u.id + ')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:middle;margin-right:4px"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>' +
              '<span data-i18n="' + (u.role === 'admin' ? 'userRoleUser' : 'userRoleAdmin') + '">' + _t(u.role === 'admin' ? 'userRoleUser' : 'userRoleAdmin') + '</span></button>';
          }
          if (!isSelf && !isLastAdmin) {
            html += '<button class="action-btn danger" onclick="AdminDashboard._deleteUser(' + u.id + ', \'' + _esc(u.username) + '\')">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:middle;margin-right:4px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
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

  // ─── DATABASE ───
  _sections.database = {
    render: function(body) {
      body.innerHTML =
        '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="sectionDatabase">' + _t('sectionDatabase') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsDb">' + _t('settingsDb') + '</span></div>' +
        '<div class="db-grid">' +
        this._tool('dbExport', 'exportDb', 'export', false) +
        this._tool('dbImport', 'importDb', 'import', false) +
        this._tool('dbDeduplicate', 'settingsCleanDuplicates', 'dedup', false) +
        this._tool('dbClearThumbs', 'settingsClearCache', 'clearThumbs', true) +
        this._tool('dbClearTags', 'settingsCleanTagCache', 'clearTags', true) +
        this._tool('dbClearFiles', 'settingsCleanDb', 'clearFiles', true) +
        this._tool('dbRegenThumbs', 'settingsRegenThumbnails', 'regenThumbs', false) +
        this._tool('dbRegenMissing', 'settingsRegenMissing', 'regenMissing', false) +
        this._tool('dbClearAll', 'settingsCleanAll', 'clearAll', true) +
        '</div></div>' +
        '<div class="admin-card" id="adminProgressCard" style="display:none">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="settingsRunning">' + _t('settingsRunning') + '</span></span>' +
        '<button class="btn btn-small btn-danger" id="adminCancelRegenBtn" style="display:none" onclick="AdminDashboard._cancelRegen()"><span data-i18n="settingsCancel">' + _t('settingsCancel') + '</span></button>' +
        '</div>' +
        '<div class="progress-bar-wrap" style="background:var(--surface2);border-radius:8px;height:8px;overflow:hidden;margin:8px 0">' +
        '<div id="adminProgressBar" style="height:100%;width:0%;background:var(--accent);border-radius:8px;transition:width .3s"></div></div>' +
        '<div id="adminProgressText" style="font-size:12px;color:var(--text2)"></div></div>';
    },

    _tool: function(labelKey, descKey, action, danger) {
      var icons = {
        export: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        import: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        dedup: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
        clearThumbs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        clearTags: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
        clearFiles: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
        regenThumbs: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
        regenMissing: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/><circle cx="12" cy="12" r="1"/></svg>',
        clearAll: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
      };
      return '<div class="db-tool' + (danger ? ' danger' : '') + '" onclick="AdminDashboard._dbAction(\'' + action + '\')">' +
        '<div class="db-tool-icon">' + (icons[action] || '') + '</div>' +
        '<div><div class="db-tool-label"><span data-i18n="' + labelKey + '">' + _t(labelKey) + '</span></div>' +
        '<div class="db-tool-desc"><span data-i18n="' + descKey + '">' + _t(descKey) + '</span></div></div></div>';
    }
  };

  // ─── API KEYS ───
  _sections['api-keys'] = {
    _settings: null,
    _cred: null,

    render: function(body) {
      _loading(body);
      var self = this;
      Promise.all([
        _api('/api/settings'),
        _api('/api/credential_status')
      ]).then(function(results) {
        self._settings = results[0];
        self._cred = results[1];
        self._renderForm(body);
      }).catch(function(e) {
        body.innerHTML = '<div class="admin-loading" style="color:var(--danger)"><span data-i18n="settingsError">' + _t('settingsError') + '</span>: ' + e.message + '</div>';
      });
    },

    _renderForm: function(body) {
      var s = this._settings;
      var html =
        '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="navApiKeys">' + _t('navApiKeys') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsApiCreds">' + _t('settingsApiCreds') + '</span></div>' +
        '<div class="admin-field-row">' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="settingsR34Uid">' + _t('settingsR34Uid') + '</span></label><input class="admin-field-input" id="admR34Uid" value="' + _esc(s.r34_uid || '') + '" placeholder="User ID"></div>' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="settingsR34Key">' + _t('settingsR34Key') + '</span></label><input class="admin-field-input" id="admR34Key" value="' + _esc(s.r34_key || '') + '" placeholder="API Key"></div>' +
        '</div>' +
        '<div class="admin-field-row">' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="settingsDanLogin">' + _t('settingsDanLogin') + '</span></label><input class="admin-field-input" id="admDanLogin" value="' + _esc(s.dan_login || '') + '" placeholder="Login"></div>' +
        '<div class="admin-field"><label class="admin-field-label"><span data-i18n="settingsDanKey">' + _t('settingsDanKey') + '</span></label><input class="admin-field-input" id="admDanKey" value="' + _esc(s.dan_key || '') + '" placeholder="API Key"></div>' +
        '</div>' +
        '<button class="btn btn-primary" onclick="AdminDashboard._saveApiKeys()" style="margin-top:8px"><span data-i18n="settingsSaveStart">' + _t('settingsSaveStart') + '</span></button>' +
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
        html += '<div class="cred-option' + (isActive ? ' active' : '') + '" onclick="AdminDashboard._selectBackend(\'' + name + '\', this)">' +
          '<input type="radio" name="credBackend" value="' + name + '"' + (isActive ? ' checked' : '') + '>' +
          '<div class="cred-option-info">' +
          '<div class="cred-option-title"><span data-i18n="' + labelKey + '">' + _t(labelKey) + '</span></div>' +
          '<div class="cred-option-desc"><span data-i18n="' + descKey + '">' + _t(descKey) + '</span></div></div></div>';
      });
      html += '<div id="credStatus" style="font-size:12px;color:var(--text2);margin-top:8px">' +
        '<span data-i18n="credStatus">' + _t('credStatus') + '</span>: <strong>' + active + '</strong></div></div>';

      html += '<div class="admin-card">' +
        '<div class="admin-card-header"><span class="admin-card-title"><span data-i18n="contentMedia">' + _t('contentMedia') + '</span></span></div>' +
        '<div class="admin-card-desc"><span data-i18n="settingsMediaPath">' + _t('settingsMediaPath') + '</span></div>' +
        '<div class="admin-field"><input class="admin-field-input" id="admMediaDir" value="' + _esc(s.media_dir || '') + '" placeholder="/path/to/media"></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="btn" onclick="AdminDashboard._pickFolder()"><span data-i18n="settingsSystemDialog">' + _t('settingsSystemDialog') + '</span></button>' +
        '<button class="btn btn-primary" onclick="AdminDashboard._scanFolder()"><span data-i18n="settingsScan">' + _t('settingsScan') + '</span></button>' +
        '</div></div>';
      body.innerHTML = html;
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
      case 'export': apiPath = '/api/export_db'; break;
      case 'import': return _importDb();
      case 'dedup': confirmKey = 'secConfirmDedup'; apiPath = '/api/deduplicate'; break;
      case 'clearThumbs': confirmKey = 'secConfirmClearThumb'; apiPath = '/api/clear_thumb_cache'; break;
      case 'clearBrowserCache': confirmKey = 'secConfirmClearBrowser'; apiPath = '/api/clear_browser_cache'; break;
      case 'clearTags': confirmKey = 'secConfirmClearTag'; apiPath = '/api/clear_tags'; break;
      case 'clearFiles': confirmKey = 'secConfirmClearDb'; apiPath = '/api/clear_database'; break;
      case 'clearAll': confirmKey = 'secConfirmClearAll'; apiPath = '/api/delete_all'; break;
      case 'regenThumbs': confirmKey = 'secConfirmRegenThumb'; apiPath = 'sse'; break;
      case 'regenMissing': apiPath = '/api/generate_missing_thumbnails'; break;
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

  function _importDb() {
    _modal(
      '<div class="admin-modal-title"><span data-i18n="dbImport">' + _t('dbImport') + '</span></div>' +
      '<p style="font-size:12px;color:var(--text2);margin-top:4px"><span data-i18n="secConfirmClearAll">' + _t('secConfirmClearAll') + '</span></p>' +
      '<button class="btn btn-danger" onclick="AdminDashboard._confirmImport()"><span data-i18n="dbImport">' + _t('dbImport') + '</span></button></div>'
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
    var data = {
      r34_uid: document.getElementById('admR34Uid').value.trim(),
      r34_key: document.getElementById('admR34Key').value.trim(),
      dan_login: document.getElementById('admDanLogin').value.trim(),
      dan_key: document.getElementById('admDanKey').value.trim()
    };
    _api('/api/settings', {method:'POST', body:data}).then(function() {
      _toast(_t('settingsSaveStart') + ' — OK', 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  function _selectBackend(name, el) {
    document.querySelectorAll('.cred-option').forEach(function(o) { o.classList.remove('active'); });
    el.classList.add('active');
    el.querySelector('input[type="radio"]').checked = true;
    _api('/api/set_credential_backend', {method:'POST', body:{backend:name}}).then(function(d) {
      var st = document.getElementById('credStatus');
      if (st) st.innerHTML = _t('credStatus') + ': <strong>' + (d.current || name) + '</strong>';
      _toast(_t('settingsSaveStart') + ' — OK', 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
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
      _toast(_t('settingsScan') + ' — ' + (d.found || 0) + ' ' + _t('filesCountShort'), 'success');
    }).catch(function(e) { _toast(e.message, 'error'); });
  }

  /* ─── UTILITIES ─── */

  function _esc(s) {
    if (typeof s !== 'string') return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  var _selfId = null;

  /* ─── ROUTER ─── */

  function loadSection(name) {
    if (!_sections[name]) return;
    _current = name;
    var navEls = document.querySelectorAll('.admin-nav-item, .mv-mh-icon[data-section]');
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
    _selectBackend: _selectBackend,
    _pickFolder: _pickFolder,
    _scanFolder: _scanFolder,
    _closeModal: _closeModal,
    _togglePw: _togglePw
  };
})();
