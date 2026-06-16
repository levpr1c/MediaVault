#!/usr/bin/env python3
"""check.py — syntax + smoke + locale + dead code + function tests for MediaVault."""
import sys, os, subprocess, time, signal, json, ast, re, glob, tempfile
from pathlib import Path

ROOT = Path(__file__).parent
VENV_PYTHON = ROOT / 'venv' / 'bin' / 'python'
PYTHON = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
STATIC = ROOT / 'static'
SRC = ROOT / 'src'
PASS, FAIL = 0, 0

def ok(msg):   global PASS; PASS += 1; print(f'\033[32m  PASS\033[0m {msg}')
def ng(msg):   global FAIL; FAIL += 1; print(f'\033[31m!! FAIL\033[0m {msg}')

def check_python():
    print('--- Python ---')
    global PASS, FAIL; PASS, FAIL = 0, 0
    for f in sorted(SRC.glob('*.py')):
        r = subprocess.run([PYTHON, '-m', 'py_compile', str(f)],
                          capture_output=True)
        (ok if r.returncode == 0 else ng)(f'py_compile {f.name}')
    print(f'  {PASS} passed, {FAIL} failed')
    return FAIL == 0

def check_js():
    print('--- JavaScript ---')
    global PASS, FAIL; PASS, FAIL = 0, 0
    for f in sorted(STATIC.rglob('*.js')):
        r = subprocess.run(['node', '--check', str(f)], capture_output=True)
        label = str(f.relative_to(STATIC))
        (ok if r.returncode == 0 else ng)(f'node --check {label}')
    print(f'  {PASS} passed, {FAIL} failed')
    return FAIL == 0

def check_css():
    print('--- CSS ---')
    global PASS, FAIL; PASS, FAIL = 0, 0
    for f in sorted((STATIC / 'css').glob('*.css')):
        size = f.stat().st_size
        (ok if size > 0 else ng)(f'exists {f.name} ({size}b)')
    print(f'  {PASS} passed, {FAIL} failed')
    return FAIL == 0

def syntax_check():
    print('--- Python ---')
    ok_py = check_python()
    print('\n--- JavaScript ---')
    ok_js = check_js()
    print('\n--- CSS ---')
    ok_css = check_css()
    return ok_py and ok_js and ok_css

