var Tagfetch = (function() {

  function getCurrentTab() {
    var path = window.location.pathname;
    if (path.indexOf('auto') !== -1) return 'auto';
    return 'manual';
  }

  return {
    getCurrentTab: getCurrentTab
  };
})();

window.Tagfetch = Tagfetch;
window.switchTab = function(tab) {
  location.href = '/content-mgmt/tags-' + tab;
};
