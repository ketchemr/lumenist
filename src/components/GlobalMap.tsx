"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { Photo } from "@/types/photo";
import {
  Layers,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  RotateCcw,
  Filter,
  ZoomIn,
  LassoSelect,
} from "lucide-react";
import Link from "next/link";

interface GlobalMapProps {
  photos: Photo[];
  categories?: string[];
  showCategoryFilter?: boolean;
  className?: string;
  heightClassName?: string;
  onFilterToCluster?: (photos: Photo[]) => void;
  filterByMapBounds?: boolean;
  onToggleFilterByMapBounds?: (enabled: boolean) => void;
  onVisiblePhotosChange?: (visiblePhotos: Photo[], zoom: number) => void;
  onLassoSelect?: (selectedPhotos: Photo[] | null) => void;
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

function isPhotoInBounds(bounds: any, lat: number, lng: number): boolean {
  if (!bounds) return false;
  if (bounds.contains([lat, lng])) return true;
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  if (lat < south || lat > north) return false;
  const west = bounds.getWest();
  const east = bounds.getEast();
  if (east - west >= 360) return true;
  let normLng = (((lng - west) % 360) + 360) % 360 + west;
  return normLng >= west && normLng <= east;
}

function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [xi, yi] = vs[i];
    const [xj, yj] = vs[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function GlobalMap({
  photos,
  categories = [],
  showCategoryFilter = false,
  className = "",
  heightClassName = "h-[72vh] min-h-[480px]",
  onFilterToCluster,
  filterByMapBounds = true,
  onToggleFilterByMapBounds,
  onVisiblePhotosChange,
  onLassoSelect,
}: GlobalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);
  const lassoLayerRef = useRef<any>(null);
  const activeLassoVerticesRef = useRef<[number, number][] | null>(null);
  const isLassoActiveRef = useRef<boolean>(false);
  const isDrawingRef = useRef<boolean>(false);
  const currentLassoPointsRef = useRef<any[]>([]);
  const currentPolygonLayerRef = useRef<any>(null);
  const onLassoSelectRef = useRef(onLassoSelect);

  const [activeLayer, setActiveLayer] = useState<LayerMode>("dark");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedCluster, setSelectedCluster] = useState<LocationCluster | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [mapZoom, setMapZoom] = useState<number>(4);
  const [visiblePhotosInView, setVisiblePhotosInView] = useState<Photo[]>(() =>
    photos.filter((p) => p.location?.latitude && p.location?.longitude)
  );

  const [isLassoActive, setIsLassoActive] = useState<boolean>(false);
  const [hasLassoShape, setHasLassoShape] = useState<boolean>(false);
  const [lassoCount, setLassoCount] = useState<number>(0);

  useEffect(() => {
    onLassoSelectRef.current = onLassoSelect;
  }, [onLassoSelect]);

  useEffect(() => {
    isLassoActiveRef.current = isLassoActive;
  }, [isLassoActive]);

