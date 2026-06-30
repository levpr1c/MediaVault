# Tech Stack Review & TypeScript Migration Guide

**Generated:** 2026-06-30
**Version:** v1.4
**Goal:** Analyse current stack, recommend modern TypeScript alternatives for a local offline-first media server (mobile + PC).

---

## 1. Current Architecture

MediaVault is a **local-first** web application — no internet required after installation. It's distributed as a single binary (PyInstaller) and runs entirely on the user's machine.

### 1.1 Backend

| Component | Technology | Details |
|-----------|-----------|---------|
| **Runtime** | Python 3.14 | Flask dev server (no gunicorn/uWSGI) |
| **Framework** | Flask 3.1.8 | Single monolithic file: `web_app.py` — **7671 lines** |
| **Database** | SQLite (stdlib) | WAL mode, `busy_timeout=5000`, raw SQL via `sqlite3.Row`, no ORM |
| **Migrations** | None | Schema changed manually via `ALTER TABLE` |
| **Auth** | JWT (pyjwt) + Werkzeug password hashing | Cookie-based, httpOnly |
| **API** | 121 routes | All behind `@api_error_handler`, 72 `@admin_required`, 13 `@auth_required` |
| **Templates** | Jinja2 | 17 files, 3010 lines — HTML rendered server-side |
| **External APIs** | `requests` + `cloudscraper` | Rule34, Danbooru, NHentai, E-Hentai |
| **Thumbnails** | Pillow (images → AVIF) + FFmpeg (video) | Called via subprocess |
| **Plugin system** | Python class-based | Plugins loaded from `~/.local/share/MediaVault/plugins/` |
| **Background tasks** | Threading + subprocess | SSE for progress, no WebSocket |

### 1.2 Frontend

| Component | Technology | Details |
|-----------|-----------|---------|
| **JS modules** | Vanilla JS — hybrid ES modules + IIFE | **33 files, ~10,500 lines** |
| **CSS** | Vanilla CSS (custom properties) | **8 files, ~3000 lines** — no preprocessor, no framework |
| **Icons** | Inline SVG | `SiteIcons.getIcon(name)` — zero icon library dependency |
| **Fonts** | Self-hosted | Unbounded (logo) + IBM Plex Sans (body) — zero CDN |
| **Libs** | Three.js r149 + Chart.js 4.5.1 | Vendored in `static/lib/`, ~53K lines combined |
| **Build** | None | No bundler, no TypeScript, no minifier |

### 1.3 Distribution

| Method | Tool | Size |
|--------|------|------|
| **Binary** | PyInstaller 6.20.0 | ~120 MB |
| **AUR** | PKGBUILD for Arch Linux | Depends on FFmpeg + python3-keyring |
| **Source** | `python src/web_app.py` | Requires venv + deps |
| **Data** | `~/.config/MediaVault/` + `~/.local/share/MediaVault/` | Config + DB + media |

### 1.4 Total Code Volume

| Layer | Language | Lines |
|-------|----------|-------|
| **Backend** | Python (Flask) | 8,945 (9 `.py` files, 7,671 in the monolith) |
| **Frontend** | Vanilla JS | 10,582 (33 files) |
| **CSS** | Vanilla CSS | 2,960 (8 files) |
| **Templates** | Jinja2 HTML | 3,010 (17 files) |
| **Vendored libs** | JS | ~53,000 (2 files — Three.js + Chart.js) |
| **Tests** | Python | 975 (`test.py` — custom CLI, no pytest) |
| **Total source** | — | **~25,500 lines** (excluding vendored libs) |

---

## 2. Pain Points (Why Rewrite)

### 2.1 Backend Issues

| Problem | Impact |
|---------|--------|
| **Monolith `web_app.py`** (7671 lines) | Any change risks breaking everything. No separation of concerns. |
| **No ORM** | Raw SQL strings everywhere — no type safety, no migration system |
| **No type hints** | Runtime errors that could be caught at compile time |
| **Flask dev server** | Single-threaded, no production-grade HTTP handling |
| **No test framework** | `test.py` is a custom script — no pytest, no CI |
| **Jinja2 templates** | Server-rendered HTML mixes backend logic with presentation |

