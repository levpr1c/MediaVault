import { _t, toast } from './utils.js'
import { tagsRender, tagsDestroy } from './tags.js'
import { filesRender, filesDestroy, onFileSearch } from './tags-manage/tags-manage.js'
import { comicsRender, comicsDestroy, initModalEvents } from './comics.js'
import { comicsTagsRender, comicsTagsDestroy } from './comics-tags.js'

const sections = {
  tags: { render: tagsRender, destroy: tagsDestroy },
  files: { render: filesRender, destroy: filesDestroy },
  tagsGroup: { render: tagsRender, destroy: tagsDestroy },
  comics: { render: comicsRender, destroy: comicsDestroy },
  comicsTags: { render: comicsTagsRender, destroy: comicsTagsDestroy }
}
let _current = 'tags'

function loadSection(name) {
  if (!sections[name]) return
  MobileSearch.unregister('cm-files')
  MobileSearch.unregister('cm-comics-tags')
  MobileSearch.unregister('cm-comics')
  sections[_current]?.destroy()
  _current = name

  document.querySelectorAll('.mv-mh-icon[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === name)
  })

  const titleEl = document.getElementById('cmPageTitle')
  if (titleEl) {
    const names = { tags: 'contentTags', files: 'tagsManage', comics: 'mvComics', comicsTags: 'comicsTags', tagsGroup: 'tagsGroup' }
    const key = names[name] || name
    titleEl.innerHTML = `<span data-i18n="${key}">${_t(key)}</span>`
  }

  const body = document.getElementById('cmContentBody')
  if (!body) return
  body.innerHTML = `<div class="admin-loading"><span class="fetch-spinner"></span> <span data-i18n="loading">${_t('loading')}</span></div>`
  setTimeout(() => {
    sections[name].render(body)
    registerMobileSection(name)
  }, 50)
}

function registerMobileSection(name) {
  if (name === 'files') {
    MobileSearch.register('cm-files', {
      onSearch: function(val) { onFileSearch(val) },
      onClear: function() { onFileSearch('') },
      getInitialValue: function() { return '' }
    })
    document.getElementById('cmFilesSearch')?.classList.add('mobile-search-hide')
  } else if (name === 'comicsTags') {
    MobileSearch.register('cm-comics-tags', {
      onSearch: function(val) {
        var q = val.toLowerCase().trim()
        document.querySelectorAll('#cmComicsTagsGrid .cm-comic-card').forEach(function(card) {
          var title = card.querySelector('.cm-comic-title')
          var match = !q || (title && (title.textContent || '').toLowerCase().includes(q))
          card.style.display = match ? '' : 'none'
        })
      },
      onClear: function() {
        document.querySelectorAll('#cmComicsTagsGrid .cm-comic-card').forEach(function(card) {
          card.style.display = ''
        })
      }
    })
  } else if (name === 'comics') {
    MobileSearch.register('cm-comics', {
      onSearch: function(val) {
        var q = val.toLowerCase().trim()
        document.querySelectorAll('#cmComics .cm-comic-card').forEach(function(card) {
          var title = card.querySelector('.cm-comic-title')
          var match = !q || (title && (title.textContent || '').toLowerCase().includes(q))
          card.style.display = match ? '' : 'none'
        })
      },
      onClear: function() {
        document.querySelectorAll('#cmComics .cm-comic-card').forEach(function(card) {
          card.style.display = ''
        })
      }
    })
  } else {
    MobileSearch.register(name, { onSearch: function() {} })
  }
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
    loadSection(params.get('tab') === 'groups' ? 'tagsGroup' : 'files')
  } else if (path.indexOf('tags-group') !== -1) {
    loadSection('tagsGroup')
  } else {
    loadSection('tags')
  }
}

window.ContentManager = { init, load: loadSection, registerMobileSection }

init()
