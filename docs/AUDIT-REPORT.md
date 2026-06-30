# MediaVault — Audit Report

**Date:** 2026-06-30
**Author:** AI audit (Sisyphus)
**Codebase:** `v1.4` (latest, post-plugin-refactoring)

---

## Summary

The project's documentation (README.md, README.ru.md, docs/code-guide.md, AGENTS.md) has **systematic drift** from the actual codebase. Every metric — line counts, file counts, route counts, decorator counts, and almost all line-number references — is outdated.

**Overall accuracy rating: ~40%** (documents were last fully accurate around v1.2)

---

## 1. README.md — Discrepancies

| Claim | Documented | Actual | Δ |
|-------|-----------|--------|---|
| `web_app.py` LOC | ~4460 | **7671** | **+3211 (72% understated)** |
| Jinja2 templates | 18 | **17** | **-1** |
| CSS files | 7 | **8** | **+1** |
| JS modules | 30 | **33** | **+3** |
| `@admin_required` endpoints | 47+ | **71** | **+24 (51% understated)** |
| `@api_error_handler` endpoints | 65+ | **100** | **+35 (54% understated)** |
| Sub-apps count | 2 (Tagfetch + MV) | **3** (MV + CM + Admin) | **+1** |
| `check.py` exists | Yes | **DELETED** | File missing |
| `DESING.md` exists | Yes | **DELETED** | File missing (never existed as DESIGN.md either) |

**Source data:** agent `bg_81dc3755` (README vs reality), agent `bg_f2d374d5` (cross-reference)

---

## 2. README.ru.md — Discrepancies

| Claim | Documented | Actual | Δ |
|-------|-----------|--------|---|
| `web_app.py` LOC | ~3640 | **7671** | **+4031 (111% understated)** |
| HTML templates | 13 | **17** | **-4** |
| CSS files | 6 | **8** | **+2** |
| JS modules (Vanilla) | 25 | **33** | **+8** |
| `check.py` exists | Yes | **DELETED** | File missing |
| `DESING.md` exists | Yes | **DELETED** | File missing |

---

## 3. docs/code-guide.md — Discrepancies

### Line Number Shift

**Every line-number reference in code-guide.md is shifted by +400–500 lines.** The document was written when `web_app.py` was ~5921 lines. The file is now 7671 lines (+1750, +29%).

| Function/Location | Documented Line | Actual Line | Shift |
|-------------------|----------------|-------------|-------|
| LOCALE start | 150 | **265** | +115 |
| `load_settings()` | 632 | **1030** | +398 |
| `save_settings()` | 648 | **1046** | +398 |
| `_THUMB_LARGE` const | 702-703 | **1134** | +432 |
| `_get_auto_tags()` | 1014 | **1468** | +454 |
| `_video_has_audio()` | 1025 | **1479** | +454 |
| `_ensure_db_schema()` | 1084 | **1538** | +454 |
| `_get_tag_categories()` | 1188 | **1687** | +499 |

**Source data:** agent `bg_9f10abfe` (code-guide vs reality)

### Metric Claim Conflicts

| Claim | Documented | Actual | Verdict |
|-------|-----------|--------|---------|
| `web_app.py` LOC | 5921 | **7671** | ❌ |
| `@app.route` | 108+ | **121** | ❌ |
| `@admin_required` | 59 | **71** | ❌ |
| `@api_error_handler` | 87 | **100** | ❌ |
| `@auth_required` | 5 | **13** | ❌ |
| `def` functions | 180+ | **212** | ✅ (212 > 180) |
| Jinja2 templates | 17 | **17** | ✅ |
| CSS files | 8 | **8** | ✅ |
| JS files | 32 (para) / 33 (table) | **33** | ❌ (para outdated) |

### Non-Existent Files Referenced

| Referenced in code-guide.md | Actual |
|---------------------------|--------|
| `static/tagfetch/manual/manual.js` (611 lines) | **Deleted.** Only `manual-v2.js` exists (648 lines) |
| `static/mediavault/utils.js` | **Deleted.** Only 3 files in `static/mediavault/`: `api.js`, `db.js`, `mediavault.js` |

---

## 4. AGENTS.md — Discrepancies

| Claim | Documented | Actual | Δ |
|-------|-----------|--------|---|
| `web_app.py` LOC | ~6000 | **7671** | **+1671 (28% understated)** |
| `@app.route` | 108+ | **121** | **+13** |
| `@admin_required` | 47+ | **71** | **+24** |
| `@api_error_handler` | 87 | **100** | **+13** |

---

## 5. changes-summary.md — Discrepancies

| Referenced File | Actual Status |
|----------------|--------------|
| `templates/franchise_search.html` | **DELETED** — does not exist |
| `docs/new-features.md` | **DELETED** — only `docs/new-features-summary.md` exists (720 lines) |
| `static/shared/icons/*.svg` for 6 sites | Only **5 SVG icon files** exist — E-Hentai icon missing |

---

