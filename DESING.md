# MediaVault Design System

Comprehensive reference for the MediaVault UI. All CSS classes, variables, components, and patterns used across the app.

---

## 1. Design Tokens

### 1.1 CSS Variables — Core

| Variable | Dark | Light | Description |
|----------|------|-------|-------------|
| `--bg` | `#121212` | `#f5f5f5` | Page background |
| `--surface` | `#1e1e1e` | `#ffffff` | Cards, sidebar, header |
| `--surface2` | `#2a2a2a` | `#e8e8e8` | Inputs, secondary surfaces, hover states |
| `--surface3` | `#383838` | `#d4d4d4` | Scrollbar thumb, tertiary surfaces |
| `--text` | `#e0e0e0` | `#1a1a1a` | Primary text |
| `--text2` | `#999999` | `#666666` | Secondary text, labels, captions |
| `--accent` | `#64b5f6` | `#4a90d9` | Accent blue — interactive elements |
| `--accent-hover` | `#42a5f5` | `#357abd` | Accent hover state |
| `--accent-glow` | `rgba(100,181,246,0.12)` | `rgba(74,144,217,0.12)` | Active nav background |
| `--border` | `#333333` | `#dddddd` | Borders, dividers |
| `--border-light` | `#555555` | `#eeeeee` | Hover borders |
| `--shadow` | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.1)` | Drop shadows |
| `--overlay` | `rgba(0,0,0,0.8)` | `rgba(0,0,0,0.6)` | Modal/lightbox backdrop |
| `--danger` | `#ef5350` | `#ef5350` | Destructive actions |
| `--success` | `#66bb6a` | `#66bb6a` | Success states |
| `--chip-bg` | `#2a2a2a` | `#e8e8e8` | Tag chip background |
| `--chip-text` | `#aaaaaa` | `#555555` | Tag chip text |

### 1.2 CSS Variables — Layout & Z-Index

| Variable | Value | Description |
|----------|-------|-------------|
| `--font` | `'Manrope', sans-serif` | Body font |
| `--font-heading` | `'Unbounded', sans-serif` | Heading font |
| `--radius` | `8px` | Default border radius |
| `--transition` | `0.2s ease` | Default transition |
| `--lb-panel-w` | `300px` | Lightbox info panel width |
| `--thumb-col-width` | `220px` | Gallery column width (masonry) |
| `--grid-cols` | `4` | Gallery grid column count |
| `--z-dropdown` | `100` | Dropdowns, autocomplete |
| `--z-sticky` | *(not defined in CSS)* | Used by home.html inline style (`z-index:var(--z-sticky)`) — defaults to auto |
| `--z-overlay` | `200` | Modals, overlays, bulk tag bar |
| `--z-modal` | `300` | Modal dialogs (comics picker, etc.) |
| `--z-lightbox` | `1000` | Lightbox overlay |
| `--z-toast` | `10000` | Toast notifications |

---

## 2. Themes

### 2.1 Implementation

Themes are controlled via the `data-theme` attribute on `<html>`:

```html
<html data-theme="dark">   <!-- explicit dark -->
<html data-theme="light">  <!-- explicit light -->
<html>                     <!-- follows system preference via prefers-color-scheme -->
```

CSS structure in `shared.css:4-66`:

1. **`:root`** — dark theme defaults (lines 5-32)
2. **`[data-theme="light"]`** — light overrides (lines 33-49)
3. **`@media (prefers-color-scheme: dark)`** — system dark fallback for unset theme (lines 51-66)

Toggle via JS: `document.documentElement.setAttribute('data-theme', 'light')` + POST `/api/theme`.

### 2.2 System Preference Fallback

When `data-theme` is not set, the `@media (prefers-color-scheme: dark)` query applies dark defaults. This ensures the app always has a valid theme.

---

## 3. Typography

### 3.1 Font Families

| Font | Weight | Usage | Source |
|------|--------|-------|--------|
| **Manrope** | 400, 500, 600, 700 | Body text, buttons, inputs, UI elements | Google Fonts |
| **Unbounded** | 500, 600, 700, 800, 900 | Headings, brand, page titles, badges | Google Fonts |
| **JetBrains Mono** | 500 | *(loaded but unused in CSS)* | Google Fonts |

### 3.2 Font Stack

```css
--font: 'Manrope', sans-serif;       /* body */
--font-heading: 'Unbounded', sans-serif;  /* headings */
```

### 3.3 Size Scale

| Size | Usage | Weight | Line Height |
|------|-------|--------|-------------|
| `10px` | Section labels, toolbar group labels, uppercase | 600–700 | — |
| `11px` | Page numbers, count badges, small labels | — | — |
| `12px` | Tag chips, gallery names, sidebar labels, descriptions | 500 | — |
| `13px` | Buttons (default), nav items, inputs, body text | 500 | 1.4 |
| `14px` | Primary buttons, home page buttons, card titles | 500–600 | — |
| `15px` | Body text default, brand | 700 | 1.6 |
| `16px` | Card titles, admin card titles, mobile brand | 600–700 | — |
| `18px` | Header h1, page titles | 600–700 | — |
| `20px` | Admin page titles, gallery empty headings | 500–700 | — |
| `22px` | Home page title (mobile) | 800 | — |
| `26px` | Home page block titles | 800 | — |
| `28px` | Home page title (desktop) | 800 | — |

