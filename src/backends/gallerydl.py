"""Kemono/Coomer import via gallery-dl CLI."""
import json, os, subprocess, re, threading
from pathlib import Path

class GalleryDlBackend:
    def __init__(self):
        self._lock = threading.Lock()

    def is_available(self):
        try:
            subprocess.run(['gallery-dl', '--version'], capture_output=True, timeout=10)
            return True
        except Exception:
            return False

    def get_info(self, url):
        """Get gallery metadata (title, artist, file count) via gallery-dl --list-urls."""
        try:
            r = subprocess.run(
                ['gallery-dl', '--list-urls', '--no-download', url],
                capture_output=True, text=True, timeout=30
            )
            if r.returncode != 0:
                return {'error': r.stderr.strip() or 'gallery-dl failed'}
            lines = [l.strip() for l in r.stdout.split('\n') if l.strip()]
            artist = ''
            post_id = ''
            match = re.search(r'/(?:kemono|coomer)\.su/([^/]+)/post/([^/?]+)', url)
            if match:
                artist = match.group(1)
                post_id = match.group(2)
            return {
                'url': url,
                'artist': artist,
                'post_id': post_id,
                'files': lines,
                'count': len(lines),
                'ok': True
            }
        except subprocess.TimeoutExpired:
            return {'error': 'gallery-dl timed out'}
        except FileNotFoundError:
            return {'error': 'gallery-dl not installed'}

    def download(self, url, dest_dir):
        """Download files to dest_dir using gallery-dl."""
        try:
            os.makedirs(dest_dir, exist_ok=True)
            r = subprocess.run(
                ['gallery-dl', '--directory', dest_dir, url],
                capture_output=True, text=True, timeout=300
            )
            if r.returncode != 0:
                return {'error': r.stderr.strip() or 'download failed'}
            downloaded = []
            for f in Path(dest_dir).rglob('*'):
                if f.is_file() and not f.name.startswith('.'):
                    downloaded.append(str(f.relative_to(dest_dir)))
            return {'downloaded': downloaded, 'count': len(downloaded), 'ok': True}
        except subprocess.TimeoutExpired:
            return {'error': 'download timed out'}
        except FileNotFoundError:
            return {'error': 'gallery-dl not installed'}
