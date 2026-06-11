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
