"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface PhotoMapProps {
  latitude: number;
  longitude: number;
  title: string;
  zoom?: number;
  height?: string;
  thumbnailUrl?: string;
}

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

  useEffect(() => {
    let isMounted = true;

    // Dynamically import Leaflet in browser only
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      mapInstanceRef.current = map;

      // Dark Matter tile layer
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

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
               style="color: #f59e0b; font-size: 11px; text-decoration: underline;">
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
      }
    };
  }, [latitude, longitude, title, zoom, thumbnailUrl]);

  return (
    <div className="relative rounded-sm overflow-hidden border border-surface-border bg-black">
      <div ref={mapContainerRef} style={{ height, width: "100%" }} />
    </div>
  );
}
