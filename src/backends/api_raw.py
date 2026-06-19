"""Native API backends for Rule34, Danbooru, NHentai."""
import time, requests

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
                                'tag_general': p.get('tag_string_general', '').split(),
                                'tag_artist': p.get('tag_string_artist', '').split(),
                                'tag_character': p.get('tag_string_character', '').split(),
                                'tag_copyright': p.get('tag_string_copyright', '').split(),
                                'tag_meta': p.get('tag_string_meta', '').split(),
                                'file_url': fu,
                                'large_file_url': p.get('large_file_url', '') or fu,
                                'preview_file_url': p.get('preview_file_url', '') or fu.replace('/original/', '/preview/')}
            except Exception:
                if attempt < 2:
                    time.sleep(1)
        return {'tags': [], 'tag_general': [], 'tag_artist': [], 'tag_character': [],
                'tag_copyright': [], 'tag_meta': [], 'file_url': '', 'large_file_url': '', 'preview_file_url': ''}

    def _fetch_nhentai(self, gid, settings):
        """NHentai gallery lookup by ID (v2 API)."""
        api_key = settings.get('credentials', {}).get('nhentai', {}).get('key', '')
        try:
            r = requests.get(
                f'https://nhentai.net/api/v2/galleries/{gid}',
                headers={'Authorization': f'Key {api_key}', 'User-Agent': UA},
                timeout=15
            )
            if r.status_code == 200:
                d = r.json()
                media_id = d.get('media_id')
                return {
                    'id': d.get('id'),
                    'title': d.get('title', {}).get('english', ''),
                    'media_id': media_id,
                    'tags': [t.get('name', '') for t in d.get('tags', [])],
                    'num_pages': d.get('num_pages', 0),
                    'file_url': f"https://i.nhentai.net/galleries/{media_id}/1.jpg",
                    'preview_url': f"https://t.nhentai.net/galleries/{media_id}/thumb.jpg",
                }
        except Exception:
            pass
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def _search_nhentai(self, query, page, settings):
        """NHentai search via v2 JSON API."""
        api_key = settings.get('credentials', {}).get('nhentai', {}).get('key', '')
        try:
            r = requests.get(
                'https://nhentai.net/api/v2/search',
                params={'query': query, 'page': page, 'sort': 'popular'},
                headers={'Authorization': f'Key {api_key}', 'User-Agent': UA},
                timeout=20
            )
            if r.status_code != 200:
                return {'results': [], 'total': 0}
            d = r.json()
            results = []
            for g in d.get('result', []):
                mid = g.get('media_id', '')
                results.append({
                    'id': g.get('id'),
                    'title': g.get('title', {}).get('english', '') or g.get('title', {}).get('japanese', ''),
                    'mid': mid,
                    'thumbnail': f"https://t.nhentai.net/galleries/{mid}/thumb.jpg" if mid else '',
                    'tags': [t.get('name', '') for t in g.get('tags', [])],
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
        return {'results': [], 'total': 0}

    def _search_rule34(self, query, page, settings):
        c = self._creds('rule34', settings or {})
        uid = c.get('uid', '')
        key = c.get('key', '')
        pid = page - 1
        url = (f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1'
               f'&tags={requests.utils.quote(query)}&limit=100&pid={pid}')
        if uid and key:
            url += f'&user_id={uid}&api_key={key}'
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=30)
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
                        'file_url': fu,
                        'preview_url': preview_url,
                        'large_file_url': p.get('large_file_url', '') or fu,
                        'width': p.get('image_width', 0),
                        'height': p.get('image_height', 0),
                        'source': 'danbooru',
                    })
                return {'results': results, 'total': len(results)}
        except Exception:
            pass
        return {'results': [], 'total': 0}
