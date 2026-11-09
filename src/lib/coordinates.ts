/**
 * Coordinate parsing and validation utilities for Lumenist.
 * Supports decimal degrees, degrees-minutes-seconds (DMS),
 * cardinal directions (N/S/E/W), and Google Maps / Apple Maps URLs.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function isValidLatitude(lat: number): boolean {
  return typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: number): boolean {
  return typeof lon === "number" && !isNaN(lon) && lon >= -180 && lon <= 180;
}

/**
 * Parses a coordinate string in various formats into { latitude, longitude }.
 * Returns null if parsing fails or values are out of bounds.
 */
export function parseCoordinates(input: string): Coordinates | null {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();
  if (!str) return null;

  // 1. Google Maps / Apple Maps / OpenStreetMap URLs
  // e.g. https://www.google.com/maps/@35.799292,-82.954774,15z
  const urlAtMatch = str.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (urlAtMatch) {
    const lat = parseFloat(urlAtMatch[1]);
    const lon = parseFloat(urlAtMatch[2]);
    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
      };
    }
  }

  // e.g. https://maps.google.com/?q=35.799292,-82.954774 or ?ll=...
  const urlQueryMatch = str.match(
    /[?&](?:q|ll|query|center)=(-?\d+\.?\d*),(-?\d+\.?\d*)/i
  );
  if (urlQueryMatch) {
    const lat = parseFloat(urlQueryMatch[1]);
    const lon = parseFloat(urlQueryMatch[2]);
    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
      };
    }
  }

  // Normalize quotes, primes, and degree symbols
  const cleanStr = str
    .replace(/[’′]/g, "'")
    .replace(/[”″]/g, '"')
    .replace(/[º°]/g, "°");

  // 2. Degrees Minutes Seconds (DMS) or Degrees Decimal Minutes (DMM)
  // e.g. 35°47'57.5"N 82°57'17.2"W or 35° 47' 57.5" N, 82° 57' 17.2" W
  const dmsRegex =
    /([0-9.]+)\s*°?\s*([0-9.]+)?\s*['\s]?\s*([0-9.]+)?\s*["\s]?\s*([NSEWnsew])\s*[,;\s/]+\s*([0-9.]+)\s*°?\s*([0-9.]+)?\s*['\s]?\s*([0-9.]+)?\s*["\s]?\s*([NSEWnsew])/;
  const dmsMatch = cleanStr.match(dmsRegex);
  if (dmsMatch) {
    const toDec = (
      degStr: string,
      minStr: string | undefined,
      secStr: string | undefined,
      dir: string
    ) => {
      const d = parseFloat(degStr) || 0;
      const m = parseFloat(minStr || "0") || 0;
      const s = parseFloat(secStr || "0") || 0;
      let dec = d + m / 60 + s / 3600;
      if (dir.toUpperCase() === "S" || dir.toUpperCase() === "W") {
        dec = -dec;
      }
      return dec;
    };

    let lat = toDec(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4]);
    let lon = toDec(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8]);

    // Handle Lon, Lat order if specified with E/W first
    if (
      ["E", "W"].includes(dmsMatch[4].toUpperCase()) &&
      ["N", "S"].includes(dmsMatch[8].toUpperCase())
    ) {
      const temp = lat;
      lat = lon;
      lon = temp;
    }

    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
      };
    }
  }

  // 3. Decimal with Cardinal directions (e.g. 35.799292 N, 82.954774 W)
  const cardMatch = cleanStr.match(
    /([0-9.]+)\s*°?\s*([NSEWnsew])\s*[,;\s/]+\s*([0-9.]+)\s*°?\s*([NSEWnsew])/
  );
  if (cardMatch) {
    const val1 = parseFloat(cardMatch[1]);
    const dir1 = cardMatch[2].toUpperCase();
    const val2 = parseFloat(cardMatch[3]);
    const dir2 = cardMatch[4].toUpperCase();

    let lat =
      ["N", "S"].includes(dir1)
        ? dir1 === "S"
          ? -val1
          : val1
        : dir2 === "S"
          ? -val2
          : val2;
    let lon =
      ["E", "W"].includes(dir1)
        ? dir1 === "W"
          ? -val1
          : val1
        : dir2 === "W"
          ? -val2
          : val2;

    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
      };
    }
  }

  // 4. Simple decimal pair (e.g. "35.799292, -82.954774", "35.799292 -82.954774", "35.799292; -82.954774")
  const simpleMatch = cleanStr.match(
    /^([+-]?\d+(?:\.\d+)?)[,\s;/]+([+-]?\d+(?:\.\d+)?)$/
  );
  if (simpleMatch) {
    const lat = parseFloat(simpleMatch[1]);
    const lon = parseFloat(simpleMatch[2]);
    if (isValidLatitude(lat) && isValidLongitude(lon)) {
      return {
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
      };
    }
  }

  return null;
}

/**
 * Formats coordinates into standard decimal format string, e.g. "35.799292, -82.954774".
 */
export function formatCoordinates(
  lat: number | null | undefined,
  lon: number | null | undefined,
  decimals = 6
): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return "";
  }
  return `${lat.toFixed(decimals)}, ${lon.toFixed(decimals)}`;
}

/**
 * Formats decimal coordinates into human-readable DMS string,
 * e.g. 35°47'57.5"N 82°57'17.2"W
 */
export function formatDMS(lat: number, lon: number): string {
  const toDmsString = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? "N" : "S") : val >= 0 ? "E" : "W";
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    return `${deg}°${min}'${sec}"${dir}`;
  };

  return `${toDmsString(lat, true)} ${toDmsString(lon, false)}`;
}
