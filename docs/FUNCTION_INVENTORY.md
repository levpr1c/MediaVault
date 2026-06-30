# MediaVault — Function Inventory

**Generated:** 2026-06-30
**Source:** `src/web_app.py` (Python) + 33 JS files under `static/`
**Tool:** AI code analysis (grep + explore agents)

---

## 1. Python Backend — `src/web_app.py`

**File stats:** 7671 lines, **222 function definitions** (214 module-level + 8 inner)

### 1.1 Decorator Summary

| Decorator | Count |
|-----------|-------|
| `@app.route` | 121 |
| `@admin_required` | 71 |
| `@auth_required` | 13 |
| `@api_error_handler` | 100 |
| `async def` | 3 |

### 1.2 Helper / Utility Layer (lines 34–248)

| Line | Function | Description |
|------|----------|-------------|
| 34 | `_enable_debug_logging` | Enable debug file logging |
| 41 | `log_debug` | ANSI-colored debug log |
| 45 | `log_debug_green` | Green ANSI debug log |
| 49 | `log_debug_red` | Red ANSI debug log |
| 54 | `log_info` | Info log |
| 57 | `log_info_green` | Green info log |
| 60 | `log_info_red` | Red info log |
| 63 | `log_info_cyan` | Cyan info log |
| 66 | `log_info_yellow` | Yellow info log |
| 70 | `log_error` | Error log |
| 73 | `log_warning` | Warning log |
| 76 | `log_request` | Request logging |
| 113 | `_ensure_db_dir` | Ensure DB directory exists |
| 122 | `_has_non_meta_tags` | Check if file has non-meta tags |
| 131 | `_check_internet` | Internet connectivity check |
| 162 | `init_credential_store` | Initialize credential store |
| 169 | `_has_users` | Check if any users exist |
| 181 | `_invalidate_users_cache` | Invalidate users cache |
| 189 | `_start_background_task` | Start background thread |
| 198 | `_run` *(inner)* | Background task runner |
| 220 | `_get_plugin_for_site` | Look up plugin handling a site |
| 237 | `_get_plugin_download_folder` | Resolve download folder from plugin |
| 248 | `_get_plugin_site_folders` | Build site→folder map from plugins |

### 1.3 Jinja2 / Template Layer (lines 920–964)

| Line | Function | Description |
|------|----------|-------------|
| 920 | `_` | i18n translate helper |
| 932 | `inject_i18n` | Inject locale into Jinja2 context |
| 936 | `inject_media_vars` | Inject media variables into context |
| 945 | `get_lang` | Get current language |
| 951 | `compute_md5` | Compute MD5 hash of file |
| 959 | `_md5_from_filename` | Extract MD5 from filename pattern |
| 964 | `_compute_dhash` | Compute perceptual hash (dHash) |

### 1.4 Database / Settings / Path Layer (lines 984–1139)

| Line | Function | Description |
|------|----------|-------------|
| 984 | `_db_conn` | Get DB connection |
| 993 | `merge_tags` | Merge tag strings |
| 1000 | `find_file_in_db` | Find file by path in DB |
| 1030 | `load_settings` | Load settings.json |
| 1046 | `save_settings` | Save settings.json |
| 1076 | `_cache_control_header` | Generate Cache-Control header |
| 1087 | `_norm_path` | Normalize file path |
| 1093 | `_is_restricted_path` | Check if path is restricted |
| 1101 | `_safe_media_path` | Sanitize media path |

### 1.5 Thumbnail Layer (lines 1139–1312)

| Line | Function | Description |
|------|----------|-------------|
| 1139 | `_make_thumbnail_bytes` | Generate thumbnail in AVIF |
| 1206 | `_get_thumbnail` | Get cached or generate thumbnail |
| 1253 | `_regen_all_thumbnails` | Regenerate all thumbnails |

### 1.6 Tag / Category Layer (lines 1312–1704)

