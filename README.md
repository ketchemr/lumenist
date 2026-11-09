# Lumenist

> **Lumenist** is an open-source, self-hosted fine-art photography gallery and modern CMS designed specifically for landscape, nature, and documentary photographers.

Named after the 19th-century **Luminism** art movement—which celebrated the poetic, atmospheric rendering of natural light and landscape—Lumenist is built as a high-performance, distraction-free alternative to legacy platforms like Piwigo and walled-garden portfolio builders.

🌐 **Live Exhibition Example**: See Lumenist running in production at <a href="https://rrkphoto.com" target="_blank" rel="noopener noreferrer"><strong>rrkphoto.com</strong> ↗</a> (*Randal R. Ketchem Photography: Fine Art Landscape and Nature Photography*).

---

## Key Features

### 🖼️ Exhibition-Grade Aesthetic & Dynamic Color Engine
- **Dark Exhibition Backgrounds**: Pre-configured with Pure OLED Black (`#000000`), Deep Obsidian, Midnight Slate, Warm Espresso, and Charcoal to maximize human eye dynamic range and eliminate ambient glare.
- **Studio Light Themes**: Built-in Clean Studio White, Warm Gallery Parchment, and Soft Silver modes.
- **Dynamic Contrast Intelligence**: Automatic contrast inversion ensures buttons, badges, navigation headers, and metadata cards remain razor-sharp regardless of background or accent color selections.
- **6 Accent Presets + Custom Hex Picker**: Amber Gold, Pure Silver, Pacific Cyan, Cascade Emerald, Alpine Crimson, and Amethyst Violet.

### 🎞️ Craft-First Photographic Metadata
Native, first-class display for details that matter to serious photographers:
- **Film Stock vs. Digital**: Distinguishes analog film transparencies (Velvia 50, Provia 100F, Tri-X) from modern digital sensor captures.
- **Optical Exposure Pyramid**: Camera body, lens model, exact focal length, shutter speed, aperture, ISO, and exposure compensation.
- **Color & White Balance**: Kelvin temperature and color tint (e.g. `5400K +6`), tone compensation, and color spaces.
- **Support Gear**: Dedicated tracking for tripods, ball heads, and leveling bases.
- **Zero Cumulative Layout Shift (CLS)**: Precise aspect ratio reservation ensures completely flicker-free page loads.

### ⚡ On-Demand Thumbnail & Image Pipeline
- **Next.js Thumbnail API (`/api/thumbnail`)**: Generates optimized WebP images on the fly with Lanczos3 resampling via Sharp.
- **Persistent Disk Caching**: Thumbnails are stored in `.thumbnails/` for millisecond subsequent delivery.
- **Batch Pre-caching**: Built-in CLI command to pre-generate all thumbnails ahead of exhibition launches.

### 🗺️ Interactive World Photography Map
- **Global & Per-Photo Mapping**: Clustered world map showing shooting locations across continents, alongside individual photo pinpoint maps.
- **3 Basemap Layers**:
  - Custom tuned dark mode vector tiles (OpenStreetMap, no API keys or third-party watermarks required).
  - Esri World Topographic relief (mountain elevation & contour).
  - Esri Aerial World Imagery (high-resolution satellite).

### 🎛️ Integrated Web Admin Suite (`/admin`)
- **Drag-and-Drop Uploader**: Direct web publishing with client-side EXIF auto-detection via `exifr` (camera, lens, focal length, aperture, shutter, ISO, date, GPS).
- **Visual Location Picker**: Interactive Leaflet map picker—click or drag a pin to assign geographic coordinates without manual typing.
- **Catalog Management**: Full searchable archive table with album filtering, pagination (25/50/100/All), and single photo editing/deletion.
- **Batch Operations**: Bulk add/remove albums, bulk assign/remove tags, and bulk delete selected works.
- **Live Studio Customizer**: Change theme accents, backgrounds, studio identity (Artist Name, Site Title, Tagline), slideshow timing, and admin passphrase directly through the web UI.

---

## Server Installation & Setup Guide

