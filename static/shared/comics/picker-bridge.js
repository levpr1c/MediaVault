/* ES module bridge to window.ComicsPicker (IIFE loaded via base.html) */
function _g(key, params) {
  return typeof Shared !== 'undefined' && Shared.t ? Shared.t(key, params) : key
}

function _alert(msg) {
  alert(msg)
}

export function openPicker(opts) {
  if (typeof ComicsPicker === 'undefined') { _alert('ComicsPicker not loaded'); return }
  return ComicsPicker.openPicker(opts)
}
export function closePicker() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.closePicker()
}
export function saveComic() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.saveComic()
}
export function selectFile(el) {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.selectFile(el)
}
export function toggleCover(el) {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.toggleCover(el)
}
export function removeFile(idx) {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.removeFile(idx)
}
export function toggleDateSort() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.toggleDateSort()
}
export function filterGallery() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.filterGallery()
}
export function openInViewer() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.openInViewer()
}
export function togglePreview() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.togglePreview()
}
export function init() {
  if (typeof ComicsPicker === 'undefined') return
  ComicsPicker.init()
}
