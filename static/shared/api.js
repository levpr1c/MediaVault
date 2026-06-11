// ============================================================
// Общий HTTP-клиент: GET, POST и Upload (FormData) запросы
// ============================================================
var SharedAPI = window.SharedAPI || {};

// GET-запрос с опциональными query-параметрами, возвращает JSON
SharedAPI.get = function(url, params) {
  var q = '';
  if (params) {
    q = Object.keys(params).map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  }
  var full = q ? url + '?' + q : url;
  return fetch(full).then(function(r) {
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    return r.json();
  });
};

// POST-запрос с JSON-телом, возвращает JSON
SharedAPI.post = function(url, body) {
  return fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body || {})}).then(function(r) {
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    return r.json();
  });
};

// Загрузка файла через FormData (multipart/form-data)
SharedAPI.upload = function(url, file) {
  var fd = new FormData();
  fd.append('file', file);
  return fetch(url, {method:'POST', body:fd}).then(function(r) {
    if (!r.ok) throw new Error(r.status + ' ' + r.statusText);
    return r.json();
  });
};

window.SharedAPI = SharedAPI;