| Line | Function | Description |
|------|----------|-------------|
| 1312 | `_ensure_categories` | Ensure Danbooru tag categories exist |
| 1351 | `_ensure_common_meta` | Ensure common meta tags exist |
| 1381 | `_categorize_r34_tag` | Categorize a Rule34 tag |
| 1401 | `_ensure_r34_categories` | Ensure Rule34 categories exist |
| 1430 | `_ensure_auto_scan_table` | Create auto_scan table |
| 1442 | `_ensure_scan_results_table` | Create scan_results table |
| 1468 | `_get_auto_tags` | Compute auto-tags for a file |
| 1479 | `_video_has_audio` | Check if video has audio track |
| 1497 | `_get_aspect_ratio_tag` | Compute aspect ratio tag |
| 1510 | `_is_dir_empty` | Check if directory is empty |
| 1525 | `_count_media_files` | Count media files in dir |
| 1538 | `_ensure_db_schema` | Ensure all DB tables exist |
| 1609 | `_mark_tags_found` | Mark file tags as found |
| 1623 | `_has_tags_found` | Check if tags were found |
| 1636 | `_mark_tags_not_found` | Mark file tags as not found |
| 1651 | `_was_tags_not_found` | Check if tags were not found |
| 1664 | `_is_auto_scanned` | Check if file was auto-scanned |
| 1676 | `_mark_auto_scanned` | Mark file as auto-scanned |
| 1687 | `_get_tag_categories` | Get all tag categories |
| 1704 | `_get_file_type` | Determine file type |
| 1714 | `_get_image_dimensions` | Get image dimensions |

### 1.7 Auth Decorators (lines 1724–1770)

| Line | Function | Description |
|------|----------|-------------|
| 1724 | `_auth_required` | Auth check helper |
| 1732 | `_admin_required` | Admin check helper |
| 1741 | `auth_required` | Decorator factory for auth |
| 1744 | `wrapper` *(inner)* | Auth decorator wrapper |
| 1751 | `admin_required` | Decorator factory for admin |
| 1754 | `wrapper` *(inner)* | Admin decorator wrapper |
| 1761 | `api_error_handler` | Decorator factory for API errors |
| 1764 | `wrapper` *(inner)* | Error handler wrapper |

### 1.8 External API Fetchers (lines 1789–1850)

| Line | Function | Description |
|------|----------|-------------|
| 1789 | `fetch_rule34` | Fetch tags from Rule34 |
| 1815 | `fetch_danbooru` | Fetch tags from Danbooru |
| 1850 | `get_caches` | Get in-memory caches |

### 1.9 HTML Page Routes (lines 1856–2075)

| Line | Route | Function | Admin | Description |
|------|-------|----------|-------|-------------|
| 1856 | `/favicon.ico` | `favicon` | — | Serve favicon |
| 1860 | `/` | `index` | — | Home page |
| 1870 | `/mediavault/gallery` | `mediavault_gallery_route` | — | MV gallery |
| 1875 | `/mediavault/comics` | `mediavault_comics_route` | — | MV comics |
| 1881 | `/mediavault/view` | `mediavault_view_route` | — | MV file view |
| 1958 | `/mediavault/comics/view` | `mediavault_comics_view_route` | — | MV comics view |
| 1962 | `/popular-tags` | `popular_tags_route` | — | Popular tags page |
| 1971 | `/content-mgmt/comics` | `comics_route` | — | CM comics list |
| 1975 | `/content-mgmt/comics/view` | `comics_view_route` | — | CM comics viewer |
| 2009 | `/content-mgmt/tags-auto` | `content_mgmt_tags_auto` | — | Tagfetch auto |
| 2017 | `/content-mgmt/tags-manual` | `content_mgmt_tags_manual` | — | Tagfetch manual |
| 2025 | `/content-mgmt/tags-manage` | `content_mgmt_tags_manage` | — | Tags manager |
| 2036 | `/content-mgmt/tags-group` | `content_mgmt_tags_group` | — | Tags group |
| 2047 | `/content-mgmt/comics-edit` | `content_mgmt_comics_edit` | ✓ | Comics editor |
| 2055 | `/nhentai-search` | `nhentai_search_page` | ✓ | NHentai search |
| 2061 | `/content-mgmt/comics-tags` | `comics_tags_page` | ✓ | Comics tagging |
| 2068 | `/content-search` | `content_search_page` | ✓ | Content search |

### 1.10 Content Search API (lines 2076–2592)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 2076 | `POST /api/content-mgmt/search` | `api_content_search` | A+E | Unified search |
| 2240 | `GET /api/content-mgmt/plugin-sources` | `api_content_mgmt_plugin_sources` | A+E | Plugin sources list |
| 2278 | `GET /api/content-mgmt/search/nhentai-gallery` | `api_content_search_nhentai_gallery` | A+E | NHentai gallery |
| 2301 | `GET /api/content-mgmt/search/plugin-gallery` | `api_content_search_plugin_gallery` | A+E | Plugin gallery |
| 2346 | `POST /api/content-mgmt/search/download` | `api_content_search_download` | U+E | Download file |
| 2469 | `POST /api/content-mgmt/search/check-manga-dir` | `api_content_search_check_manga_dir` | U+E | Check manga dir |
| 2508 | `POST /api/content-mgmt/search/download-manga` | `api_content_search_download_manga` | U+E | Download manga |

