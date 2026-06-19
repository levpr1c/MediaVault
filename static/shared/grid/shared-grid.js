// ============================================================
// SharedGrid — переиспользуемый masonry/flexbox компонент
// сетки. IIFE, экспортируется в window.SharedGrid.
//
// Поддерживает два layout:
//   'masonry' — CSS columns (как MV Gallery)
//   'grid'    — flexbox wrap (как MV gallery.fixed)
// ============================================================
var SharedGrid = (function() {
  'use strict';

  function SharedGrid(container, options) {
    if (!container || !container.nodeType) {
      throw new Error('SharedGrid: container element required');
    }
    this._container = container;
    this._opts = options || {};

    this._opts.getItemHtml = this._opts.getItemHtml || function() { return ''; };
    this._opts.layout = this._opts.layout || 'masonry';
    this._opts.loadingHtml = this._opts.loadingHtml ||
      '<div class="shared-grid-loading"><div class="shared-grid-spinner"></div></div>';
    this._opts.emptyHtml = this._opts.emptyHtml ||
      '<div class="shared-grid-empty">No items</div>';
    this._opts.className = this._opts.className || '';

    this._items = [];
    this._init();
  }

  SharedGrid.prototype._init = function() {
    var c = this._container;
    c.classList.add('shared-grid');
    if (this._opts.className) c.classList.add(this._opts.className);
    if (this._opts.layout === 'grid') c.classList.add('shared-grid-fixed');

    this._clickHandler = this._onClick.bind(this);
    c.addEventListener('click', this._clickHandler);
  };

  SharedGrid.prototype._onClick = function(e) {
    var item = e.target.closest('.shared-grid-item');
    if (!item || !this._opts.onItemClick) return;
    var idx = parseInt(item.dataset.index, 10);
    if (isNaN(idx)) return;
    this._opts.onItemClick(this._items[idx], idx, e);
  };

  SharedGrid.prototype.render = function(items) {
    this._items = Array.isArray(items) ? items : [];
    this._clearChildren();
    this._container.classList.remove('shared-grid-is-loading', 'shared-grid-is-empty');

    if (!this._items.length) {
      this.setEmpty(true);
      return;
    }

    var c = this._container;
    var html = '';
    for (var i = 0; i < this._items.length; i++) {
      html += '<div class="shared-grid-item" data-index="' + i + '">' +
        this._opts.getItemHtml(this._items[i], i) + '</div>';
    }
    c.insertAdjacentHTML('beforeend', html);
  };

  SharedGrid.prototype.setLoading = function(show) {
    this._container.classList.toggle('shared-grid-is-loading', !!show);
    var el = this._container.querySelector('.shared-grid-loading');
    if (show) {
      this._clearChildren();
      this._container.classList.remove('shared-grid-is-empty');
      if (!el) {
        this._container.insertAdjacentHTML('beforeend', this._opts.loadingHtml);
      }
    } else if (el) {
      el.remove();
    }
  };

  SharedGrid.prototype.setEmpty = function(show) {
    this._container.classList.toggle('shared-grid-is-empty', !!show);
    var el = this._container.querySelector('.shared-grid-empty');
    if (show) {
      this._clearChildren();
      this._container.classList.remove('shared-grid-is-loading');
      if (!el) {
        this._container.insertAdjacentHTML('beforeend', this._opts.emptyHtml);
      }
    } else if (el) {
      el.remove();
    }
  };

  SharedGrid.prototype._clearChildren = function() {
    var c = this._container;
    var els = c.querySelectorAll('.shared-grid-item, .shared-grid-loading, .shared-grid-empty');
    for (var i = els.length - 1; i >= 0; i--) els[i].remove();
  };

  SharedGrid.prototype.clear = function() {
    this._items = [];
    this._clearChildren();
    this._container.classList.remove('shared-grid-is-loading', 'shared-grid-is-empty');
  };

  SharedGrid.prototype.destroy = function() {
    if (this._clickHandler) {
      this._container.removeEventListener('click', this._clickHandler);
    }
    this.clear();
    this._container.classList.remove('shared-grid', 'shared-grid-fixed');
    if (this._opts.className) {
      this._container.classList.remove(this._opts.className);
    }
    this._container = null;
    this._opts = null;
    this._items = null;
  };

  return SharedGrid;
})();

window.SharedGrid = SharedGrid;
