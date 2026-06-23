// Shared comics search module
const SVG_SEARCH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>'

function _defaultT(key) {
  if (!window._i18nData) return 'Search comics'
  var lang = document.documentElement.lang || 'en'
  return (window._i18nData[lang] && window._i18nData[lang][key])
    || (window._i18nData.en && window._i18nData.en[key]) || 'Search comics'
}

function _debounce(fn, ms) {
  var timer
  return function() {
    var args = arguments
    var ctx = this
    clearTimeout(timer)
    timer = setTimeout(function() { fn.apply(ctx, args) }, ms)
  }
}

/**
 * @param {HTMLElement} container - Container to prepend search into
 * @param {string|null} gridSelector - Optional CSS selector for grid within container
 * @param {string|null} apiUrl - API URL for server-side search (unused yet)
 * @param {Object} [options]
 * @param {Function} [options._t] - i18n function
 * @param {Function} [options.onFilter] - Callback(gridElement, query)
 * @param {number} [options.debounceMs=300] - Debounce delay
 * @returns {Function} destroy function
 */
export function initComicsSearch(container, gridSelector, apiUrl, options) {
  if (!options) options = {}
  var t = options._t || _defaultT
  var debounceMs = options.debounceMs || 300

  var wrapper = document.createElement('div')
  wrapper.className = 'cm-comics-search-wrapper'
  var icon = document.createElement('span')
  icon.className = 'cm-comics-search-icon'
  icon.innerHTML = SVG_SEARCH
  wrapper.appendChild(icon)

  var input = document.createElement('input')
  input.id = 'cmComicsSearchQ'
  input.className = 'cm-comics-search-input'
  input.type = 'text'
  input.placeholder = t('searchComics')
  wrapper.appendChild(input)

  container.insertBefore(wrapper, container.firstChild)

  var filter = _debounce(function(q) {
    var grid = gridSelector ? container.querySelector(gridSelector) : container
    if (!grid) return
    if (options.onFilter) options.onFilter(grid, q)
  }, debounceMs)

  input.addEventListener('input', function(e) {
    filter(e.target.value.toLowerCase().trim())
  })

  return function destroy() {
    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper)
  }
}
