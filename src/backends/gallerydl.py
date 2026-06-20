"""Universal backend using gallery-dl Python API + raw API fallbacks.

Supports:
  - danbooru: gallery-dl for fetch (MD5) and search (no auth required)
  - rule34:  gallery-dl for fetch (MD5) and search (needs api-key + user-id)
  - nhentai: raw JSON API for search, gallery-dl for gallery fetch
  - kemono/coomer: gallery-dl CLI for get_info/download (unchanged)
"""
import concurrent.futures, json, os, re, subprocess, sys, threading, time, requests
from pathlib import Path

_KEMONO_DOMAINS = r'(?:kemono|coomer)\.(?:su|cr|cv|party|so|us|co)'
_UA = 'curl/8.20.0'
_NHENTAI_API = 'https://nhentai.net/api'


class GalleryDlBackend:
    def __init__(self):
        self._lock = threading.Lock()

    def _apply_gd_config(self, settings):
        """Apply gallery-dl config (API keys, rate limits) from settings."""
        from gallery_dl import config as gconfig
        # Global: skip downloads, no sleep overhead
        gconfig.set((), 'skip', True)
        gconfig.set((), 'sleep', 0)
        creds = settings.get('credentials', {}) if settings else {}
        # Danbooru auth (optional)
        dan = creds.get('danbooru', {})
        if dan.get('login') and dan.get('key'):
            gconfig.set(('extractor', 'danbooru'), 'username', dan['login'])
            gconfig.set(('extractor', 'danbooru'), 'password', dan['key'])
        # R34 auth (required for gallery-dl)
        r34 = creds.get('rule34', {})
        if r34.get('uid') and r34.get('key'):
            gconfig.set(('extractor', 'rule34'), 'api-key', r34['key'])
            gconfig.set(('extractor', 'rule34'), 'user-id', r34['uid'])
        gconfig.set(('extractor', 'danbooru'), 'per-page', 50)
        gconfig.set(('extractor', 'danbooru'), 'page-limit', 1)
        gconfig.set(('extractor', 'rule34'), 'per-page', 50)
        gconfig.set(('extractor', 'rule34'), 'page-limit', 1)
        gconfig.set(('extractor', 'nhentai'), 'per-page', 25)
        gconfig.set(('extractor', 'nhentai'), 'page-limit', 1)
        gconfig.set(('extractor', 'nhentai'), 'request-interval', 0)
        # E-Hentai config (optional auth via cookies in gallery-dl config)
        gconfig.set(('extractor', 'e-hentai'), 'per-page', 25)
        gconfig.set(('extractor', 'e-hentai'), 'page-limit', 1)
        gconfig.set(('extractor', 'e-hentai'), 'request-interval', 1)

    @staticmethod
    def _gd_extract(extr, limit=0):
        """Iterate gallery-dl extractor, yield (path, prefix, data) tuples."""
        try:
            extr.initialize()
            count = 0
            for item in extr.items():
                yield item
                count += 1
                if limit and count >= limit:
                    break
        except Exception as e:
            # Log but don't crash — gallery-dl raises on auth failures
            import sys
            print(f'GalleryDlBackend: extract error: {e}', file=sys.stderr)

    # ── fetch() — MD5 lookup via gallery-dl ────────────────────────

    def fetch(self, site, md5, settings):
        """Fetch post metadata by MD5 hash using gallery-dl."""
        if site == 'danbooru':
            return self._fetch_danbooru(md5, settings)
        elif site == 'rule34':
            return self._fetch_rule34(md5, settings)
        elif site == 'nhentai':
            return {}
        elif site == 'ehentai':
            # MD5 not supported for e-hentai; use fetch_by_url()
            return {}
        return {}  # kemono/coomer: handled via existing get_info()

    def _fetch_danbooru(self, md5, settings):
        self._apply_gd_config(settings)
        try:
            from gallery_dl.extractor import find
            extr = find(f'https://danbooru.donmai.us/posts?tags=md5:{md5}')
            if not extr:
                return {}
            for _path, _prefix, data in self._gd_extract(extr, limit=1):
                return {
                    'tags': data.get('tag_string', '').split(),
                    'tag_general': list(data.get('tags_general') or []),
                    'tag_artist': list(data.get('tags_artist') or []),
                    'tag_character': list(data.get('tags_character') or []),
                    'tag_copyright': list(data.get('tags_copyright') or []),
                    'tag_meta': list(data.get('tags_meta') or []),
                    'file_url': data.get('file_url', ''),
                    'large_file_url': data.get('large_file_url', '') or data.get('file_url', ''),
                    'preview_file_url': data.get('preview_file_url', ''),
                }
        except Exception:
            import sys
            print(f'GalleryDlBackend: danbooru fetch error (md5={md5})', file=sys.stderr)
        return {}

    def _fetch_rule34(self, md5, settings):
        self._apply_gd_config(settings)
        try:
            # Check if R34 API keys are configured
            creds = settings.get('credentials', {}).get('rule34', {})
            if not creds.get('uid') or not creds.get('key'):
                return {}
            from gallery_dl.extractor import find
            # R34 search by MD5 via gelbooru API
            extr = find(f'https://rule34.xxx/index.php?page=post&s=list&tags=md5:{md5}')
            if not extr:
                return {}
            for _path, _prefix, data in self._gd_extract(extr, limit=1):
                return {
                    'tags': data.get('tags', '').split() if isinstance(data.get('tags'), str) else (data.get('tags', []) if isinstance(data.get('tags'), list) else []),
                    'file_url': data.get('file_url', ''),
                    'preview_url': data.get('preview_url', '') or data.get('file_url', ''),
                }
        except Exception:
            import sys
            print(f'GalleryDlBackend: rule34 fetch error (md5={md5})', file=sys.stderr)
        return {}

    # ── NHentai gallery fetch (by gallery ID / URL) ────────────────

    def fetch_gallery(self, gallery_id, settings=None):
        self._apply_gd_config(settings or {})
        try:
            from gallery_dl.extractor import find
            extr = find(f'https://nhentai.net/g/{gallery_id}')
            if not extr:
                return None
            data = None
            for _path, _prefix, d in self._gd_extract(extr, limit=1):
                data = d
                break
            if data is None:
                return None
            # Extract num_pages from the raw API response stored by the extractor
            num_pages = 0
            try:
                if hasattr(extr, 'data') and isinstance(extr.data, dict):
                    num_pages = int(extr.data.get('num_pages', 0) or 0)
            except Exception:
                pass
            return {
                'id': data.get('id') or data.get('gallery_id'),
                'title': data.get('title', ''),
                'title_en': data.get('title_en', ''),
                'title_ja': data.get('title_ja', ''),
                'media_id': data.get('media_id'),
                'tags': list(data.get('tags', [])),
                'num_pages': num_pages,
                'num_favorites': data.get('num_favorites', 0),
                'upload_date': str(data.get('date', '')),
            }
        except Exception as e:
            import sys
            print(f'GalleryDlBackend: fetch_gallery error: {e}', file=sys.stderr)
        return None

    def fetch_by_url(self, url):
        """Fetch gallery/post metadata from any URL via gallery-dl."""
        try:
            from gallery_dl.extractor import find
            extr = find(url)
            if not extr:
                return None
            for _path, _prefix, data in self._gd_extract(extr, limit=1):
                result = dict(data)
                result.pop('_extractor', None)
                return result
        except Exception as e:
            import sys
            print(f'GalleryDlBackend: fetch_by_url error: {e}', file=sys.stderr)
        return None

    # ── search() ───────────────────────────────────────────────────

    def search(self, site, query, page=1, settings=None):
        if site == 'danbooru':
            self._apply_gd_config(settings or {})
            return self._search_danbooru(query, page, settings)
        elif site == 'rule34':
            return self._search_rule34(query, page, settings)
        elif site == 'nhentai':
            self._apply_gd_config(settings or {})
            return self._search_nhentai(query, page)
        elif site == 'ehentai':
            self._apply_gd_config(settings or {})
            return self._search_ehentai(query, page)
        return {'results': [], 'total': 0}

    def _search_danbooru(self, query, page, settings):
        self._apply_gd_config(settings)
        try:
            from gallery_dl.extractor import find
            tags_q = requests.utils.quote(query)
            extr = find(f'https://danbooru.donmai.us/posts?tags={tags_q}&page={page}')
            if not extr:
                return {'results': [], 'total': 0}
            results = []
            for _path, _prefix, data in self._gd_extract(extr):
                results.append({
                    'id': str(data.get('id', '')),
                    'tags': data.get('tag_string', '').split(),
                    'tag_artist': list(data.get('tags_artist') or []),
                    'tag_character': list(data.get('tags_character') or []),
                    'tag_copyright': list(data.get('tags_copyright') or []),
                    'tag_general': list(data.get('tags_general') or []),
                    'tag_meta': list(data.get('tags_meta') or []),
                    'file_url': data.get('file_url', ''),
                    'preview_url': data.get('preview_file_url', '') or data.get('file_url', ''),
                    'large_file_url': data.get('large_file_url', '') or data.get('file_url', ''),
                    'width': data.get('image_width', 0),
                    'height': data.get('image_height', 0),
                    'rating': data.get('rating', ''),
                    'score': data.get('score', 0),
                    'source': 'danbooru',
                })
            return {'results': results, 'total': len(results)}
        except Exception as e:
            import sys
            print(f'GalleryDlBackend: danbooru search error: {e}', file=sys.stderr)
        return {'results': [], 'total': 0}

    def _search_rule34(self, query, page, settings=None):
        """R34 search — use raw JSON API (needs api-key + user-id now)."""
        pid = page - 1
        url = f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags={requests.utils.quote(query)}&limit=100&pid={pid}'
        creds = (settings or {}).get('credentials', {}).get('rule34', {})
        uid = creds.get('uid', '')
        key = creds.get('key', '')
        if uid and key:
            url += f'&user_id={uid}&api_key={key}'
        try:
            r = requests.get(url, headers={'User-Agent': _UA}, timeout=30)
            if r.status_code == 200 and r.text.strip():
                posts = r.json()
                if not isinstance(posts, list) or not posts:
                    return {'results': [], 'total': 0}
                results = []
                for p in posts:
                    results.append({
                        'id': str(p.get('id', '')),
                        'tags': p.get('tags', '').split(),
                        'file_url': p.get('file_url', ''),
                        'preview_url': p.get('preview_url', ''),
                        'sample_url': p.get('sample_url', ''),
                        'width': p.get('width', 0),
                        'height': p.get('height', 0),
                        'source': 'rule34',
                    })
                return {'results': results, 'total': len(results)}
        except Exception as e:
            import sys
            print(f'GalleryDlBackend: rule34 search error: {e}', file=sys.stderr)
        return {'results': [], 'total': 0}

    def _search_nhentai(self, query, page):
        try:
            from gallery_dl.extractor import find
            tags_q = requests.utils.quote(query)
            print(f'[NHentai Debug] search: query="{query}" page={page}', file=sys.stderr)
            extr = find(f'https://nhentai.net/search/?q={tags_q}')
            if not extr:
                print(f'[NHentai Debug] search: extractor not found for query="{query}"', file=sys.stderr)
                return {'results': [], 'total': 0}

            # gallery-dl NHentai search only returns gallery_id, not full metadata
            gallery_ids = []
            for _path, _prefix, data in self._gd_extract(extr):
                gid = data.get('gallery_id')
                if gid and gid not in gallery_ids:
                    gallery_ids.append(gid)
            print(f'[NHentai Debug] search: found {len(gallery_ids)} gallery IDs for query="{query}"', file=sys.stderr)
            if not gallery_ids:
                print(f'[NHentai Debug] search: no gallery IDs for query="{query}"', file=sys.stderr)
                return {'results': [], 'total': 0}

            per_page = 25
            start = (page - 1) * per_page
            page_ids = gallery_ids[start:start + per_page]
            print(f'[NHentai Debug] search: page {page} → IDs {page_ids}', file=sys.stderr)

            def _fetch_one(gid):
                meta = self.fetch_gallery(gid)
                if meta:
                    entry = {
                        'id': meta.get('id'),
                        'title': meta.get('title_en') or meta.get('title', ''),
                        'mid': meta.get('media_id'),
                        'thumbnail': f"https://t.nhentai.net/galleries/{meta.get('media_id')}/thumb.jpg",
                        'tags': list(meta.get('tags', [])),
                        'pages': meta.get('num_pages', 0),
                    }
                    print(f'[NHentai Debug]   gallery id={entry["id"]} title="{entry["title"]}" '
                          f'pages={entry["pages"]} tags={len(entry["tags"])} '
                          f'thumbnail={entry["thumbnail"]}', file=sys.stderr)
                    return entry
                print(f'[NHentai Debug]   gallery id={gid} fetch failed (no metadata)', file=sys.stderr)
                return None

            with concurrent.futures.ThreadPoolExecutor(
                max_workers=min(len(page_ids), 8)
            ) as exc:
                fetched = list(exc.map(_fetch_one, page_ids))

            results = [f for f in fetched if f]
            print(f'[NHentai Debug] search: returning {len(results)} results for query="{query}"', file=sys.stderr)
            return {'results': results, 'total': len(gallery_ids)}
        except Exception as e:
            import traceback
            print(f'[NHentai Debug] search ERROR: {e}', file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
        return {'results': [], 'total': 0}

    def _search_ehentai(self, query, page):
        """Search E-Hentai via gallery-dl native e-hentai extractor."""
        try:
            from gallery_dl.extractor import find
            tags_q = requests.utils.quote(query)
            extr = find(f'https://e-hentai.org/?q={tags_q}')
            if not extr:
                return {'results': [], 'total': 0}
            start = (page - 1) * 25
            current = 0
            results = []
            for _path, _prefix, data in self._gd_extract(extr):
                current += 1
                if current <= start:
                    continue
                if len(results) >= 25:
                    break
                gid = data.get('gallery_id') or data.get('id')
                token = data.get('token') or ''
                thumb = data.get('thumbnail') or ''
                tags = list(data.get('tags', []))
                # gallery-dl returns tags as strings, keep them
                results.append({
                    'id': str(gid) if gid else '',
                    'token': str(token) if token else '',
                    'title': data.get('title', ''),
                    'title_jpn': data.get('title_jpn', ''),
                    'category': data.get('category', ''),
                    'thumbnail': thumb,
                    'preview_url': thumb,
                    'file_url': thumb,
                    'tags': tags,
                    'tags_raw': tags,
                    'pages': data.get('filecount', 0) or data.get('count', 0) or 0,
                    'rating': data.get('rating', ''),
                    'uploader': data.get('uploader', ''),
                    'source': 'ehentai',
                })
            total = current
            return {'results': results, 'total': total}
        except Exception as e:
            import sys
            print(f'[EHentai] search ERROR: {e}', file=sys.stderr)
        return {'results': [], 'total': 0}

    # ── Legacy: Kemono/Coomer via CLI ─────────────────────────────

    @staticmethod
    def _get_gallerydl_path():
        """Find gallery-dl binary path. Prefers venv bin, falls back to PATH."""
        # Try venv bin directory first (where sys.executable lives)
        if sys.executable:
            venv_path = os.path.join(os.path.dirname(sys.executable), 'gallery-dl')
            if os.path.exists(venv_path):
                return venv_path
        # Fall back to system PATH
        return 'gallery-dl'

    def is_available(self):
        gdl = self._get_gallerydl_path()
        print(f'[GalleryDlBackend] is_available: checking path={gdl}', file=sys.stderr)
        try:
            r = subprocess.run([gdl, '--version'], capture_output=True, text=True, timeout=10)
            ok = r.returncode == 0
            if ok:
                print(f'[GalleryDlBackend] is_available: found {r.stdout.strip()}', file=sys.stderr)
            else:
                print(f'[GalleryDlBackend] is_available: failed {r.stderr.strip()}', file=sys.stderr)
            return ok
        except FileNotFoundError:
            print(f'[GalleryDlBackend] is_available: binary not found at {gdl}', file=sys.stderr)
            return False
        except Exception as e:
            print(f'[GalleryDlBackend] is_available: error {e}', file=sys.stderr)
            return False

    def get_info(self, url):
        """Get gallery metadata (title, artist, file count) via gallery-dl --list-urls."""
        gdl = self._get_gallerydl_path()
        print(f'[GalleryDlBackend] get_info: using {gdl} for {url}', file=sys.stderr)
        try:
            r = subprocess.run(
                [gdl, '--list-urls', '--no-download', url],
                capture_output=True, text=True, timeout=30
            )
            if r.returncode != 0:
                return {'error': r.stderr.strip() or 'gallery-dl failed'}
            lines = [l.strip() for l in r.stdout.split('\n') if l.strip()]
            artist = ''
            post_id = ''
            match = re.search(r'/' + _KEMONO_DOMAINS + r'/([^/]+)/post/([^/?]+)', url)
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
            return {'error': 'gallery-dl timed out', 'debug': {'gdl_path': gdl}}
        except FileNotFoundError:
            print(f'[GalleryDlBackend] get_info: binary not found at {gdl}', file=sys.stderr)
            return {'error': 'gallery-dl not installed', 'debug': {'gdl_path': gdl, 'gdl_version': 'binary not found'}}

    def download(self, url, dest_dir):
        """Download files to dest_dir using gallery-dl."""
        gdl = self._get_gallerydl_path()
        print(f'[GalleryDlBackend] download: using {gdl} for {url} → {dest_dir}', file=sys.stderr)
        try:
            os.makedirs(dest_dir, exist_ok=True)
            r = subprocess.run(
                [gdl, '--directory', dest_dir, url],
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
            return {'error': 'download timed out', 'debug': {'gdl_path': gdl}}
        except FileNotFoundError:
            print(f'[GalleryDlBackend] download: binary not found at {gdl}', file=sys.stderr)
            return {'error': 'gallery-dl not installed', 'debug': {'gdl_path': gdl, 'gdl_version': 'binary not found'}}

    @staticmethod
    def get_mirrors():
        """Return known working Kemono/Coomer mirror domains."""
        return [
            'kemono.su', 'kemono.cr', 'kemono.cv', 'kemono.party',
            'kemono.so', 'kemono.us', 'kemono.co',
            'coomer.su', 'coomer.cr', 'coomer.cv', 'coomer.party',
            'coomer.so', 'coomer.us', 'coomer.co',
        ]
