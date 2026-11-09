"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface PhotoMapProps {
  latitude: number;
  longitude: number;
  title: string;
  zoom?: number;
  height?: string;
  thumbnailUrl?: string;
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

export function PhotoMap({
  latitude,
  longitude,
  title,
  zoom = 13,
  height = "260px",
  thumbnailUrl,
}: PhotoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [activeLayer, setActiveLayer] = useState<LayerMode>("dark");

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    // Dynamically import Leaflet in browser only
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      leafletLibRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = map;

      // Initial tile layer
      const config = LAYER_CONFIGS[activeLayer];
      const initialTileLayer = L.tileLayer(config.url, config.options).addTo(map);
      tileLayerRef.current = initialTileLayer;

      // Custom amber pin marker
      const customIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="
            width: 26px;
            height: 26px;
            background-color: #f59e0b;
            border: 2px solid #000;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background-color: #000;
              border-radius: 50%;
              transform: rotate(45deg);
            "></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -26],
      });

      const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(
        map
      );

      const popupHtml = `
        <div style="color: #fff; background: #111; padding: 4px; font-family: inherit;">
          ${
            thumbnailUrl
              ? `<div style="margin-bottom: 6px; border-radius: 2px; overflow: hidden; max-height: 80px; background: #000;">
                   <img src="${thumbnailUrl}" style="width: 100%; height: 80px; object-fit: cover;" />
                 </div>`
              : ""
          }
          <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #fff;">${title}</div>
          <div style="font-size: 11px; color: #9ca3af; font-family: monospace;">
            ${latitude.toFixed(5)}, ${longitude.toFixed(5)}
          </div>
          <div style="margin-top: 6px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}"
               target="_blank"
               rel="noopener noreferrer"
               style="color: #9999ff; font-size: 11px; text-decoration: underline;">
               Open in Google Maps ↗
            </a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: "dark-map-popup",
        maxWidth: 240,
      });

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
        leafletLibRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, [latitude, longitude, title, zoom, thumbnailUrl]);

  // Handle Layer switching dynamically without re-mounting map
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
    // Ensure tiles stay behind marker pins
    newLayer.bringToBack();
    tileLayerRef.current = newLayer;
  };

  return (
    <div className="relative rounded-sm overflow-hidden border border-surface-border bg-black">
      {/* Basemap Switcher Controls */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center bg-black/85 backdrop-blur-md border border-surface-border rounded-sm overflow-hidden text-[11px] shadow-lg">
        <button
          type="button"
          onClick={() => switchLayer("dark")}
          className={`px-2.5 py-1 transition-colors ${
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
          className={`px-2.5 py-1 border-l border-surface-border transition-colors ${
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
          className={`px-2.5 py-1 border-l border-surface-border transition-colors ${
            activeLayer === "satellite"
              ? "bg-accent text-black font-semibold"
              : "text-gray-300 hover:text-white"
          }`}
          title="Esri Aerial Satellite Imagery"
        >
          Satellite
        </button>
      </div>

      <div ref={mapContainerRef} style={{ height, width: "100%" }} />
    </div>
  );
}
