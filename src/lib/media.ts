import { Photo } from "@/types/photo";

export const SUPPORTED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".avif",
  ".gif",
  ".tif",
  ".tiff",
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
] as const;

export const IMAGE_ACCEPT_ATTR =
  "image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff,.jpg,.jpeg,.png,.webp,.avif,.gif,.tif,.tiff";

export const VIDEO_ACCEPT_ATTR =
  "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v";

export const MEDIA_MIME_MAP: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".txt": "text/plain; charset=utf-8",
};

export function isVideoPhoto(photo?: Pick<Photo, "mediaType" | "videoSrc" | "videoEmbedUrl"> | null): boolean {
  if (!photo) return false;
  return (
    photo.mediaType === "video" ||
    Boolean(photo.videoSrc && photo.videoSrc.trim()) ||
    Boolean(photo.videoEmbedUrl && photo.videoEmbedUrl.trim())
  );
}

export function isSupportedImageFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isSupportedVideoFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export interface ParsedVideoEmbed {
  provider: "youtube" | "vimeo";
  id: string;
  embedUrl: string;
  canonicalUrl: string;
  thumbnailUrl?: string;
  fallbackThumbnailUrl?: string;
}

/**
 * Safely parses YouTube and Vimeo URLs into privacy-enhanced embed URLs.
 * Returns null if the URL is not a recognized YouTube or Vimeo link.
 */
export function parseVideoEmbed(rawUrl?: string | null): ParsedVideoEmbed | null {
  if (!rawUrl || !rawUrl.trim()) return null;
  let input = rawUrl.trim();
  if (!/^https?:\/\//i.test(input)) {
    input = `https://${input}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = parsed.pathname;

  // YouTube
  if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "youtu.be"
  ) {
    let videoId: string | null = null;
    if (host === "youtu.be") {
      videoId = pathname.split("/").filter(Boolean)[0] || null;
    } else if (pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else {
      const match = pathname.match(/^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]{6,})/);
      if (match) videoId = match[2];
    }

    if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
      return {
        provider: "youtube",
        id: videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
        canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        fallbackThumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    }
  }

  // Vimeo
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segments = pathname.split("/").filter(Boolean);
    let videoId: string | null = null;
    if (host === "player.vimeo.com" && segments[0] === "video" && segments[1]) {
      videoId = segments[1];
    } else {
      // Match /123456789 or /channels/staffpicks/123456789 or /manage/videos/123456789
      for (let i = segments.length - 1; i >= 0; i--) {
        if (/^\d{5,15}$/.test(segments[i])) {
          videoId = segments[i];
          break;
        }
      }
    }

    if (videoId && /^\d{5,15}$/.test(videoId)) {
      return {
        provider: "vimeo",
        id: videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}?dnt=1`,
        canonicalUrl: `https://vimeo.com/${videoId}`,
      };
    }
  }

  return null;
}

/**
 * Generates a generic, self-hosted CLI helper script for optimizing a video
 * with ffmpeg, extracting a poster frame, and syncing it to a server via rsync.
 */
export function buildGenericVideoCliScript(options: {
  photoID?: string;
  year?: number | string;
}): string {
  const id = (options.photoID || "v20260101120000").replace(/[^a-zA-Z0-9_-]/g, "");
  const year = String(options.year || new Date().getFullYear());

  return `# 1. Transcode to web-ready H.264 MP4 (faststart enables instant streaming)
ffmpeg -i input_video.mov \\
  -c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p \\
  -movflags +faststart \\
  -c:a aac -b:a 128k \\
  ${id}.mp4

# 2. Extract a poster frame (at 1 second) for gallery thumbnails
ffmpeg -ss 00:00:01 -i ${id}.mp4 -frames:v 1 -q:v 2 ${id}.jpg

# 3. Sync both files to your server's photos/${year}/ folder
#    (uses the same REMOTE_PHOTO_TARGET convention as \`npm run sync:remote\`)
REMOTE_PHOTO_TARGET="\${REMOTE_PHOTO_TARGET:-user@your-server:/path/to/photos}"
rsync -avz --progress ${id}.mp4 ${id}.jpg "\${REMOTE_PHOTO_TARGET}/${year}/"

# 4. In the form below, enter "${id}.mp4" as the synced video filename,
#    select "${id}.jpg" as the poster image, fill in metadata, and publish.`;
}