### 1.11 Download Background Workers (lines 2592–3344)

| Line | Function | Description |
|------|----------|-------------|
| 2592 | `_dl_page` | Download single page from source |
| 2729 | `_bg_download_file` | Background file download |
| 2811 | `_bg_download_manga` | Background manga download |
| 2881 | `_dl` | Generic download function |
| 3025 | `api_content_search_download_async` | Async download (route) |
| 3043 | `api_content_search_download_manga_async` | Async manga download (route) |
| 3064 | `api_content_search_download_plugin_async` | Async plugin download (route) |
| 3086 | `_bg_download_plugin` | Background plugin download |
| 3344 | `_dl_plugin_page` | Download plugin page |

### 1.12 Content Search Auxiliary (lines 3356–3439)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 3356 | `GET /api/content-mgmt/search/task/<id>` | `api_content_search_task_status` | U+E | Task status |
| 3372 | `POST /api/mount-check` | `api_mount_check` | U+E | Mount check |
| 3391 | `POST /api/content-mgmt/search/create-folders` | `api_content_search_create_folders` | A+E | Create folder structure |
| 3416 | `GET /api/tags/autocomplete` | `api_tags_autocomplete` | A+E | Tag autocomplete |
| 3439 | `/similar` | `similar_page` | E | Similar files page |

### 1.13 Settings / NHentai / EH / Kemono (lines 3447–3666)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 3447 | `/settings` | `settings_page` | — | Settings page |
| 3461 | `GET/POST /api/settings` | `api_settings` | E | Settings CRUD |
| 3501 | `GET /api/nhentai/search` | `api_nhentai_search` | E | NHentai search |
| 3518 | `GET /api/ehentai/gallery` | `api_ehentai_gallery` | E | E-Hentai gallery |
| 3534 | `GET /api/kemono/mirrors` | `api_kemono_mirrors` | A+E | Kemono mirrors |
| 3543 | `/kemono-import` | `kemono_import_page` | A+E | Kemono import page |
| 3550 | `GET /api/kemono/info` | `api_kemono_info` | A+E | Kemono post info |
| 3562 | `POST /api/kemono/download` | `api_kemono_download` | A+E | Kemono download |
| 3588 | `GET /api/credential_status` | `api_credential_status` | E | Credential status |
| 3597 | `POST /api/set_credential_backend` | `api_set_credential_backend` | A+E | Switch credential backend |
| 3642 | `POST /api/theme` | `api_theme` | E | Theme switch |
| 3655 | `POST /api/effects` | `api_effects` | E | Effects toggle |
| 3666 | `_relocate_or_clean` | `_relocate_or_clean` | — | Relocate/clean data |

### 1.14 Auth / Admin Panel (lines 3714–3973)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 3714 | — | `_ensure_admin_user` | — | Create default admin |
| 3733 | `GET /api/auth_status` | `api_auth_status` | E | Auth status |
| 3744 | `POST /api/login` | `api_login` | E | Login |
| 3772 | `POST /api/logout` | `api_logout` | E | Logout |
| 3780 | `POST /api/set_password` | `api_set_password` | U+E | Set password |
| 3803 | `POST /api/account/change_username` | `api_account_change_username` | U+E | Change username |
| 3834 | `/admin` | `admin_panel` | — | Admin panel page |
| 3854 | `/content-mgmt` | `content_page_legacy` | — | CM legacy redirect |
| 3862 | `GET /api/admin/users` | `api_admin_users` | A+E | List users |
| 3875 | `POST /api/admin/users` | `api_admin_add_user` | A+E | Add user |
| 3898 | `DELETE /api/admin/users/<id>` | `api_admin_delete_user` | A+E | Delete user |
| 3912 | `POST /api/admin/users/<id>/role` | `api_admin_set_role` | A+E | Set user role |
| 3932 | `POST /api/admin/users/<id>/password` | `api_admin_set_password` | A+E | Set user password |
| 3951 | — | `check_auth` | — | Before-request auth check |
| 3968 | — | `log_access` | — | After-request logging |
| 3973 | `/login` | `login_page` | — | Login page |