### 3.4 Text Rendering

All body text and buttons use `-webkit-font-smoothing: antialiased` for crisp rendering on macOS.

---

## 4. Color System

### 4.1 Accent Color

The accent color (`--accent`) is blue and used for:
- Primary buttons (`.btn-primary`)
- Active navigation items
- Focus borders on inputs
- Selected gallery items
- Link hover states
- Active tab indicators

### 4.2 Category Colors (Tag System)

Category colors are stored in the `tag_categories` DB table and returned via `GET /api/categories`. Defaults from `web_app.py:897-903`:

| Category | Default Color | CSS Usage |
|----------|--------------|-----------|
| Artist | `#ff4444` (red) | `.tag-chip` background inline style |
| Character | `#44cc44` (green) | `.tag-chip` background inline style |
| Copyright | `#4488ff` (blue) | `.tag-chip` background inline style |
| Meta | `#999999` (grey) | `.tag-chip` background inline style |
| General | `#cccccc` (light grey) | `.tag-chip` background inline style |

Tag chips in the UI use inline `style="background: COLOR"` applied by the templates. The `.tag-chip` class provides consistent sizing (`padding: 2px 6px; border-radius: 4px; font-size: 12px`). Category dot in view overlay uses `.cat-dot` (7px circle).

### 4.3 Home Block Colors

| Block | Gradient | Hover Border | Hover Shadow |
|-------|----------|-------------|--------------|
| MV (MediaVault) | `#6366f1 → #8b5cf6` (indigo) | `#6366f1` | `rgba(99,102,241,0.18)` |
| CM (Content Mgmt) | `#f59e0b → #f97316` (amber) | `#f59e0b` | `rgba(245,158,11,0.18)` |
| Admin | `#10b981 → #059669` (emerald) | `#10b981` | `rgba(16,185,129,0.18)` |

---

## 5. Spacing & Layout

### 5.1 Page Padding

