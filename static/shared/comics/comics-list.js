// MV comics list (view mode) — ES module

function _t(key) {
  if (!window._i18nData) return key;
  var lang = document.documentElement.lang || 'en';
  return (window._i18nData[lang] && window._i18nData[lang][key])
    || (window._i18nData.en && window._i18nData.en[key]) || key;
}

function esc(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

function render() {
  var grid = document.getElementById('comicsGrid');
  if (!grid) return;
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2)">' + _t('loading') + '…</div>';

  fetch('/api/comics/list')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        grid.innerHTML = '<div class="empty-state"><p>' + esc(data.error) + '</p></div>';
        return;
      }
      if (!data || !data.length) {
        if (window._isAdmin) {
          grid.innerHTML = '<div class="cm-comic-add-card" data-action="add-comic" style="margin:40px auto;width:200px;height:240px">' +
            '<div class="cm-comic-add-icon">+</div>' +
            '<div class="cm-comic-add-label">' + _t('createComic') + '</div></div>';
        } else {
          grid.innerHTML = '<div class="empty-state"><p>' + _t('comicsEmpty') + '</p></div>';
        }
        return;
      }
      var html = '';
      for (var i = 0; i < data.length; i++) {
        var c = data[i];
        html += '<div class="cm-comic-card" data-id="' + c.id + '">';
        if (c.cover) {
          html += '<div class="cm-comic-cover"><img src="/api/media?path=' + encodeURIComponent(c.cover) + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<span class=cm-comic-fallback>&#x1F4C4;</span>\'"></div>';
        } else {
          html += '<div class="cm-comic-cover"><span class="cm-comic-fallback"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h6"/></svg></span></div>';
        }
        html += '<div class="cm-comic-info"><span class="cm-comic-title">' + esc(c.title) + '</span></div>';
        html += '</div>';
      }
      if (window._isAdmin) {
        html += '<div class="cm-comic-add-card" data-action="add-comic">' +
          '<div class="cm-comic-add-icon">+</div>' +
          '<div class="cm-comic-add-label">' + _t('createComic') + '</div>' +
        '</div>';
      }
      grid.innerHTML = html;
    })
    .catch(function(err) {
      grid.innerHTML = '<div class="empty-state"><p>' + _t('loadingError') + ': ' + esc(err.message) + '</p></div>';
    });
}

// Click handler — open viewer or add comic
document.addEventListener('click', function(e) {
  var addBtn = e.target.closest('.cm-comic-add-card');
  if (addBtn) {
    if (window.ComicsPicker && ComicsPicker.openPicker) {
      ComicsPicker.openPicker({onSave:function(){location.reload()}});
    }
    return;
  }
  var card = e.target.closest('.cm-comic-card');
  if (card) {
    window.location.href = '/comics/view?id=' + card.dataset.id;
  }
});

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