### 1.15 Scan Layer (lines 3983–4394)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 3983 | — | `_remove_stale_record` | — | Remove stale DB record |
| 3994 | — | `_quick_scan` | — | Quick file scan |
| 4143 | — | `_full_scan` | — | Full directory scan |
| 4347 | `POST /api/rescan/full` | `api_rescan_full` | A+E | Full rescan |
| 4363 | `POST /api/scan_folder` | `api_scan_folder` | A+E | Scan specific folder |
| 4380 | `GET /api/scan_status` | `api_scan_status` | A+E | Scan progress |
| 4387 | `GET /api/admin/scan/progress` | `api_admin_scan_progress` | A+E | Admin scan SSE |
| 4394 | `GET /api/admin/dashboard` | `api_admin_dashboard` | A+E | Dashboard stats |

### 1.16 Admin Plugins / Backends (lines 4485–4564)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 4485 | `GET /api/admin/plugins` | `api_admin_plugins` | A+E | List plugins |
| 4512 | `POST /api/admin/plugins/<name>/toggle` | `api_admin_plugins_toggle` | A+E | Toggle plugin |
| 4535 | `GET /api/admin/backends/status` | `api_admin_backends_status` | A+E | Backend status |
| 4548 | — | `_folder_sql_clause` | — | SQL clause builder |

### 1.17 Gallery / Media / Browse API (lines 4564–4998)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 4564 | `GET /api/gallery` | `api_gallery` | E | Gallery data |
| 4650 | `POST /api/pick_folder` | `api_pick_folder` | A+E | Folder picker |
| 4672 | `GET /api/browse` | `api_browse` | A+E | Directory listing |
| 4702 | `GET /api/media` | `api_media` | U+E | Serve media file |
| 4729 | `GET /api/thumbnail` | `api_thumbnail` | U+E | Serve thumbnail |
| 4760 | `GET /api/fileinfo` | `api_fileinfo` | U+E | File metadata |
| 4809 | `GET /api/similar` | `api_similar` | E | Similar files |
| 4843 | `GET /api/fetch_file` | `api_fetch_file` | A+E | Fetch tags for file |
| 4953 | `POST /api/auto_status` | `api_auto_status` | E | Auto-scan status |
| 4998 | `POST /api/check_status` | `api_check_status` | E | Check file status batch |

### 1.18 Tags / Categories / Save / Auto-Scan (lines 5035–5451)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 5035 | `POST /api/clear_cache` | `api_clear_cache` | A+E | Clear file cache |
| 5053 | `GET /api/popular_tags` | `api_popular_tags` | E | Get popular tags |
| 5091 | `GET/POST /api/categories` | `api_categories` | E | Tag category CRUD |
| 5188 | `POST /api/save_file` | `api_save_file` | A+E | Save tags to file |
| 5317 | `POST /api/save_all_fetched` | `api_save_all_fetched` | A+E | Save all fetched tags |
| 5403 | `POST /api/auto_scan` | `api_auto_scan` | A+E | Auto-scan (SSE) |
| 5451 | `generate` *(inner)* | SSE event generator | — | Auto-scan SSE generator |

### 1.19 Comics / Gallery Auto (lines 5590–6395)

| Line | Function/Route | Function | Auth | Description |
|------|----------------|----------|------|-------------|
| 5590 | — | `_comics_auto_tagfetch_bg` | — | Background comics tagfetch |
| 5744 | `POST /api/comics/auto/tagfetch` | `api_comics_auto_tagfetch` | A+E | Trigger comics tagfetch |
| 5759 | — | `_comics_auto_create_bg` | — | Auto-create comics from downloads |
| 5913 | — | `_comics_enrich_metadata_bg` | — | Enrich comic metadata |
| 6178 | `POST /api/comics/enrich-metadata` | `api_comics_enrich_metadata` | A+E | Trigger metadata enrich |
| 6193 | `POST /api/comics/auto/fetch` | `api_comics_auto_fetch` | A+E | Trigger auto fetch |
| 6205 | — | `_gallery_auto_tagfetch_bg` | — | Background gallery tagfetch |
| 6356 | `POST /api/auto/fetch-gallery` | `api_auto_fetch_gallery` | A+E | Gallery auto-tagfetch |
| 6373 | `POST /api/auto/fetch-all` | `api_auto_fetch_all` | A+E | Auto-fetch all |
| 6384 | `_run_both` *(inner)* | Combined runner | — | Run both auto-fetchers |
| 6395 | `GET /api/export_db` | `api_export_db` | A+E | Export database |

