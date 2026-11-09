# Lumenist

> **Lumenist** is an open-source, self-hosted fine-art photography gallery and modern CMS designed specifically for landscape, nature, and documentary photographers.

Named after the 19th-century **Luminism** art movement—which celebrated the poetic, atmospheric rendering of natural light and landscape—Lumenist is built as a high-performance, distraction-free alternative to legacy platforms like Piwigo and walled-garden portfolio builders.

---

## Key Features

### 🖼️ Exhibition-Grade Aesthetic & Dynamic Color Engine
- **Dark Exhibition Backgrounds**: Pre-configured with Pure OLED Black (`#000000`), Deep Obsidian, Midnight Slate, Warm Espresso, and Charcoal to maximize human eye dynamic range and eliminate ambient glare.
- **Studio Light Themes**: Built-in Clean Studio White, Warm Gallery Parchment, and Soft Silver modes.
- **Dynamic Contrast Intelligence**: Automatic contrast inversion ensures buttons, badges, navigation headers, and metadata cards remain razor-sharp regardless of background or accent color selections.
- **6 Accent Presets + Hex Picker**: Amber Gold, Pure Silver, Pacific Cyan, Cascade Emerald, Alpine Crimson, and Amethyst Violet.

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

## Quick Start & Installation

### Prerequisites
- **Node.js** v18.18+ or v20+ (Node.js 22 LTS recommended)
- **npm** v9+

### 1. Clone the Repository
```bash
git clone https://github.com/ketchemr/lumenist.git
cd lumenist
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create your local environment configuration:
```bash
cp .env.example .env.local
```

Edit `.env.local` to define your administrative credentials:
```env
# Administrative security
ADMIN_PASSWORD=your-secure-admin-passphrase
ADMIN_SECRET=your-random-32-char-secret-key
```

### 4. Link or Add Your Photos
Lumenist serves high-resolution photos through `public/photos`. You can symlink an existing local photo directory or place images directly:

```bash
# Example: Symlinking an external photo drive or Google Drive folder
ln -s "/path/to/your/photos" public/photos
```

Organize your photo files by year or category (e.g. `public/photos/2026/my_photo.jpg`).

### 5. Ingest Photo Metadata
If you have companion `.txt` metadata files (Piwigo/IPTC format) or wish to scan existing image files for EXIF:
```bash
npm run import:all
```
This parses image dimensions, dates, camera data, descriptions, categories, and tags, writing the unified catalog to `data/photos.json`.

*(Optional)* Pre-cache WebP thumbnails for instant gallery navigation:
```bash
npm run thumbnails:precache
```

### 6. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Using Lumenist

### Public Gallery Navigation
- **Home (`/`)**: Dynamic randomized hero slideshow with smooth crossfades and previous/next slide history, followed by curated gallery cards.
- **Galleries (`/galleries`)**: Curated collections and albums. Each gallery displays a representative photo framed full-size.
- **Explore (`/explore`)**: Instant live search by title, location, camera, or keyword, alongside category pills and year timeline filters.
- **Map (`/map`)**: Global interactive map with dark mode, topographic, and satellite views.
- **Photo Viewer (`/photo/[id]`)**: Fullscreen-capable display with dark matting, deep exposure technical drawer, and companion shooting location map.
- **About (`/about`)**: Artist statement, biography, and camera/film gear list.

### Accessing the Web Admin
1. Navigate to [`http://localhost:3000/admin`](http://localhost:3000/admin) (or `/admin` on your production domain).
2. Enter your `ADMIN_PASSWORD`.
3. Use the tabs:
   - **Upload**: Publish new photographs with automated EXIF extraction and interactive map pinning.
   - **Manage**: Search, edit metadata, delete, or perform bulk batch updates across your catalog.
   - **Settings**: Adjust studio title, tagline, slideshow interval, default catalog sort order, background/accent color schemes, or change your passphrase.

---

## Production Deployment

### Build for Production
```bash
npm run build
```

### Running with PM2 (Recommended for Ubuntu / Debian / VPS)
```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Start Lumenist with PM2
pm2 start npm --name "lumenist" -- start

# Configure PM2 to start on system boot
pm2 startup
pm2 save
```

### Nginx Reverse Proxy Configuration
Example Nginx server block with SSL and large photo upload support:

```nginx
server {
    server_name rrkphoto.com www.rrkphoto.com;

    # Allow high-resolution image uploads up to 100MB
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

    # Cache pre-generated thumbnails aggressively
    location /.thumbnails/ {
        alias /var/www/lumenist/.thumbnails/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    listen 443 ssl http2;
    # SSL certificates managed by certbot or Cloudflare
}
```

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

Every photograph in Lumenist adheres to a strict, typed schema:

```typescript
export interface Photo {
  photoID: string;              // e.g. "d20261027151131"
  title: string;                // e.g. "Mingus Mill in Autumn"
  description: string;          // Rich narrative and history
  availability: string;         // "Available for Order", "Private Collection", etc.
  
  categories: string[];         // ["Fall Color", "Historic Structures", "Water"]
  tags: string[];               // ["Mingus Mill", "Great Smoky Mountains", "Pioneer"]
  
  dateTaken: string;            // ISO formatted timestamp
  year: number;                 // e.g. 2026
  
  // Optical & Gear Details
  film: string;                 // "Digital" or film stock ("Fuji Velvia 50", "Kodak Tri-X")
  camera: string;               // e.g. "Sony ILCE-7RM4"
  lens: string;                 // e.g. "Sony FE 24-105mm F4 G OSS"
  focalLength: string;          // e.g. "24 mm"
  shutterspeed: string;         // e.g. "1/15 s"
  aperture: string;             // e.g. "f/14"
  iso: string;                  // e.g. "100"
  exposureCompensation: string; // e.g. "0 EV"
  whiteBalance: string;         // e.g. "5200K +4" (Kelvin + Tint)
  toneCompensation: string;     // e.g. "Auto"
  tripod: string;               // e.g. "Manfrotto 055 Carbon Fiber, Arca-Swiss Monoball"

  // Geospatial Coordinates
  latitude: number | null;      // e.g. 35.5312
  longitude: number | null;     // e.g. -83.3094

  // Dimensions & Aspect Ratio (Zero-CLS)
  width: number;                // e.g. 1920
  height: number;               // e.g. 1080
  aspectRatio: number;          // e.g. 1.777
  orientation: "horizontal" | "vertical" | "square";

  // File Paths
  imageDesktop: string;         // Path to display image (/photos/...)
  imageThumb: string;           // Path or thumbnail route
}
```

---

## License

This project is licensed under the **MIT License** — you are free to self-host, customize, and extend it for your own photography portfolio.
