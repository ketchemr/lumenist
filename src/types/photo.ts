export interface DateTaken {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  iso?: string;
}

export interface PhotoLocation {
  latitude: number;
  longitude: number;
}

export interface PhotoSize {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'horizontal' | 'vertical' | 'square';
}

export interface Photo {
  // Identity & Story
  photoID: string;              // e.g., "d20261027151131"
  title: string;                // "Mingus Mill"
  description: string;          // Rich narrative
  availability: string;         // e.g. "Available for Order"
  
  // Organization
  categories: string[];         // ["Fall Color", "Trees"]
  keywords: string[];           // ["Mingus Mill", "Great Smoky Mountains", ...]
  
  // Chronology
  dateTaken: DateTaken;
  createdTimestamp?: string;    // "20261106214010"
  updatedAt?: number;           // File modification timestamp (Unix seconds)
  
  // Capture & Optics
  film: string;                 // "Digital", "Fuji Velvia 50", "Kodak Tri-X", etc.
  camera: string;               // e.g. "Sony ILCE-7RM4"
  lens: string;                 // e.g. "Sony FE 4/24-105 G OSS"
  focalLength: string;          // "24 mm"
  shutterspeed: string;         // "1/15" or "1.3"
  aperture: string;             // "f14"
  sensitivity: string;          // "ISO 100"
  exposureCompensation: string; // "0 Ev"
  whiteBalance: string;         // "4900 +12"
  toneCompensation: string;     // "Auto"
  hueAdjustment: number;        // 0
  tripod?: string;              // "Manfrotto Befree GT XPRO Carbon, 496 ball head"
  
  // Geospatial
  location?: PhotoLocation;
  
  // Geometry
  size?: PhotoSize;
  
  // Image Paths / URLs
  imageDesktop: string;         // Path or URL to desktop-optimized display file
  imageThumbnail?: string;      // Thumbnail
  imageFullsize?: string;       // Master high-res
  
  // Raw / custom fields fallback
  rawFields?: Record<string, string>;
}

export interface SiteConfig {
  siteTitle: string;
  artistName: string;
  tagline: string;
  bio?: string;
  contactEmail?: string;
  copyrightText: string;
  theme: {
    accentColor: string;
    backgroundColor: string;
  };
  navigation: {
    label: string;
    href: string;
  }[];
}
