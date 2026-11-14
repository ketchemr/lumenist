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
Launches the Next.js production HTTP server using the pre-compiled `.next/` build. In production environments, this is typically orchestrated via PM2 (`pm2 start npm --name "lumenist" -- start`).

### `npm run lint`
Runs the linter across all TypeScript, TSX, and JavaScript source files to check for syntax issues, formatting consistency, and potential runtime bugs.

---

## 📸 Catalog & Photo Ingestion Commands

### `npm run import:all`
Scans your photo archive directory (configured in `.env.local` via `PHOTOS_SOURCE_DIR` or `LOCAL_PHOTO_DIR`), extracts EXIF metadata and companion `.txt` narrative descriptions, and rebuilds the unified catalog at `data/photos.json`.

### `npm run import:test`
Performs a dry-run test of the metadata parser script against sample images and `.txt` files without writing or modifying `data/photos.json`. Useful for verifying changes to parsing logic.

### `npm run thumbnails:precache`
Pre-generates and caches WebP thumbnails for every photograph in the catalog across all exhibition sizes (150px, 400px, 600px). Pre-caching ensures zero latency when visitors browse galleries and explore maps.

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
# 1. Pull latest code from GitHub
git pull origin main

# 2. Install any updated dependencies
npm install

# 3. Build optimized production bundle
npm run build

# 4. Restart production server via PM2
pm2 restart lumenist
```