## 6. File Inventory — Python (web_app.py)

**Total: 222 function definitions** (214 module-level + 8 inner/nested)

| Category | Count |
|----------|-------|
| Module-level `def` | 214 |
| Inner (nested) functions | 8 |
| `@app.route` (total) | 121 |
| `@admin_required` | 71 |
| `@auth_required` | 13 |
| `@api_error_handler` | 100 |
| `async def` | 3 |
| Generator functions | 2 (both inner, SSE) |

**8 Inner Functions:**

| Line | Name | Parent |
|------|------|--------|
| 198 | `_run` | `_start_background_task` |
| 1744 | `wrapper` | `auth_required` |
| 1754 | `wrapper` | `admin_required` |
| 1764 | `wrapper` | `api_error_handler` |
| 5451 | `generate` | `api_auto_scan` |
| 6384 | `_run_both` | `api_auto_fetch_all` |
| 6515 | `generate` | `api_regen_thumbnails_stream` |
| 6858 | `_run` | `api_rehash` |

---

## 7. File Inventory — JavaScript

**Total: ~530 named functions across 33 JS files**

| Category | Count |
|----------|-------|
| IIFE modules | 15 |
| ES modules | 12 |
| Object literal modules | 5 |
| Constructor functions | 3 (`Lightbox`, `SharedGrid`, `MediaVaultLightbox`) |
| Prototype methods | 43 |
| Exported functions | 37 |
| Async functions | 7 |

**Largest JS files by function count:**
1. `static/admin/admin.js` — ~55 functions (AdminDashboard)
2. `static/shared/gallery/gallery.js` — ~50 functions (MediaVaultGallery)
3. `static/shared/lightbox.js` — 31 prototype methods + 1 constructor
4. `static/shared/comics/comics.js` — ~30 functions (ComicsPicker)
5. `static/tagfetch/manual/manual-v2.js` — ~28 functions (ManualTagfetch)

---

## 8. Files Referenced But Deleted

| File | Last Referenced In | Notes |
|------|-------------------|-------|
| `check.py` | README.md, README.ru.md | Was 68 syntax checks |
| `DESING.md` (or `DESIGN.md`) | README.md, README.ru.md | Never existed? |
| `templates/franchise_search.html` | `changes-summary.md` | Was franchise search page |
| `docs/new-features.md` | `changes-summary.md` | Only `new-features-summary.md` exists |
| `static/tagfetch/manual/manual.js` | `docs/code-guide.md` | Replaced by `manual-v2.js` |
| `static/mediavault/utils.js` | `docs/code-guide.md` | Dead code removed |

---

## 9. Route `/tagfetch/manual` Status

- **Template exists:** `templates/tagfetch/manual.html` ✓
- **Backend route:** **DELETED** from `web_app.py` (no `/tagfetch/manual` GET handler)
- **Actual equivalent route:** `/content-mgmt/tags-manual` (line 2016, renders same `tagfetch/manual.html`)
- **Template is orphaned** unless someone navigates to `/content-mgmt/tags-manual`

---

## 10. Mermaid Diagrams in code-guide.md

All range annotations in the structure diagram (lines 562-578 of code-guide.md) are shifted. For example:
- "100-1060: Helpers" → actual helpers are at ~1139-1687
- "1060-1310: Auth decorators" → actual decorators at ~1724-1770

The diagram needs a full re-range.

---

## 11. Recommendations

### Immediate (high priority)
1. ⚠️ **Update README.md and README.ru.md** with accurate metrics (lines, files, routes)
2. ⚠️ **Update AGENTS.md** with accurate counts (lines 6000→7700, routes 108→121)
3. ⚠️ **Fix code-guide.md line numbers** or remove them (systematic +400-500 shift)

### Medium priority
4. **Merge valuable content from deleted docs** into code-guide.md
   - Backend architecture from `sites-api-in-MV.md` → code-guide.md
   - Plugin system docs from code-guide (already has some) → expand
5. **Add missing route** for `/tagfetch/manual` (or document that it's served by `/content-mgmt/tags-manual`)
6. **Run `/init-deep`** to regenerate AGENTS.md

### Low priority
7. **Update `changes-summary.md`** — remove references to deleted files
8. **Consider removing orphaned template** `templates/tagfetch/manual.html` if unreachable
9. **Add E-Hentai SVG icon** to `static/shared/icons.js` if needed
10. **Add CI check** for documentation accuracy (grep cross-reference script)

---

## 12. Methodology

- All line counts via `wc -l`, file counts via `find ... | wc -l`
- Function names via `grep -n "^def \|    def "` on Python, full AST analysis on JS
- Route counts via `grep -c "@app.route"` on web_app.py
- Decorator counts via `grep -c "@admin_required\|@auth_required\|@api_error_handler"`
- Cross-references via manual comparison of documented claims vs `grep`/`find` results
- 5 parallel explore agents used for verification + direct `bash` commands

---

*Generated by Sisyphus — MediaVault AI build manager*
