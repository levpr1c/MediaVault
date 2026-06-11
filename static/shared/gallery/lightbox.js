// ============================================================
// MV Gallery Lightbox — uses shared Lightbox with tag panel
// ============================================================
var MediaVaultLightbox = (function() {
  var _mvInstance = new Lightbox({
    prefix: 'lb',
    tagPanel: true,
    mediaUrlFn: function(path) { return MediaVaultAPI.mediaUrl(path); },
    nameFn: function(f) { return f.name; },
    onSaveTags: function(path, tags) {
      return MediaVaultAPI.saveFile(path, tags);
    },
    getVisualOrderFn: function() { return MediaVaultGallery.getVisualOrder(); },
    getFilteredDataFn: function() { return MediaVaultGallery.getFilteredData(); },
    getCatListFn: function() { return MediaVaultTags.getCatList(); },
    getTagCategoryNameFn: function(tag) { return MediaVaultTags.getTagCategoryName(tag); },
    hexToRgba: function(hex, a) { return MediaVaultTags.hexToRgba(hex, a); },
    galleryRefreshFn: function(path, tags) { MediaVaultGallery.refreshGalleryItem(path, tags); },
    gallerySetSearchFn: function(tag) { MediaVaultGallery.setSearchQuery(tag); },
    galleryApplyFilterFn: function() { MediaVaultGallery.applyFilter(); }
  });

  return {
    open: function(idx, data) { _mvInstance.open(idx, data); },
    close: function() { _mvInstance.close(); },
    prev: function() { _mvInstance._prev(); },
    next: function() { _mvInstance._next(); },
    init: function() {},
    addTagFromInput: function() { _mvInstance._addTagFromInput(); },
    showBulkAutocomplete: function(query) { _showBulkAutocomplete(query); }
  };

  // ─── Bulk Tag Autocomplete (kept here for historical reasons) ───

  function _showBulkAutocomplete(query) {
    var container = document.getElementById('bulkAutocomplete');
    if (!container) return;
    if (!query || !query.trim()) {
      var allData = MediaVaultGallery.getFilteredData();
      var tagCounts = {};
      for (var i = 0; i < allData.length; i++) {
        var tags = MediaVaultTags.parseTags(allData[i].tags);
        for (var j = 0; j < tags.length; j++) {
          tagCounts[tags[j]] = (tagCounts[tags[j]] || 0) + 1;
        }
      }
      var sorted = Object.keys(tagCounts).sort(function(a, b) { return tagCounts[b] - tagCounts[a]; }).slice(0, 10);
      if (sorted.length === 0) { container.innerHTML = ''; return; }
      container.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:160px;overflow-y:auto">' +
        sorted.map(function(tag) {
          var cat = MediaVaultTags.getTagCategory(tag);
          var style = cat ? 'color:' + cat + ';border-left:3px solid ' + cat + ';padding-left:9px;background:' + MediaVaultTags.hexToRgba(cat, 0.08) : '';
          return '<div class="ac-item" data-tag="' + Shared.esc(tag) + '" style="' + style + '">' + Shared.esc(tag) + ' <span style="color:var(--text2);font-size:11px">(' + tagCounts[tag] + ')</span></div>';
        }).join('') + '</div>';
      container.querySelectorAll('.ac-item').forEach(function(el) {
        el.addEventListener('mousedown', function(e) {
          e.preventDefault();
          document.getElementById('bulkTagInput').value = el.dataset.tag;
          container.innerHTML = '';
          document.getElementById('bulkTagInput').focus();
        });
      });
      return;
    }
    var q = query.trim().toLowerCase();
    var matches = [];
    var allData = MediaVaultGallery.getFilteredData();
    var tagCounts = {};
    for (var i = 0; i < allData.length; i++) {
      var tags = MediaVaultTags.parseTags(allData[i].tags);
      for (var j = 0; j < tags.length; j++) {
        tagCounts[tags[j]] = (tagCounts[tags[j]] || 0) + 1;
        if (tags[j].toLowerCase().indexOf(q) !== -1 && matches.indexOf(tags[j]) === -1) {
          matches.push(tags[j]);
        }
      }
    }
    matches.sort(function(a, b) { return (tagCounts[b] || 0) - (tagCounts[a] || 0); });
    matches = matches.slice(0, 8);
    if (matches.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '<div style="background:var(--surface);border:1px solid var(--border);border-radius:4px;max-height:160px;overflow-y:auto">' +
      matches.map(function(tag) {
        var cat = MediaVaultTags.getTagCategory(tag);
        var style = cat ? 'color:' + cat + ';border-left:3px solid ' + cat + ';padding-left:9px;background:' + MediaVaultTags.hexToRgba(cat, 0.08) : '';
        return '<div class="ac-item" data-tag="' + Shared.esc(tag) + '" style="' + style + '">' + Shared.esc(tag) + ' <span style="color:var(--text2);font-size:11px">(' + (tagCounts[tag] || 0) + ')</span></div>';
      }).join('') + '</div>';
    container.querySelectorAll('.ac-item').forEach(function(el) {
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        document.getElementById('bulkTagInput').value = el.dataset.tag;
        container.innerHTML = '';
        document.getElementById('bulkTagInput').focus();
      });
    });
  }
})();
