export function _t(key) {
  if (!window._i18nData) return key
  const lang = document.documentElement.lang || 'en'
  return window._i18nData[lang]?.[key] ?? window._i18nData.en?.[key] ?? key
}

export async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? {'Content-Type': 'application/json'} : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || _t('settingsError'))
  return data
}

export function esc(s) {
  return window.Shared ? window.Shared.esc(s) : (typeof s !== 'string' ? '' : s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]));
}

export function hexToRgba(hex, alpha) {
  return window.Shared ? window.Shared.hexToRgba(hex, alpha) : (() => { const v = parseInt(hex.slice(1), 16); return `rgba(${v>>16},${(v>>8)&255},${v&255},${alpha})`; })();
}

export function isImageExt(name) {
  return /\.(jpg|jpeg|png|gif|webp|avif|bmp)$/i.test(name)
}

export function isVideoExt(name) {
  return /\.(mp4|webm|mkv|avi|mov)$/i.test(name)
}

export function toast(msg, type) {
  if (window.Shared) { window.Shared.notify(msg, type); return; }
  const old = document.querySelector('.cm-toast')
  if (old) old.remove()
  const t = document.createElement('div')
  t.className = 'cm-toast' + (type === 'error' ? ' error' : type === 'success' ? ' success' : '')
  if (msg.indexOf('<a ') !== -1) { t.innerHTML = msg } else { t.textContent = msg }
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 5000)
}

export function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