### 1.20 DB Import / Thumbnails (lines 6405–6589)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 6405 | `POST /api/import_db` | `api_import_db` | A+E | Import database |
| 6428 | `POST /api/clear_thumb_cache` | `api_clear_thumb_cache` | A+E | Clear thumbnail cache |
| 6448 | `POST /api/regenerate_thumbnails` | `api_regenerate_thumbnails` | A+E | Regenerate all thumbnails |
| 6459 | `GET /api/regenerate_thumbnails/status` | `api_regenerate_thumbnails_status` | E | Regeneration status |
| 6462 | — | `_regen_missing_thumbnails` | — | Generate missing thumbnails |
| 6497 | `POST /api/generate_missing_thumbnails` | `api_generate_missing_thumbnails` | A+E | Trigger missing thumbnails |
| 6509 | `GET /api/regen-thumbnails/stream` | `api_regen_thumbnails_stream` | A+E | SSE stream for regeneration |
| 6515 | `generate` *(inner)* | SSE event generator | — | Regen SSE generator |
| 6589 | `POST /api/cancel_regen` | `api_cancel_regen` | A+E | Cancel regeneration |

### 1.21 Clear / Delete / Dedup / Rehash (lines 6602–6906)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 6602 | `POST /api/tags` | `api_tags` | A+E | Add tags |
| 6634 | `POST /api/tags/bulk` | `api_tags_bulk` | A+E | Bulk tag files |
| 6661 | `POST /api/clear_browser_cache` | `api_clear_browser_cache` | A+E | Increment cache buster |
| 6672 | `POST /api/clear_tag_cache` | `api_clear_tag_cache` | A+E | Clear tag cache |
| 6695 | `POST /api/clear_database` | `api_clear_database` | A+E | Clear file database |
| 6725 | `POST /api/clear_all` | `api_clear_all` | A+E | Clear everything |
| 6743 | `POST /api/clear_tags` | `api_clear_tags` | A+E | Clear all tags |
| 6768 | `POST /api/delete_all` | `api_delete_all` | A+E | Delete all files from DB |
| 6803 | `POST /api/deduplicate` | `api_deduplicate` | A+E | Deduplicate files |
| 6845 | `POST /api/rehash` | `api_rehash` | A+E | Rehash all files |
| 6858 | `_run` *(inner)* | Rehash runner | — | Background rehash |
| 6891 | `GET /api/rehash-progress` | `api_rehash_progress` | A+E | Rehash progress |
| 6895 | — | `_has_sample_prefix` | — | Check if path starts with sample/ |
| 6898 | — | `_has_real_tags` | — | Check if file has real tags |

### 1.22 Find/Remove Duplicates / Originals (lines 6906–7219)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 6906 | `POST /api/find-duplicates` | `api_find_duplicates` | A+E | Find duplicate files |
| 6984 | `POST /api/remove-duplicates` | `api_remove_duplicates` | A+E | Remove duplicates |
| 7018 | `GET /api/files-without-tags` | `api_files_without_tags` | U+E | Files without tags |
| 7034 | — | `_find_sample_originals_task` | — | Background original finder |
| 7115 | `POST /api/find-originals` | `api_find_originals` | A+E | Find originals |
| 7132 | `GET /api/find-originals/progress` | `api_find_originals_progress` | A+E | Originals progress |
| 7142 | `POST /api/find-originals/cancel` | `api_find_originals_cancel` | A+E | Cancel originals search |
| 7154 | `POST /api/download-original` | `api_download_original` | A+E | Download original file |

### 1.23 Comics CRUD API (lines 7219–7558)

| Line | Route | Function | Auth | Description |
|------|-------|----------|------|-------------|
| 7219 | `POST /api/comics/search` | `api_comics_search` | E | Search comics |
| 7244 | `GET /api/comics/list` | `api_comics_list` | E | List comics |
| 7270 | `POST /api/comics/add` | `api_comics_add` | A+E | Create comic |
| 7301 | `POST /api/comics/delete` | `api_comics_delete` | A+E | Delete comic |
| 7321 | `GET /api/comics/get` | `api_comics_get` | E | Get comic details |
| 7349 | `POST /api/comics/update` | `api_comics_update` | A+E | Update comic |
| 7378 | `POST /api/comics/pages/tag` | `api_comics_pages_tag` | A+E | Tag comic pages |
| 7455 | `POST /api/comics/metadata/export` | `api_comics_metadata_export` | A+E | Export comic metadata |
| 7507 | `POST /api/comics/metadata/import` | `api_comics_metadata_import` | A+E | Import comic metadata |
| 7558 | — | `main` | — | Flask app entry point |

