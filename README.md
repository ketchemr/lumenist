# Lumenist

> **Lumenist** is an open-source, self-hosted photography gallery and CMS designed specifically for fine-art, landscape, and nature photographers.

Named after the 19th-century **Luminism** art movement—which celebrated the poetic, atmospheric rendering of natural light and landscape—Lumenist is built as a modern, high-performance alternative to legacy platforms like Piwigo and walled-garden portfolio builders.

---

## Why Lumenist?

Most photo gallery systems treat images like generic social media uploads: stripping out critical metadata, forcing rigid forum-style layouts, or burying exposure details.

Lumenist is built with deep respect for the photographic craft:

* **Dark, Distraction-Free Aesthetic**: Clean, minimalist presentation that puts high-resolution photography front and center.
* **First-Class Photographic Metadata**: Native support for fields photographers actually care about:
  * **Film stock** (analog film support: Velvia, Tri-X, Provia, Portra, vs. Digital)
  * **Tripod & support gear** (ball heads, carbon fiber legs)
  * **White balance with color tint** (e.g. `5400K +6`)
  * **Exposure pyramid**: Focal length, aperture, shutter speed, ISO, exposure compensation
  * **Geographic coordinates**: Latitude & longitude for spatial mapping and location clustering
* **Zero Cumulative Layout Shift**: Stores exact dimensions and aspect ratios for smooth, instant page rendering.
* **Modern Ingestion & Uploads**: Web-based upload UI alongside scriptable CLI/folder ingestion.
* **Self-Hostable Anywhere**: Single-container Docker deployment powered by embedded SQLite—no complex database servers required.

---

## Metadata Specification

Lumenist uses a structured data contract for every photo:

```typescript
export interface Photo {
  id: string;                   // Unique identifier (e.g. "d20261027151131")
  title: string;                // "Mingus Mill"
  description: string;          // Rich narrative and history
  availability: string;         // "Available for Order", "Private Collection", etc.
  
  categories: string[];         // ["Fall Color", "Trees"]
  keywords: string[];           // ["Mingus Mill", "Great Smoky Mountains", ...]
  
  dateTaken: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    isoString?: string;
  };

  // Optical & Gear Details
  film: string;                 // "Digital" or film stock (e.g. "Fuji Velvia 50")
  camera: string;               // e.g. "Sony ILCE-7RM4"
  lens: string;                 // e.g. "Sony FE 4/24-105 G OSS"
  focalLength: string;          // e.g. "24 mm"
  shutterspeed: string;         // e.g. "1/15"
  aperture: string;             // e.g. "f14"
  sensitivity: string;          // e.g. "ISO 100"
  exposureCompensation: string; // e.g. "0 Ev"
  whiteBalance: string;         // e.g. "4900 +12" (Kelvin + Tint)
  toneCompensation: string;     // e.g. "Auto"
  hueAdjustment: number;        // e.g. 0
  tripod?: string;              // e.g. "Manfrotto Befree GT XPRO Carbon, 496 ball head"

  // Geospatial
  location?: {
    latitude: number;
    longitude: number;
  };

  // Geometry
  size: {
    width: number;
    height: number;
    aspectRatio: number;
    orientation: 'horizontal' | 'vertical' | 'square';
  };
}
```

---

## Architecture

* **Framework**: [Next.js](https://nextjs.org/) (App Router, React Server Components)
* **Styling**: [Tailwind CSS](https://tailwindcss.com/)
* **Database**: Embedded [SQLite](https://sqlite.org/) via [Prisma](https://www.prisma.io/) or [Drizzle ORM](https://orm.drizzle.team/)
* **Image Processing**: [Sharp](https://sharp.pixelplumbing.com/) (AVIF / WebP generation, thumbnailing)
* **Deployment**: Standalone Node / Docker Compose

---

## Roadmap

- [ ] **Phase 1**: Core schema & lossless parser for `.txt` companion files + image manifest generator
- [ ] **Phase 2**: High-performance public gallery (masonry, lightbox, EXIF drawer, categories)
- [ ] **Phase 3**: Web-based admin dashboard & drag-and-drop uploader with background image pipeline
- [ ] **Phase 4**: Interactive location map (Leaflet / OpenStreetMap)
- [ ] **Phase 5**: Docker Compose packaging & one-click deployment for the open-source community
