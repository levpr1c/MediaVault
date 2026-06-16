"""Tag fetch backends. Each module exports fetch(site, query, params) -> dict."""

from .api_raw import ApiRawBackend
from .gallerydl import GalleryDlBackend

BACKENDS = {
    'api_raw': ApiRawBackend(),
    'gallerydl': GalleryDlBackend(),
}

# Per-site default backends (used when fetch_backend setting is missing)
_DEFAULT_BACKEND = {
    'rule34': 'api_raw',
    'danbooru': 'api_raw',
    'nhentai': 'gallerydl',    # gallery-dl NHentai search + gallery fetch
    'kemono': 'gallerydl',
    'coomer': 'gallerydl',
}

def get_backend(name):
    return BACKENDS.get(name)

def fetch_tags(site, md5, settings):
    """Dispatch to the configured backend for the given site."""
    fb = settings.get('fetch_backend', {})
    backend_name = fb.get(site) or _DEFAULT_BACKEND.get(site, 'api_raw')
    backend = get_backend(backend_name)
    if not backend:
        return {'tags': [], 'file_url': '', 'preview_url': ''}
    return backend.fetch(site, md5, settings)

def search_tags(site, query, page=1, settings=None):
    """Search for posts by tag across configured backends."""
    fb = (settings or {}).get('fetch_backend', {})
    backend_name = fb.get(site) or _DEFAULT_BACKEND.get(site, 'api_raw')
    backend = get_backend(backend_name)
    if not backend:
        return {'results': [], 'total': 0}
    if hasattr(backend, 'search'):
        return backend.search(site, query, page, settings)
    return {'results': [], 'total': 0}