  // Filter photos with valid coordinates and matching category
  const geotaggedPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (!p.location?.latitude || !p.location?.longitude) return false;
      if (!showCategoryFilter || selectedCategory === "All") return true;
      return p.categories.some(
        (c) => c.toLowerCase() === selectedCategory.toLowerCase()
      );
    });
  }, [photos, selectedCategory, showCategoryFilter]);

  const geotaggedPhotosRef = useRef<Photo[]>(geotaggedPhotos);
  const onVisiblePhotosChangeRef = useRef(onVisiblePhotosChange);

  useEffect(() => {
    geotaggedPhotosRef.current = geotaggedPhotos;
  }, [geotaggedPhotos]);

  useEffect(() => {
    onVisiblePhotosChangeRef.current = onVisiblePhotosChange;
  }, [onVisiblePhotosChange]);

  // Re-evaluate lasso selection if underlying photos change
  useEffect(() => {
    if (activeLassoVerticesRef.current) {
      const vs = activeLassoVerticesRef.current;
      const selected = geotaggedPhotos.filter((p) => {
        if (!p.location?.latitude || !p.location?.longitude) return false;
        return isPointInPolygon([p.location.latitude, p.location.longitude], vs);
      });
      setLassoCount(selected.length);
      onLassoSelectRef.current?.(selected);
    }
  }, [geotaggedPhotos]);

  const computeVisiblePhotos = useCallback(
    (currentMap: any, photoList: Photo[]) => {
      if (!currentMap) return [];
      const bounds = currentMap.getBounds();
      const zoom = currentMap.getZoom();
      setMapZoom(zoom);
      const visible = photoList.filter((p) => {
        if (!p.location?.latitude || !p.location?.longitude) return false;
        return isPhotoInBounds(bounds, p.location.latitude, p.location.longitude);
      });
      setVisiblePhotosInView(visible);
      onVisiblePhotosChangeRef.current?.(visible, zoom);
      return visible;
    },
    []
  );

  const clearLasso = useCallback(() => {
    if (lassoLayerRef.current) {
      lassoLayerRef.current.clearLayers();
    }
    activeLassoVerticesRef.current = null;
    currentPolygonLayerRef.current = null;
    currentLassoPointsRef.current = [];
    isDrawingRef.current = false;
    setHasLassoShape(false);
    setLassoCount(0);
    onLassoSelectRef.current?.(null);

    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      map.dragging.enable();
      if (map.touchZoom) map.touchZoom.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = "";
      }
    }
    setIsLassoActive(false);
  }, []);

  const toggleLassoMode = () => {
    if (isLassoActive) {
      setIsLassoActive(false);
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = "";
        }
      }
    } else {
      if (lassoLayerRef.current) {
        lassoLayerRef.current.clearLayers();
      }
      activeLassoVerticesRef.current = null;
      setHasLassoShape(false);
      setLassoCount(0);
      setSelectedCluster(null);

      setIsLassoActive(true);
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        map.dragging.disable();
        if (map.touchZoom) map.touchZoom.disable();
        if (map.doubleClickZoom) map.doubleClickZoom.disable();
        if (mapContainerRef.current) {
          mapContainerRef.current.style.cursor = "crosshair";
        }
      }
    }
  };

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
        scrollWheelZoom: false, // Prevent wheel zoom hijacking vertical page scrolling
        maxZoom: 18,
        minZoom: 2,
        attributionControl: false,
      });

      // Enable scroll wheel zoom only when user actively clicks into the map
      map.on("click", () => {
        map.scrollWheelZoom.enable();
      });

      const container = mapContainerRef.current;
      const handleMouseLeave = () => {
        map.scrollWheelZoom.disable();
      };
      container?.addEventListener("mouseleave", handleMouseLeave);

      mapInstanceRef.current = map;

      // Initial clean tile layer
      const config = LAYER_CONFIGS[activeLayer];
      const initialLayer = L.tileLayer(config.url, config.options).addTo(map);
      tileLayerRef.current = initialLayer;

      const layerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = layerGroup;

      const lassoLayer = L.layerGroup().addTo(map);
      lassoLayerRef.current = lassoLayer;

      const getLatLngFromEvent = (e: MouseEvent | TouchEvent) => {
        if (!container) return null;
        const rect = container.getBoundingClientRect();
        const clientX =
          "touches" in e && e.touches.length > 0
            ? e.touches[0].clientX
            : (e as MouseEvent).clientX;
        const clientY =
          "touches" in e && e.touches.length > 0
            ? e.touches[0].clientY
            : (e as MouseEvent).clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        return map.containerPointToLatLng([x, y]);
      };

      const handlePointerDown = (e: MouseEvent | TouchEvent) => {
        if (!isLassoActiveRef.current) return;
        const target = e.target as HTMLElement;
        if (
          target.closest("button") ||
          target.closest(".leaflet-control") ||
          target.closest(".dark-map-popup")
        ) {
          return;
        }

        e.preventDefault();
        isDrawingRef.current = true;
        currentLassoPointsRef.current = [];
        if (lassoLayerRef.current) {
          lassoLayerRef.current.clearLayers();
        }

        const latlng = getLatLngFromEvent(e);
        if (!latlng) return;
        currentLassoPointsRef.current.push(latlng);

        const poly = L.polygon([latlng], {
          color: "#f59e0b",
          weight: 2.5,
          opacity: 0.95,
          dashArray: "4, 4",
          fillColor: "#f59e0b",
          fillOpacity: 0.15,
        }).addTo(lassoLayerRef.current);
        currentPolygonLayerRef.current = poly;
      };

      const handlePointerMove = (e: MouseEvent | TouchEvent) => {
        if (!isLassoActiveRef.current || !isDrawingRef.current) return;
        e.preventDefault();

        const latlng = getLatLngFromEvent(e);
        if (!latlng) return;

        const pts = currentLassoPointsRef.current;
        if (pts.length > 0) {
          const lastPt = pts[pts.length - 1];
          const p1 = map.latLngToContainerPoint(lastPt);
          const p2 = map.latLngToContainerPoint(latlng);
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          if (dist < 4) return;
        }

        pts.push(latlng);
        if (currentPolygonLayerRef.current) {
          currentPolygonLayerRef.current.setLatLngs(pts);
        }
      };

      const handlePointerUp = () => {
        if (!isLassoActiveRef.current || !isDrawingRef.current) return;
        isDrawingRef.current = false;

        const pts = currentLassoPointsRef.current;
        if (pts.length >= 3) {
          if (currentPolygonLayerRef.current) {
            currentPolygonLayerRef.current.setStyle({
              dashArray: undefined,
              weight: 2,
              fillOpacity: 0.2,
            });
          }

          const vertices: [number, number][] = pts.map((pt: any) => [
            pt.lat,
            pt.lng,
          ]);
          activeLassoVerticesRef.current = vertices;

          const currentGeotagged = geotaggedPhotosRef.current;
          const selected = currentGeotagged.filter((p) => {
            if (!p.location?.latitude || !p.location?.longitude) return false;
            return isPointInPolygon(
              [p.location.latitude, p.location.longitude],
              vertices
            );
          });

          setHasLassoShape(true);
          setLassoCount(selected.length);
          onLassoSelectRef.current?.(selected);
        } else {
          if (lassoLayerRef.current) {
            lassoLayerRef.current.clearLayers();
          }
          activeLassoVerticesRef.current = null;
          setHasLassoShape(false);
          setLassoCount(0);
        }

        setIsLassoActive(false);
        map.dragging.enable();
        if (map.touchZoom) map.touchZoom.enable();
        if (map.doubleClickZoom) map.doubleClickZoom.enable();
        if (container) {
          container.style.cursor = "";
        }
      };

      container.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);

      container.addEventListener("touchstart", handlePointerDown, {
        passive: false,
      });
      window.addEventListener("touchmove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("touchend", handlePointerUp);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isLassoActiveRef.current) {
          clearLasso();
        }
      };
      window.addEventListener("keydown", handleKeyDown);

      const handleMoveEnd = () => {
        if (!isMounted || !mapInstanceRef.current) return;
        computeVisiblePhotos(mapInstanceRef.current, geotaggedPhotosRef.current);
      };

      map.on("moveend", handleMoveEnd);

      renderClusterMarkers(L, map, layerGroup, clusters);
      computeVisiblePhotos(map, geotaggedPhotosRef.current);

      let resizeObserver: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined" && container) {
        resizeObserver = new ResizeObserver(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(container);
      }

      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          map.invalidateSize();
        }
      }, 250);

      return () => {
        map.off("moveend", handleMoveEnd);
        container.removeEventListener("mousedown", handlePointerDown);
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);

        container.removeEventListener("touchstart", handlePointerDown);
        window.removeEventListener("touchmove", handlePointerMove);
        window.removeEventListener("touchend", handlePointerUp);
        window.removeEventListener("keydown", handleKeyDown);

        if (resizeObserver && container) {
          resizeObserver.disconnect();
        }
        if (container) {
          container.removeEventListener("mouseleave", handleMouseLeave);
        }
      };
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        lassoLayerRef.current = null;
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
          <div style="padding: 2px; font-family: inherit; width: 200px; color: inherit;">
            <a href="/photo/${photo.photoID}" style="display: block; text-decoration: none; color: inherit;">
              <div style="width: 100%; height: 110px; overflow: hidden; border-radius: 2px; margin-bottom: 6px; background: rgba(0,0,0,0.1);">
                <img src="/api/thumbnail?src=${encodeURIComponent(photo.imageDesktop)}&w=400" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div style="font-weight: 600; font-size: 13px; line-height: 1.2; margin-bottom: 4px; color: inherit;">
                ${photo.title}
              </div>
              <div style="font-size: 11px; opacity: 0.75; margin-bottom: 4px;">
                ${photo.dateTaken.year}-${String(photo.dateTaken.month).padStart(2, "0")}-${String(photo.dateTaken.day).padStart(2, "0")}
              </div>
              <div style="color: var(--accent, #f59e0b); font-size: 11px; font-weight: 500;">
                View Photograph →
              </div>
            </a>
          </div>
        `;
      } else {
        popupHtml = `
          <div style="padding: 4px; font-family: inherit; width: 230px; color: inherit;">
            <div style="font-weight: 600; font-size: 12px; color: var(--accent, #f59e0b); margin-bottom: 6px;">
              📍 ${cluster.photos.length} Photographs at this site
            </div>
            <div style="display: grid; grid-template-columns: repeat(${Math.min(cluster.photos.length, 3)}, 1fr); gap: 4px; margin-bottom: 6px;">
              ${cluster.photos
                .slice(0, 3)
                .map(
                  (p) => `
                <a href="/photo/${p.photoID}" style="display: block; height: 52px; border-radius: 2px; overflow: hidden; background: rgba(0,0,0,0.1); border: 1px solid var(--surface-border, #333);">
                  <img src="/api/thumbnail?src=${encodeURIComponent(p.imageDesktop)}&w=150" style="width: 100%; height: 100%; object-fit: cover;" title="${p.title}" />
                </a>
              `
                )
                .join("")}
            </div>
            <div style="font-size: 12px; font-weight: 500; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${cluster.photos[0].title}
            </div>
            <div style="font-size: 11px; opacity: 0.75;">
              and ${cluster.photos.length - 1} more in this location
            </div>
            <div style="font-size: 11px; color: var(--accent, #f59e0b); margin-top: 6px; font-weight: 500;">
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

    if (clusterList.length === 1) {
      map.setView([clusterList[0].latitude, clusterList[0].longitude], 11);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  };

  // Re-render markers when filtered clusters change
  useEffect(() => {
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;
    const layerGroup = markersLayerRef.current;
    if (L && map && layerGroup) {
      renderClusterMarkers(L, map, layerGroup, clusters);
      computeVisiblePhotos(map, geotaggedPhotos);
    }
  }, [clusters, computeVisiblePhotos, geotaggedPhotos]);

  const handleResetView = () => {
    if (!mapInstanceRef.current || !leafletLibRef.current) return;
    const L = leafletLibRef.current;
    const map = mapInstanceRef.current;
    const bounds = L.latLngBounds([]);
    clusters.forEach((c) => bounds.extend([c.latitude, c.longitude]));
    if (clusters.length === 1) {
      map.setView([clusters[0].latitude, clusters[0].longitude], 11);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  };

  // Deselect cluster if it is filtered out of current selection
  useEffect(() => {
    if (selectedCluster && !clusters.some((c) => c.key === selectedCluster.key)) {
      setSelectedCluster(null);
      setActivePhotoIndex(0);
    }
  }, [clusters, selectedCluster]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Category Filter Bar */}
      {showCategoryFilter && categories.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-surface-border p-3 rounded-sm">
          <div className="flex items-center space-x-2 text-xs text-muted">
            <Layers className="w-4 h-4 text-accent" />
            <span className="font-medium text-foreground">Filter by Category:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
            <button
              onClick={() => {
                setSelectedCategory("All");
                setSelectedCluster(null);
              }}
              className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                selectedCategory === "All"
                  ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                  : "bg-surface hover:bg-surface-hover border border-surface-border text-foreground hover:border-accent/40"
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
                      ? "bg-accent text-accent-contrast font-semibold shadow-sm"
                      : "bg-surface hover:bg-surface-hover border border-surface-border text-foreground hover:border-accent/40"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Map View */}
      <div className={`relative rounded-sm overflow-hidden border border-surface-border bg-surface dark:bg-black ${heightClassName}`}>
        {/* Basemap Switcher Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center bg-surface/90 dark:bg-black/85 backdrop-blur-md border border-surface-border dark:border-white/20 rounded-sm overflow-hidden text-[11px] shadow-lg">
          <button
            type="button"
            onClick={() => switchLayer("dark")}
            className={`px-3 py-1.5 transition-colors cursor-pointer ${
              activeLayer === "dark"
                ? "bg-accent text-accent-contrast font-semibold"
                : "text-muted hover:text-foreground dark:text-white/80 dark:hover:text-white"
            }`}
            title="OpenStreetMap Standard / Dark Mode"
          >
            <span className="dark:inline hidden">Dark</span>
            <span className="dark:hidden inline">Map</span>
          </button>
          <button
            type="button"
            onClick={() => switchLayer("topo")}
            className={`px-3 py-1.5 border-l border-surface-border dark:border-white/10 transition-colors cursor-pointer ${
              activeLayer === "topo"
                ? "bg-accent text-accent-contrast font-semibold"
                : "text-muted hover:text-foreground dark:text-white/80 dark:hover:text-white"
            }`}
            title="Esri Topographic & Mountain Relief"
          >
            Topo
          </button>
          <button
            type="button"
            onClick={() => switchLayer("satellite")}
            className={`px-3 py-1.5 border-l border-surface-border dark:border-white/10 transition-colors cursor-pointer ${
              activeLayer === "satellite"
                ? "bg-accent text-accent-contrast font-semibold"
                : "text-muted hover:text-foreground dark:text-white/80 dark:hover:text-white"
            }`}
            title="Esri Aerial Satellite Imagery"
          >
            Satellite
          </button>
        </div>

        {/* Map View & Filter Controls (Top Left, alongside zoom buttons) */}
        <div className="absolute top-2.5 left-12 z-[1000] flex items-center gap-1.5 sm:gap-2">
          {/* Fit All button */}
          <button
            type="button"
            onClick={handleResetView}
            className="px-2.5 py-1.5 bg-surface/90 dark:bg-black/85 backdrop-blur-md border border-surface-border dark:border-white/20 rounded-sm text-[11px] text-foreground dark:text-white/90 hover:text-accent hover:border-accent transition-colors shadow-lg flex items-center space-x-1.5 cursor-pointer"
            title="Fit all photographs in view"
          >
            <RotateCcw className="w-3 h-3 text-accent" />
            <span className="hidden sm:inline">Fit All</span>
          </button>

          {/* Filter by map view toggle button */}
          {onToggleFilterByMapBounds && (
            <button
              type="button"
              onClick={() => onToggleFilterByMapBounds(!filterByMapBounds)}
              className={`px-2.5 py-1.5 rounded-sm backdrop-blur-md text-[11px] font-medium shadow-lg border transition-all cursor-pointer flex items-center space-x-1.5 ${
                filterByMapBounds
                  ? "bg-accent text-accent-contrast border-accent shadow-accent/20"
                  : "bg-surface/90 dark:bg-black/85 text-foreground dark:text-white/90 border-surface-border dark:border-white/20 hover:border-accent"
              }`}
              title={
                filterByMapBounds
                  ? "Disable map view gallery filter"
                  : "Filter gallery to photographs in current map view"
              }
            >
              <Filter className="w-3 h-3" />
              <span>{filterByMapBounds ? "Filtered to Map" : "Filter to Map"}</span>
              <span className="font-mono text-[10px] opacity-85">
                ({visiblePhotosInView.length})
              </span>
            </button>
          )}

          {/* Freehand Lasso Tool Button */}
          {onLassoSelect && (
            <button
              type="button"
              onClick={toggleLassoMode}
              className={`px-2.5 py-1.5 rounded-sm backdrop-blur-md text-[11px] font-medium shadow-lg border transition-all cursor-pointer flex items-center space-x-1.5 ${
                isLassoActive
                  ? "bg-accent text-accent-contrast border-accent ring-2 ring-accent/40 animate-pulse"
                  : hasLassoShape
                  ? "bg-accent/20 text-accent border-accent/60"
                  : "bg-surface/90 dark:bg-black/85 text-foreground dark:text-white/90 border-surface-border dark:border-white/20 hover:border-accent"
              }`}
              title={
                isLassoActive
                  ? "Drawing active: Click & drag on map to encircle photographs (or Esc to cancel)"
                  : hasLassoShape
                  ? "Lasso active. Click to draw a new boundary"
                  : "Draw freehand lasso around a set of photographs"
              }
            >
              <LassoSelect className="w-3.5 h-3.5" />
              <span>{isLassoActive ? "Drawing..." : "Lasso"}</span>
              {hasLassoShape && (
                <span className="font-mono text-[10px] font-bold">
                  ({lassoCount})
                </span>
              )}
            </button>
          )}

          {/* Clear Lasso button if shape exists */}
          {hasLassoShape && (
            <button
              type="button"
              onClick={clearLasso}
              className="px-2 py-1.5 bg-surface/90 dark:bg-black/85 backdrop-blur-md border border-surface-border dark:border-white/20 rounded-sm text-[11px] text-muted hover:text-foreground transition-colors shadow-lg flex items-center space-x-1 cursor-pointer"
              title="Clear lasso boundary"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline text-[10px]">Clear Lasso</span>
            </button>
          )}
        </div>

        {/* Floating guidance banner when lasso drawing mode is active */}
        {isLassoActive && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000] animate-in fade-in duration-150">
            <div className="px-3.5 py-1.5 bg-surface/95 dark:bg-black/95 backdrop-blur-md border border-accent text-accent rounded-full text-xs font-medium shadow-2xl flex items-center space-x-2">
              <LassoSelect className="w-3.5 h-3.5" />
              <span>Click &amp; drag on map to encircle photos</span>
              <button
                type="button"
                onClick={toggleLassoMode}
                className="ml-1.5 text-muted hover:text-foreground cursor-pointer text-[11px] underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Floating prompt when zoomed into an area with fewer photos than the total */}
        {!filterByMapBounds &&
          onToggleFilterByMapBounds &&
          visiblePhotosInView.length < geotaggedPhotos.length &&
          visiblePhotosInView.length > 0 && (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[1000]">
              <button
                type="button"
                onClick={() => onToggleFilterByMapBounds(true)}
                className="px-3 py-1.5 bg-surface/95 dark:bg-black/95 backdrop-blur-md border border-accent/60 hover:border-accent text-foreground dark:text-white rounded-full text-xs font-medium shadow-xl flex items-center space-x-1.5 hover:scale-105 transition-all cursor-pointer group"
              >
                <ZoomIn className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
                <span>Filter gallery to this view</span>
                <span className="bg-accent/20 text-accent px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                  {visiblePhotosInView.length}
                </span>
              </button>
            </div>
          )}

        {/* Subtle Zoom Badge in bottom right */}
        <div className="absolute bottom-2 right-2 z-[1000] px-2 py-0.5 rounded bg-surface/80 dark:bg-black/80 backdrop-blur-xs text-[10px] font-mono text-muted border border-surface-border/40 pointer-events-none">
          Zoom: {mapZoom}
        </div>

        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Empty state if no geotagged photos match */}
        {geotaggedPhotos.length === 0 && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/70 backdrop-blur-xs pointer-events-none p-4">
            <div className="bg-surface/95 border border-surface-border p-4 rounded-sm shadow-xl text-center max-w-sm">
              <MapPin className="w-5 h-5 text-muted mx-auto mb-1.5 opacity-60" />
              <p className="text-xs font-medium text-foreground">No mapped locations</p>
              <p className="text-[11px] text-muted mt-0.5">
                No geotagged photographs match the current search or filters.
              </p>
            </div>
          </div>
        )}

        {/* Selected Location / Multi-Photo Showcase Card */}
        {selectedCluster && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xl z-[1000] bg-surface/95 dark:bg-black/95 backdrop-blur-md border border-surface-border dark:border-white/20 rounded-sm p-4 shadow-2xl space-y-3 text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-2">
              <div className="flex items-center space-x-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-accent" />
                <span className="font-semibold text-foreground">
                  {selectedCluster.photos.length === 1
                    ? "Site Photograph"
                    : `Site Collection (${selectedCluster.photos.length} Photographs)`}
                </span>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                {selectedCluster.photos.length > 1 && (
                  <div className="flex items-center space-x-1.5 text-muted font-mono text-[11px]">
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
                      className="p-1 hover:bg-surface-hover rounded text-foreground transition-colors cursor-pointer"
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
                      className="p-1 hover:bg-surface-hover rounded text-foreground transition-colors cursor-pointer"
                      title="Next photo at this site"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setSelectedCluster(null)}
                  className="text-muted hover:text-foreground p-0.5 cursor-pointer"
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
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {currentPhoto.title}
                      </h4>
                      <p className="text-xs text-muted font-mono">
                        {currentPhoto.dateTaken.year}-
                        {String(currentPhoto.dateTaken.month).padStart(2, "0")}-
                        {String(currentPhoto.dateTaken.day).padStart(2, "0")} ·{" "}
                        {currentPhoto.camera}
                      </p>
                      {currentPhoto.description && (
                        <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                          {currentPhoto.description}
                        </p>
                      )}
                      <div className="pt-1 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/photo/${currentPhoto.photoID}`}
                          className="inline-flex items-center space-x-1.5 text-xs text-accent hover:underline font-medium"
                        >
                          <span>Exhibition View</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                        {onFilterToCluster && (
                          <button
                            type="button"
                            onClick={() => onFilterToCluster(selectedCluster.photos)}
                            className="inline-flex items-center space-x-1 text-xs text-muted hover:text-accent font-medium cursor-pointer transition-colors"
                          >
                            <span>
                              {selectedCluster.photos.length === 1
                                ? "View in list below ↓"
                                : `View all ${selectedCluster.photos.length} in list below ↓`}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thumbnail ribbon for multi-photo sites */}
                  {selectedCluster.photos.length > 1 && (
                    <div className="pt-2 border-t border-surface-border/40">
                      <div className="text-[11px] text-muted mb-1.5 font-medium">
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
