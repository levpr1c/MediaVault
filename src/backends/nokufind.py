"""NHentai search via unofficial JSON API."""
import requests, time

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'

class NokufindBackend:
    def search(self, query, page=1):
        url = f'https://nhentai.net/api/galleries/search?query={requests.utils.quote(query)}&page={page}'
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                results = []
                for g in data.get('result', []):
                    results.append({
                        'id': g['id'],
                        'title': g['title']['english'] or g['title']['japanese'] or '',
                        'thumbnail': f"https://t.nhentai.net/galleries/{g['media_id']}/thumb.jpg",
                        'tags': [t['name'] for t in g.get('tags', [])],
                        'pages': g.get('num_pages', 0),
                    })
                return {'results': results, 'total': data.get('num_pages', 0) * 25}
        except Exception:
            pass
        return {'results': [], 'total': 0}

    def fetch_gallery(self, gallery_id):
        url = f'https://nhentai.net/api/gallery/{gallery_id}'
        try:
            r = requests.get(url, headers={'User-Agent': UA}, timeout=15)
            if r.status_code == 200:
                data = r.json()
                pages = []
                for i in range(1, data.get('num_pages', 0) + 1):
                    pages.append({
                        'page': i,
                        'url': f"https://i.nhentai.net/galleries/{data['media_id']}/{i}.jpg"
                    })
                return {
                    'id': data['id'],
                    'title': data['title']['english'] or data['title']['japanese'] or '',
                    'tags': [t['name'] for t in data.get('tags', [])],
                    'pages': pages,
                    'media_id': data['media_id'],
                }
        except Exception:
            pass
        return None
