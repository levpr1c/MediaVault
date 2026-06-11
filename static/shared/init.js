// ============================================================
// Инициализация страницы: запуск нужного JS-модуля
// в зависимости от текущей страницы (tagfetch/mediavault/content)
// ============================================================
(function() {
  Shared.applyI18n();
  Shared.initThemeBtn();
  Shared.initLangBtn();

  // Mobile drawer toggle (header dropdown)
  var drawerBtn = document.getElementById('mobileMenuBtn');
  var drawer = document.getElementById('mobileDrawer');
  function toggleDrawer() {
    if (!drawer) return;
    var isOpen = drawer.classList.toggle('open');
    if (isOpen) drawerBtn.classList.add('active');
    else drawerBtn.classList.remove('active');
  }
  if (drawerBtn) drawerBtn.addEventListener('click', toggleDrawer);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { if (drawer) drawer.classList.remove('open'); if (drawerBtn) drawerBtn.classList.remove('active'); } });
  document.addEventListener('click', function(e) {
    if (drawer && drawer.classList.contains('open') && !drawer.contains(e.target) && e.target !== drawerBtn && !drawerBtn.contains(e.target)) {
      drawer.classList.remove('open');
      if (drawerBtn) drawerBtn.classList.remove('active');
    }
    document.querySelectorAll('.hdr-dropdown.open, .hm-account-dropdown.open').forEach(function(dd) {
      if (!e.target.closest('.hdr-account') && !e.target.closest('.hm-account')) {
        dd.classList.remove('open');
      }
    });
  });

  var page = window.CONFIG && CONFIG.page || 'home';

  if (window.CONFIG && CONFIG.mediaDir && page !== 'home') {
    var svgWarn = '<svg style="flex-shrink:0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    var msg, banner = document.createElement('div');
    banner.id = 'mediaDirWarning';
    if (!CONFIG.mediaDirExists) {
      msg = Shared.getLang() === 'ru'
        ? 'Хранилище файлов не найдено: ' + CONFIG.mediaDir + '. Проверьте путь в настройках.'
        : 'Media directory not found: ' + CONFIG.mediaDir + '. Please check the path in Settings.';
    } else if (CONFIG.mediaDirEmpty) {
      msg = Shared.getLang() === 'ru'
        ? 'Хранилище файлов пусто: ' + CONFIG.mediaDir + '. Возможно, накопитель не подключён.'
        : 'Media directory has no files: ' + CONFIG.mediaDir + '. Storage may be unavailable.';
    }
    if (msg) {
      var msgEN, msgRU;
      if (!CONFIG.mediaDirExists) {
        msgEN = 'Media directory not found: ' + CONFIG.mediaDir + '. Please check the path in Settings.';
        msgRU = 'Хранилище файлов не найдено: ' + CONFIG.mediaDir + '. Проверьте путь в настройках.';
      } else {
        msgEN = 'Media directory has no files: ' + CONFIG.mediaDir + '. Storage may be unavailable.';
        msgRU = 'Хранилище файлов пусто: ' + CONFIG.mediaDir + '. Возможно, накопитель не подключён.';
      }
      var xSvg = '<svg style="flex-shrink:0;display:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>';
      banner.innerHTML = svgWarn + '<span data-i18n-banner data-msg-en="' + Shared.esc(msgEN) + '" data-msg-ru="' + Shared.esc(msgRU) + '">' + (Shared.getLang() === 'ru' ? msgRU : msgEN) + '</span>';
      var xEl = document.createElement('span');
      xEl.innerHTML = xSvg;
      xEl.style.cssText = 'position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;opacity:0;transition:opacity .15s;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px';
      banner.appendChild(xEl);
      banner.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;gap:10px;background:#ef4444;color:#fff;padding:8px 40px 8px 20px;font-size:15px;font-weight:700;';
      banner.onmouseenter = function() { xEl.style.opacity = '1'; };
      banner.onmouseleave = function() { xEl.style.opacity = '0'; };
      document.body.insertBefore(banner, document.body.firstChild);
      var bh = banner.offsetHeight;
      var app = document.getElementById('app');
      if (app) {
        app.style.position = 'relative';
        app.style.height = 'calc(100vh - ' + bh + 'px)';
      }
      var t = document.getElementById('topbar');
      if (t) t.style.top = bh + 'px';
      xEl.onclick = function(e) {
        e.stopPropagation();
        banner.style.display = 'none';
        if (app) app.style.height = '100vh';
        var t = document.getElementById('topbar');
        if (t) t.style.top = '0';
      };
    }
  }

  // Tagfetch: инициализируем только активную вкладку по subview
  if (page === 'tagfetch') {
    var subview = window.CONFIG && CONFIG.subview || 'manual';
    if (subview === 'manual') {
      TagfetchManual.init();
    }
  } else if (page === 'mediavault') {
    MediaVault.init();
  } else if (page === 'popular_tags') {
    MediaVaultTags.loadCategories().then(function() {
      MediaVaultTags.renderPopularTagsFull('popularTagsFullList');
    });
  }
})();
