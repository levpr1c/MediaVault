// ============================================================
// Оркестратор MediaVault: инициализация всех модулей,
// модальное окно категорий, импорт/экспорт БД
// ============================================================
var MediaVault = (function() {

  // Инициализация MediaVault: загрузка тегов, лайтбокса, галереи,
  // настройка мобильной раскладки, подписка на события
  function init() {
    MediaVaultTags.loadCategories().then(function() {
      MediaVaultGallery.init();
    });
    MediaVaultLightbox.init();
    // Show lang toggle
    var langToggle = document.getElementById('langToggle');
    if (langToggle) langToggle.style.display = '';

    // Sidebar toggle
    var st = document.getElementById('sidebarToggle');
    if (st) {
      st.addEventListener('click', function() {
        var sb = document.querySelector('#mvSidebar');
        sb.classList.toggle('collapsed');
        st.classList.toggle('rotated');
      });
    }

    // Desktop search input
    var searchDebounce = null;
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        MediaVaultGallery.onSearchInput(e.target.value);
        MobileSearch.setValue(e.target.value);
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function() {
          if (e.target.value === document.getElementById('searchInput').value) {
            MediaVaultGallery.applyFilter();
          }
        }, 150);
      });
    }

    // Mobile search: register with shared module
    MobileSearch.register('gallery', {
      onSearch: function(val) {
        var side = document.getElementById('searchInput');
        if (side) side.value = val;
        MediaVaultGallery.onSearchInput(val);
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function() {
          if (val === MobileSearch.getValue()) {
            MediaVaultGallery.applyFilter();
          }
        }, 150);
      },
      onClear: function() {
        MediaVaultGallery.onSearchInput('');
        MediaVaultGallery.applyFilter();
      },
      getInitialValue: function() {
        var side = document.getElementById('searchInput');
        return side ? side.value : '';
      }
    });

    // Click on sidebar tag → search by that tag
    function onSidebarTagClick(e) {
      var chip = e.target.closest('.tag-chip[data-tag]');
      if (!chip) return;
      var tag = chip.dataset.tag;
      var input = document.getElementById('searchInput');
      if (input) input.value = tag;
      MediaVaultGallery.setSearchQuery(tag);
      MediaVaultGallery.applyFilter();
    }
    document.getElementById('categorizedTagsList').addEventListener('click', onSidebarTagClick);
    var catTagsMobile = document.getElementById('categorizedTagsMobile');
    if (catTagsMobile) catTagsMobile.addEventListener('click', onSidebarTagClick);
    var popTagsEl = document.getElementById('contextualPopularTags');
    if (popTagsEl) popTagsEl.addEventListener('click', onSidebarTagClick);

    // Thumb size buttons
    document.querySelectorAll('.thumb-size').forEach(function(btn) {
      btn.addEventListener('click', function() {
        MediaVaultGallery.setThumbSize(btn.dataset.size);
      });
    });

    // Gallery toolbar
    document.querySelectorAll('[data-layout]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        MediaVaultGallery.setLayoutMode(btn.dataset.layout);
      });
    });
    document.querySelectorAll('[data-pagesize]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        MediaVaultGallery.setPageSize(parseInt(btn.dataset.pagesize));
      });
    });
    ['pagePrev','pagePrevTop'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function() {
        var cur = document.querySelector('.page-num.active');
        if (cur) MediaVaultGallery.goToPage(parseInt(cur.dataset.page) - 1);
      });
    });
    ['pageNext','pageNextTop'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function() {
        var cur = document.querySelector('.page-num.active');
        if (cur) MediaVaultGallery.goToPage(parseInt(cur.dataset.page) + 1);
      });
    });
    ['pageNumbers','pageNumbersTop'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', function(e) {
        var btn = e.target.closest('.page-num');
        if (btn) MediaVaultGallery.goToPage(parseInt(btn.dataset.page));
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      var lb = document.querySelector('.shared-lightbox.open');
      if (!lb) return;
      var isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (e.key === 'Enter' && e.target.id === 'lbTagInput') {
        e.preventDefault();
        MediaVaultLightbox.addTagFromInput();
        return;
      }
      if (isInput) return;
      if (e.key === 'Escape') { MediaVaultLightbox.close(); return; }
    });

    // Bulk tag
    document.getElementById('bulkTagBtn').addEventListener('click', MediaVaultGallery.toggleSelectMode);
    document.getElementById('bulkAddBtn').addEventListener('click', MediaVaultGallery.addTagToSelected);
    document.getElementById('bulkTagInput').addEventListener('input', function(e) {
      MediaVaultLightbox.showBulkAutocomplete(e.target.value);
    });
    document.getElementById('bulkTagInput').addEventListener('focusin', function(e) {
      if (!e.target.value) MediaVaultLightbox.showBulkAutocomplete('');
    });
    document.getElementById('bulkTagInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') MediaVaultGallery.addTagToSelected();
    });
    document.getElementById('bulkCancelBtn').addEventListener('click', function() {
      if (MediaVaultGallery.isSelectMode()) MediaVaultGallery.toggleSelectMode();
    });

    // Category modal (onclick handles opening; wire close/add)
    document.getElementById('closeCategoryBtn').addEventListener('click', closeCategoryModal);
    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    document.getElementById('categoryModal').addEventListener('click', function(e) {
      if (e.target === e.currentTarget) closeCategoryModal();
    });
    document.getElementById('newCategoryName').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addCategory();
    });
  }

  // ─── Category Modal ───
  // Открытие модального окна управления категориями
  function openCategoryModal() {
    document.getElementById('categoryModal').style.display = 'flex';
    renderCategoryModal();
  }

  // Закрытие модального окна категорий
  function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
  }

  // Отрисовка содержимого модального окна (список категорий с тегами)
  function renderCategoryModal() {
    var list = document.getElementById('categoryList');
    if (!list) return;
    MediaVaultDB.getCategoriesFull().then(function(data) {
      if (data.error || !data.categories || !data.categories.length) {
        list.innerHTML = '<p style="color:var(--text2);font-size:13px">' + Shared.t('mvCatModalNoCats') + '</p>';
        return;
      }
      list.innerHTML = data.categories.map(function(cat) {
        var members = data.members[cat.name] || [];
        return '<div style="margin-bottom:10px;padding:8px;background:var(--bg);border-radius:6px;border-left:4px solid ' + cat.color + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<strong style="font-size:14px">' + Shared.esc(cat.name) + '</strong>' +
          '<button class="btn btn-sm delete-category" data-category="' + Shared.esc(cat.name) + '" style="color:var(--text2)">✕</button></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:6px">' +
          (members.length ? members.map(function(t) {
            return '<span class="tag-chip" style="color:' + cat.color + ';background:' + MediaVaultTags.hexToRgba(cat.color, 0.12) + ';-webkit-text-stroke:0.5px ' + cat.color + '">' + Shared.esc(t) + '</span>';
          }).join('') : '<span style="font-size:12px;color:var(--text2)">' + Shared.t('mvCatModalNoTags') + '</span>') +
          '</div>' +
          '<div style="display:flex;gap:4px;margin-top:6px">' +
          '<input type="text" class="cat-tag-input" data-category="' + Shared.esc(cat.name) + '" placeholder="' + Shared.t('mvCatModalAssign') + '" style="flex:1">' +
          '<button class="btn btn-sm cat-add-tag" data-category="' + Shared.esc(cat.name) + '">+</button></div></div>';
      }).join('');

      list.querySelectorAll('.delete-category').forEach(function(btn) {
        btn.addEventListener('click', function() {
          MediaVaultDB.deleteCategory(btn.dataset.category).then(function(data) {
            if (data.ok) {
              MediaVaultTags.invalidateCatCache();
              MediaVaultTags.loadCategories();
              renderCategoryModal();
            }
          });
        });
      });

      list.querySelectorAll('.cat-add-tag').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var input = btn.parentElement.querySelector('.cat-tag-input');
          var tag = input.value.trim();
          if (!tag) return;
          SharedAPI.post('/api/categories', {action:'add_tag', tag: tag, category: btn.dataset.category}).then(function(data) {
            if (data.ok) {
              MediaVaultTags.invalidateCatCache();
              MediaVaultTags.loadCategories();
              input.value = '';
              renderCategoryModal();
            }
          });
        });
      });

      list.querySelectorAll('.cat-tag-input').forEach(function(input) {
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            e.target.parentElement.querySelector('.cat-add-tag').click();
          }
        });
      });
    }).catch(function() {
      list.innerHTML = '<p style="color:var(--text2)">' + Shared.t('mvCatModalFailed') + '</p>';
    });
  }

  // Создание новой категории через API
  function addCategory() {
    var nameInput = document.getElementById('newCategoryName');
    var colorInput = document.getElementById('newCategoryColor');
    var name = nameInput.value.trim();
    if (!name) return;
    MediaVaultDB.addCategory(name, colorInput.value).then(function(data) {
      if (data.ok) {
        MediaVaultTags.invalidateCatCache();
        MediaVaultTags.loadCategories();
        nameInput.value = '';
        renderCategoryModal();
      }
    });
  }

  // ─── DB Import ───
  // Импорт базы данных из выбранного пользователем файла
  function importDB(input) {
    var file = input.files[0];
    if (!file) return;
    var fd = new FormData();
    fd.append('file', file);
    fetch('/api/import_db', {method: 'POST', body: fd}).then(function(r) { return r.json(); }).then(function(data) {
      if (data.ok) {
        MediaVaultTags.invalidateCatCache();
        MediaVaultTags.loadCategories();
        MediaVaultGallery.loadGallery();
      } else {
        alert('Import failed: ' + (data.error || 'unknown'));
      }
    }).catch(function(e) {
      alert('Import failed: ' + e.message);
    });
    input.value = '';
  }

  return {
    init: init,
    openCategoryModal: openCategoryModal,
    closeCategoryModal: closeCategoryModal,
    addCategory: addCategory,
    importDB: importDB,
  };
})();

window.MediaVault = MediaVault;
