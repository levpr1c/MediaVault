"""Native API backends for Rule34, Danbooru, NHentai."""
import time, requests, xml.etree.ElementTree as ET

UA = 'MediaVault/1.0 (mediavault project)'
API_DELAY = 1.0

class ApiRawBackend:

    @staticmethod
    def _creds(site, settings):
        return settings.get('credentials', {}).get(site, {})

    def fetch(self, site, md5, settings):
        if site == 'rule34':
            c = self._creds('rule34', settings)
            return self._fetch_rule34(md5, c.get('uid', ''), c.get('key', ''))
        elif site == 'danbooru':
            c = self._creds('danbooru', settings)
            return self._fetch_danbooru(md5, c.get('login', ''), c.get('key', ''))
        elif site == 'nhentai':
            return self._fetch_nhentai(md5, settings)
        elif site == 'ehentai':
            return self._fetch_ehentai(md5, settings)
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def _fetch_rule34(self, md5, uid, key):
        if not uid or not key:
            return {'tags': [], 'file_url': '', 'preview_url': ''}
        url = f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=1&tags=md5:{md5}&user_id={uid}&api_key={key}'
        for attempt in range(3):
            try:
                r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
                if r.status_code == 200 and r.text.strip():
                    data = r.json()
                    if data:
                        return {'tags': data[0].get('tags', '').split(),
                                'file_url': data[0].get('file_url', ''),
                                'preview_url': data[0].get('preview_url', '')}
            except Exception:
                if attempt < 2:
                    time.sleep(1)
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def _fetch_danbooru(self, md5, login, api_key):
        url = f'https://danbooru.donmai.us/posts.json?limit=1&tags=md5:{md5}'
        auth = (login, api_key) if login and api_key else None
        for attempt in range(3):
            try:
                r = requests.get(url, headers={'User-Agent': UA}, auth=auth, timeout=15)
                if r.status_code == 200 and r.text.strip():
                    data = r.json()
                    if data:
                        p = data[0]
                        fu = p.get('file_url', '')
                        return {'tags': p.get('tag_string', '').split(),
                                'tag_general': (p.get('tag_string_general') or '').split(),
                                'tag_artist': (p.get('tag_string_artist') or '').split(),
                                'tag_character': (p.get('tag_string_character') or '').split(),
                                'tag_copyright': (p.get('tag_string_copyright') or '').split(),
                                'tag_meta': (p.get('tag_string_meta') or '').split(),
                                'file_url': fu,
                                'large_file_url': p.get('large_file_url', '') or fu,
                                'preview_file_url': p.get('preview_file_url', '') or fu.replace('/original/', '/preview/')}
            except Exception:
                if attempt < 2:
                    time.sleep(1)
        return {'tags': [], 'tag_general': [], 'tag_artist': [], 'tag_character': [],
                'tag_copyright': [], 'tag_meta': [], 'file_url': '', 'large_file_url': '', 'preview_file_url': ''}

    def _fetch_ehentai(self, gid_token, settings):
        """E-Hentai gallery metadata via official API (gdata method).
        Input format: 'gallery_id:gallery_token' or just 'gallery_id'.
        """
        if not gid_token or ':' not in gid_token:
            return {'tags': [], 'file_url': '', 'preview_url': ''}
        parts = gid_token.split(':', 1)
        gid = parts[0].strip()
        token = parts[1].strip()
        if not gid.isdigit() or not token:
            return {'tags': [], 'file_url': '', 'preview_url': ''}
        try:
            r = requests.post(
                'https://api.e-hentai.org/api.php',
                json={'method': 'gdata', 'gidlist': [[int(gid), token]], 'namespace': 1},
                headers={'User-Agent': UA},
                timeout=15
            )
            if r.status_code != 200:
                return {'tags': [], 'file_url': '', 'preview_url': ''}
            d = r.json()
            glist = d.get('gmetadata', [])
            if not glist:
                return {'tags': [], 'file_url': '', 'preview_url': ''}
            g = glist[0]
            tags_raw = g.get('tags', [])
            tags = []
            for t in tags_raw:
                if ':' in t:
                    tags.append(t.split(':', 1)[1])
                else:
                    tags.append(t)
            return {
                'tags': tags,
                'tags_raw': tags_raw,
                'title': g.get('title', ''),
                'title_jpn': g.get('title_jpn', ''),
                'category': g.get('category', ''),
                'thumb': g.get('thumb', ''),
                'file_count': int(g.get('filecount', 0) or 0),
                'file_url': g.get('thumb', ''),
                'preview_url': g.get('thumb', ''),
                'rating': g.get('rating', ''),
                'uploader': g.get('uploader', ''),
            }
        except Exception:
            pass
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def search_ehentai_gdata(self, queries, settings=None):
        """Batch gallery metadata lookup via gdata API.
        queries: list of (gid, token) tuples.
        Returns list of gallery dicts (max 25 per call).
        """
        if not queries:
            return []
        batches = [queries[i:i+25] for i in range(0, len(queries), 25)]
        results = []
        for batch in batches:
            try:
                r = requests.post(
                    'https://api.e-hentai.org/api.php',
                    json={'method': 'gdata', 'gidlist': batch, 'namespace': 1},
                    headers={'User-Agent': UA},
                    timeout=15
                )
                if r.status_code == 200:
                    results.extend(r.json().get('gmetadata', []))
            except Exception:
                pass
        return results

    def _fetch_nhentai(self, gid, settings):
        """NHentai gallery lookup by ID (v2 API). Returns full metadata with categorized tags + page URLs."""
        try:
            r = requests.get(
                f'https://nhentai.net/api/v2/galleries/{gid}',
                headers={'User-Agent': UA},
                timeout=15
            )
            if r.status_code == 200:
                d = r.json()
                media_id = d.get('media_id')
                # Tags with categories
                tags = d.get('tags', [])
                tag_artist = []
                tag_character = []
                tag_copyright = []
                tag_general = []
                tag_language = []
                tag_category = []
                flat_tags = []
                for t in tags:
                    name = t.get('name', '')
                    if not name:
                        continue
                    flat_tags.append(name)
                    ttype = t.get('type', '')
                    if ttype == 'artist':
                        tag_artist.append(name)
                    elif ttype == 'character':
                        tag_character.append(name)
                    elif ttype == 'parody':
                        tag_copyright.append(name)
                    elif ttype == 'language':
                        tag_language.append(name)
                    elif ttype == 'category':
                        tag_category.append(name)
                    else:
                        tag_general.append(name)
                # Page URLs from pages array
                pages = d.get('pages', [])
                page_urls = []
                for p in pages:
                    path = p.get('path', '')
                    if path:
                        page_urls.append(f"https://i.nhentai.net/{path}")
                # Cover/thumbnail from relative paths
                cover_path = d.get('cover', {}).get('path', '')
                thumb_path = d.get('thumbnail', {}).get('path', '')
                return {
                    'id': d.get('id'),
                    'title': d.get('title', {}).get('english', '') or d.get('title', {}).get('pretty', ''),
                    'media_id': str(media_id) if media_id else '',
                    'tags': flat_tags,
                    'tag_artist': tag_artist,
                    'tag_character': tag_character,
                    'tag_copyright': tag_copyright,
                    'tag_general': tag_general,
                    'tag_language': tag_language,
                    'tag_category': tag_category,
                    'num_pages': d.get('num_pages', 0),
                    'file_url': f"https://i.nhentai.net/{cover_path}" if cover_path else '',
                    'preview_url': f"https://t.nhentai.net/{thumb_path}" if thumb_path else '',
                    'page_urls': page_urls,
                }
        except Exception:
            pass
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def _search_nhentai(self, query, page, settings):
        """NHentai search via v2 JSON API (public, no key needed).

        Search API returns simplified results with relative thumbnail paths.
        Full metadata (tags, page URLs) requires fetch_gallery per item.

        If query is purely numeric, treat it as a gallery ID lookup
        via _fetch_nhentai() instead of a search.
        """
        q = query.strip()
        if q.isdigit():
            meta = self._fetch_nhentai(q, settings)
            if meta and meta.get('media_id'):
                return {
                    'results': [{
                        'id': meta.get('id'),
                        'title': meta.get('title', ''),
                        'mid': meta.get('media_id', ''),
                        'thumbnail': meta.get('preview_url', ''),
                        'preview_url': meta.get('preview_url', ''),
                        'tags': meta.get('tags', []),
                        'pages': meta.get('num_pages', 0),
                    }],
                    'total': 1,
                }
            return {'results': [], 'total': 0}

        import logging as _log
        try:
            r = requests.get(
                'https://nhentai.net/api/v2/search',
                params={'query': query, 'page': page, 'sort': 'popular'},
                headers={'User-Agent': UA},
                timeout=20
            )
            if r.status_code != 200:
                return {'results': [], 'total': 0}
            d = r.json()
            results = []
            for g in d.get('result', []):
                mid = str(g.get('media_id', '') or '')
                thumb_rel = g.get('thumbnail', '')
                results.append({
                    'id': g.get('id'),
                    'title': g.get('english_title', '') or g.get('japanese_title', ''),
                    'mid': mid,
                    'thumbnail': f"https://t.nhentai.net/{thumb_rel}" if thumb_rel else '',
                    'preview_url': f"https://t.nhentai.net/{thumb_rel}" if thumb_rel else '',
                    'tags': [],
                    'pages': g.get('num_pages', 0),
                })
            return {'results': results, 'total': d.get('total', len(results))}
        except Exception:
            pass
        return {'results': [], 'total': 0}

    def search(self, site, query, page=1, settings=None):
        """Search for posts by tag/category/author query."""
        if site == 'rule34':
            return self._search_rule34(query, page, settings)
        elif site == 'danbooru':
            return self._search_danbooru(query, page, settings)
        elif site == 'nhentai':
            return self._search_nhentai(query, page, settings)
        elif site == 'ehentai':
            # No search API — returns empty; use gallery-dl instead
            return {'results': [], 'total': 0}
        return {'results': [], 'total': 0}

    def _search_rule34(self, query, page, settings):
        c = self._creds('rule34', settings or {})
        uid = c.get('uid', '')
        key = c.get('key', '')
        pid = page - 1
        url = (f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index'
               f'&tags={requests.utils.quote(query)}&limit=100&pid={pid}')
        if uid and key:
            url += f'&user_id={uid}&api_key={key}'
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=30)
            if r.status_code == 200 and r.text.strip():
                root = ET.fromstring(r.text)
                total = int(root.get('count', '0'))
                posts = root.findall('post')
                results = []
                for p in posts:
                    results.append({
                        'id': p.get('id', ''),
                        'tags': (p.get('tags', '') or '').split(),
                        'file_url': p.get('file_url', ''),
                        'preview_url': p.get('preview_url', ''),
                        'sample_url': p.get('sample_url', ''),
                        'width': int(p.get('width', 0) or 0),
                        'height': int(p.get('height', 0) or 0),
                        'source': 'rule34',
                    })
                return {'results': results, 'total': total}
        except Exception:
            pass
        return {'results': [], 'total': 0}

    def _search_danbooru(self, query, page, settings):
        c = self._creds('danbooru', settings or {})
        login = c.get('login', '')
        api_key = c.get('key', '')
        url = f'https://danbooru.donmai.us/posts.json?tags={requests.utils.quote(query)}&limit=100&page={page}'
        params = {}
        if login and api_key:
            params['login'] = login
            params['api_key'] = api_key
        try:
            r = requests.get(url, params=params, headers={'User-Agent': UA}, timeout=30)
            if r.status_code == 200 and r.text.strip():
                posts = r.json()
                if not posts:
                    return {'results': [], 'total': 0}
                # Try x-total-count header; if missing or implausible, use /counts endpoint
                total = len(posts)
                hdr = r.headers.get('x-total-count')
                if hdr and hdr.isdigit() and int(hdr) > total:
                    total = int(hdr)
                else:
                    try:
                        cr = requests.get(
                            f'https://danbooru.donmai.us/counts/posts.json?tags={requests.utils.quote(query)}',
                            headers={'User-Agent': UA}, timeout=10
                        )
                        if cr.status_code == 200:
                            cd = cr.json()
                            if isinstance(cd, dict) and 'counts' in cd:
                                total = int(cd['counts'].get('posts', total))
                            elif isinstance(cd, (int, float)):
                                total = int(cd)
                    except Exception:
                        pass
                results = []
                for p in posts:
                    fu = p.get('file_url', '')
                    preview_url = p.get('preview_url', '')
                    if not preview_url and fu:
                        preview_url = fu.replace('/original/', '/preview/')
                        dot = preview_url.rfind('.')
                        if dot >= 0:
                            preview_url = preview_url[:dot] + '.jpg'
                    results.append({
                        'id': str(p.get('id', '')),
                        'tags': p.get('tag_string', '').split(),
                        'tag_artist': (p.get('tag_string_artist') or '').split(),
                        'tag_character': (p.get('tag_string_character') or '').split(),
                        'tag_copyright': (p.get('tag_string_copyright') or '').split(),
                        'tag_general': (p.get('tag_string_general') or '').split(),
                        'tag_meta': (p.get('tag_string_meta') or '').split(),
                        'file_url': fu,
                        'preview_url': preview_url,
                        'large_file_url': p.get('large_file_url', '') or fu,
                        'width': p.get('image_width', 0),
                        'height': p.get('image_height', 0),
                        'source': 'danbooru',
                    })
                return {'results': results, 'total': total}
        except Exception:
            pass
        return {'results': [], 'total': 0}
