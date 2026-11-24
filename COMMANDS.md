# Lumenist — NPM Commands Reference

Quick reference of all `npm` commands used for developing, building, maintaining, and deploying Lumenist.

---

## 🛠️ Core Application Commands

### `npm install`
Installs all dependencies defined in `package.json` (Next.js, React, Tailwind CSS, Leaflet, Exifr, etc.) into `node_modules/`. Run this after cloning the repository or pulling updates.

### `npm run dev`
Starts the Next.js local development server with Fast Refresh (hot-reloading) at [http://localhost:3000](http://localhost:3000). Use this for daily local coding and testing.

### `npm run build`
Compiles and generates the optimized production build of the Next.js application into `.next/`. Runs TypeScript type-checking and statically optimizes pages for maximum speed. Run this before deploying or starting the production server.

### `npm start`
Launches the Next.js production HTTP server using the pre-compiled `.next/` build. In production environments, this is orchestrated via PM2 (`pm2 start ecosystem.config.cjs`).

### `npm run deploy`
Performs a fast, zero-downtime production update via `scripts/deploy.sh`:
1. Pulls the latest commits (`git pull --ff-only`).
2. Runs `npm ci` **only** if `package-lock.json` changed.
3. Builds into the inactive A/B build slot (`.next-a/` or `.next-b/`, reusing the previous slot's `cache/` for fast incremental builds) so the live build is completely untouched during compilation.
4. Atomically flips `.next-active` to the new slot (leaving the previous slot intact during reload overlap and for instant rollback).
5. Executes `pm2 reload lumenist` in cluster mode so the new worker boots and binds before the old worker drains.

Optional flags: `npm run deploy -- --no-pull`, `--force-install`, or `--skip-reload`.

### `npm run lint`
Runs the linter across all TypeScript, TSX, and JavaScript source files to check for syntax issues, formatting consistency, and potential runtime bugs.

---

## 📸 Catalog & Photo Ingestion Commands

### `npm run import:batch`
Batch-imports a folder of images (with an optional `.csv` or `.json` metadata manifest) directly into `public/photos/` and `data/photos.json`, automatically extracting EXIF camera, date, and GPS metadata for any missing fields.
```bash
npm run import:batch -- /path/to/images --meta /path/to/manifest.csv --duplicates merge
```
*(For smaller batches, use the **Bulk Import** tab in `/admin/upload`, which also includes one-click **Export JSON / CSV** catalog backups.)*

### `npm run thumbnails:precache`
Pre-generates and caches WebP thumbnails for every photograph in the catalog across all exhibition sizes (150px, 400px, 600px). Pre-caching ensures zero latency when visitors browse galleries and explore maps.

### `npm run icons:generate`
Regenerates all distribution favicon and application icons (`icon.svg`, multi-resolution `favicon.ico`, and `apple-icon.png`) using the canonical vector definition in `scripts/generate-favicons.js`.

### `npm run sync:remote`
Executes an `rsync` transfer to synchronize local photo files to the remote production server target specified by `REMOTE_PHOTO_TARGET`.

---

## 🚀 Typical Workflows

### Local Development Workflow
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

### Production Deployment / Update Workflow
```bash
# One-command zero-downtime deploy (pulls, builds in staging, swaps .next, reloads PM2)
npm run deploy
```

*(If running PM2 manually for the first time, launch with `pm2 start ecosystem.config.cjs && pm2 save` so `pm2 reload lumenist` uses cluster mode for seamless reloads.)*
