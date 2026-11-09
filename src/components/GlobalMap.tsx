"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { Photo } from "@/types/photo";
import { Layers, ExternalLink } from "lucide-react";
import Link from "next/link";

interface GlobalMapProps {
  photos: Photo[];
  categories: string[];
}

type LayerMode = "dark" | "topo" | "satellite";

const LAYER_CONFIGS: Record<
  LayerMode,
  { name: string; url: string; options: any }
> = {
  dark: {
    name: "Dark",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      className: "map-tiles-dark",
      maxZoom: 19,
    },
  },
  topo: {
    name: "Topo",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution:
        'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Topo',
      maxZoom: 18,
    },
  },
  satellite: {
    name: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    options: {
      attribution:
        'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Satellite',
      maxZoom: 18,
    },
  },
};

export function GlobalMap({ photos, categories }: GlobalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<LayerMode>("dark");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  // Filter photos with valid coordinates and matching category
  const geotaggedPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (!p.location?.latitude || !p.location?.longitude) return false;
      if (selectedCategory === "All") return true;
      return p.categories.some(
        (c) => c.toLowerCase() === selectedCategory.toLowerCase()
      );
    });
  }, [photos, selectedCategory]);

  // Initialize Map dynamically on client
  useEffect(() => {
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      leafletLibRef.current = L;

      // Centered on North America by default
      const map = L.map(mapContainerRef.current, {
        center: [39.8283, -98.5795],
        zoom: 4,
        zoomControl: true,
        maxZoom: 18,
        minZoom: 2,
      });

      mapInstanceRef.current = map;

      // Initial clean tile layer
      const config = LAYER_CONFIGS[activeLayer];
      const initialLayer = L.tileLayer(config.url, config.options).addTo(map);
      tileLayerRef.current = initialLayer;

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;

      renderMarkers(L, map, layerGroup, geotaggedPhotos);

      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          map.invalidateSize();
        }
      }, 250);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        tileLayerRef.current = null;
        leafletLibRef.current = null;
      }
    };
  }, []);

  const switchLayer = (newMode: LayerMode) => {
    setActiveLayer(newMode);
    if (!mapInstanceRef.current || !leafletLibRef.current) return;

    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = LAYER_CONFIGS[newMode];
    const newLayer = L.tileLayer(config.url, config.options).addTo(map);
    newLayer.bringToBack();
    tileLayerRef.current = newLayer;
  };

  const renderMarkers = (L: any, map: any, layerGroup: any, photoList: Photo[]) => {
    layerGroup.clearLayers();
    if (photoList.length === 0) return;

    const bounds = L.latLngBounds([]);

    const createIcon = () =>
      L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background-color: #f59e0b;
            border: 2px solid #000;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            cursor: pointer;
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -22],
      });

    photoList.forEach((photo) => {
      const lat = photo.location!.latitude;
      const lon = photo.location!.longitude;
      bounds.extend([lat, lon]);

      const marker = L.marker([lat, lon], { icon: createIcon() });

      const popupHtml = `
        <div style="color: #fff; background: #111; padding: 2px; font-family: inherit; width: 200px;">
          <a href="/photo/${photo.photoID}" style="display: block; text-decoration: none; color: inherit;">
            <div style="width: 100%; height: 110px; overflow: hidden; border-radius: 2px; margin-bottom: 6px; background: #000;">
              <img src="/api/thumbnail?src=${encodeURIComponent(photo.imageDesktop)}&w=400" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="font-weight: 600; font-size: 13px; line-height: 1.2; margin-bottom: 4px; color: #fff;">
              ${photo.title}
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 4px;">
              ${photo.dateTaken.year}-${String(photo.dateTaken.month).padStart(2, "0")}-${String(photo.dateTaken.day).padStart(2, "0")}
            </div>
            <div style="color: #9999ff; font-size: 11px; font-weight: 500;">
              View Photograph →
            </div>
          </a>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: "dark-map-popup",
        maxWidth: 220,
      });

      marker.on("click", () => {
        setSelectedPhoto(photo);
      });

      layerGroup.addLayer(marker);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  };

  // Re-render markers when filter changes
  useEffect(() => {
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (L && map && layerGroup) {
      renderMarkers(L, map, layerGroup, geotaggedPhotos);
    }
  }, [geotaggedPhotos]);

  return (
    <div className="space-y-4">
      {/* Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-surface-border p-3 rounded-sm">
        <div className="flex items-center space-x-2 text-xs text-muted">
          <Layers className="w-4 h-4 text-accent" />
          <span className="font-medium text-white">Filter by Category:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
              selectedCategory === "All"
                ? "bg-accent text-black font-semibold"
                : "bg-surface-hover text-gray-300 hover:text-white"
            }`}
          >
            All Locations ({photos.filter((p) => p.location).length})
          </button>
          {categories.map((cat) => {
            const count = photos.filter(
              (p) =>
                p.location &&
                p.categories.some((c) => c.toLowerCase() === cat.toLowerCase())
            ).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-accent text-black font-semibold"
                    : "bg-surface-hover text-gray-300 hover:text-white"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Map View */}
      <div className="relative rounded-sm overflow-hidden border border-surface-border bg-black h-[72vh] min-h-[480px]">
        {/* Basemap Switcher Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center bg-black/85 backdrop-blur-md border border-surface-border rounded-sm overflow-hidden text-[11px] shadow-lg">
          <button
            type="button"
            onClick={() => switchLayer("dark")}
            className={`px-3 py-1.5 transition-colors ${
              activeLayer === "dark"
                ? "bg-accent text-black font-semibold"
                : "text-gray-300 hover:text-white"
            }`}
            title="OpenStreetMap Dark Mode (No watermarks)"
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => switchLayer("topo")}
            className={`px-3 py-1.5 border-l border-surface-border transition-colors ${
              activeLayer === "topo"
                ? "bg-accent text-black font-semibold"
                : "text-gray-300 hover:text-white"
            }`}
            title="Esri Topographic & Mountain Relief"
          >
            Topo
          </button>
          <button
            type="button"
            onClick={() => switchLayer("satellite")}
            className={`px-3 py-1.5 border-l border-surface-border transition-colors ${
              activeLayer === "satellite"
                ? "bg-accent text-black font-semibold"
                : "text-gray-300 hover:text-white"
            }`}
            title="Esri Aerial Satellite Imagery"
          >
            Satellite
          </button>
        </div>

        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Selected Photo Floating Card */}
        {selectedPhoto && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-black/90 backdrop-blur border border-surface-border rounded-sm p-3 max-w-sm flex items-center space-x-3 shadow-2xl">
            <img
              src={`/api/thumbnail?src=${encodeURIComponent(selectedPhoto.imageDesktop)}&w=200`}
              alt={selectedPhoto.title}
              className="w-16 h-16 object-cover rounded-sm border border-surface-border flex-shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <h4 className="text-sm font-medium text-white truncate">
                {selectedPhoto.title}
              </h4>
              <p className="text-xs text-muted">
                {selectedPhoto.dateTaken.year}-{String(selectedPhoto.dateTaken.month).padStart(2, "0")}-{String(selectedPhoto.dateTaken.day).padStart(2, "0")} · {selectedPhoto.camera}
              </p>
              <div className="flex items-center space-x-3 pt-0.5 text-xs">
                <Link
                  href={`/photo/${selectedPhoto.photoID}`}
                  className="text-accent hover:underline flex items-center space-x-1"
                >
                  <span>Exhibition View</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-muted hover:text-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