This guide covers installing and deploying Lumenist on an Ubuntu/Debian Linux server (e.g. Oracle Cloud, DigitalOcean, Hetzner, AWS, or home lab server).

### Prerequisites
- **Ubuntu 22.04 / 24.04 LTS** (or Debian 12)
- **Node.js 20+ or 22 LTS**
- **Nginx** (reverse proxy & SSL termination)
- **PM2** (process manager for zero-downtime restarts)
- A registered domain name pointing to your server's public IP

```bash
# Update packages and install Node.js 22 LTS & essential tools
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx git certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

---

### Step 1: Clone the Repository

Clone Lumenist to your web directory (e.g. `/var/www/lumenist`):

```bash
sudo mkdir -p /var/www/lumenist
sudo chown -R $USER:$USER /var/www/lumenist

git clone https://github.com/ketchemr/lumenist.git /var/www/lumenist
cd /var/www/lumenist
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create your server environment file from the template:

```bash
cp .env.example .env.local
```

Edit `.env.local` to define your secure administrator credentials:

```env
# Administrative Passphrase for /admin access
ADMIN_PASSWORD=your-secure-admin-passphrase

# 32+ character random secret used for session token signing
ADMIN_SECRET=generate-a-secure-random-secret-string-here
```

### Step 4: Set Up Your Photo Directory

Lumenist serves high-resolution photos via `public/photos`. You can symlink an existing photo drive, storage volume, or dedicated folder:

```bash
# Example: Symlinking a dedicated photo storage directory
ln -s /var/photos /var/www/lumenist/public/photos
```

Organize your photo files by year or category (e.g. `public/photos/2026/my_photo.jpg`).

### Step 5: Ingest Existing Photo Catalog & Metadata

If you have existing images or companion `.txt` metadata files (Piwigo/IPTC format):

```bash
npm run import:all
```

This parses image dimensions, dates, camera exposure details, descriptions, categories, and tags, writing your unified catalog to `data/photos.json`.

*(Recommended)* Pre-cache WebP thumbnails for instant exhibition loading:

```bash
npm run thumbnails:precache
```

### Step 6: Build & Launch with PM2

Build the optimized production application:

```bash
npm run build
```

Start the application with PM2:

```bash
# Start Lumenist on port 3000
pm2 start npm --name "lumenist" -- start

# Configure PM2 to automatically start on server boot
pm2 startup
pm2 save
```

### Step 7: Configure Nginx & SSL

Create an Nginx configuration file for your domain:

```bash
sudo nano /etc/nginx/sites-available/lumenist
```

Paste the following production configuration (replace `your-domain.com` with your actual domain):

```nginx
server {
    server_name your-domain.com www.your-domain.com;

    # Allow high-resolution photo uploads through /admin
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve pre-generated thumbnails with aggressive client caching
    location /.thumbnails/ {
        alias /var/www/lumenist/.thumbnails/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    listen 80;
}
```

Enable the site and reload Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/lumenist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Obtain a free SSL certificate with Let's Encrypt:

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## Managing Your Site via Web Admin

Once your server is running, manage your entire portfolio from any web browser:

1. Navigate to:
   ```
   https://your-domain.com/admin
   ```
2. Enter your `ADMIN_PASSWORD` (from `.env.local`).
3. Use the integrated control tabs:
   - **Upload**: Publish new photographs with automated EXIF extraction and interactive visual map pinning.
   - **Manage**: Search, edit metadata, delete, or perform bulk batch updates (add/remove albums, tag/untag, batch delete) across your entire catalog.
   - **Settings**: Customize your studio identity (Artist Name, Site Title, Tagline), slideshow timing, default catalog sort order, background/accent color schemes, or update your passphrase.

---

## Public Gallery Features

