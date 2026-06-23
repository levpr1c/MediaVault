/* ─── Shared Grid Renderer ───
 * Reusable grid components for Content Management pages.
 * Used by tags-manage.js (files grid) and comics-tags.js (comics grid).
 */

function _t(key) {
  const lang = document.documentElement.lang || 'en'
  return (window._i18nData?.[lang]?.[key] ?? window._i18nData?.en?.[key] ?? key)
}

function esc(s) {
  return window.Shared?.esc(s) ?? s
}

function hexToRgba(hex, alpha) {
  return window.Shared?.hexToRgba(hex, alpha) ?? `rgba(0,0,0,${alpha})`
}

function _cbSuffix() {
  return (window._cbSuffix && window._cbSuffix()) || ''
}

/* ─── Left tag panel ─── */

export function buildLeftPanelHtml(searchPlaceholder) {
  return `<div class="cm-files-left shared-tag-panel">` +
    `<div class="cm-files-left-search">` +
      `<input id="cmFilesTagSearchQ" class="cm-tag-search-input" placeholder="${searchPlaceholder}">` +
    `</div>` +
    `<div class="cm-files-left-content" id="cmFilesLeftContent"></div>` +
  `</div>`
}

export function renderLeftTags(container, cats, searchQ, opts) {
  opts = opts || {}
  const q = searchQ ? searchQ.toLowerCase() : ''
  let html = ''
  if (!cats || !cats.length) {
    html += `<div class="cm-files-left-empty">${_t('comicsEmpty')}</div>`
    container.innerHTML = html
    return
  }
  cats.forEach(cat => {
    let tags = cat.tags || []
    if (q) tags = tags.filter(t => t.toLowerCase().includes(q))
    if (q && !tags.length && !cat.name.toLowerCase().includes(q)) return
    html += `<div class="cm-files-left-section">` +
      `<div class="cm-files-left-section-title" style="color:${cat.color}">${esc(cat.name)}</div>` +
      `<div class="cm-files-left-tags">`
    tags.forEach(tag => {
      html += `<span class="tag-chip cm-tags-chip" draggable="true" data-tag="${esc(tag)}" style="color:${cat.color};background:${hexToRgba(cat.color, 0.12)}">${esc(tag)}</span>`
    })
    html += `</div></div>`
  })
  const uncatTags = opts.uncatTags || []
  if (uncatTags.length) {
    html += `<div class="cm-files-left-section">` +
      `<div class="cm-files-left-section-title" style="color:#999">${_t('uncategorized')}</div>` +
      `<div class="cm-files-left-tags">`
    uncatTags.forEach(t => {
      html += `<span class="tag-chip cm-tags-chip" draggable="true" data-tag="${esc(t.name || t)}" style="color:#999;background:rgba(153,153,153,0.12)">${esc(t.name || t)} <span class="cm-tags-count-badge">(${t.count || 0})</span></span>`
    })
    html += `</div></div>`
  }
  if (!html) html += `<div class="cm-files-gallery-empty">${_t('comicsEmpty')}</div>`
  container.innerHTML = html
}

/* ─── Drag-to-tag events ─── */

export function setupDragEvents(body, signal, opts) {
  opts = opts || {}
  const targetSelector = opts.targetSelector || '.drop-target'
  const dropClass = opts.dropClass || 'tag-dragover'

  body.addEventListener('dragstart', e => {
    const chip = e.target.closest('.cm-tags-chip')
    if (!chip) return
    e.dataTransfer.setData('text/plain', chip.dataset.tag)
    e.dataTransfer.effectAllowed = 'copy'
    chip.classList.add('dragging')
  }, { signal })

  body.addEventListener('dragend', e => {
    const chip = e.target.closest('.cm-tags-chip')
    if (chip) chip.classList.remove('dragging')
  }, { signal })

  body.addEventListener('dragover', e => {
    const target = e.target.closest(targetSelector)
    if (target) { e.preventDefault(); target.classList.add(dropClass) }
  }, { signal })

  body.addEventListener('dragleave', e => {
    const target = e.target.closest(targetSelector)
    if (target) target.classList.remove(dropClass)
  }, { signal })

  body.addEventListener('drop', e => {
    document.querySelectorAll(targetSelector).forEach(el => el.classList.remove(dropClass))
    const target = e.target.closest(targetSelector)
    if (!target) return
    const tag = e.dataTransfer.getData('text/plain')
    if (tag && opts.onDrop) opts.onDrop(target, tag, e)
  }, { signal })
}

/* ─── Comic card HTML ─── */

export function comicCardHTML(comic) {
  const hasCover = comic.cover && comic.cover.trim()
  let thumbSrc = ''
  if (hasCover) {
    thumbSrc = '/api/media?path=' + encodeURIComponent(comic.cover) + _cbSuffix()
  }

  const sourceLabels = {
    r34: 'R34',
    dan: 'Dan',
    nhentai: 'NH',
    kemono: 'Kemono',
    coomer: 'Coomer'
  }
  const sourceLabel = sourceLabels[comic.source] || comic.source || ''
  const siteBadge = sourceLabel ? `<span class="cm-comic-site-badge">${esc(sourceLabel)}</span>` : ''
  const pagesInfo = comic.page_count ? `<span class="cm-comic-pages">${comic.page_count}p</span>` : ''

  return `<div class="cm-comic-card" data-comic-id="${comic.id}" data-title="${esc(comic.title)}">` +
    `<div class="cm-comic-cover">` +
    (hasCover
      ? `<img src="${thumbSrc}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=cm-comic-fallback>&#x1F4C4;</span>'">`
      : `<span class="cm-comic-fallback">&#x1F4C4;</span>`) +
    `</div>` +
    `<div class="cm-comic-info">` +
      `<span class="cm-comic-title">${esc(comic.title)}</span>` +
      `<div class="cm-comic-meta">` +
        pagesInfo +
        siteBadge +
      `</div>` +
    `</div>` +
  `</div>`
}

export function buildComicsGridHTML(comics) {
  if (!comics || !comics.length) {
    return `<div class="cm-comics-tags-empty">${_t('comicsEmpty')}</div>`
  }
  return comics.map(c => comicCardHTML(c)).join('')
}
