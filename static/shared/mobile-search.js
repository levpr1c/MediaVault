// ============================================================
// MobileSearch — shared mobile header search + toolbar dropdown
// ============================================================
var MobileSearch = (function() {
  var _registry = {}
  var _current = null
  var _input = null
  var _isMobile = false
  var _mql = null

  function _init() {
    _input = document.getElementById('searchInputMobile')
    if (!_input) return

    _mql = window.matchMedia('(max-width: 768px)')
    _isMobile = _mql.matches
    _mql.addEventListener('change', function(e) {
      _isMobile = e.matches
    })

    _input.addEventListener('input', function(e) {
      var val = e.target.value
      if (_current && _registry[_current] && _registry[_current].onSearch) {
        _registry[_current].onSearch(val)
      }
    })

    _input.addEventListener('search', function(e) {
      if (!e.target.value && _current && _registry[_current] && _registry[_current].onClear) {
        _registry[_current].onClear()
      }
    })
  }

  function register(page, callbacks) {
    if (callbacks && callbacks.onSearch) {
      _registry[page] = callbacks
    } else {
      _registry[page] = callbacks || {}
    }
    _current = page
    if (_input && callbacks && callbacks.getInitialValue) {
      var v = callbacks.getInitialValue()
      if (v !== undefined && v !== null) _input.value = v
    }
    if (_input && _isMobile && callbacks && callbacks.onActivate) {
      callbacks.onActivate()
    }
  }

  function unregister(page) {
    if (_current === page) {
      if (_input) _input.value = ''
      _current = null
    }
    delete _registry[page]
  }

  function setValue(val) {
    if (_input) _input.value = val
  }

  function getValue() {
    return _input ? _input.value : ''
  }

  function isMobile() {
    return _isMobile
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init)
  } else {
    _init()
  }

  return {
    register: register,
    unregister: unregister,
    setValue: setValue,
    getValue: getValue,
    isMobile: isMobile
  }
})()