---

## 2. JavaScript Frontend — 33 files

**Total: ~530 named functions** across 33 JS files (15 IIFE modules, 12 ES modules, 5 object literals, 3 constructors, 43 prototype methods, 37 exported functions)

### 2.1 static/shared/utils.js (Shared utilities)

| Line | Function | Type |
|------|----------|------|
| 9 | `Shared.esc` | Sanitize HTML |
| 17 | `Shared.notify` | Toast notification |
| 40 | `Shared.toggleTheme` | Toggle dark/light theme |
| 756 | `Shared.t` | i18n translate |
| 767 | `Shared.getLang` | Get current language |
| 770 | `Shared.toggleLang` | Toggle language |
| 794 | `Shared.toggleEffects` | Toggle CSS effects |
| 816 | `Shared.initThemeBtn` | Initialize theme button |
| 858 | `Shared.initLangBtn` | Initialize language button |
| 900 | `Shared.applyI18n` | Apply i18n to DOM |
| 964 | `CSS.escape` | CSS.escape polyfill |
| 982 | `Shared.playChime` | Notification sound |
| 1000 | `Shared.hexToRgba` | Hex → rgba conversion |
| 1006 | `Shared.parseTags` | Parse tag string |
| 1012 | `Shared.getColumnCount` | Get responsive column count |
| 1029 | `Shared.reorderGalleryDOM` | Reorder gallery elements |
| 1046 | `Shared.getVisualOrder` | Get visual order of elements |
| 1058 | `Shared.logout` | Logout function |
| 1061 | `Shared.toggleDropdown` | Toggle dropdown |

### 2.2 static/shared/lightbox.js (Lightbox — 31 prototype methods)

| Line | Method | Description |
|------|--------|-------------|
| 22 | `function Lightbox(opts)` | Constructor |
| 67 | `Lightbox.prototype._id` | Get element ID |
| 71 | `Lightbox.prototype._el` | Get element |
| 75 | `Lightbox.prototype._ensureDOM` | Create DOM structure |
| 125 | `Lightbox.prototype._bindEvents` | Bind keyboard/click events |
| 336 | `Lightbox.prototype.open` | Open lightbox |
| 368 | `Lightbox.prototype.close` | Close lightbox |
| 402 | `Lightbox.prototype._renderContent` | Render content |
| 418 | `Lightbox.prototype._renderMedia` | Render image/video |
| 501 | `Lightbox.prototype._resetHideTimer` | Reset auto-hide timer |
| 513 | `Lightbox.prototype._cancelHideTimer` | Cancel auto-hide |
| 520 | `Lightbox.prototype._renderPanel` | Render info panel |
| 624 | `Lightbox.prototype._prev` | Previous item |
| 640 | `Lightbox.prototype._next` | Next item |
| 657 | `Lightbox.prototype._sizeLb` | Size lightbox |
| 696 | `Lightbox.prototype._resetSize` | Reset size |
| 706 | `Lightbox.prototype._toggleFullscreen` | Toggle fullscreen |
| 714 | `Lightbox.prototype._sizeAuto` | Auto-size |
| 721 | `Lightbox.prototype._resetZoom` | Reset zoom |
| 740 | `Lightbox.prototype._setZoomScroll` | Set zoom scroll |
| 755 | `Lightbox.prototype._toggleZoom` | Toggle zoom mode |
| 780 | `Lightbox.prototype._zoomFull` | Zoom to full |
| 800 | `Lightbox.prototype._zoomIn` | Zoom in |
| 816 | `Lightbox.prototype._zoomOut` | Zoom out |
| 832 | `Lightbox.prototype._toggleScrollMode` | Toggle scroll mode |
| 846 | `Lightbox.prototype._initDragPan` | Drag pan initialization |
| 897 | `Lightbox.prototype._parseTags` | Parse tag string |
| 902 | `Lightbox.prototype._esc` | Escape HTML |
| 907 | `Lightbox.prototype._showAutocomplete` | Tag autocomplete |
| 945 | `Lightbox.prototype._showRelatedTags` | Related tags |
| 979 | `Lightbox.prototype._addTag` | Add tag |
| 1005 | `Lightbox.prototype._addTagFromInput` | Add tag from input |
| 1013 | `Lightbox.prototype._toggleDeleteMode` | Toggle delete mode |
| 1019 | `Lightbox.prototype._toggleTagDeletion` | Toggle tag deletion |

### 2.3 static/admin/admin.js (AdminDashboard — ~55 functions)

