import { Photo } from "@/types/photo";

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
    const c = p.createdTimestamp || p.rawFields?.created;
    if (c) {
      const n = parseInt(c, 10);
      if (!isNaN(n)) return n;
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
