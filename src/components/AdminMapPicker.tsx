"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface AdminMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
}

// Geographic center of the contiguous United States
const US_CENTER_LAT = 39.5;
const US_CENTER_LON = -98.35;
const US_DEFAULT_ZOOM = 4;

export function AdminMapPicker({
  latitude,
  longitude,
  onChange,
}: AdminMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletLibRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);

  // Keep latest onChange in ref so it doesn't trigger effect re-runs
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Default to entire US if no coordinates yet
  const defaultLat = latitude !== null ? latitude : US_CENTER_LAT;
  const defaultLon = longitude !== null ? longitude : US_CENTER_LON;
  const defaultZoom =
    latitude !== null && longitude !== null ? 14 : US_DEFAULT_ZOOM;

  useEffect(() => {
    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      leafletLibRef.current = L;

      const map = L.map(mapContainerRef.current, {
        center: [defaultLat, defaultLon],
        zoom: defaultZoom,
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
        lastCoordsRef.current = { lat: latitude, lon: longitude };
        const marker = L.marker([latitude, longitude], {
          icon: createIcon(),
          draggable: true,
        }).addTo(map);

        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          const lat = parseFloat(latlng.lat.toFixed(6));
          const lon = parseFloat(latlng.lng.toFixed(6));
          lastCoordsRef.current = { lat, lon };
          onChangeRef.current(lat, lon);
        });

        markerRef.current = marker;
      }

      // Click on map to place or move marker
      map.on("click", (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6));
        const lon = parseFloat(e.latlng.lng.toFixed(6));
        lastCoordsRef.current = { lat, lon };

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);
        } else {
          const marker = L.marker([lat, lon], {
            icon: createIcon(),
            draggable: true,
          }).addTo(map);

          marker.on("dragend", (ev: any) => {
            const pos = ev.target.getLatLng();
            const pLat = parseFloat(pos.lat.toFixed(6));
            const pLon = parseFloat(pos.lng.toFixed(6));
            lastCoordsRef.current = { lat: pLat, lon: pLon };
            onChangeRef.current(pLat, pLon);
          });

          markerRef.current = marker;
        }

        onChangeRef.current(lat, lon);
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

  // Update marker position and pan map when coordinates change externally
  useEffect(() => {
    if (!mapInstanceRef.current || !leafletLibRef.current) return;

    if (latitude !== null && longitude !== null) {
      // Check if coordinates were already set by the map itself to prevent redundant pan
      const hasChanged =
        !lastCoordsRef.current ||
        Math.abs(lastCoordsRef.current.lat - latitude) > 0.000001 ||
        Math.abs(lastCoordsRef.current.lon - longitude) > 0.000001;

      lastCoordsRef.current = { lat: latitude, lon: longitude };

      if (hasChanged) {
        const currentZoom = mapInstanceRef.current.getZoom();
        const targetZoom =
          currentZoom && currentZoom > 14 ? currentZoom : 14;
        mapInstanceRef.current.setView([latitude, longitude], targetZoom);
      }

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
          const pLat = parseFloat(pos.lat.toFixed(6));
          const pLon = parseFloat(pos.lng.toFixed(6));
          lastCoordsRef.current = { lat: pLat, lon: pLon };
          onChangeRef.current(pLat, pLon);
        });

        markerRef.current = marker;
      }
    } else {
      // Coordinates cleared: remove marker and reset view to entire US
      lastCoordsRef.current = null;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      mapInstanceRef.current.setView(
        [US_CENTER_LAT, US_CENTER_LON],
        US_DEFAULT_ZOOM
      );
    }
  }, [latitude, longitude]);

  return (
    <div className="relative rounded-sm overflow-hidden border border-surface-border bg-black h-64 sm:h-72 w-full">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 left-2 z-[1000] bg-black/85 backdrop-blur-md px-2.5 py-1 rounded text-[11px] text-gray-300 border border-surface-border shadow-md">
        {latitude !== null && longitude !== null
          ? `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          : "Click on map to drop pin (or enter coordinates above)"}
      </div>
    </div>
  );
}