- **Home (`/`)**: Dynamic randomized hero slideshow with smooth crossfades and previous/next slide history, followed by curated gallery cards.
- **Galleries (`/galleries`)**: Curated collections and albums. Each gallery displays a representative photo framed full-size.
- **Explore (`/explore`)**: Instant live search by title, location, camera, or keyword, alongside category pills and year timeline filters.
- **Map (`/map`)**: Global interactive map with dark mode, topographic, and satellite views.
- **Photo Viewer (`/photo/[id]`)**: Fullscreen-capable display with dark matting, deep exposure technical drawer, and companion shooting location map.
- **About (`/about`)**: Artist statement, biography, and camera/film gear list.

---

## Local Development (Optional)

If you wish to test or develop Lumenist locally on your personal machine before deploying to your server:

```bash
# Clone and install dependencies
git clone https://github.com/ketchemr/lumenist.git
cd lumenist
npm install

# Setup local credentials
cp .env.example .env.local

# Link sample photos and import
ln -s /path/to/photos public/photos
npm run import:all

# Run local dev server with hot reloading
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public site, and [http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard.

---

## Project Structure

```
lumenist/
├── data/                      # Persistent catalog (git-ignored)
│   ├── photos.json            # Unified photo metadata archive
│   ├── settings.json          # Studio and theme settings
│   └── auth.json              # Hashed admin credentials
├── public/
│   ├── photos/                # Symlink or folder for full-res master photos
│   └── favicon.ico            # Site favicon
├── scripts/
│   ├── import-photos.ts       # CLI ingestion for images and .txt metadata
│   ├── precache-thumbnails.js # Pre-caches WebP thumbnails across widths
│   └── test-parser.ts         # Test suite for metadata companion parser
├── src/
│   ├── app/                   # Next.js 15 App Router
│   │   ├── admin/             # Web Admin suite (/admin, /admin/upload)
│   │   ├── api/               # API routes (auth, metadata, upload, thumbnails)
│   │   ├── galleries/         # Gallery and category exhibition views
│   │   ├── photo/[id]/        # Individual photo showcase & technical drawer
│   │   ├── explore/           # Search, tag filters, and year timeline
│   │   ├── map/               # Global photography map
│   │   └── about/             # Artist statement & bio
│   ├── components/            # Reusable UI components (Leaflet maps, Hero, etc.)
│   ├── config/                # Site defaults and navigation configuration
│   ├── lib/                   # Photos parser, auth helpers, settings engine
│   └── types/                 # TypeScript interfaces (Photo, Settings, EXIF)
└── tailwind.config.ts         # Tailwind design system with semantic CSS variables
```

---

## Photo Metadata Specification

Every photograph in Lumenist adheres to a strict, typed schema. Lumenist automatically parses **EXIF, XMP, GPS, and image headers** during ingestion and web upload, merging technical camera data with your curated narratives.

```typescript
export interface Photo {
  // Identity & Story (Curated / Companion Metadata)
  photoID: string;              // e.g. "d20261027151131" (or auto-generated from EXIF timestamp)
  title: string;                // e.g. "Mingus Mill in Autumn" (Curated)
  description: string;          // Rich narrative and history (Curated)
  availability: string;         // e.g. "Available for Order", "Private Collection" (Curated)
  
  // Organization (Curated)
  categories: string[];         // ["Fall Color", "Historic Structures", "Water"]
  tags: string[];               // ["Mingus Mill", "Great Smoky Mountains", "Pioneer"]
  
  // Chronology (Derived from EXIF DateTimeOriginal / CreateDate)
  dateTaken: string;            // ISO formatted timestamp (e.g. "2026-10-27T15:11:31")
  year: number;                 // e.g. 2026
  
  // Camera & Optics (Derived from EXIF / XMP)
  camera: string;               // e.g. "Sony ILCE-7RM4" (EXIF Make + Model)
  lens: string;                 // e.g. "Sony FE 24-105mm F4 G OSS" (EXIF LensModel / Lens)
  focalLength: string;          // e.g. "24 mm" (EXIF FocalLength)
  shutterspeed: string;         // e.g. "1/15 s" or "2.5 s" (EXIF ExposureTime)
  aperture: string;             // e.g. "f/14" (EXIF FNumber)
  iso: string;                  // e.g. "100" (EXIF ISO / PhotographicSensitivity)
  exposureCompensation: string; // e.g. "0 EV", "+0.7 EV" (EXIF ExposureCompensation)
  whiteBalance: string;         // e.g. "5200K +4" or "Auto" (XMP Temperature + Tint / WhiteBalance)
  toneCompensation: string;     // e.g. "Auto" (EXIF / XMP tone curve)

