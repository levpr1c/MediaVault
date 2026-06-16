#!/usr/bin/env python3
"""
Credential store for API keys — GNOME Keyring backend only.
Falls back to plain JSON in settings.json if keyring unavailable.
"""

import logging
import sys

LOG = logging.getLogger('mediavault')

try:
    import keyring
    _HAVE_KEYRING = True
except ImportError:
    _HAVE_KEYRING = False


class KeyringStore:
    """Stores API keys in GNOME Keyring (libsecret)."""

    _SERVICE = 'mediavault'

    def is_available(self) -> bool:
        if not _HAVE_KEYRING:
            return False
        try:
            keyring.get_keyring()
            return True
        except Exception as exc:
            LOG.debug('KeyringStore not available: %s', exc)
            return False

    def get(self, key: str) -> str | None:
        try:
            return keyring.get_password(self._SERVICE, key)
        except Exception:
            return None

    def set(self, key: str, value: str):
        try:
            keyring.set_password(self._SERVICE, key, value)
        except Exception as exc:
            LOG.error('KeyringStore.set(%s) failed: %s', key, exc)

    def delete(self, key: str):
        try:
            keyring.delete_password(self._SERVICE, key)
        except Exception:
            pass

    @staticmethod
    def name() -> str:
        return 'KeyringStore'


def init_credential_store() -> KeyringStore | None:
    """Create and return a KeyringStore if available, else None."""
    try:
        ks = KeyringStore()
        if ks.is_available():
            LOG.debug('Credential store: KeyringStore (GNOME Keyring)')
            return ks
    except Exception as exc:
        LOG.debug('KeyringStore init failed: %s', exc)
    LOG.debug('Credential store: None (fallback to settings.json)')
    return None

_OLD_KEY_MAP = {
    'r34_uid':   ('rule34',   'uid'),
    'r34_key':   ('rule34',   'key'),
    'dan_login': ('danbooru', 'login'),
    'dan_key':   ('danbooru', 'key'),
    'nh_key':    ('nhentai',  'key'),
}

_PER_SITE_SCHEMA = {
    'rule34':   ['uid', 'key'],
    'danbooru': ['login', 'key'],
    'nhentai':  ['key'],
}

def migrate_old_keys(ks: KeyringStore | None, s: dict) -> dict:
    """Migrate old flat key format to per-site credentials dict.

    Handles two sources:
      1. Flat keys stored in settings dict (r34_uid, r34_key, ...)
      2. Old keyring keys (api:r34_uid, api:r34_key, ...)

    Returns the updated settings dict with 'credentials' populated.
    """
    cred = s.setdefault('credentials', {})

    # 1. Migrate flat keys from settings dict
    for old_key, (site, cred_key) in _OLD_KEY_MAP.items():
        val = s.pop(old_key, None) or ''
        if val:
            cred.setdefault(site, {})[cred_key] = val

    # 2. Migrate old keyring keys, delete after transfer
    if ks:
        for old_key, (site, cred_key) in _OLD_KEY_MAP.items():
            new_key = f'api:{site}:{cred_key}'
            val = ks.get('api:' + old_key)
            if val:
                if not cred.get(site, {}).get(cred_key):
                    cred.setdefault(site, {})[cred_key] = val
                ks.delete('api:' + old_key)

        # 3. Replenish from new keyring keys
        for site, keys in _PER_SITE_SCHEMA.items():
            for k in keys:
                val = ks.get(f'api:{site}:{k}')
                if val:
                    cred.setdefault(site, {})[k] = val

    # 4. setdefault empty strings
    for site, keys in _PER_SITE_SCHEMA.items():
        for k in keys:
            cred.setdefault(site, {}).setdefault(k, '')

    return s