### 2.2 Frontend Issues

| Problem | Impact |
|---------|--------|
| **Vanilla JS verbosity** | Same patterns repeated across 33 files. No components, no state management |
| **No TypeScript** | Entire API surface (121 routes × response shapes) has no type contracts |
| **Hybrid module system** | 13 ES modules + 20 IIFE scripts — inconsistent, hard to reason about |
| **CSS `!important`** | Convention allows it in `mediavault.css` — indicates broken cascade |
| **No component model** | DOM manipulation scattered across files, no encapsulation |
| **No bundler** | 33 separate HTTP requests for JS, no tree-shaking, no code splitting |
| **Duplicated modules** | `comics.js` exists in both `shared/` and `content/` with different implementations |

### 2.3 Distribution Issues

| Problem | Impact |
|--------|--------|
| **PyInstaller size** | ~120 MB for a Python app (bundles entire interpreter) |
| **FFmpeg dependency** | Required system-wide install — not bundled |
| **No cross-platform build** | PyInstaller builds per-platform, no CI/CD pipeline |
| **No mobile app** | Web-only — no native mobile experience |

---

## 3. Modern TypeScript Stack Recommendations

The goal: **less code, better design, offline-first, mobile + PC, one binary.**

### 3.1 Backend Framework

| Framework | Bundle | TypeScript | Runtimes | SQLite | Binary | Speed (req/s) |
|-----------|--------|-----------|----------|--------|--------|-------------|
| **Hono** | **~14 KB** | ✅ Native | Node/Bun/Deno | ✅ via ORM | ✅ Bun compile | ~62K (Bun) |
| **Elysia** | ~30 KB | ✅ Best (Eden RPC) | Bun primarily | ✅ Drizzle | ✅ Bun compile | ~71K (Bun) |
| **Fastify** | ~50 KB | ✅ Good | Node.js | ✅ | ❌ needs pkg | ~18K |
| **Express** | ~200+ KB | ⚠️ `@types/express` | Node.js | ✅ | ❌ needs pkg | ~15K |

> **Recommended: Hono** — smallest bundle, multi-runtime, native TypeScript, WebSocket built-in, Hono RPC for type-safe client-server communication. On Bun gives ~62K req/s — 3–4× faster than current Flask.

### 3.2 Database

| Category | Options | Verdict |
|----------|---------|---------|
| **SQLite driver** | `bun:sqlite` (built-in), `better-sqlite3`, `@libsql/client` | **`bun:sqlite`** — fastest JS SQLite driver, 3–6× faster than better-sqlite3, zero deps |
| **ORM / Query Builder** | Drizzle ORM, Kysely, Prisma, TypeORM | **Drizzle ORM** — SQL-like API, no codegen, native SQLite support, `drizzle-kit` migrations |
| **Migrations** | Drizzle Kit, manual SQL | **Drizzle Kit** — generates SQL migration files from schema changes |

### 3.3 Frontend Framework

| Framework | Bundle (gzip) | Runtime-less | Mobile FCP | Offline | Code volume vs React |
|-----------|--------------|-------------|-----------|---------|---------------------|
| **Svelte 5** | **~5 KB** | ✅ Compiled away | 1.2s | ✅ SW | **~70% less code** |
| **SolidJS** | ~7 KB | ✅ | **1.1s** | ✅ | ~50% less code |
| **Preact** | ~8.8 KB | ⚠️ Tiny runtime | 1.4s | ✅ | ~20% less code |
| **Vue 3** | ~28 KB | ❌ | 1.7s | ✅ | ~30% less code |
| **React 19** | ~49 KB | ❌ | 1.9s | ⚠️ | baseline |
| **Qwik** | ~28 KB (first) | ✅ Resumable | 1.3s | ✅ | ~40% less code |

> **Recommended: Svelte 5** — compiles away the framework, smallest bundle, best mobile performance, built-in transitions (useful for lightbox/gallery), SvelteKit for routing + service workers.

### 3.4 CSS & Design