| Context | Desktop | Mobile (<768px) |
|---------|---------|-----------------|
| Main content | `20px 24px` | `12px` |
| Gallery (#mvMain) | `16px` | `12px` |
| Admin | `28px 32px` | `16px` |
| Content Management | `20px 24px` | `12px 16px` |
| Tagfetch Auto | `20px 24px` | `12px` |
| Home page | `24px` (page) | `20px 12px` (hero) |

### 5.2 Card Padding

| Component | Padding |
|-----------|---------|
| `.admin-card` | `24px` |
| `.admin-card-header` | `margin-bottom: 16px` |
| `.hm-block` | `24px` |
| `.hm-block-head` | `padding: 4px 0 10px; margin-bottom: 14px` |
| `.cm-tags-card` | — (flex child) |
| `.db-tool` | `16px` |
| `.form-section` | `16px 20px` |
| `.panel` (tagfetch) | `14px` |
| `.cat-modal` | `20px` |

### 5.3 Gaps

| Gap Size | Usage |
|----------|-------|
| `2px` | `.hdr-tabs`, `.hdr-nav`, tabs row |
| `4px` | Search mode, thumb size, filter bar |
| `6px` | Mobile header rows, toolbar groups, small UI gaps |
| `8px` | Default gap — buttons, toolbar, gallery items, tags |
| `10px` | Admin field rows, DB grid, file browser |
| `12px` | Header, preview rows, content gap, section gap |
| `16px` | Home blocks, tag scroll sections, panels gap |
| `24px` | Admin main padding, large section gap |
| `32px` | Home hero blocks gap |

### 5.4 Max-Widths

| Element | Max-Width |
|---------|-----------|
| `.home-hero-blocks` | `1060px` (desktop) |
| `.hm-block` (MV, Admin) | `420px` (flex:1) |
| `.hm-block[data-block="mv"]` | `480px` |
| `.hm-block--cm` | `620px` (flex:1.5) |
| `.admin-modal-content` | `440px` |
| `.comic-modal` (modal) | `1100px` |
| Sidebar (`aside`) | `260px` (fixed) |
| Tagfetch sidebar | `500px` (max), resizeable |
| `#gallery.few-items .gallery-item` | `var(--thumb-col-width, 220px)` |

---

## 6. Component Library

### 6.1 Header

**Desktop** (`.hdr-desktop` — `mediavault.css:11`)

```css
.hdr-desktop { display: flex; align-items: center; gap: 12px;
  padding: 6px 16px; background: var(--surface); border-bottom: 1px solid var(--border); }
```

Structure inside `#appHeader`:

| Element | Class/ID | Description |
|---------|----------|-------------|
| Tab container | `.hdr-tabs` | Flex row, `gap: 2px` |
| Spacer | `.hdr-spacer` | `flex: 1` |
| Actions | `.hdr-actions` | Right-aligned, Home/Theme/Lang buttons |
| Navigation | `.hdr-nav` | Left-aligned nav links |
| Brand | `.brand` | `font-size: 15px; font-weight: 700; font-family: var(--font-heading); color: var(--accent)` |
| Account dropdown | `.hdr-dropdown` | Absolute positioned dropdown, `right: 0`, `radius: 10px` |

**Mobile** (`.hdr-mobile` — `mediavault.css:81-95` + `shared.css:81-95`)

Shown at `<768px`, `.hdr-desktop` is hidden.

Structure:
- `.mv-mh-row1` — brand + spacer + search + icons
- `.mv-mh-row2` — toolbar buttons (layout, sort, page size)
- `.mv-mh-brand` — 16px, 700 weight, font-heading
- `.mv-mh-icon` — 32×32 icon buttons
- `.mv-mh-search` — flex search bar with icon + input

**Drawer** (`.mv-drawer` — `shared.css:74-78`)

Animated expand/collapse for mobile toolbar:
```css
.mv-drawer { overflow: hidden; max-height: 0; transition: max-height .35s ease; }
.mv-drawer.open { max-height: 300px; }
```

### 6.2 Tabs

**MediaVault Tabs** (`.mv-tab` — `mediavault.css:222-224`)

```css
.mv-tab { display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; font-size: 14px; font-weight: 600;
  color: var(--text2); border-radius: 8px;
  text-transform: uppercase; letter-spacing: .3px; }
.mv-tab:hover { color: var(--text); background: var(--surface2); }
.mv-tab.active { color: var(--accent); background: var(--surface2); border-color: var(--accent); }
```

**Settings Tabs** (`.settings-tab-btn` — `settings.css:8-20`)

```css
.settings-tab-btn { padding: 4px 12px; height: 32px; font-size: 13px; font-weight: 500;
  border-radius: 6px; transition: all .2s; }
.settings-tab-btn.active { background: var(--accent); color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.12); }
```

Container: `.settings-tabs-row` — `display: flex; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;`
Content: `.settings-tab-content { display: none; }` / `.settings-tab-content.active { display: block; animation: fadeUp .3s ease; }`

**CM Header Button** (`.cm-hdr-btn` — `content.css:431-438`)

```css
.cm-hdr-btn { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;
  color: var(--text2); letter-spacing: .4px; }
.cm-hdr-btn.active { color: var(--accent); background: rgba(100,181,246,.1); }
```

**CM Header Dropdowns:** All CM groups (TAGFETCH, TAGS, COMICS, SEARCH) are expandable dropdowns implemented in `content/cm-header.js`. Click a group header to toggle its links open/closed. Multiple dropdowns can be open simultaneously.

**Tagfetch Tabs** (`.tf-tab` — `tagfetch.css:48-50`)
Same visual style as `.mv-tab`.

### 6.3 Buttons

**Base Button** (`.btn` — `shared.css:110-111`)

```css
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); color: var(--text); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all var(--transition); font-family: var(--font);
  line-height: 1.4; white-space: nowrap; text-decoration: none; }
.btn:hover { background: var(--surface2); border-color: var(--border-light); }
.btn:active { transform: scale(.96); }
```

**Button Variants**

| Class | Background | Text | Border |
|-------|-----------|------|--------|
| `.btn` | `var(--surface)` | `var(--text)` | `var(--border)` |
| `.btn-primary` | `var(--accent)` | `#fff` | `var(--accent)` |
| `.btn-danger` | `var(--danger)` | `#fff` | `var(--danger)` |
| `.btn-success` | `var(--success)` | `#fff` | `var(--success)` |

**Button Sizes**

| Class | Padding | Font-Size | Radius |
|-------|---------|-----------|--------|
| `.btn` (default) | `8px 16px` | `13px` | `6px` |
| `.btn-sm` | `5px 10px` | `12px` | `5px` |
| `.btn-xs` | `2px 6px` | `11px` | `4px` |
| `.btn-icon` | `6px` | `16px` | — |

**Tool Button** (`.tool-btn` — `mediavault.css:58-62`)

```css
.tool-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--text2); font-size: 13px; cursor: pointer;
  line-height: 1.4; min-height: 32px; }
.tool-btn:hover { background: var(--surface2); color: var(--text); }
.tool-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
```

**Language & Theme Buttons** (`.lang-btn`, `.theme-btn` — `mediavault.css:133-147`)

Animated expand buttons with SVG icons:

```css
.lang-btn, .theme-btn { display: inline-flex; align-items: center; justify-content: center;
  padding: 6px; min-width: 36px; border: none; background: transparent;
  color: var(--text2); cursor: pointer; border-radius: 8px;
  transition: background .15s, color .15s, gap .3s cubic-bezier(.34,1.56,.64,1); }
```

Text animation: `.lang-text` — `width: 0 → 28px` on hover (`.show-text`). `.theme-text` — `width: 0 → 20px` on hover.

**Mobile Header Icon** (`.mv-mh-icon` — `shared.css:86-89`)

```css
.mv-mh-icon { width: 32px; height: 32px; border: none; background: none;
  color: var(--text2); cursor: pointer; border-radius: 8px; }
.mv-mh-icon:hover { background: var(--surface2); color: var(--text); }
.mv-mh-icon:active { transform: scale(.92); }
.mv-mh-icon.active { background: var(--surface2); color: var(--accent); }
```

**CM Toolbar Action** (`.cm-files-tb-action` — `content.css:83-91`)
Same pattern as `.tool-btn`.

**Theme Button (Home)** (`.theme-btn.effects-off` — `shared.css:123`)
```css
.theme-btn.effects-off { opacity: .5; border-color: rgba(255,255,255,.1);
  background: rgba(255,255,255,.04); }
```

### 6.4 Cards

**Admin Card** (`.admin-card` — `admin.css:25-50`)

```css
.admin-card { background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 24px; margin-bottom: 16px;
  transition: border-color var(--transition); }
.admin-card:hover { border-color: var(--border-light); }
.admin-card-header { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px; }
.admin-card-title { font-size: 16px; font-weight: 600; color: var(--text); }
.admin-card-desc { font-size: 13px; color: var(--text2); margin: -8px 0 16px; line-height: 1.5; }
```

**Home Block** (`.hm-block` — inline style in `home.html`)

```css
.hm-block { flex: 1; min-width: 280px; max-width: 420px;
  background: var(--surface); border: 2px solid var(--border);
  border-radius: 18px; padding: 24px; transition: all .25s ease;
  display: flex; flex-direction: column; }
```

Per-block hover colors via `data-block` attribute:
- `[data-block="mv"]:hover` → indigo (`#6366f1`)
- `[data-block="cm"]:hover` → amber (`#f59e0b`)
- `[data-block="admin"]:hover` → emerald (`#10b981`)

Internal structure:
- `.hm-block-head` — icon + title row, min-height 52px, bottom border
- `.hm-block-title` — 13px, 700 weight, uppercase, text2 color
- `.hm-block-icon` — 32×32, border-radius 8px, gradient backgrounds
- `.hm-block-grid` — flex column, gap 8px
- `.hm-block-btn` — 44px min-height, 14px, 600 weight, rounded 10px, hover lift + color
- `.hm-block-desc` — 12px, text2, centered, margin-top auto

### 6.5 Gallery

**Layout Modes** (`mediavault.css:66-103`)

| Mode | Class | Display | Description |
|------|-------|---------|-------------|
| Masonry | `#gallery` (default) | `column-width: var(--thumb-col-width, 220px)` | CSS multi-column masonry |
| Grid | `#gallery.fixed` | `grid; grid-template-columns: repeat(var(--grid-cols,4), 1fr)` | Even grid |
| Scroll | `#gallery.scroll` | `flex; flex-direction: column` | Horizontal list |

**Gallery Item** (`.gallery-item` — `mediavault.css:72-78`)

```css
.gallery-item { display: inline-block; width: 100%; margin-bottom: 8px;
  overflow: hidden; cursor: pointer; background: var(--surface);
  border-radius: 4px; break-inside: avoid;
  animation: pageFadeIn .25s ease both; }
.gallery-item.selected::after { border: 3px solid var(--accent); }
```

**Gallery Thumb** (`.gallery-thumb` — `mediavault.css:80-83`)

```css
.gallery-thumb { display: flex; align-items: center; justify-content: center;
  font-size: 48px; background: var(--surface2); color: var(--text2);
  overflow: hidden; min-height: 80px; position: relative; }
```

**Gallery Info** (`.gallery-info` — `mediavault.css:84-87`)
- `.gallery-name` — 12px, ellipsis overflow
- `.gallery-tags` — flex wrap, gap 3px
- `.tag-chip` — 12px, chip-bg, radius 3px

**Gallery Toolbar** (`#galleryToolbar` — `mediavault.css:54-63`)
Flex row with `.tool-btn`, `.toolbar-group`, `.toolbar-group-label`, `.toolbar-sep`.

**Empty State** (`.gallery-empty` — `mediavault.css:69-71`)
Centered, text2 color, heading 20px + description 14px.

**CM Files Gallery** (`.cm-files-gallery` — `content.css:139-192`)
Same layout modes (masonry, fixed, scroll) but with `--thumb-size` instead of `--thumb-col-width`. Items use `.cm-files-gallery-item` with slightly different styling (radius 8px, explicit border).

### 6.6 Lightbox

The lightbox is injected dynamically by `shared/lightbox.js` as a `<div class="shared-lightbox">` with all styles inlined. Key classes:

| Class | Description |
|-------|-------------|
| `.shared-lightbox` | Fixed overlay, `z-index: 9999`, scale animation |
| `.shared-lightbox.open` | Visible, `opacity: 1; transform: scale(1)` |
| `.shared-lightbox.closing` | Closing animation |
| `.sl-overlay-bg` | Backdrop, `rgba(0,0,0,0.5)`, `blur(4px)` |
| `.lightbox-content` | Inner container, `max-width: 95vw; max-height: 90vh; radius: 12px` |
| `.lightbox-content.fullscreen` | Fullscreen mode, `100vw × 100vh`, no radius |
| `.lightbox-media` | Media container, flex center |
| `.lightbox-close` | Close button, top-right, 36×36, blur bg |
| `.lightbox-toolbar` | Bottom toolbar, `rgba(0,0,0,.65)`, `blur(12px)`, `radius: 10px` |
| `.lightbox-toolbar.lb-toolbar-hidden` | Hidden state, `opacity: 0` |
| `.lightbox-panel` | Side info panel, `300px` wide |
| `.lb-nav-zone` | Click zones (left/right), `35%` width each |
| `.lb-pos` | Position counter in toolbar, `min-width: 48px` |
| `.lb-del-btn` | Delete button in panel |

Image zoom classes (applied to `<img>` within `.lightbox-media`):
- `.zoom-fit` — `max-width/max-height: 100%; object-fit: contain`
- `.zoom-fill` — `object-fit: fill`
- `.zoom-full` — `position: absolute; top: 0; left: 0; max-width/max-height: none`
- `.zoom-scroll` — `max-width: 100%; object-fit: contain; transform-origin: center center`

Mobile lightbox (<768px) overrides: fullscreen by default, toolbar at top, panel at bottom.

### 6.7 Sidebar

**MediaVault Sidebar** (`aside#mvSidebar` — `mediavault.css:22-25`)

```css
aside { width: 260px; flex-shrink: 0; background: var(--surface);
  border-right: 1px solid var(--border); padding: 16px;
  flex-direction: column; transition: width .25s cubic-bezier(.4,0,.2,1),
  padding .25s cubic-bezier(.4,0,.2,1); }
#mvSidebar.collapsed { width: 0; padding: 0; border-right-color: transparent; }
#mvSidebar-inner { overflow-y: auto; white-space: nowrap; }
```

**Sidebar Sections:**
- `.sidebar-section` — `margin-top: 12px`
- `.sidebar-label` — 13px, uppercase, letter-spacing .5px, text2 color
- `#searchPanel input` — 12px, radius 4px, accent focus
- `.srch-mode` / `.thumb-size` — toggle buttons, 3px 8px, 12px
- `.sidebar-action` — full-width button, `justify-content: flex-start`

**Desktop-Only Pattern:** `.desktop-only` — hidden at `<768px` via CSS.

### 6.8 Modals

**Admin Modal** (`.admin-modal` — `admin.css:254-289`)

```css
.admin-modal { position: fixed; inset: 0; background: var(--overlay);
  z-index: var(--z-toast); align-items: center; justify-content: center;
  backdrop-filter: blur(4px); display: none; }
.admin-modal.open { display: flex; }
.admin-modal-content { background: var(--surface); border: 1px solid var(--border);
  border-radius: 16px; padding: 28px; width: 90%; max-width: 440px;
  box-shadow: 0 16px 48px var(--shadow); animation: fadeSlide .25s ease both; }
.admin-modal-title { font-family: var(--font-heading); font-size: 18px; font-weight: 700; }
.admin-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }
```

**Tagfetch Modal** (`.modal-overlay` / `.modal-dialog` — `tagfetch.css:55-64`)
- `.modal-overlay` — fixed, overlay bg, `z-index: var(--z-modal)`, `animation: fadeIn .15s`
- `.modal-dialog` — 600px wide, `max-height: 80vh`, `radius: 12px`, `animation: fadeSlide .2s`
- `.modal-header` / `.modal-body` / `.modal-footer` — standard structure
- `.modal-breadcrumb` — 12px, text2 color

**Comics Modal** (`#comicsModalOverlay` — `content.css:250-299`)
- Similar to tagfetch modal but `flex-direction: row`, `padding: 30px`
- `.comic-modal` — `flex: 1; max-width: 1380px; max-height: 90vh`
- `.comic-modal-header` / `.comic-modal-body` / `.comic-modal-footer`
- Preview sidebar: `#comicPreviewOverlay` — `width: 0 → 640px` when `.preview-open`

**Category Modal** (`#categoryModal` — `mediavault.css:118-127`)
- Fixed overlay, `z-index: var(--z-overlay)`
- `.cat-modal` — surface bg, radius 12px, padding 20px, max-height 90vh
- `.cat-horizontal-scroll` — horizontal scroll container for category columns

### 6.9 Tags

**Tag Chip** (`.tag-chip` — `shared.css:194`)

```css
.tag-chip { display: inline-block; padding: 2px 6px; border-radius: 4px;
  margin: 1px; font-size: 12px; font-weight: 500;
  background: var(--chip-bg); color: var(--chip-text); }
```

**CM Tags** (`.cm-tags-chip` — `content.css:55-59`)
Same as `.tag-chip` but with `cursor: grab` for drag-and-drop.

**CM Tags Card** (`.cm-tags-card` — `content.css:41-44`)
- `width: 280px; max-height: 65vh; overflow-y: auto`
- `.cm-tags-card-head` — clickable header with colored dot
- `.cm-tags-dot` — 12×12, 3px radius, category color

**Tags Panel (Files section)** (`.cm-files-left-tags` — `content.css:122-130`)
Flex-wrap tag chips in sidebar, with `cursor: grab` for drag-to-file tagging.

### 6.10 DB Tools Grid

(`admin.css:151-179`)

```css
.db-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px; }
.db-tool { background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 16px; cursor: pointer;
  transition: all .15s; display: flex; gap: 12px; align-items: center; }
.db-tool:hover { border-color: var(--accent); transform: translateY(-2px);
  box-shadow: 0 4px 16px var(--shadow); }
.db-tool-icon { font-size: 28px; display: flex; align-items: center; }
.db-tool-label { font-size: 14px; font-weight: 500; }
.db-tool-desc { font-size: 12px; color: var(--text2); }
.db-tool.danger .db-tool-label { color: var(--danger); }
```

### 6.11 Tables

(`admin.css:53-96`)

```css
.admin-table { width: 100%; border-collapse: separate; border-spacing: 0;
  font-size: 14px; }
.admin-table th { padding: 10px 14px; font-size: 12px; font-weight: 600;
  color: var(--text2); text-transform: uppercase; border-bottom: 1px solid var(--border); }
.admin-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
.admin-table tr:hover td { background: var(--accent-glow); }
```

### 6.12 Role Badge

(`admin.css:99-115`)

```css
.role-badge { display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.role-badge.admin { background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent); }
.role-badge.user { background: color-mix(in srgb, var(--success) 20%, transparent);
  color: var(--success); }
```

### 6.13 Forms

(`admin.css:182-213`)

```css
.admin-field { margin-bottom: 14px; }
.admin-field-label { display: block; font-size: 12px; font-weight: 600;
  color: var(--text2); margin-bottom: 5px; text-transform: uppercase;
  letter-spacing: 0.5px; }
.admin-field-input { width: 100%; padding: 10px 14px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--bg); color: var(--text); font-size: 14px;
  font-family: var(--font); outline: none; transition: border-color var(--transition); }
.admin-field-input:focus { border-color: var(--accent); }
.admin-field-row { display: flex; gap: 10px; align-items: flex-end; }
```

**Password Field** (macros — `macros.html:10-20`)

Wrapper `.pw-wrap` with toggle button (eye icon) inside the input:
```css
.pw-wrap { position: relative; display: flex; align-items: center; }
.pw-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
```

Alternatively, `.pw-field` + `.pw-toggle` pattern used in admin (admin.css:358-384).

**Radio Label** (`shared.css:212-214`)
```css
.radio-label { display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer;
  font-size: 13px; transition: all .15s; }
```

### 6.14 Toasts

**Admin Toast** (`.admin-toast` — `admin.css:292-316`)

```css
.admin-toast { position: fixed; bottom: 24px; right: 24px;
  background: var(--surface2); border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 20px; font-size: 14px; color: var(--text); z-index: var(--z-toast);
  animation: fadeSlide .3s ease both; max-width: 360px; }
.admin-toast.error { border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 15%, var(--surface));
  color: var(--danger); }
.admin-toast.success { border-color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, var(--surface));
  color: var(--success); }
```

**CM Toast** (`.cm-toast` — `content.css:10-18`)
Centered at bottom, `left: 50%; transform: translateX(-50%)`. Error/success variants with solid colors.

### 6.15 Settings Page

(`settings.css` — 112 lines total)

- `.settings-tabs-row` — pill-style tab bar, `display: flex; background: var(--surface); border-radius: 8px; padding: 2px 3px`
- `.settings-tab-btn` — individual tab buttons
- `.settings-tab-content` — shown/hidden via `.active`, `animation: fadeUp .3s`
- `.settings-toggle` — checkbox card, `padding: 14px 16px; border-radius: 10px`, active state has accent border + glow
- `.settings-toggle-label` — 14px, 500 weight
- `.settings-toggle-desc` — 12px, text2
- `.lang-toggle` — radio-style language selector buttons

### 6.16 Comics Picker

(`content.css:239-395`)

- `#comicsModalOverlay` — fullscreen overlay with blur backdrop
- `.comic-modal` — two-column layout (file picker + optional preview)
- `#cpageGrid` — flexbox wrap grid of file thumbnails, left-to-right order, 6 columns
- `.cpage-item` — file thumbnail, `border: 2px solid transparent`, `.selected` → accent border
- `.cpage-item.cover` — gold border (`#ffd700`)
- `.cpage-star` — cover indicator star, gold
- `#comicPreviewOverlay` — right panel, `width: 0 → 1400px` transition
- `.comic-preview-content` — flexbox wrap grid of selected pages, left-to-right order
- `.preview-page` — draggable, with `page-num` badge and `preview-remove` button (shows on hover)
- Modal dimensions: 1380×920px, expands to 2100px with preview

### 6.17 Folder Browser (Tagfetch)

(`tagfetch.css:8-20`)

- `.path-browser` — scrollable file tree, `border: 1px solid var(--border); border-radius: 6px`
- `.path-item` — file/folder row, `padding: 6px 10px`, `.selected` → accent bg + white text
- `.breadcrumb` — navigation path, 12px, clickable segments

### 6.18 Tagfetch Panels

(`tagfetch.css:22-43`)

- `#fileInfo` — metadata card, `padding: 12px 16px`, border radius, 13px
- `.preview-row` — 3-column preview area
- `.preview-panel` — flex column with header + preview box
- `.preview-box` — flex center, `min-height: 100px`, surface2 bg
- `.panels` — 2-column found/fetched tags
- `.panel` — flex column, 14px padding, border radius
- `.action-bar` — button row, flex-wrap

### 6.19 Tagfetch Auto Grid

(`tagfetch.css:84-111`)

- `.auto-content` — main container, `padding: 20px 24px`
- `.auto-grid` — `grid-template-columns: 1fr 1fr; gap: 10px`
- `.auto-card` — flex row, `border-radius: 8px`, fadeIn animation
- `.auto-card-landscape` — column layout for wide images
- `.auto-card-img` — image container, surface2 bg
- `.auto-card-body` — tag display, `padding: 10px 14px`
- `.auto-tag` — chip style, `11px`, chip-bg, `border: 1px solid var(--border)`

### 6.20 Viewer (Standalone View)

(`templates/shared/view.html` inline styles)

- `#mediaWrap` — full viewport, `height: calc(100vh - 44px)`, centered content
- `.nav-zone` — left/right click zones, 12% width, `cursor: pointer`
- `#tagsOverlay` — bottom panel, slideUp animation, `max-height: 45vh`
- `.cat-group` — categorized tags with `.cat-dot` (7px circle)
- `#pageCounter` — dot navigation for comics, `.dot` 6px, `.dot.active` scale(1.6)

### 6.21 Comic Reader

(`mediavault.css:215-219`)

- `.comic-reader-page` — single page display
- `.comic-scroll-mode` — vertical scroll layout
- `.comic-lightbox-mode` — fullscreen single page, `position: fixed; top: 44px`

### 6.22 Bulk Tag Bar

(`mediavault.css:112-115`)

```css
#bulkTagBar { position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--surface); border-top: 1px solid var(--border);
  padding: 10px 16px; z-index: var(--z-overlay); display: none; }
#bulkTagBar.active { display: flex; }
```

### 6.23 Credential Selector

(`admin.css:216-251`)

- `.cred-option` — card-style radio option, `padding: 14px 16px; border-radius: 10px`
- `.cred-option.active` — accent border + glow bg

### 6.24 Autocomplete

(`mediavault.css:108-109`)

```css
.ac-item { padding: 8px 12px; font-size: 13px; cursor: pointer;
  color: var(--text); display: flex; align-items: center; gap: 6px; }
.ac-item:hover { background: var(--accent); color: #fff; }
```

---

## 7. Animations

### 7.1 Keyframe Definitions

| Keyframe | Description | Source |
|----------|-------------|--------|
| `fadeSlide` | Fade in + translateY(12px → 0) — most common entrance | `shared.css:148` |
| `fadeIn` | Fade in + scale(.96 → 1) — modals, cards | `shared.css:147` |
| `spin` | 360° rotation — loading spinners | `shared.css:146` |
| `pulse` | Opacity 1 → .5 → 1 — loading states | `shared.css:149` |
| `shake` | Horizontal shake — error feedback | `shared.css:150` |
| `shimmer` | Skeleton loading shimmer | `shared.css:153` |
| `btnPress` | Scale 1 → .95 → 1 — button press | `shared.css:154` |
| `btnSpin` | 360° rotation + scale pulse — theme toggle | `shared.css:155` |
| `lbPulse` | Scale 1 → 1.015 → 1 — lightbox navigation | `mediavault.css:105` |
| `pageFadeIn` | TranslateY(6px → 0) — gallery items | `mediavault.css:203` |
| `fadeUp` | TranslateY(8px → 0) — settings tab content | `settings.css:109` |

### 7.2 Utility Classes

| Class | Animation | Usage |
|-------|-----------|-------|
| `.btn-spin` | `btnSpin .5s cubic-bezier(.34,1.56,.64,1)` | Theme toggle button |
| `.btn-press` | `btnPress .2s ease` | General button feedback |
| `.shake` | `shake .4s ease` | Error input feedback |
| `.fetch-spinner` | SVG border spinner — `spin .6s linear infinite` | Loading indicator |

### 7.3 Hover Effects

| Element | Effect |
|---------|--------|
| `.home-block:hover` | `translateY(-4px)`, border color change, `box-shadow` |
| `.btn:hover` | `background: var(--surface2)` |
| `.btn-primary:hover` | `box-shadow: 0 2px 16px color-mix(in srgb, var(--accent) 50%, transparent)` |
| `.btn:active` | `transform: scale(.96)` |
| `.admin-card:hover` | `border-color: var(--border-light)` |
| `.db-tool:hover` | `translateY(-2px)`, accent border, shadow |
| `.cm-comic-card:hover` | accent border, shadow |
| `.gallery-item:hover` | `opacity: .9` |
| `.cm-files-gallery-item:hover` | accent border, shadow |
| `.hm-block-btn:hover` | `translateY(-2px)`, accent bg + white text |

### 7.4 Effects Toggle

The `data-no-effects` attribute on `<html>` disables all CSS transitions, animations, and backdrop filters:

```css
[data-no-effects] *,
[data-no-effects] *::before,
[data-no-effects] *::after {
  animation: none !important;
  transition: none !important;
  backdrop-filter: none !important;
}
```

Toggled via `.theme-btn.effects-off` class (reduced motion mode).

---

## 8. Responsive Breakpoints

### 8.1 Breakpoints

| Breakpoint | Name | Changes |
|------------|------|---------|
| `1440px` | *(none)* | Maximum content width reference for home blocks |
| `1024px` | *(none)* | — |
| `900px` | Tablet | Home blocks wrap to flex-wrap |
| `768px` | Mobile | Major layout change |
| `650px` | Small mobile | Home blocks stack vertically |
| `480px` | Compact | Compact thumbnails, smaller fonts |

### 8.2 Mobile (<768px) Changes

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Header | `.hdr-desktop` (flex) | `.hdr-desktop` hidden, `.hdr-mobile` shown |
| Sidebar | Fixed 260px | `.desktop-only` hidden, mobile buttons in bottom section |
| Gallery masonry | `column-width: 220px` | `column-width: 140px` |
| Gallery grid | `repeat(4, 1fr)` | `repeat(2, 1fr)` |
| Gallery thumb | `min-height: 80px` | `min-height: 60px` |
| Gallery info | `padding: 6px 8px` | `padding: 4px 6px` |
| Toolbar | Flex row, visible | Wraps, compact buttons |
| Page size buttons (`.thumb-size`) | Visible | Hidden (use drawer) |
| #mvBottomSection | Hidden | Shown (mobile toolbar) |
| Lightbox | Panel sidebar | Fullscreen, panel below |
| CM layout | Row (sidebar + content) | Column, left panel max 200px |
| CM gallery | `column-width: 160px` | `column-width: 110px` |
| CM gallery grid | `repeat(4, 1fr)` | `repeat(2, 1fr)` |
| Comics modal | Row layout | Column layout, preview below |
| Tagfetch sidebar | 364px fixed | 100% width, max-height 50vh |
| Auto grid | `2 columns` | `1 column` |
| Home blocks | Side by side (flex:1) | Stack vertically |
| Admin sidebar | Fixed 220px | Fixed overlay, `left: -240px` → 0 |

### 8.3 Mobile (<480px) Changes

```css
.gallery-thumb { min-height: 40px; font-size: 24px; }
header { padding: 6px 8px; }
```

---

## 9. Z-Index System

| Variable | Value | Used By |
|----------|-------|---------|
| `--z-dropdown` | `100` | Dropdowns (`.hdr-dropdown`, `.hdr-account`), autocomplete, gallery overlay badges |
| `--z-overlay` | `200` | Category modal bulk tag bar (fixed bottom), sidebar (mobile), comic lightbox |
| `--z-modal` | `300` | Modal dialogs (`.modal-overlay`, `#comicsModalOverlay`, `.admin-modal`) |
| `--z-lightbox` | `1000` | Lightbox overlay (`.shared-lightbox`) |
| `--z-toast` | `10000` | Toast notifications (`.admin-toast`, `.cm-toast`), admin modal content |

Note: `--z-sticky` is referenced by `home.html` inline styles but is not defined in `shared.css`. Defaults to `auto`.

---

## 10. CSS Architecture

### 10.1 File Loading Order (in `base.html`)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `shared.css` | Variables, themes, base, buttons, home layout, animations, scrollbar |
| 2 | `mediavault.css` | Gallery, lightbox, sidebar, header layout, tabs, comics viewer |
| 3 | `settings.css` | Settings tab row, toggle cards, language selector |
| 4 | `tagfetch.css` | Manual/auto layout, panels, file browser, auto grid |
| 5 | `admin.css` | Admin SPA, cards, tables, DB grid, modals, toasts |
| 6 | `content.css` | Content SPA, tags drag-drop, files gallery, comics editor |

This order is critical for specificity — later files override earlier ones without `!important`.

### 10.2 CSS Convention

- **No `!important`** — specificity managed via load order (exception: `data-no-effects` mode and `hidden` class)
- **No `window.innerWidth <= 768` in JS** — responsive handled entirely via CSS media queries
- **`color-mix()`** used for hover/active states (badge backgrounds, toast variants)
- **`touch-action: manipulation`** on mobile interactive elements to remove tap delay

---

## 11. Jinja2 Macros

Defined in `templates/shared/macros.html` (73 lines).

| Macro | Parameters | Output |
|-------|-----------|--------|
| `password_field(name, label, id, placeholder, cls, toggle_class, onclick, input_class)` | Field name, placeholder, CSS classes | Wrapper `<div>` with password input + eye toggle button |
| `theme_buttons(cls)` | Optional extra class for both buttons | Theme toggle button (sun/moon SVG) + Language toggle button (RU/EN text + globe SVG) |
| `sort_btn(id, onclick)` | Element ID, click handler | Button with sort arrows SVG + label span |
| `close_svg()` | — | SVG close icon (circle + X) |
| `loading_spinner()` | — | Centered spinner with "Loading" text |
| `view_btn(path)` | File path URL | Open viewer link with external-link SVG icon |

Usage:
```jinja
{% from 'shared/macros.html' import password_field, theme_buttons, sort_btn, close_svg, loading_spinner, view_btn %}
{{ theme_buttons(cls='hm-topbar-btn') }}
```

---

## 12. Design Principles

1. **No emoji in UI** — All UI icons are inline SVG. No emoji characters used anywhere.
2. **No `!important`** — Specificity is managed through CSS file load order and selector depth. The only exceptions are `data-no-effects` mode and the `.hidden` utility class.
3. **SVG icons only** — `currentColor` for theming. Icon sizes: 14-20px navigation, 16-18px buttons, 24px section icons, 32-48px placeholders.
4. **Theme colors via CSS variables** — All colors use `var(--token)` for seamless dark/light switching.
5. **Single source of truth for colors** — Functions like `Shared.hexToRgba()` in `utils.js` centralize color manipulation.
6. **Mobile-first responsive** — Desktop is default, mobile overrides use `@media(max-width:768px)`. No JS-based responsive detection.
7. **Touch-friendly** — Interactive elements have minimum 44×44px touch target on mobile, `touch-action: manipulation` to eliminate tap delay.
8. **Consistent spacing scale** — Gaps follow a 2-4-6-8-12-16-24-32 scale. Padding follows 4-8-12-16-20-24-28-32.
9. **Declarative hover per block** — Home blocks use `data-block` attributes for per-block accent colors rather than duplicating selectors.
10. **Accessibility** — `:focus-visible` outlines for keyboard navigation, `aria-label` on icon-only buttons.
