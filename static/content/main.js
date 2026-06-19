import { _t, toast } from './utils.js'
import { tagsRender, tagsDestroy } from './tags.js'
import { filesRender, filesDestroy, onFileSearch } from './tags-manage/tags-manage.js'
import { comicsRender, comicsDestroy, initModalEvents, ctSelectPage, ctSaveAll } from './comics.js'
import { comicsTagsRender, comicsTagsDestroy } from './comics-tags.js'

const sections = {
  tags: { render: tagsRender, destroy: tagsDestroy },
  files: { render: filesRender, destroy: filesDestroy },
  comics: { render: comicsRender, destroy: comicsDestroy },
  comicsTags: { render: comicsTagsRender, destroy: comicsTagsDestroy }
}
let _current = 'tags'

function loadSection(name) {
  if (!sections[name]) return
  sections[_current]?.destroy()
  _current = name

  document.querySelectorAll('.mv-mh-icon[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name)
  })

  const titleEl = document.getElementById('cmPageTitle')
  if (titleEl) {
    const names = { tags: 'contentTags', files: 'navFiles', comics: 'mvComics', comicsTags: 'comicsTags' }
    const key = names[name] || name
    titleEl.innerHTML = `<span data-i18n="${key}">${_t(key)}</span>`
  }

  const body = document.getElementById('cmContentBody')
  if (!body) return
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> <span data-i18n="loading">${_t('loading')}</span></div>`
  setTimeout(() => sections[name].render(body), 50)
}

function onMobileSearch(value) {
  if (_current === 'files') onFileSearch(value)
}

export function init() {
  initModalEvents()
  var path = window.location.pathname
  var params = new URLSearchParams(window.location.search)
  if (path.indexOf('comics-tags') !== -1) {
    loadSection('comicsTags')
  } else if (path.indexOf('comics-edit') !== -1) {
    loadSection('comics')
  } else if (path.indexOf('tags-manage') !== -1) {
    loadSection(params.get('tab') === 'groups' ? 'tags' : 'files')
  } else {
    loadSection('tags')
  }
}

window.ContentManager = { init, load: loadSection, _onMobileSearch: onMobileSearch, ctSelectPage, ctSaveAll }

init()
