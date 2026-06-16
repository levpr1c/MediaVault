"""Tag fetch backends. Each module exports fetch(site, query, params) -> dict."""

from .api_raw import ApiRawBackend
from .nokufind import NokufindBackend

BACKENDS = {
    'api_raw': ApiRawBackend(),
    'nokufind': NokufindBackend(),
}

def get_backend(name):
    return BACKENDS.get(name)

def fetch_tags(site, md5, settings):
    """Dispatch to the configured backend for the given site."""
    backend_name = settings.get('fetch_backend', {}).get(site, 'api_raw')
    backend = get_backend(backend_name)
    if not backend:
        return {'tags': [], 'file_url': '', 'preview_url': ''}
    return backend.fetch(site, md5, settings)
