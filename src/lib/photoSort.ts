import { Photo } from "@/types/photo";

export function parseCreatedToTime(val?: string | number): number | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // 14-digit string: YYYYMMDDHHMMSS (e.g. 20261108131310)
  if (/^\d{14}$/.test(str)) {
    const y = parseInt(str.slice(0, 4), 10);
    const m = parseInt(str.slice(4, 6), 10) - 1;
    const d = parseInt(str.slice(6, 8), 10);
    const h = parseInt(str.slice(8, 10), 10);
    const min = parseInt(str.slice(10, 12), 10);
    const s = parseInt(str.slice(12, 14), 10);
    const dt = new Date(Date.UTC(y, m, d, h, min, s));
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // 8-digit string: YYYYMMDD
  if (/^\d{8}$/.test(str)) {
    const y = parseInt(str.slice(0, 4), 10);
    const m = parseInt(str.slice(4, 6), 10) - 1;
    const d = parseInt(str.slice(6, 8), 10);
    const dt = new Date(Date.UTC(y, m, d));
    if (!isNaN(dt.getTime())) return dt.getTime();
  }

  // ISO or standard date string
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) return dt.getTime();

  // Epoch number
  const num = Number(str);
  if (!isNaN(num) && num > 0) return num;

  return null;
}

export function sortPhotos(photos: Photo[], sortOrder?: string): Photo[] {
  const order = sortOrder || "date-desc";
  const list = [...photos];

  const getCaptureTime = (p: Photo) => {
    if (p.dateTaken?.iso) {
      const t = new Date(p.dateTaken.iso).getTime();
      if (!isNaN(t)) return t;
    }
    if (p.dateTaken?.year) {
      return new Date(
        p.dateTaken.year,
        (p.dateTaken.month || 1) - 1,
        p.dateTaken.day || 1,
        p.dateTaken.hour || 0,
        p.dateTaken.minute || 0,
        p.dateTaken.second || 0
      ).getTime();
    }
    return 0;
  };

  const getCreatedVal = (p: Photo) => {
    const createdTime = parseCreatedToTime(p.createdTimestamp || p.rawFields?.created);
    if (createdTime !== null) {
      return createdTime;
    }
    return getCaptureTime(p);
  };

  switch (order) {
    case "date-asc":
      return list.sort((a, b) => getCaptureTime(a) - getCaptureTime(b));
    case "created-desc":
      return list.sort((a, b) => getCreatedVal(b) - getCreatedVal(a));
    case "title-asc":
      return list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    case "title-desc":
      return list.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
    case "date-desc":
    default:
      return list.sort((a, b) => getCaptureTime(b) - getCaptureTime(a));
  }
}