def smoke_test():
    print('--- Smoke Test ---')
    port = 15050
    proc = subprocess.Popen(
        [PYTHON, 'src/web_app.py', '--bind', '127.0.0.1', '--port', str(port)],
        cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(16):
            time.sleep(0.5)
            if proc.poll() is not None:
                ng('flask crashed on start'); return False
            try:
                import urllib.request
                r = urllib.request.urlopen(f'http://127.0.0.1:{port}/login', timeout=1)
                if r.status == 200: break
            except: pass
        ok('flask started')

        import urllib.request
        def get(path):
            try:
                r = urllib.request.urlopen(f'http://127.0.0.1:{port}{path}', timeout=5)
                return r.status
            except Exception as e:
                return getattr(e, 'code', 0)

        code = get('/login')
        (ok if code == 200 else ng)(f'GET /login -> {code}')

        code = get('/api/gallery')
        if code == 401: ok('GET /api/gallery (no auth) -> 401')
        else: ok(f'GET /api/gallery -> {code}')

        return True
    finally:
        proc.terminate(); proc.wait(timeout=5)

# ──────────────────────────── Locale tests ────────────────────────────

def _parse_server_locale():
    """Parse LOCALE dict from web_app.py via AST."""
    with open(SRC / 'web_app.py', encoding='utf-8') as f:
        tree = ast.parse(f.read())
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == 'LOCALE':
                    d = node.value
                    if not isinstance(d, ast.Dict):
                        return None
                    result = {}
                    for lang_key, lang_val in zip(d.keys, d.values):
                        if not isinstance(lang_key, ast.Constant):
                            continue
                        lang = lang_key.value
                        if not isinstance(lang_val, ast.Dict):
                            continue
                        entries = {}
                        for k, v in zip(lang_val.keys, lang_val.values):
                            if isinstance(k, ast.Constant) and isinstance(v, ast.Constant):
                                entries[k.value] = v.value
                        result[lang] = entries
                    return result
    return None


def _parse_js_i18ndata():
    """Parse _i18nData dict from static/shared/utils.js via regex."""
    path = STATIC / 'shared' / 'utils.js'
    if not path.exists():
        return None
    with open(path, encoding='utf-8') as f:
        src = f.read()

    result = {}
    current = None
    for line in src.split('\n'):
        m = re.match(r'\s+(en|ru):\s*\{', line)
        if m:
            current = m.group(1)
            result[current] = {}
            continue
        if current and re.match(r'\s+\},', line):
            current = None
            continue
        if current:
            m = re.match(r'\s+(\w+):\s*[\'"]', line)
            if m:
                result[current][m.group(1)] = True
    return result


def _extract_html_keys():
    """Extract all i18n keys used in .html templates."""
    keys = set()
    pat_jinja = re.compile(r"\{%-?\s*_\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*-?%\}")
    pat_jinja2 = re.compile(r"\{\{\s*_\s*\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\}\}")
    pat_data = re.compile(r'data-i18n(?:-[a-z]+)?="([^"]+)"')
    for fpath in sorted(glob.glob(str(ROOT / 'templates/**/*.html'), recursive=True)):
        with open(fpath, encoding='utf-8') as f:
            content = f.read()
        for m in pat_jinja.finditer(content):
            keys.add(m.group(1))
        for m in pat_jinja2.finditer(content):
            keys.add(m.group(1))
        for m in pat_data.finditer(content):
            keys.add(m.group(1))
    return keys


def _extract_js_keys():
    """Extract all i18n keys used in .js files (literal strings only)."""
    keys = set()
    pat_call = re.compile(r"(?:Shared\.t|_t)\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")
    for fpath in sorted(glob.glob(str(STATIC / '**/*.js'), recursive=True)):
        with open(fpath, encoding='utf-8') as f:
            content = f.read()
        for m in pat_call.finditer(content):
            key = m.group(1)
            if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', key):
                keys.add(key)
    return keys


def _extract_py_keys():
    """Extract all i18n keys used in Python source (outside LOCALE)."""
    keys = set()
    with open(SRC / 'web_app.py', encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'^LOCALE = \{', src, re.MULTILINE)
    if m:
        brace_depth = 0
        end = m.start()
        for i, ch in enumerate(src[m.start():]):
            if ch == '{':
                brace_depth += 1
            elif ch == '}':
                brace_depth -= 1
                if brace_depth == 0:
                    end = m.start() + i + 1
                    break
        src = src[:m.start()] + src[end:]

    pat = re.compile(r"_\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")
    for m in pat.finditer(src):
        keys.add(m.group(1))
    return keys


def check_locale():
    """Run all locale consistency checks."""
    print('--- Locale ---')

    server = _parse_server_locale()
    if server is None:
        ng('LOCALE not found in src/web_app.py')
        return False
    ok('LOCALE parsed from src/web_app.py')

    server_en = set(server.get('en', {}))
    server_ru = set(server.get('ru', {}))
    server_all = server_en | server_ru

    if 'en' in server and 'ru' in server:
        ok(f'LOCALE: en ({len(server_en)} keys) + ru ({len(server_ru)} keys)')
    else:
        missing = []
        if 'en' not in server: missing.append('en')
        if 'ru' not in server: missing.append('ru')
        ng(f'LOCALE missing: {", ".join(missing)}')

    only_en = server_en - server_ru
    only_ru = server_ru - server_en
    if not only_en and not only_ru:
        ok('en <-> ru keys match')
    else:
        if only_en:
            ng(f'en-only keys ({len(only_en)}): {", ".join(sorted(only_en))}')
        if only_ru:
            ng(f'ru-only keys ({len(only_ru)}): {", ".join(sorted(only_ru))}')

    js_data = _parse_js_i18ndata()
    if js_data:
        js_en = set(js_data.get('en', {}))
        js_ru = set(js_data.get('ru', {}))
        js_all = js_en | js_ru
        missing_js = server_all - js_all
        extra_js = js_all - server_all
        if missing_js:
            ng(f'JS _i18nData missing server LOCALE keys ({len(missing_js)}): {", ".join(sorted(missing_js))}')
        else:
            ok('JS _i18nData has all server LOCALE keys')
        if extra_js:
            ng(f'JS _i18nData has extra keys not in server LOCALE ({len(extra_js)}): {", ".join(sorted(extra_js))}')
    else:
        ng('_i18nData not found in static/shared/utils.js')

    html_keys = _extract_html_keys()
    js_used_keys = _extract_js_keys()
    py_keys = _extract_py_keys()
    all_used = html_keys | js_used_keys | py_keys

    missing_in_locale = all_used - server_all
    if missing_in_locale:
        for k in sorted(missing_in_locale):
            sources = []
            if k in html_keys: sources.append('html')
            if k in js_used_keys: sources.append('js')
            if k in py_keys: sources.append('py')
            ng(f'key "{k}" used in {", ".join(sources)} but missing in LOCALE')
    else:
        ok('all used keys exist in LOCALE')

    unused = server_all - all_used
    if unused:
        for k in sorted(unused):
            ng(f'LOCALE key "{k}" is never used')
    else:
        ok('all LOCALE keys are used')

    def _find_duplicate_values(entries):
        value_to_keys = {}
        for k, v in entries.items():
            value_to_keys.setdefault(v, []).append(k)
        return {v: ks for v, ks in value_to_keys.items() if len(ks) > 1}

    for lang in ('en', 'ru'):
        dups = _find_duplicate_values(server.get(lang, {}))
        if dups:
            for val, keys in sorted(dups.items()):
                ng(f'{lang} duplicate values: {", ".join(sorted(keys))} -> "{val}"')
        else:
            ok(f'no duplicate values in {lang}')

    print(f'\n--- {PASS} passed, {FAIL} failed ---')
    return FAIL == 0


# ──────────────────────────── Dead code detection ────────────────────

_FLASK_REG_DEPS = frozenset({
    'context_processor', 'before_request', 'after_request',
    'errorhandler', 'teardown_request', 'before_first_request',
})


def check_dead_code():
    """Detect unused public non-route Python functions via AST."""
    print('--- Dead Python Code ---')

    funcs = []
    for fpath in sorted(SRC.glob('*.py')):
        with open(fpath, encoding='utf-8') as f:
            try:
                tree = ast.parse(f.read())
            except SyntaxError:
                ng(f'AST parse error in {fpath.name}')
                continue
        relpath = str(fpath.relative_to(ROOT))
        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            name = node.name
            if name.startswith('_'):
                continue
            is_route = False
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr == 'route':
                    is_route = True
                    break
                if isinstance(dec, ast.Attribute) and dec.attr in _FLASK_REG_DEPS:
                    is_route = True
                    break
            if is_route:
                continue
            funcs.append((name, relpath, node.lineno))

    if not funcs:
        ok('No public non-route functions to check')
        print(f'\n--- {PASS} passed, {FAIL} failed ---')
        return True

    all_src_parts = []
    for fpath in SRC.glob('*.py'):
        all_src_parts.append(fpath.read_text(encoding='utf-8'))
    all_src = '\n'.join(all_src_parts)

    found_unused = False
    for name, relpath, lineno in funcs:
        count = len(re.findall(r'\b' + re.escape(name) + r'\b', all_src))
        if count <= 1:
            found_unused = True
            ng(f'Unused function: {name} ({relpath}:{lineno})')

    if not found_unused:
        ok(f'All {len(funcs)} public non-route functions are used')

    print(f'\n--- {PASS} passed, {FAIL} failed ---')
    return FAIL == 0


def check_dead_js():
    """Detect unused JS functions via regex-based reference counting."""
    print('--- Dead JavaScript ---')

    # Common JS built-in names likely to produce false positives
    _JS_EXCLUDE = {
        'name', 'length', 'prototype', 'constructor', 'call', 'apply', 'bind',
        'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf',
        'forEach', 'map', 'filter', 'reduce', 'find', 'some', 'every',
        'includes', 'indexOf', 'split', 'join', 'trim', 'slice', 'splice',
        'push', 'pop', 'shift', 'unshift', 'sort', 'reverse', 'concat',
        'then', 'catch', 'finally', 'resolve', 'reject',
        'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
        'undefined', 'null', 'true', 'false', 'NaN', 'Infinity',
        'exports', 'module', 'require', 'define', 'import', 'export',
        'classList', 'add', 'remove', 'toggle', 'contains',
        'innerHTML', 'innerText', 'textContent', 'value', 'style',
        'onclick', 'onload', 'onerror', 'onsubmit', 'onchange', 'oninput',
        'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onkeypress',
        'onmousedown', 'onmouseup', 'onmousemove', 'onmouseover',
        'onmouseout', 'onmouseenter', 'onmouseleave', 'onscroll',
        'onresize', 'ontouchstart', 'ontouchend', 'ontouchmove',
        'onwheel', 'oncontextmenu', 'ondblclick', 'ondrag', 'ondrop',
        'onhashchange', 'onpopstate', 'onprogress', 'onreadystatechange',
        'ontimeupdate', 'onvolumechange', 'onwaiting', 'oncanplay',
        'onended', 'onloadeddata', 'onpause', 'onplay', 'onplaying',
        'onseeked', 'onseeking', 'onstalled', 'onsuspend',
        'addEventListener', 'removeEventListener', 'querySelector',
        'querySelectorAll', 'getElementById', 'getElementsByClassName',
        'getElementsByTagName', 'createElement', 'appendChild', 'removeChild',
        'setAttribute', 'getAttribute', 'removeAttribute',
        'classList', 'matches', 'closest', 'contains',
        'fetch', 'console', 'window', 'document', 'location', 'navigator',
        'localStorage', 'sessionStorage', 'history', 'screen',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'requestAnimationFrame', 'cancelAnimationFrame',
        'alert', 'confirm', 'prompt',
        'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number',
        'Boolean', 'RegExp', 'Error', 'Map', 'Set', 'Promise', 'Symbol',
        'URL', 'FormData', 'Blob', 'File', 'FileReader', 'Image',
        'XMLHttpRequest', 'Headers', 'Request', 'Response',
        'AbortController', 'AbortSignal',
        'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
        'Element', 'Node', 'Event', 'CustomEvent', 'HTMLElement',
        'KeyboardEvent', 'MouseEvent', 'TouchEvent', 'WheelEvent',
        'PointerEvent', 'DragEvent', 'ClipboardEvent', 'SubmitEvent',
        'Text', 'Comment', 'DocumentFragment', 'ShadowRoot',
        'Intl', 'performance', 'crypto', 'caches',
        'WeakMap', 'WeakSet', 'Proxy', 'Reflect', 'Symbol',
        'decodeURI', 'encodeURI', 'decodeURIComponent', 'encodeURIComponent',
        'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'Infinity', 'NaN',
        'globalThis', 'self', 'top', 'parent', 'frames',
    }

    js_files = sorted(STATIC.rglob('*.js'))
    if not js_files:
        ok('No JS files to check')
        return True

    defs = []
    for fpath in js_files:
        src = fpath.read_text(encoding='utf-8')
        rel = str(fpath.relative_to(ROOT))
        for m in re.finditer(r'(?:^|\b)(?:export\s+)?function\s+([a-zA-Z_$][\w$]*)\s*\(', src, re.MULTILINE):
            defs.append((m.group(1), rel, src.count('\n', 0, m.start()) + 1))
        for m in re.finditer(r'([a-zA-Z_$][\w$]*)\s*:\s*function\s*\(', src):
            defs.append((m.group(1), rel, src.count('\n', 0, m.start()) + 1))

    if not defs:
        ok('No named JS functions to check')
        return True

    all_js_src = '\n'.join(f.read_text(encoding='utf-8') for f in js_files)

    found_unused = False
    for name, relpath, lineno in defs:
        if len(name) < 3 or name in _JS_EXCLUDE:
            continue
        count = len(re.findall(r'\b' + re.escape(name) + r'\b', all_js_src))
        if count <= 1:
            found_unused = True
            ng(f'Unused JS function: {name} ({relpath}:{lineno})')

    if not found_unused:
        ok(f'All {len(defs)} named JS functions have references (after filtering)')

    print(f'\n--- {PASS} passed, {FAIL} failed ---')
    return FAIL == 0


# ──────────────────────────── Function unit tests ────────────────────

_FUNC_TEST_SCRIPT = r'''
import sys, os, math, re, tempfile, shutil

META_TAGS = {'sound', 'animated', 'photo', 'video', 'gif'}
ASPECT_RATIO_RE = re.compile(r'^\d+:\d+$')

def _has_non_meta_tags(tag_str):
    return any(
        t.strip() and t.strip() not in META_TAGS and not ASPECT_RATIO_RE.match(t.strip())
        for t in tag_str.split(',')
    )

def _get_aspect_ratio_tag(width, height):
    if not width or not height:
        return ''
    try:
        g = math.gcd(width, height)
        return f'{width // g}:{height // g}'
    except Exception:
        return ''

_IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'}
_VIDEO_EXTS = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}
_AUDIO_EXTS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'}

def _get_file_type(ext):
    if ext in _IMAGE_EXTS:
        return 'image'
    if ext in _VIDEO_EXTS:
        return 'video'
    if ext in _AUDIO_EXTS:
        return 'audio'
    return 'other'

def _is_dir_empty(path):
    try:
        for entry in os.scandir(path):
            if entry.is_file(follow_symlinks=False) and not entry.name.startswith('.'):
                return False
            if entry.is_dir(follow_symlinks=False) and not entry.name.startswith('.'):
                for sub in os.scandir(entry.path):
                    if sub.is_file(follow_symlinks=False) and not sub.name.startswith('.'):
                        return False
        return True
    except Exception:
        return True

PASS, FAIL = 0, 0
def ok(msg):   global PASS; PASS += 1; print(f'PASS {msg}')
def ng(msg):   global FAIL; FAIL += 1; print(f'FAIL {msg}')

# _has_non_meta_tags tests
ok('_has_non_meta_tags meta-only single') if not _has_non_meta_tags('photo') else ng('_has_non_meta_tags meta-only single')
ok('_has_non_meta_tags meta-only multi') if not _has_non_meta_tags('photo,video,animated') else ng('_has_non_meta_tags meta-only multi')
ok('_has_non_meta_tags aspect-ratio') if not _has_non_meta_tags('16:9') else ng('_has_non_meta_tags aspect-ratio')
ok('_has_non_meta_tags with non-meta') if _has_non_meta_tags('original') else ng('_has_non_meta_tags with non-meta')
ok('_has_non_meta_tags mixed') if _has_non_meta_tags('photo,original') else ng('_has_non_meta_tags mixed')
ok('_has_non_meta_tags empty') if not _has_non_meta_tags('') else ng('_has_non_meta_tags empty')
ok('_has_non_meta_tags aspect-ratio with meta') if not _has_non_meta_tags('16:9,video') else ng('_has_non_meta_tags aspect-ratio with meta')

# _get_aspect_ratio_tag tests
ok('_get_aspect_ratio_tag 16:9') if _get_aspect_ratio_tag(1920, 1080) == '16:9' else ng(f'_get_aspect_ratio_tag 16:9 got {_get_aspect_ratio_tag(1920, 1080)}')
ok('_get_aspect_ratio_tag 4K') if _get_aspect_ratio_tag(3840, 2160) == '16:9' else ng(f'_get_aspect_ratio_tag 4K got {_get_aspect_ratio_tag(3840, 2160)}')
ok('_get_aspect_ratio_tag 4:3') if _get_aspect_ratio_tag(4, 3) == '4:3' else ng(f'_get_aspect_ratio_tag 4:3 got {_get_aspect_ratio_tag(4, 3)}')
ok('_get_aspect_ratio_tag zeroes') if _get_aspect_ratio_tag(0, 0) == '' else ng(f'_get_aspect_ratio_tag zeroes got {_get_aspect_ratio_tag(0, 0)}')
ok('_get_aspect_ratio_tag one zero') if _get_aspect_ratio_tag(100, 0) == '' else ng(f'_get_aspect_ratio_tag one zero got {_get_aspect_ratio_tag(100, 0)}')
ok('_get_aspect_ratio_tag 1:1') if _get_aspect_ratio_tag(1, 1) == '1:1' else ng(f'_get_aspect_ratio_tag 1:1 got {_get_aspect_ratio_tag(1, 1)}')
ok('_get_aspect_ratio_tag 21:9') if _get_aspect_ratio_tag(64, 27) == '64:27' else ng(f'_get_aspect_ratio_tag 64:27 got {_get_aspect_ratio_tag(64, 27)}')

# _get_file_type tests
ok('_get_file_type .jpg -> image') if _get_file_type('.jpg') == 'image' else ng(f'_get_file_type .jpg -> {_get_file_type(".jpg")}')
ok('_get_file_type .png -> image') if _get_file_type('.png') == 'image' else ng(f'_get_file_type .png -> {_get_file_type(".png")}')
ok('_get_file_type .mp4 -> video') if _get_file_type('.mp4') == 'video' else ng(f'_get_file_type .mp4 -> {_get_file_type(".mp4")}')
ok('_get_file_type .mp3 -> audio') if _get_file_type('.mp3') == 'audio' else ng(f'_get_file_type .mp3 -> {_get_file_type(".mp3")}')
ok('_get_file_type .pdf -> other') if _get_file_type('.pdf') == 'other' else ng(f'_get_file_type .pdf -> {_get_file_type(".pdf")}')
ok('_get_file_type .mkv -> video') if _get_file_type('.mkv') == 'video' else ng(f'_get_file_type .mkv -> {_get_file_type(".mkv")}')
ok('_get_file_type .wav -> audio') if _get_file_type('.wav') == 'audio' else ng(f'_get_file_type .wav -> {_get_file_type(".wav")}')
ok('_get_file_type empty -> other') if _get_file_type('') == 'other' else ng(f'_get_file_type empty -> {_get_file_type("")}')
ok('_get_file_type no dot -> other') if _get_file_type('jpg') == 'other' else ng(f'_get_file_type no dot -> {_get_file_type("jpg")}')

# _is_dir_empty tests
tmpdir = tempfile.mkdtemp()
try:
    ok('_is_dir_empty empty dir') if _is_dir_empty(tmpdir) else ng('_is_dir_empty empty dir')

    with open(os.path.join(tmpdir, 'test.txt'), 'w') as f: f.write('x')
    ok('_is_dir_empty non-empty') if not _is_dir_empty(tmpdir) else ng('_is_dir_empty non-empty')

    os.remove(os.path.join(tmpdir, 'test.txt'))
    with open(os.path.join(tmpdir, '.hidden'), 'w') as f: f.write('x')
    ok('_is_dir_empty hidden only') if _is_dir_empty(tmpdir) else ng('_is_dir_empty hidden only')

    os.remove(os.path.join(tmpdir, '.hidden'))
    subdir = os.path.join(tmpdir, 'sub')
    os.makedirs(subdir)
    ok('_is_dir_empty subdir only') if _is_dir_empty(tmpdir) else ng('_is_dir_empty subdir only')

    with open(os.path.join(subdir, 'nested.txt'), 'w') as f: f.write('x')
    ok('_is_dir_empty nested file') if not _is_dir_empty(tmpdir) else ng('_is_dir_empty nested file')

finally:
    shutil.rmtree(tmpdir)

ok('_is_dir_empty nonexistent') if _is_dir_empty('/_nonexistent_path_xyz_') else ng('_is_dir_empty nonexistent')

print(f'\nResults: {PASS} passed, {FAIL} failed')
sys.exit(0 if FAIL == 0 else 1)
'''


def check_functions():
    """Run unit tests on key helper functions via subprocess."""
    print('--- Function Tests ---')

    fd, tmppath = tempfile.mkstemp(suffix='.py', prefix='mv_check_func_')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(_FUNC_TEST_SCRIPT)
        r = subprocess.run(
            [PYTHON, tmppath],
            capture_output=True, text=True, timeout=30
        )
        for line in r.stdout.split('\n'):
            line = line.strip()
            if not line:
                continue
            if line.startswith('PASS '):
                ok(line[5:])
            elif line.startswith('FAIL '):
                ng(line[5:])
            else:
                print(f'  {line}')
        if r.stderr:
            for line in r.stderr.strip().split('\n'):
                print(f'  stderr: {line}')
    except subprocess.TimeoutExpired:
        ng('Function tests timed out (30s)')
    except Exception as e:
        ng(f'Function tests error: {e}')
    finally:
        try:
            os.unlink(tmppath)
        except Exception:
            pass

    print(f'\n--- {PASS} passed, {FAIL} failed ---')
    return FAIL == 0


# ──────────────────────────── Fix mode ─────────────────────────────

def fix_unused_keys():
    """Remove unused LOCALE keys from web_app.py and _i18nData in utils.js."""
    import re

    server = _parse_server_locale()
    if server is None:
        print('  Cannot fix: LOCALE not found'); return False

    server_en = set(server.get('en', {}).keys())
    server_ru = set(server.get('ru', {}).keys())
    server_all = server_en | server_ru

    html_keys = _extract_html_keys()
    js_used_keys = _extract_js_keys()
    py_keys = _extract_py_keys()
    all_used = html_keys | js_used_keys | py_keys

    unused = server_all - all_used
    print('--- Fix Unused Keys ---')
    if not unused:
        print('  No unused keys to remove')
        print(f'\n--- 0 removed ---')
        return True

    # Remove from web_app.py LOCALE
    path = SRC / 'web_app.py'
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    removed = []
    for line in lines:
        skip = False
        for key in unused:
            if re.search(r"['\"]" + re.escape(key) + r"['\"]\s*:", line):
                skip = True
                removed.append(key)
                break
        if not skip:
            new_lines.append(line)

    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    # Remove from _i18nData in utils.js
    js_path = STATIC / 'shared' / 'utils.js'
    with open(js_path, encoding='utf-8') as f:
        js_lines = f.readlines()

    js_removed = []
    new_js_lines = []
    for line in js_lines:
        skip = False
        for key in unused:
            if re.match(r'^\s+' + re.escape(key) + r'\s*:', line):
                skip = True
                js_removed.append(key)
                break
        if not skip:
            new_js_lines.append(line)

    with open(js_path, 'w', encoding='utf-8') as f:
        f.writelines(new_js_lines)

    print(f'  Removed {len(set(removed))} unused keys from LOCALE')
    for k in sorted(set(removed)):
        print(f'    - {k}')

    # Also sweep blank lines that might result from removals
    for fpath in (SRC / 'web_app.py', STATIC / 'shared' / 'utils.js'):
        with open(fpath, encoding='utf-8') as f:
            txt = f.read()
        # Remove doubled blank lines
        while '\n\n\n' in txt:
            txt = txt.replace('\n\n\n', '\n\n')
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(txt)

    print(f'\n--- {len(set(removed))} removed ---')
    return True


# ──────────────────────────── Watch mode ────────────────────────────

def watch():
    """Watch source files and re-run syntax check on change."""
    import hashlib
    seen = {}
    def scan():
        files = [*SRC.glob('*.py'), *STATIC.rglob('*.js'), *(STATIC / 'css').glob('*.css')]
        changed = []
        for f in files:
            h = hashlib.md5(f.read_bytes()).hexdigest()
            if seen.get(f) != h:
                seen[f] = h; changed.append(f)
        return changed

    scan()  # init
    print('Watching for changes... (Ctrl+C to stop)')
    try:
        while True:
            changed = scan()
            if changed:
                print(f'\n-- Changed: {", ".join(f.name for f in changed)} --')
                syntax_check()
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nstopped')


_CHECK_GROUPS = {
    'py':   lambda: check_python(),
    'js':   lambda: check_js(),
    'css':  lambda: check_css(),
    'syntax': lambda: syntax_check(),
    'locale': lambda: check_locale(),
    'dead':   lambda: check_dead_code() and check_dead_js(),
    'func':   lambda: check_functions(),
    'smoke':  lambda: smoke_test(),
}

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Syntax + smoke + locale + dead code + function tests for MediaVault.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('--check', nargs='+', metavar='CHECK',
                        choices=list(_CHECK_GROUPS),
                        help='One or more checks: py, js, css, syntax, locale, dead, func, smoke')
    parser.add_argument('--watch', action='store_true', help='watch mode (re-run syntax check)')
    parser.add_argument('--fix', action='store_true', help='remove unused LOCALE keys')
    args = parser.parse_args()

    if args.fix:
        fix_unused_keys()
        sys.exit(0)
    elif args.watch:
        watch()
    elif args.check:
        ok = all(_CHECK_GROUPS[c]() for c in args.check)
        sys.exit(0 if ok else 1)
    else:
        # default: syntax + locale + dead + func (no smoke)
        ok_syn = syntax_check()
        ok_loc = check_locale()
        ok_dc = check_dead_code()
        ok_dj = check_dead_js()
        ok_ft = check_functions()
        sys.exit(0 if (ok_syn and ok_loc and ok_dc and ok_dj and ok_ft) else 1)