| Section | Functions | Description |
|---------|-----------|-------------|
| Internal | `_t`, `_loading`, `_toast`, `_modal`, `_api`, `_closeModal`, `_esc`, `_destroyCharts` | Helpers |
| Dashboard | `_renderDashboard` | Stats, charts |
| Users | `_renderTable`, `_roleBadge`, `_addUser`, `_createUser`, `_deleteUser`, `_toggleRole`, `_setPassword` | User CRUD |
| Database | `_renderContent`, `_tool`, `_dbAction`, `_execDbAction`, `_findDuplicates`, `_renderDuplicateModal`, `_removeDupSelected` | DB tools |
| API Keys | `_renderForm`, `_saveApiKeys`, `_saveCredBackend` | Key management |
| Plugins | `_renderPlugins`, `_togglePlugin` | Plugin management |
| Folders | `_saveFolderSettings`, `_pickFolder`, `_scanFolder` | Folder settings |
| Backends | render, form | Backend selection |
| Progress | `_startScanProgressPoll`, `_stopScanProgressPoll`, `_updateScanProgress`, `_hideScanProgress`, `_pollRehash`, `_startRegenSSE`, `_cancelRegen` | Progress tracking |
| Mount | `_checkMount`, `_startMountWatch`, `_stopMountWatch` | Mount status |
| Navigation | `init`, `loadSection` | SPA routing |

### 2.4 static/content/content-search.js (Content search — ~25 functions)

| Function | Description |
|----------|-------------|
| `getActiveSites` | Get enabled search sites |
| `hideAutocomplete` | Hide autocomplete dropdown |
| `fetchAutocomplete` | Fetch tag suggestions |
| `doSearch` | Execute search |
| `fetchPage` | Fetch single page |
| `renderPage` | Render results |
| `renderPageNumbers` | Pagination controls |
| `goToPage` | Navigate to page |
| `cardHTML` | Build result card HTML |
| `renderSkeletons` | Loading skeletons |
| `pollTask` | Poll async task |
| `buildMangaViewer` | Build manga spread viewer |
| `loadSpreads` | Load manga spreads |
| `goToSpread` | Navigate to spread |
| `updateCounter` | Update page counter |
| `updateNhCategories` | Update NH categories |
| `showLightbox` | Open content lightbox |

### 2.5 static/shared/gallery/gallery.js (MediaVaultGallery — ~50 functions)

Key functions: `init`, `loadGallery`, `scanFolder`, `applyFilter`, `goToPage`, `setLayoutMode`, `setPageSize`, `setThumbSize`, `setSearchMode`, `onSearchInput`, `setSearchQuery`, `showSearchAutocomplete`, `toggleSelectMode`, `addTagToSelected`, `getFilteredData`, `getVisualOrder`, `refreshGalleryItem`, `toggleFetchedOnly`, `toggleDateSort`, `renderGalleryContent`, `buildGalleryItemHtml`, `loadThumbnail`, `createLazyLoader`, `attachGalleryEvents`, `playPreview`, `stopPreview`, `renderPaginationControls`, `updateBulkBar`

### 2.6 Remaining Key Files

| File | Functions | Type |
|------|-----------|------|
| `static/shared/comics/comics.js` | ~30 (ComicsPicker) | IIFE |
| `static/shared/find-originals.js` | ~18 (FindOriginals) | IIFE |
| `static/shared/gallery/tags.js` | 14 (MediaVaultTags) | IIFE |
| `static/shared/mobile-search.js` | 5 (MobileSearch) | IIFE |
| `static/shared/grid/shared-grid.js` | 9 prototype + constructor | IIFE |
| `static/shared/gallery/lightbox.js` | 7 (MediaVaultLightbox) | IIFE |
| `static/mediavault/mediavault.js` | 5 (MediaVault) | IIFE |
| `static/mediavault/db.js` | 3 (MediaVaultDB) | IIFE |
| `static/mediavault/api.js` | 6 (MediaVaultAPI) | Object |
| `static/tagfetch/auto/auto.js` | ~18 (TagfetchAuto) | IIFE |
| `static/tagfetch/manual/manual-v2.js` | ~28 (ManualTagfetch) | IIFE |
| `static/tagfetch/tagfetch.js` | 1 (Tagfetch) | IIFE |
| `static/tagfetch/api.js` | 17 (TagfetchAPI) | Object |
| `static/shared/api.js` | 3 (SharedAPI) | Object |
| `static/shared/icons.js` | 3 (SiteIcons) | Object |
| `static/shared/home-bg.js` | 1 exported + 2 internal | ES module |
| `static/shared/comics/picker-bridge.js` | 11 exported | ES module |
| `static/shared/comics/comics-search.js` | 1 exported | ES module |
| `static/shared/grid-renderer.js` | 5 exported | ES module |
| `static/content/comics.js` | 3 exported | ES module |
| `static/content/tags-manage/tags-manage.js` | 3 exported | ES module |
| `static/content/comics-tags.js` | 2 exported | ES module |
| `static/content/main.js` | 1 exported | ES module |
| `static/content/tags.js` | 2 exported | ES module |
| `static/content/utils.js` | 8 exported | ES module |
| `static/content/nhentai_search.js` | 6 regular | ES module |
| `static/shared/comics/comics-list.js` | 4 regular | Plain script |
| `static/shared/init.js` | 1 (toggleDrawer) | IIFE |

