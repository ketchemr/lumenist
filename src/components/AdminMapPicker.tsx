"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface AdminMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
}

export function AdminMapPicker({
  latitude,
  longitude,
  onChange,
}: AdminMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);

  // Default to Snoqualmie / Cascades region if no coordinates yet
  const defaultLat = latitude || 47.5;
  const defaultLon = longitude || -121.8;

  useEffect(() => {
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      leafletLibRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLon],
        zoom: latitude && longitude ? 13 : 8,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Clean OpenStreetMap with dark styling
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        className: "map-tiles-dark",
        maxZoom: 19,
      }).addTo(map);

      // Custom amber marker icon
      const createIcon = () =>
        L.divIcon({
          className: "admin-picker-pin",
          html: `
            <div style="
              width: 26px;
              height: 26px;
              background-color: #f59e0b;
              border: 2px solid #000;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px rgba(0,0,0,0.6);
              cursor: grab;
            "></div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });

      // Place initial marker if coordinates exist
      if (latitude !== null && longitude !== null) {
        const marker = L.marker([latitude, longitude], {
          icon: createIcon(),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          onChange(parseFloat(latlng.lat.toFixed(6)), parseFloat(latlng.lng.toFixed(6)));
        });

        markerRef.current = marker;
      }

      // Click on map to place or move marker
      map.on("click", (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lon = parseFloat(e.latlng.lng.toFixed(6));

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);
        } else {
          const marker = L.marker([lat, lon], {
            icon: createIcon(),
            draggable: true,
          }).addTo(map);

          marker.on("dragend", (ev: any) => {
            const pos = ev.target.getLatLng();
            onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
          });

          markerRef.current = marker;
        }

        onChange(lat, lon);
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
        markerRef.current = null;
        leafletLibRef.current = null;
      }
    };
  }, []);

  // Update marker position if coordinates change from input fields
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLibRef.current) return;
    if (latitude !== null && longitude !== null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const L = leafletLibRef.current;
        const icon = L.divIcon({
          className: "admin-picker-pin",
          html: `
            <div style="
              width: 26px;
              height: 26px;
              background-color: #f59e0b;
              border: 2px solid #000;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px rgba(0,0,0,0.6);
              cursor: grab;
            "></div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });

        const marker = L.marker([latitude, longitude], {
          icon,
          draggable: true,
        }).addTo(mapInstanceRef.current);

        marker.on("dragend", (ev: any) => {
          const pos = ev.target.getLatLng();
          onChange(parseFloat(pos.lat.toFixed(6)), parseFloat(pos.lng.toFixed(6)));
        });

        markerRef.current = marker;
      }
    }
  }, [latitude, longitude, onChange]);

  return (
    <div className="relative rounded-sm overflow-hidden border border-surface-border bg-black h-56 w-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-[1000] bg-black/85 backdrop-blur-md px-2.5 py-1 rounded text-[11px] text-gray-300 border border-surface-border">
        {latitude !== null && longitude !== null
          ? `📍 ${latitude}, ${longitude}`
          : "Click on map to set coordinates"}
      </div>
    </div>
  );
}
