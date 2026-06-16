"""Native API backends for Rule34 and Danbooru."""
import time, requests

UA = 'curl/8.20.0'
API_DELAY = 1.0

class ApiRawBackend:
    def fetch(self, site, md5, settings):
        if site == 'rule34':
            return self._fetch_rule34(md5, settings.get('r34_uid', ''), settings.get('r34_key', ''))
        elif site == 'danbooru':
            return self._fetch_danbooru(md5, settings.get('dan_login', ''), settings.get('dan_key', ''))
        return {'tags': [], 'file_url': '', 'preview_url': ''}

    def _fetch_rule34(self, md5, uid, key):
        url = f'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=1&tags=md5:{md5}'
        if uid and key:
            url += f'&user_id={uid}&api_key={key}'
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
                        return {'tags': p.get('tag_string', '').split(),
                                'tag_general': p.get('tag_string_general', '').split(),
                                'tag_artist': p.get('tag_string_artist', '').split(),
                                'tag_character': p.get('tag_string_character', '').split(),
                                'tag_copyright': p.get('tag_string_copyright', '').split(),
                                'tag_meta': p.get('tag_string_meta', '').split(),
                                'file_url': p.get('file_url', ''),
                                'large_file_url': p.get('large_file_url', '') or p.get('file_url', ''),
                                'preview_file_url': p.get('preview_file_url', '')}
            except Exception:
                if attempt < 2:
                    time.sleep(1)
        return {'tags': [], 'tag_general': [], 'tag_artist': [], 'tag_character': [],
                'tag_copyright': [], 'tag_meta': [], 'file_url': '', 'large_file_url': '', 'preview_file_url': ''}