---

## 3. Other Python Files

### 3.1 src/credential_store.py

| Function | Description |
|----------|-------------|
| `CredentialStore.is_available` | Check if keyring is available |
| `CredentialStore.get` | Get credential by key |
| `CredentialStore.set` | Set credential |
| `CredentialStore.delete` | Delete credential |

### 3.2 src/backends/__init__.py

| Function | Description |
|----------|-------------|
| `fetch_tags` | Dispatch to backend for tag fetch |
| `search_tags` | Dispatch to backend for search |
| `get_backend` | Get backend by name |

### 3.3 src/backends/api_raw.py (372 lines)

| Function | Description |
|----------|-------------|
| `ApiRawBackend.fetch` | Dispatch fetch by site |
| `ApiRawBackend.search` | Dispatch search by site |
| `ApiRawBackend._fetch_rule34` | Rule34 tag fetch |
| `ApiRawBackend._search_rule34` | Rule34 search |
| `ApiRawBackend._fetch_danbooru` | Danbooru tag fetch |
| `ApiRawBackend._search_danbooru` | Danbooru search |
| `ApiRawBackend._fetch_nhentai` | NHentai v2 gallery fetch |
| `ApiRawBackend._search_nhentai` | NHentai v2 search |

### 3.4 src/backends/gallerydl.py (455 lines)

| Function | Description |
|----------|-------------|
| `GalleryDlBackend.fetch` | Dispatch fetch by site via gallery-dl |
| `GalleryDlBackend.search` | Dispatch search by site via gallery-dl |
| `GalleryDlBackend.get_info` | Get post info (Kemono/Coomer) |
| `GalleryDlBackend.download` | Download post (Kemono/Coomer) |
| `GalleryDlBackend.is_available` | Check CLI availability |
| `GalleryDlBackend.get_mirrors` | Get Kemono/Coomer mirror domains |
| `GalleryDlBackend._apply_gd_config` | Apply gallery-dl config |
| `GalleryDlBackend._gd_extract` | gallery-dl extractor helper |

### 3.5 src/plugins/interface.py (86 lines)

| Function | Description |
|----------|-------------|
| `BasePlugin.get_metadata` | Plugin metadata |
| `BasePlugin.get_search_page_config` | Search page config |
| `BasePlugin.get_search_params` | Search URL params |
| `BasePlugin.parse_search_results` | Parse search response |
| `BasePlugin.get_gallery_params` | Gallery URL params |
| `BasePlugin.parse_gallery_response` | Parse gallery response |
| `BasePlugin.get_download_params` | Download params |
| `BasePlugin.parse_download_response` | Parse download response |
| `BasePlugin.get_extra_tags` | Extra tags for enrichment |
| `BasePlugin.get_extra_fields` | Extra fields for enrichment |

### 3.6 src/plugins/__init__.py (193 lines)

| Function | Description |
|----------|-------------|
| `PluginManager.load_all` | Load all plugins |
| `PluginManager.load_plugin` | Load single plugin |
| `PluginManager.get_plugin` | Get plugin by name |
| `PluginManager.get_all_plugins` | Get all plugins |
| `PluginManager.get_loaded_plugins` | Get loaded plugins dictionary |

---

## 4. Summary

| Category | Count |
|----------|-------|
| Python functions (web_app.py) | 222 (214 module + 8 inner) |
| Python functions (other backends) | ~50 |
| JavaScript functions (33 files) | ~530 |
| HTML template files | 17 |
| CSS files | 8 |
| **Grand total functions** | **~800** |

---

*Generated by Sisyphus — MediaVault AI build manager*
