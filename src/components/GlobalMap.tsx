"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import { Photo } from "@/types/photo";
import {
  Layers,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
} from "lucide-react";
import Link from "next/link";

interface GlobalMapProps {
  photos: Photo[];
  categories: string[];
}

interface LocationCluster {
  key: string;
  latitude: number;
  longitude: number;
  photos: Photo[];
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
  const [selectedCluster, setSelectedCluster] = useState<LocationCluster | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);

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

  // Group photos into location clusters (~11m precision or exact)
  const clusters = useMemo(() => {
    const map = new Map<string, LocationCluster>();
    for (const photo of geotaggedPhotos) {
      if (!photo.location?.latitude || !photo.location?.longitude) continue;
      const key = `${photo.location.latitude.toFixed(4)},${photo.location.longitude.toFixed(4)}`;
      const existing = map.get(key);
      if (existing) {
        existing.photos.push(photo);
      } else {
        map.set(key, {
          key,
          latitude: photo.location.latitude,
          longitude: photo.location.longitude,
          photos: [photo],
        });
      }
    }
    return Array.from(map.values());
  }, [geotaggedPhotos]);

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
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Initial clean tile layer
      const config = LAYER_CONFIGS[activeLayer];
      const initialLayer = L.tileLayer(config.url, config.options).addTo(map);
      tileLayerRef.current = initialLayer;

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;

      renderClusterMarkers(L, map, layerGroup, clusters);

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

  const renderClusterMarkers = (
    L: any,
    map: any,
    layerGroup: any,
    clusterList: LocationCluster[]
  ) => {
    layerGroup.clearLayers();
    if (clusterList.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Icon generator: Single Pin vs Multi-Photo Badge
    const createMarkerIcon = (count: number) => {
      if (count === 1) {
        return L.divIcon({
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
      }

      // Multi-photo cluster badge pin
      return L.divIcon({
        className: "custom-cluster-badge",
        html: `
          <div style="
            min-width: 26px;
            height: 26px;
            padding: 0 6px;
            background-color: #f59e0b;
            color: #000;
            font-weight: 700;
            font-size: 11px;
            border: 2px solid #000;
            border-radius: 13px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: monospace;
            cursor: pointer;
          ">
            ${count}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -15],
      });
    };

    clusterList.forEach((cluster) => {
      bounds.extend([cluster.latitude, cluster.longitude]);

      const marker = L.marker([cluster.latitude, cluster.longitude], {
        icon: createMarkerIcon(cluster.photos.length),
      });

      // Build popup content
      let popupHtml = "";
      if (cluster.photos.length === 1) {
        const photo = cluster.photos[0];
        popupHtml = `
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
      } else {
        popupHtml = `
          <div style="color: #fff; background: #111; padding: 4px; font-family: inherit; width: 230px;">
            <div style="font-weight: 600; font-size: 12px; color: #f59e0b; margin-bottom: 6px;">
              📍 ${cluster.photos.length} Photographs at this site
            </div>
            <div style="display: grid; grid-template-columns: repeat(${Math.min(cluster.photos.length, 3)}, 1fr); gap: 4px; margin-bottom: 6px;">
              ${cluster.photos
                .slice(0, 3)
                .map(
                  (p) => `
                <a href="/photo/${p.photoID}" style="display: block; height: 52px; border-radius: 2px; overflow: hidden; background: #000; border: 1px solid #333;">
                  <img src="/api/thumbnail?src=${encodeURIComponent(p.imageDesktop)}&w=150" style="width: 100%; height: 100%; object-fit: cover;" title="${p.title}" />
                </a>
              `
                )
                .join("")}
            </div>
            <div style="font-size: 12px; color: #fff; font-weight: 500; truncate;">
              ${cluster.photos[0].title}
            </div>
            <div style="font-size: 11px; color: #9ca3af;">
              and ${cluster.photos.length - 1} more in this location
            </div>
            <div style="font-size: 11px; color: #9999ff; margin-top: 6px; font-weight: 500;">
              Click pin to browse collection below ↓
            </div>
          </div>
        `;
      }

      marker.bindPopup(popupHtml, {
        className: "dark-map-popup",
        maxWidth: 250,
      });

      marker.on("click", () => {
        setSelectedCluster(cluster);
        setActivePhotoIndex(0);
      });

      layerGroup.addLayer(marker);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  };

  // Re-render markers when filtered clusters change
  useEffect(() => {
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (L && map && layerGroup) {
      renderClusterMarkers(L, map, layerGroup, clusters);
    }
  }, [clusters]);

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
            onClick={() => {
              setSelectedCategory("All");
              setSelectedCluster(null);
            }}
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
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedCluster(null);
                }}
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

        {/* Selected Location / Multi-Photo Showcase Card */}
        {selectedCluster && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xl z-[1000] bg-black/95 backdrop-blur-md border border-surface-border rounded-sm p-4 shadow-2xl space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-2">
              <div className="flex items-center space-x-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span className="font-semibold text-white">
                  {selectedCluster.photos.length === 1
                    ? "Site Photograph"
                    : `Site Collection (${selectedCluster.photos.length} Photographs)`}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                {selectedCluster.photos.length > 1 && (
                  <div className="flex items-center space-x-1.5 text-gray-400 font-mono text-[11px]">
                    <span>
                      {activePhotoIndex + 1} of {selectedCluster.photos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex(
                          (prev) =>
                            (prev - 1 + selectedCluster.photos.length) %
                            selectedCluster.photos.length
                        )
                      }
                      className="p-1 hover:bg-surface rounded text-white transition-colors cursor-pointer"
                      title="Previous photo at this site"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActivePhotoIndex(
                          (prev) => (prev + 1) % selectedCluster.photos.length
                        )
                      }
                      className="p-1 hover:bg-surface rounded text-white transition-colors cursor-pointer"
                      title="Next photo at this site"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedCluster(null)}
                  className="text-muted hover:text-gray-200 p-0.5 cursor-pointer"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Currently Active Photo at This Site */}
            {(() => {
              const currentPhoto =
                selectedCluster.photos[activePhotoIndex] ||
                selectedCluster.photos[0];
              return (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3.5">
                    <Link
                      href={`/photo/${currentPhoto.photoID}`}
                      className="group block flex-shrink-0 relative overflow-hidden rounded-sm border border-surface-border hover:border-accent transition-colors"
                    >
                      <img
                        src={`/api/thumbnail?src=${encodeURIComponent(
                          currentPhoto.imageDesktop
                        )}&w=300`}
                        alt={currentPhoto.title}
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h4 className="text-sm font-medium text-white truncate">
                        {currentPhoto.title}
                      </h4>
                      <p className="text-xs text-muted font-mono">
                        {currentPhoto.dateTaken.year}-
                        {String(currentPhoto.dateTaken.month).padStart(2, "0")}-
                        {String(currentPhoto.dateTaken.day).padStart(2, "0")} ·{" "}
                        {currentPhoto.camera}
                      </p>
                      {currentPhoto.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                          {currentPhoto.description}
                        </p>
                      )}
                      <div className="pt-1">
                        <Link
                          href={`/photo/${currentPhoto.photoID}`}
                          className="inline-flex items-center space-x-1.5 text-xs text-accent hover:underline font-medium"
                        >
                          <span>Exhibition View</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail ribbon for multi-photo sites */}
                  {selectedCluster.photos.length > 1 && (
                    <div className="pt-2 border-t border-surface-border/40">
                      <div className="text-[11px] text-gray-400 mb-1.5 font-medium">
                        All photos at this location ({selectedCluster.photos.length}):
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                        {selectedCluster.photos.map((p, idx) => (
                          <button
                            key={p.photoID}
                            type="button"
                            onClick={() => setActivePhotoIndex(idx)}
                            className={`relative flex-shrink-0 w-12 h-12 rounded-sm overflow-hidden border transition-all cursor-pointer ${
                              idx === activePhotoIndex
                                ? "border-accent ring-2 ring-accent/60 scale-105"
                                : "border-surface-border opacity-70 hover:opacity-100"
                            }`}
                            title={p.title}
                          >
                            <img
                              src={`/api/thumbnail?src=${encodeURIComponent(
                                p.imageDesktop
                              )}&w=150`}
                              alt={p.title}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="text-[10px] text-gray-500 text-right font-mono pr-1">
        Map data &copy; OpenStreetMap &copy; Esri
      </div>
    </div>
  );
}
