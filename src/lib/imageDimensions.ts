import fs from "fs";

/**
 * Extract real image dimensions from JPEG, PNG, GIF, or WebP headers synchronously.
 */
export function getImageDimensions(
  filePath: string
): { width: number; height: number } | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const fd = fs.openSync(filePath, "r");
    try {
      const header = Buffer.alloc(30);
      const readBytes = fs.readSync(fd, header, 0, 30, 0);
      if (readBytes < 10) return null;

      // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width/height at bytes 16..23
      if (
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47
      ) {
        if (readBytes >= 24) {
          const width = header.readUInt32BE(16);
          const height = header.readUInt32BE(20);
          if (width > 0 && height > 0) return { width, height };
        }
        return null;
      }

      // GIF: "GIF87a" or "GIF89a", width/height at bytes 6..9 (little-endian)
      if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
        const width = header.readUInt16LE(6);
        const height = header.readUInt16LE(8);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }

      // WebP: "RIFF".... "WEBP"
      if (
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.toString("ascii", 8, 12) === "WEBP"
      ) {
        const chunk = header.toString("ascii", 12, 16);
        if (chunk === "VP8X" && readBytes >= 30) {
          const width =
            1 + (header[24] | (header[25] << 8) | (header[26] << 16));
          const height =
            1 + (header[27] | (header[28] << 8) | (header[29] << 16));
          if (width > 0 && height > 0) return { width, height };
        } else if (chunk === "VP8 " && readBytes >= 30) {
          const width = header.readUInt16LE(26) & 0x3fff;
          const height = header.readUInt16LE(28) & 0x3fff;
          if (width > 0 && height > 0) return { width, height };
        } else if (chunk === "VP8L" && readBytes >= 25) {
          const bits = header.readUInt32LE(21);
          const width = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          if (width > 0 && height > 0) return { width, height };
        }
        return null;
      }

      // JPEG: FF D8
      if (header[0] === 0xff && header[1] === 0xd8) {
        let pos = 2;
        const buf = Buffer.alloc(9);
        while (true) {
          const bytesRead = fs.readSync(fd, buf, 0, 2, pos);
          if (bytesRead < 2) break;
          if (buf[0] !== 0xff) {
            pos++;
            continue;
          }
          const marker = buf[1];
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            fs.readSync(fd, buf, 0, 7, pos + 2);
            const height = buf.readUInt16BE(3);
            const width = buf.readUInt16BE(5);
            if (width > 0 && height > 0) {
              return { width, height };
            }
            return null;
          } else if (marker === 0xd9 || marker === 0xda) {
            break;
          } else {
            fs.readSync(fd, buf, 0, 2, pos + 2);
            const segLen = buf.readUInt16BE(0);
            pos += 2 + segLen;
          }
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  return null;
}

export function getJpegDimensions(
  filePath: string
): { width: number; height: number } | null {
  return getImageDimensions(filePath);
}