  // Physical Craft & Support (Curated / Companion Metadata)
  film: string;                 // "Digital" (auto-detected from EXIF) or film stock ("Fuji Velvia 50", "Kodak Tri-X")
  tripod: string;               // e.g. "Manfrotto 055 Carbon Fiber, Arca-Swiss Monoball" (Not recorded in EXIF)

  // Geospatial Coordinates (Derived from EXIF GPS or picked via Admin Map)
  latitude: number | null;      // Decimal latitude (e.g. 35.5312)
  longitude: number | null;     // Decimal longitude (e.g. -83.3094)

  // Dimensions & Aspect Ratio (Derived from Image File Headers for Zero-CLS Layout)
  width: number;                // Pixel width (e.g. 1920)
  height: number;               // Pixel height (e.g. 1080)
  aspectRatio: number;          // e.g. 1.777
  orientation: "horizontal" | "vertical" | "square";

  // File Paths (System Managed)
  imageDesktop: string;         // Relative URL to master display image (/photos/...)
  imageThumb: string;           // On-demand thumbnail endpoint (/api/thumbnail?src=...)
}
```

### EXIF-Derived vs. Curated Breakdown

| Field | Source | Details |
| :--- | :--- | :--- |
| **Camera** | **EXIF** | Read from `Make` and `Model` tags, normalized (e.g., removing redundant vendor prefixes). |
| **Lens** | **EXIF** | Read from `LensModel` or `Lens` EXIF/XMP tags. |
| **Focal Length** | **EXIF** | Read from `FocalLength` tag in millimeters. |
| **Shutter Speed** | **EXIF** | Read from `ExposureTime`, formatted as fractional seconds (e.g. `1/125 s`) or whole seconds (e.g. `2.5 s`). |
| **Aperture** | **EXIF** | Read from `FNumber` tag (e.g. `f/8`, `f/11`). |
| **ISO** | **EXIF** | Read from `ISO` or `PhotographicSensitivity`. |
| **Exposure Bias** | **EXIF** | Read from `ExposureCompensation` (e.g. `0 EV`, `+0.7 EV`, `-1.0 EV`). |
| **White Balance** | **EXIF / XMP** | Kelvin color temperature and tint (e.g. `5200K +4`) when present in camera maker-notes/XMP, falling back to standard EXIF white balance setting (`Auto` / `Daylight`). |
| **Date & Time** | **EXIF** | Extracted from `DateTimeOriginal` or `CreateDate`. Also used to automatically generate the photo ID (`dYYYYMMDDHHMMSS`) if no manual ID is specified. |
| **GPS Coordinates**| **EXIF / Map** | Read from GPS IFD tags (`GPSLatitude`, `GPSLongitude`). Can also be assigned or refined using the visual map pin picker in `/admin`. |
| **Geometry** | **Image Headers** | Exact pixel width, height, aspect ratio, and orientation calculated directly from the image file to reserve layout space and prevent Cumulative Layout Shift (CLS). |
| **Capture Medium** | **EXIF / Curated** | Defaulted to `"Digital"` when digital camera EXIF is detected. For analog film scans, can be set to the specific film emulsion (e.g. `Fuji Velvia 50`, `Kodak Tri-X 400`, `Provia 100F`). |
| **Tripod & Support**| **Curated** | Camera EXIF does not record support gear. Configured via `.txt` companion files or selected from the quick-pick gear dropdown in `/admin`. |
| **Narrative & Title**| **Curated** | Title, multi-paragraph story, gallery categories, keywords/tags, and order availability are managed via companion `.txt` metadata files or the `/admin` editor. |

---

## License

This project is licensed under the **MIT License** — you are free to self-host, customize, and extend it for your own photography portfolio.