| Tool | Approach | Bundle (gzip) | TypeScript | Verdict |
|------|----------|--------------|-----------|---------|
| **UnoCSS** | On-demand atomic CSS | **~8–12 KB** | ✅ First-class | **Best pick** — 50% smaller than Tailwind, sub-ms rebuilds, attributify mode, built-in icons |
| **Tailwind v4** | Utility-first (Oxide Rust engine) | ~12–25 KB | ⚠️ Limited | Great ecosystem but larger bundle |
| **PandaCSS** | Compile-time CSS-in-JS | ~2.3 KB | ✅ Full | Best type safety but steeper learning curve |
| **Open Props** | CSS custom properties | ~20 KB tokens | ❌ | Minimal, but no utility classes |

> **Recommended: UnoCSS + Tailwind preset + Attributify mode.** Smallest CSS bundle, instant rebuilds, Tailwind-compatible syntax.
>
> **Components:** ShadCN-Svelte (Tailwind-based, headless UI via Melt UI) or Shoelace (Web Components, framework-agnostic).

### 3.5 Build & Binary

| Tool | Runtime | Binary size | TypeScript | Native addons | Verdict |
|------|---------|------------|-----------|--------------|---------|
| **`bun build --compile`** | Bun (JavaScriptCore) | **~108 MB** | ✅ Native | ✅ Explicit | **Best** — smallest binary, fastest cold start (510ms), cross-compile |
| **Node SEA (`pkg`)** | Node (V8) | ~200 MB | ✅ via tsup | ✅ better-sqlite3, sharp | Fallback if Bun incompatible |
| **Deno compile** | Deno (V8) | ~180 MB | ✅ Native | ✅ | Less portable |

> **Recommended: `bun build --compile`** — bundles server + frontend + assets into a single executable. Cross-compile: `bun build --compile --target linux-x64`.

### 3.6 Media Processing

| Task | Recommended Library | Why |
|------|-------------------|-----|
| **Image thumbnails** | **sharp** | 4–40× faster than Jimp, AVIF/WebP/JPEG output, attention-based cropping |
| **Video thumbnails** | `fluent-ffmpeg` + `ffmpeg-static` | Standard, bundles FFmpeg binary inside the app — no system dep |
| **File system watching** | **chokidar** (or `bun:fs.watchFile`) | Cross-platform recursive watching, debounce, industry standard |

### 3.7 Authentication

| Library | Approach | Hono support | Drizzle support | Size |
|---------|----------|-------------|----------------|------|
| **Better Auth** | Server sessions + JWT | ✅ Official adapter | ✅ Official adapter | ~30 KB |
| **Lucia** | Server sessions | ✅ | ✅ | ~15 KB |
| **DIY JWT** | Stateless access + refresh | ✅ | — | Minimal |

> **Recommended: Better Auth** — full-featured (email/password, OAuth, MFA), cookie-based httpOnly, refresh token rotation, official Hono + Drizzle adapters. For a local app, basic email+password with bcrypt is sufficient.

### 3.8 Real-World References

These OSS projects successfully migrated from Flask/Vanilla JS to TypeScript with similar architecture:

| Project | Stack | Similarity |
|---------|-------|-----------|
| **[ts-media-server](https://github.com/jeffreese/ts-media-server)** | Fastify + Drizzle + better-sqlite3 + React + sharp + FFmpeg | **Very high** — media server with thumbnails, tags, REST API, SQLite, JWT |
| **[Photon](https://github.com/clucraft/Photon)** | Fastify + Drizzle + React + sharp + FFmpeg | **High** — photo/video management, albums, multi-user |
| **[LocalBox](https://github.com/Mohammed-Asfar/localbox)** | Express + React + Tailwind + Tus | **Medium** — file manager with previews |
| **[Hono+Svelte template](https://github.com/MosheRivkin/hono-svelte-5)** | Hono + Svelte 5 + Drizzle + SQLite + Tailwind | **Exact stack match** — reference fullstack app |

---

## 4. Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    bun build --compile                            │
│                          mediavault                               │
│                                                                   │
│  ┌────────────────────┐    ┌────────────────────────────────┐     │
│  │      Hono API       │    │         Svelte 5 SPA           │     │
│  │      (~14 KB)       │    │         (~5 KB gzip)           │     │
│  │                     │    │                                │     │
│  │  REST endpoints     │◄──►│  SvelteKit routing            │     │
│  │  WebSocket (SSE)    │    │  UnoCSS styling               │     │
│  │  Hono RPC (type-safe) │   │  ShadCN-Svelte components    │     │
│  │  Better Auth        │    │  Service Worker (offline)     │     │
│  └────────┬────────────┘    └────────────────────────────────┘     │
│           │                                                        │
│  ┌────────▼────────────────────────────────────────────────────┐   │
│  │                  Drizzle ORM + bun:sqlite                    │   │
│  │                                                              │   │
│  │  ┌──────────┐  ┌────────┐  ┌────────────┐  ┌────────────┐  │   │
│  │  │  files   │  │  tags  │  │ media_tags │  │  users      │  │   │
│  │  ├──────────┤  ├────────┤  ├────────────┤  ├────────────┤  │   │
│  │  │  comics  │  │ pages  │  │  sessions  │  │  settings   │  │   │
│  │  └──────────┘  └────────┘  └────────────┘  └────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                        │
│  ┌────────▼────────────────────────────────────────────────────┐   │
│  │              sharp + fluent-ffmpeg + chokidar                 │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │   │
│  │  │ Images   │  │ Video frames │  │ File system watcher  │   │   │
│  │  │ → WebP   │  │ → JPEG      │  │ → auto-indexing      │   │   │
│  │  │ → AVIF   │  │ → thumbnail │  │ → re-index on change │   │   │
│  │  └──────────┘  └──────────────┘  └──────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

         ↓ Run: ./mediavault        Port: 5050
         ↓ No internet required     One process, one binary
         ↓ Mobile: browser → http://192.168.x.x:5050
```

### 4.1 Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Runtime** | Bun | Fastest cold start, built-in SQLite, `bun build --compile` for single binary, TypeScript-native |
| **API pattern** | Hono RPC (`hc`) | Type-safe client-server communication without codegen — shared types between backend and frontend |
| **Database** | `bun:sqlite` + Drizzle ORM | Zero native deps, fastest SQLite driver, drizzle-kit migrations, SQL-like query API |
| **Frontend** | Svelte 5 + SvelteKit | Compiles away framework, smallest bundle, best mobile perf, built-in transitions |
| **CSS** | UnoCSS + Attributify | 8–12 KB CSS, Tailwind-compatible, instant rebuilds, zero config |
| **Components** | ShadCN-Svelte | Accessible, customizable, Tailwind-based, proven design system |
| **Auth** | Better Auth | Official Hono + Drizzle adapters, httpOnly cookies, refresh token rotation |
| **Binary** | `bun build --compile` | Single executable, ~108 MB, cross-compile, bundles FFmpeg |
| **State** | Svelte 5 runes (`$state`, `$derived`, `$effect`) | Native reactivity, no Redux/Zustand needed |
| **Offline** | SvelteKit service worker | Cache API responses, enable full offline operation |

### 4.2 Estimated Code Reduction

| Layer | Current (lines) | Estimated TS (lines) | Reduction |
|-------|----------------|---------------------|-----------|
| **Backend** | 8,945 (Python) | **~3,000–4,000** (TypeScript) | **55–65%** |
| **Frontend** | 10,582 (Vanilla JS) | **~4,000–5,000** (Svelte) | **50–60%** |
| **CSS** | 2,960 (Vanilla) | **~500–800** (UnoCSS classes) | **70–80%** |
| **Templates** | 3,010 (Jinja2) | **→ 0** (Svelte components) | **100%** |
| **Total source** | **~25,500** | **~7,500–9,800** | **~60–70% less code** |

---

## 5. Migration Strategy

### 5.1 Approach: Incremental (Not Big Bang)

A full rewrite is risky. Recommended approach:

```
Phase 1: Foundation (Week 1-2)
├── Set up Bun + Hono + Drizzle project
├── Port SQLite schema to Drizzle (migrations)
├── Implement file scanning + thumbnail generation (sharp + FFmpeg)
├── Basic auth (Better Auth — email/password)
└── Serve SvelteKit SPA from Hono

Phase 2: Core API (Week 3-4)
├── Gallery endpoints (list, search, filter)
├── Tag system (CRUD, categories, auto-tags)
├── Comics CRUD + pages
├── Lightbox API (file info, navigation)
└── Hono RPC types shared with frontend

Phase 3: Frontend (Week 5-8)
├── Gallery page with masonry/grid/list layouts
├── Lightbox component with zoom + nav
├── Comics reader (scroll + lightbox mode)
├── Tag management UI (drag-and-drop)
├── Content Search UI (multi-source)
├── Admin panel (users, DB, plugins)
└── Service worker for offline

Phase 4: Polish (Week 9-10)
├── UnoCSS design system refinement
├── Mobile responsive pass
├── Binary distribution (bun build --compile)
├── Plugin system (TypeScript class-based)
├── AUR package update
└── Documentation update
```

### 5.2 Coexistence Strategy

During migration, both apps can coexist:

```bash
# Old app (unchanged)
venv/bin/python src/web_app.py --port 5050

# New app (in progress)
cd mediavault-ts/
bun run dev --port 5051
```

Shared data directory (`~/.local/share/MediaVault/`) means the SQLite database can be shared during transition if the schema is compatible.

### 5.3 Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Feature regression** | Keep old app running during migration. Port one sub-app at a time (CM → MV → Admin) |
| **Performance regression** | Use Hono RPC + Svelte 5 — both are faster than current stack |
| **Mobile compatibility** | Svelte 5 bundle is ~5 KB — better mobile perf than current Vanilla JS |
| **SQLite data loss** | Keep schema compatible with current DB during Phase 1-2 |
| **Plugin incompatibility** | Rewrite plugin interface early (Phase 1) so existing plugins can be ported |

---

## 6. Migration Checklist

- [ ] **Bun + Hono + Drizzle** — foundation project scaffolded
- [ ] **SQLite schema** — ported to Drizzle with migration history
- [ ] **File scanning** — sharp + fluent-ffmpeg + chokidar working
- [ ] **Auth** — Better Auth with login/logout/session management
- [ ] **SvelteKit** — SPA mode, served from Hono
- [ ] **Gallery API** — pagination, search, filter, sort
- [ ] **Tag system** — CRUD, categories, auto-tags, color coding
- [ ] **Gallery UI** — masonry/grid/list with Svelte transitions
- [ ] **Lightbox** — fullscreen viewer, zoom, navigation, tag editor
- [ ] **Comics** — CRUD, scroll mode, lightbox mode
- [ ] **Content Search** — multi-source (R34, Dan, NH, EH)
- [ ] **Admin** — users, DB management, API keys, plugins
- [ ] **UnoCSS** — design system, responsive, mobile
- [ ] **Service Worker** — offline caching
- [ ] **Binary** — `bun build --compile` working
- [ ] **AUR** — updated PKGBUILD

---

## Appendix: Key Library Versions (as of Jun 2026)

| Library | Version | Notes |
|---------|---------|-------|
| **Bun** | 1.4+ | JavaScriptCore runtime, Node-compatible |
| **Hono** | 4.7+ | 14 KB, multi-runtime, RPC |
| **Drizzle ORM** | 0.41+ | SQL-like, codegen-free, SQLite-native |
| **Svelte** | 5.18+ | Runes, compiled, ~5 KB |
| **SvelteKit** | 2.20+ | Router, adapters, service workers |
| **UnoCSS** | 0.66+ | On-demand atomic CSS, instant |
| **sharp** | 0.35+ | libvips-based, AVIF/WebP |
| **Better Auth** | 1.4+ | Hono + Drizzle adapters |
| **fluent-ffmpeg** | 2.1+ | FFmpeg wrapper |
| **chokidar** | 5.0+ | ESM-only, cross-platform |
