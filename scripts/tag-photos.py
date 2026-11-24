#!/usr/bin/env python3
"""
AI-assisted photo tagger for Lumenist (local Ollama vision by default, or Gemini).

Inspects a photo alongside its location (EXIF GPS, --location "lat, lon" or
place name, reverse-geocoded via OpenStreetMap Nominatim), plus optional title,
description, albums, existing image tags, and optional existing catalog/system tags,
then suggests specific, non-redundant search tags.

Zero external Python dependencies (uses stdlib + macOS `sips` if available).

Usage:
  # Tag a standalone image (uses EXIF GPS if present, or pass --location)
  python3 scripts/tag-photos.py --image /path/to/photo.jpg --location "35.7993, -82.9548"

  # Standalone image with optional metadata and catalog system tags
  python3 scripts/tag-photos.py --image /path/to/photo.jpg \\
    --location "19.9149, -155.8863" \\
    --title "Sunset at 'Anaeho'omalu Beach" \\
    --description "Evening light over the fishpond and palms" \\
    --tags "Hawaii, HI" \\
    --system-tags

  # Dry run on a single cataloged photo (default: does not modify data/photos.json)
  python3 scripts/tag-photos.py --photo d20261026144835

  # Dry run on one folder / year
  python3 scripts/tag-photos.py --folder 2026

  # Analyze all photos and update data/photos.json directly
  python3 scripts/tag-photos.py --all --apply
"""

from __future__ import annotations

import argparse
import base64
import csv
import json
import os
import re
import shutil
import ssl
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"
DEFAULT_OLLAMA_MODEL = "gemma3:12b"
DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434"

GENERIC_STOPLIST = {
    "nature",
    "scenic",
    "scenery",
    "outdoor",
    "outdoors",
    "photography",
    "photo",
    "picture",
    "image",
    "landscape",
    "beautiful",
    "view",
    "travel",
    "usa",
    "united states",
    "america",
    "north america",
    "daytime",
    "daylight",
}


def make_ssl_context() -> ssl.SSLContext:
    cafile = "/etc/ssl/cert.pem"
    if os.path.exists(cafile):
        return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


SSL_CTX = make_ssl_context()


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def resolve_photos_dir(cli_dir: str | None) -> Path:
    if cli_dir:
        return Path(cli_dir).expanduser().resolve()
    for env_key in ("PHOTOS_DIR", "PHOTOS_SOURCE_DIR", "LOCAL_PHOTO_DIR"):
        val = os.environ.get(env_key, "").strip()
        if val:
            return Path(val).expanduser().resolve()
    return (REPO_ROOT / "public" / "photos").resolve()


def resolve_image_path(photo: dict[str, Any], photos_dir: Path) -> Path | None:
    rel = str(photo.get("imageDesktop", "")).split("?")[0]
    if rel.startswith("/photos/"):
        cand = photos_dir / rel[len("/photos/") :]
        if cand.exists():
            return cand
    year = str((photo.get("dateTaken") or {}).get("year", ""))
    pid = str(photo.get("photoID", ""))
    if year and pid:
        for ext in (".jpg", ".jpeg", ".png", ".webp", "_desktop.jpg"):
            cand = photos_dir / year / f"{pid}{ext}"
            if cand.exists():
                return cand
    return None


class Geocoder:
    """Cached OpenStreetMap Nominatim reverse geocoder (respects 1 req/sec)."""

    def __init__(self, cache_path: Path) -> None:
        self.cache_path = cache_path
        self.cache: dict[str, dict[str, Any]] = {}
        self.last_request = 0.0
        self.lock = threading.Lock()
        if cache_path.exists():
            try:
                self.cache = json.loads(cache_path.read_text(encoding="utf-8"))
            except Exception:
                self.cache = {}

    def save(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        self.cache_path.write_text(
            json.dumps(self.cache, indent=2, sort_keys=True), encoding="utf-8"
        )

    def reverse(self, lat: float, lon: float) -> dict[str, Any] | None:
        key = f"{lat:.4f},{lon:.4f}"
        with self.lock:
            if key in self.cache:
                return self.cache[key]

            elapsed = time.time() - self.last_request
            if elapsed < 1.1:
                time.sleep(1.1 - elapsed)

            url = (
                "https://nominatim.openstreetmap.org/reverse?"
                + urllib.parse.urlencode(
                    {
                        "format": "jsonv2",
                        "lat": f"{lat:.6f}",
                        "lon": f"{lon:.6f}",
                        "zoom": "16",
                        "addressdetails": "1",
                    }
                )
            )
            req = urllib.request.Request(
                url, headers={"User-Agent": "lumenist-photo-tagger/1.0"}
            )
            self.last_request = time.time()
            try:
                with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                result = {
                    "name": data.get("name", ""),
                    "display_name": data.get("display_name", ""),
                    "address": data.get("address", {}),
                }
                self.cache[key] = result
                self.save()
                return result
            except Exception as exc:
                print(f"  [warn] Geocode failed for {key}: {exc}", file=sys.stderr)
                return None


def prepare_image_base64(image_path: Path, max_dim: int = 768) -> tuple[str, str]:
    if shutil.which("sips"):
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            proc = subprocess.run(
                [
                    "sips",
                    "-Z",
                    str(max_dim),
                    "-s",
                    "format",
                    "jpeg",
                    "-s",
                    "formatOptions",
                    "80",
                    str(image_path),
                    "--out",
                    str(tmp_path),
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            if proc.returncode == 0 and tmp_path.exists() and tmp_path.stat().st_size > 0:
                b64 = base64.b64encode(tmp_path.read_bytes()).decode("ascii")
                return "image/jpeg", b64
        finally:
            tmp_path.unlink(missing_ok=True)

    ext = image_path.suffix.lower()
    mime = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")
    return mime, base64.b64encode(image_path.read_bytes()).decode("ascii")


def extract_exif_metadata(image_path: Path) -> tuple[dict[str, str], dict[str, float] | None]:
    """Extract DateTaken and GPS coordinates from a JPEG's EXIF APP1 block (stdlib only)."""
    date_taken: dict[str, str] = {}
    location: dict[str, float] | None = None

    try:
        data = image_path.read_bytes()
        if data[:2] == b"\xff\xd8":
            pos = 2
            exif_bytes: bytes | None = None
            while pos + 4 <= len(data):
                if data[pos] != 0xFF:
                    break
                marker = data[pos + 1]
                if marker in (0xD9, 0xDA):  # EOI / SOS
                    break
                seg_len = struct.unpack(">H", data[pos + 2 : pos + 4])[0]
                if marker == 0xE1 and data[pos + 4 : pos + 10] == b"Exif\x00\x00":
                    exif_bytes = data[pos + 10 : pos + 2 + seg_len]
                    break
                pos += 2 + seg_len

            if exif_bytes and len(exif_bytes) >= 8:
                endian = "<" if exif_bytes[:2] == b"II" else ">" if exif_bytes[:2] == b"MM" else ""
                if endian:
                    def read_ifd(offset: int) -> dict[int, tuple[int, int, bytes]]:
                        entries: dict[int, tuple[int, int, bytes]] = {}
                        if offset + 2 > len(exif_bytes):
                            return entries
                        count = struct.unpack_from(endian + "H", exif_bytes, offset)[0]
                        for i in range(count):
                            base = offset + 2 + i * 12
                            if base + 12 > len(exif_bytes):
                                break
                            tag, typ, cnt, val_off = struct.unpack_from(endian + "HHII", exif_bytes, base)
                            type_sizes = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}
                            sz = type_sizes.get(typ, 1) * cnt
                            if sz <= 4:
                                raw = exif_bytes[base + 8 : base + 8 + sz]
                            elif val_off + sz <= len(exif_bytes):
                                raw = exif_bytes[val_off : val_off + sz]
                            else:
                                raw = b""
                            entries[tag] = (typ, cnt, raw)
                        return entries

                    def read_rationals(raw: bytes, cnt: int) -> list[float]:
                        vals: list[float] = []
                        for i in range(cnt):
                            if (i + 1) * 8 > len(raw):
                                break
                            num, den = struct.unpack_from(endian + "II", raw, i * 8)
                            vals.append(num / den if den else 0.0)
                        return vals

                    ifd0_offset = struct.unpack_from(endian + "I", exif_bytes, 4)[0]
                    ifd0 = read_ifd(ifd0_offset)

                    # DateTimeOriginal from ExifIFD (0x8769) or DateTime from IFD0 (0x0132)
                    dt_str = ""
                    if 0x8769 in ifd0 and len(ifd0[0x8769][2]) == 4:
                        exif_ifd_off = struct.unpack_from(endian + "I", ifd0[0x8769][2], 0)[0]
                        exif_ifd = read_ifd(exif_ifd_off)
                        if 0x9003 in exif_ifd:
                            dt_str = exif_ifd[0x9003][2].decode("ascii", errors="ignore").strip("\x00 ")
                    if not dt_str and 0x0132 in ifd0:
                        dt_str = ifd0[0x0132][2].decode("ascii", errors="ignore").strip("\x00 ")
                    if dt_str and len(dt_str) >= 10:
                        parts = dt_str[:10].split(":")
                        if len(parts) == 3:
                            date_taken = {"year": parts[0], "month": parts[1], "day": parts[2]}

                    # GPS IFD (0x8825)
                    if 0x8825 in ifd0 and len(ifd0[0x8825][2]) == 4:
                        gps_ifd_off = struct.unpack_from(endian + "I", ifd0[0x8825][2], 0)[0]
                        gps_ifd = read_ifd(gps_ifd_off)
                        if 2 in gps_ifd and 4 in gps_ifd:
                            lat_dms = read_rationals(gps_ifd[2][2], gps_ifd[2][1])
                            lon_dms = read_rationals(gps_ifd[4][2], gps_ifd[4][1])
                            if len(lat_dms) == 3 and len(lon_dms) == 3:
                                lat = lat_dms[0] + lat_dms[1] / 60.0 + lat_dms[2] / 3600.0
                                lon = lon_dms[0] + lon_dms[1] / 60.0 + lon_dms[2] / 3600.0
                                lat_ref = gps_ifd[1][2].decode("ascii", errors="ignore").strip("\x00 ").upper() if 1 in gps_ifd else "N"
                                lon_ref = gps_ifd[3][2].decode("ascii", errors="ignore").strip("\x00 ").upper() if 3 in gps_ifd else "E"
                                if lat_ref == "S":
                                    lat = -lat
                                if lon_ref == "W":
                                    lon = -lon
                                location = {"latitude": round(lat, 6), "longitude": round(lon, 6)}
    except Exception:
        pass

    return date_taken, location


def clean_new_tags(candidates: list[Any], existing_tags: list[str]) -> list[str]:
    existing_lower = {t.lower() for t in existing_tags}
    seen_lower: set[str] = set()
    cleaned: list[str] = []
    for item in candidates:
        if not isinstance(item, str):
            continue
        tag = " ".join(item.strip().split())
        if not tag or "," in tag:
            continue
        low = tag.lower()
        if low in existing_lower or low in seen_lower or low in GENERIC_STOPLIST:
            continue
        seen_lower.add(low)
        cleaned.append(tag)
    return cleaned


def parse_location_arg(
    raw: str | None,
) -> tuple[dict[str, float] | None, str | None]:
    """Parse --location as 'lat, lon' (or Google Maps URL with @lat,lon) or a plain place name."""
    if raw is None:
        return None, None
    trimmed = raw.strip()
    if not trimmed or trimmed.lower() == "none":
        return None, None

    # Match decimal coordinates: "35.7993, -82.9548" or "35.7993 -82.9548" or "@35.7993,-82.9548"
    coord_match = re.search(
        r"(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)", trimmed
    )
    if coord_match:
        lat = float(coord_match.group(1))
        lon = float(coord_match.group(2))
        if -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
            return {"latitude": round(lat, 6), "longitude": round(lon, 6)}, None

    return None, trimmed


def load_system_tags_vocabulary(
    system_tags_arg: str | None,
    catalog_path: Path,
    photo: dict[str, Any],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
    location_text: str | None = None,
    limit: int = 120,
) -> list[str]:
    """Load optional system/catalog tag vocabulary, filtered to avoid unrelated geographic hallucinations."""
    if not system_tags_arg:
        return []

    existing_lower = {t.strip().lower() for t in existing_tags if t.strip()}
    counts: dict[str, int] = {}

    if system_tags_arg == "__CATALOG__":
        if not catalog_path.exists():
            return []
        try:
            catalog_data = json.loads(catalog_path.read_text(encoding="utf-8"))
        except Exception:
            return []
        for entry in catalog_data:
            for raw in entry.get("keywords") or []:
                tag = str(raw).strip()
                if tag and tag.lower() not in existing_lower:
                    counts[tag] = counts.get(tag, 0) + 1
    else:
        cand_path = Path(system_tags_arg).expanduser()
        if cand_path.exists() and cand_path.is_file():
            raw_text = cand_path.read_text(encoding="utf-8", errors="replace")
            try:
                parsed = json.loads(raw_text)
                if isinstance(parsed, list):
                    for item in parsed:
                        if isinstance(item, str) and item.strip():
                            t = item.strip()
                            if t.lower() not in existing_lower:
                                counts[t] = counts.get(t, 0) + 1
                        elif isinstance(item, dict):
                            for raw in item.get("keywords") or []:
                                t = str(raw).strip()
                                if t and t.lower() not in existing_lower:
                                    counts[t] = counts.get(t, 0) + 1
            except Exception:
                for tok in re.split(r"[,\n]+", raw_text):
                    t = tok.strip()
                    if t and t.lower() not in existing_lower:
                        counts[t] = counts.get(t, 0) + 1
        else:
            for tok in system_tags_arg.split(","):
                t = tok.strip()
                if t and t.lower() not in existing_lower:
                    counts[t] = counts.get(t, 0) + 1

    if not counts:
        return []

    # Build context text from this photo's metadata + location so proper-noun tags
    # from unrelated states/parks don't pollute this photo.
    context_parts = [
        str(photo.get("title") or ""),
        str(photo.get("description") or ""),
        " ".join(str(c) for c in (photo.get("categories") or [])),
        location_text or "",
    ]
    if geo:
        context_parts.append(str(geo.get("name") or ""))
        context_parts.append(str(geo.get("display_name") or ""))
        addr = geo.get("address")
        if isinstance(addr, dict):
            context_parts.extend(str(v) for v in addr.values())
    context_text = " ".join(context_parts).lower()

    matched_context: list[tuple[str, int]] = []
    common_subjects: list[tuple[str, int]] = []
    for tag, cnt in counts.items():
        low = tag.lower()
        if context_text and len(low) >= 2 and low in context_text:
            matched_context.append((tag, cnt))
        elif tag == low:
            common_subjects.append((tag, cnt))

    matched_context.sort(key=lambda kv: (-kv[1], kv[0].lower()))
    common_subjects.sort(key=lambda kv: (-kv[1], kv[0].lower()))

    combined: list[str] = []
    seen: set[str] = set()
    for tag, _ in matched_context[:40] + common_subjects:
        low = tag.lower()
        if low in seen:
            continue
        seen.add(low)
        combined.append(tag)
        if len(combined) >= limit:
            break
    return combined


def parse_added_tags_from_content(content: str) -> list[Any]:
    trimmed = content.strip()
    for candidate in (trimmed,):
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict) and isinstance(parsed.get("added_tags"), list):
                return parsed["added_tags"]
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    match = re.search(r"\{[\s\S]*\}", trimmed)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict) and isinstance(parsed.get("added_tags"), list):
                return parsed["added_tags"]
        except Exception:
            pass

    # Fallback if num_predict truncated a JSON array mid-output
    arr_start = trimmed.find("[")
    if arr_start != -1:
        strings = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', trimmed[arr_start + 1 :])
        if strings:
            return strings

    raise RuntimeError("Ollama returned an unexpected response format instead of JSON tags.")


def build_prompt(
    photo: dict[str, Any],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
    system_tags: list[str] | None = None,
    location_text: str | None = None,
) -> str:
    dt = photo.get("dateTaken") or {}
    date_str = (
        f"{dt.get('year', '')}-{dt.get('month', '')}-{dt.get('day', '')}".strip("-")
        or "unknown"
    )
    loc = photo.get("location")
    loc_str = f"{loc['latitude']},{loc['longitude']}" if loc else (location_text or "none")
    geo_summary = json.dumps(geo, ensure_ascii=False) if geo else (location_text or "none")
    has_existing = len(existing_tags) > 0
    albums_str = ", ".join(photo.get("categories") or []) or "(none)"
    existing_str = ", ".join(existing_tags) if has_existing else "(none)"
    vocab_line = (
        f"\n- Established catalog/system tags (prefer reusing exact spelling/casing from this list when clearly relevant to this photo, and also add new specific tags not in this list when warranted): {', '.join(system_tags)}"
        if system_tags
        else ""
    )

    if has_existing:
        task_block = """Task:
Look closely at the photograph and its location/metadata. Suggest ONLY genuinely missing, high-value NEW search tags (typically 3 to 12 tags, or fewer if the photo is already well tagged) that are clearly supported by what is visible in the photo or its verified location. Do not pad with filler, spelling variants, or near-duplicates of existing tags (e.g. do not add "Hawai'i" or "Big Island Hawaii" if "Hawaii" and "Big Island" are already present)."""
    else:
        task_block = """Task:
This photograph currently has NO tags. Look closely at the photograph and its location/metadata and generate a thorough, well-rounded set of 15 to 25 distinct, high-value search tags covering:
- Verified geographic places from the title, description, and location/reverse-geocoded GPS (landmarks, parks, bays, beaches, towns, islands, counties, full US state name, and 2-letter US state code).
- All prominent visual subjects and natural/architectural features (e.g. palm trees, beach, coast, clouds, water, reflection, silhouette, bridge, waterfall, wildflowers).
- Time of day, lighting, weather, and season (e.g. sunset, sunrise, dusk, twilight, evening, fog, autumn, winter).
- Format or technique only if obvious (e.g. panorama, black and white, long exposure).
Avoid redundant near-duplicates (e.g. do not output both "stone bridge" and "stone structure" and "stone construction")."""

    return f"""You are a fine-art & nature photography archivist adding search tags to a curated photo catalog.

Photo metadata:
- Title: {photo.get('title', '') or '(none)'}
- Description: {photo.get('description', '') or '(none)'}
- Date: {date_str}
- Location / GPS: {loc_str}
- Reverse-geocoded place: {geo_summary}
- Albums: {albums_str}
- Existing tags on this photo (DO NOT repeat, rephrase, or duplicate any of these): {existing_str}{vocab_line}

{task_block}

Strict rules:
1. DO NOT repeat any existing tag on this photo (including singular/plural duplicates, punctuation/diacritic variants, or combined duplicates of existing tags).
2. ALWAYS use Title Case for ALL proper nouns—including landmarks, parks, bays, beaches, oceans, rivers, mountains, islands, towns, counties, streets/places from GPS, states, and 2-letter US state codes (e.g. "Pacific Ocean", "Hawaii", "HI", "Big Island", "Waikoloa", "Ku'uali'i Place", "North Carolina", "NC").
3. Use lowercase for common visual subjects, features, weather, lighting, seasons, flora/fauna, and structures (e.g. "palm trees", "beach", "sunset", "dusk", "reflection", "silhouette", "clouds", "waterwheel", "wooden bridge", "autumn", "fog").
4. Include BOTH the full US state name and 2-letter state code as separate tags (e.g. "Hawaii", "HI") ONLY if the photo is in the US and either is missing from existing tags. Never include any state, county, or place that does not match this photo's verified location.
5. NO generic filler words (avoid: nature, scenic, outdoor, photography, photo, landscape, beautiful, view, travel, USA, United States, daytime).
6. Do NOT guess obscure species or landmark names unless confident from the image + coordinates/description.
7. Return JSON matching the schema: {{"added_tags": ["tag1", "tag2", ...]}}."""


def call_gemini(
    api_key: str,
    model: str,
    image_path: Path,
    photo: dict[str, Any],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
    system_tags: list[str] | None = None,
    location_text: str | None = None,
) -> list[str]:
    mime, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(photo, existing_tags, geo, system_tags, location_text)

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime, "data": img_b64}},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "added_tags": {
                        "type": "ARRAY",
                        "items": {"type": "STRING"},
                    }
                },
                "required": ["added_tags"],
            },
        },
    }

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model)}:generateContent?key={urllib.parse.quote(api_key)}"
    )
    body = json.dumps(payload).encode("utf-8")

    for attempt in range(5):
        req = urllib.request.Request(
            url, data=body, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            raw_tags = parsed.get("added_tags", [])
            return clean_new_tags(raw_tags if isinstance(raw_tags, list) else [], existing_tags)
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"Gemini HTTP {exc.code}: {err_body[:400]}") from exc
        except Exception as exc:
            if attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"Gemini request failed: {exc}") from exc
    return []


def call_ollama(
    ollama_url: str,
    model: str,
    image_path: Path,
    photo: dict[str, Any],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
    system_tags: list[str] | None = None,
    location_text: str | None = None,
) -> list[str]:
    _, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(photo, existing_tags, geo, system_tags, location_text)
    is_from_scratch = len(existing_tags) == 0

    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
        "format": {
            "type": "object",
            "properties": {
                "added_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "maxItems": 28 if is_from_scratch else 15,
                }
            },
            "required": ["added_tags"],
        },
        "options": {
            "temperature": 0.2,
            "num_predict": 384 if is_from_scratch else 256,
            "repeat_penalty": 1.15,
        },
    }

    url = f"{ollama_url.rstrip('/')}/api/chat"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp_json = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")[:400]
        if exc.code == 404 or "not found" in err_body.lower():
            raise RuntimeError(
                f'Ollama model "{model}" not found at {ollama_url}. Run: ollama pull {model}'
            ) from exc
        raise RuntimeError(f"Ollama HTTP {exc.code}: {err_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not connect to Ollama at {ollama_url}. Make sure Ollama is running (e.g. `brew services start ollama` or `ollama serve`)."
        ) from exc

    content = (resp_json.get("message") or {}).get("content", "")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("Ollama returned an empty response.")
    raw_tags = parse_added_tags_from_content(content)
    return clean_new_tags(raw_tags if isinstance(raw_tags, list) else [], existing_tags)


def write_reports(
    entries: list[dict[str, Any]], md_path: Path, csv_path: Path
) -> None:
    md_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Photo Tagging Review Report",
        "",
        f"Total photos processed: **{len(entries)}**",
        "",
        "| Photo ID | Title | Added Tags | Existing Tags |",
        "| --- | --- | --- | --- |",
    ]
    for e in entries:
        title = (e.get("title") or "").replace("|", "\\|")
        added = ", ".join(e.get("added_tags") or []).replace("|", "\\|")
        existing = ", ".join(e.get("existing_tags") or []).replace("|", "\\|")
        lines.append(f"| `{e['photo_id']}` | {title} | {added} | {existing} |")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["photo_id", "title", "existing_tags", "added_tags"])
        for e in entries:
            w.writerow(
                [
                    e["photo_id"],
                    e.get("title", ""),
                    ",".join(e.get("existing_tags") or []),
                    ",".join(e.get("added_tags") or []),
                ]
            )


def main() -> None:
    load_env_file(REPO_ROOT / ".env.local")

    parser = argparse.ArgumentParser(
        description="Enrich Lumenist photo tags using local Ollama Vision (default) or Gemini Vision + GPS."
    )
    parser.add_argument("--image", help="Standalone local image file to tag (not yet in catalog)")
    parser.add_argument(
        "--location",
        default=None,
        help="Location for --image: 'lat, lon' coordinates, Google Maps URL, or place name (falls back to EXIF GPS; pass 'none' if unknown)",
    )
    parser.add_argument("--title", default="", help="Optional title context (used with --image)")
    parser.add_argument("--description", default="", help="Optional description context (used with --image)")
    parser.add_argument("--albums", default="", help="Optional comma-separated albums/categories (used with --image)")
    parser.add_argument("--tags", default="", help="Optional comma-separated existing image tags to exclude (used with --image)")
    parser.add_argument(
        "--system-tags",
        nargs="?",
        const="__CATALOG__",
        default=None,
        help="Optional existing system/catalog tags to prefer: omit for none, pass flag alone to load from --catalog (data/photos.json), or pass a comma-separated list or file path",
    )
    parser.add_argument("--lat", type=float, default=None, help="Optional GPS latitude override (used with --image)")
    parser.add_argument("--lon", type=float, default=None, help="Optional GPS longitude override (used with --image)")
    parser.add_argument("--photo", help="Single photoID to process")
    parser.add_argument("--folder", help="Filter by folder/year (e.g. 2026 or Film)")
    parser.add_argument("--all", action="store_true", help="Process all photos in catalog")
    parser.add_argument("--photos-dir", help="Override photos directory")
    parser.add_argument(
        "--catalog",
        default=str(REPO_ROOT / "data" / "photos.json"),
        help="Path to photos.json catalog",
    )
    parser.add_argument(
        "--provider", choices=("ollama", "gemini"), default="ollama"
    )
    parser.add_argument("--model", default=None)
    parser.add_argument("--ollama-url", default=os.environ.get("OLLAMA_HOST", DEFAULT_OLLAMA_URL))
    parser.add_argument("--workers", type=int, default=None)
    parser.add_argument("--apply", action="store_true", help="Write merged tags to data/photos.json")
    parser.add_argument("--force", action="store_true", help="Ignore cached results")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    if not args.image and not args.photo and not args.folder and not args.all:
        raise SystemExit("Specify one of --image <path>, --photo <ID>, --folder <name>, or --all.")

    provider = args.provider
    if provider == "gemini":
        model = args.model or os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        workers = args.workers if args.workers is not None else 4
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            sys.exit("Error: GEMINI_API_KEY is not set in .env.local or environment.")
    else:
        model = args.model or os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        workers = args.workers if args.workers is not None else 1
        api_key = ""

    catalog_path = Path(args.catalog).resolve()
    geo_cache_path = REPO_ROOT / "data" / "geocode-cache.json"
    geocoder = Geocoder(geo_cache_path)

    # Standalone image mode (for images not yet added to the site)
    if args.image:
        img_path = Path(args.image).expanduser().resolve()
        if not img_path.exists() or not img_path.is_file():
            sys.exit(f"Error: Image file not found: {img_path}")

        date_taken, exif_loc = extract_exif_metadata(img_path)
        parsed_loc, location_text = parse_location_arg(args.location)
        if args.lat is not None and args.lon is not None:
            loc = {"latitude": args.lat, "longitude": args.lon}
        elif parsed_loc is not None:
            loc = parsed_loc
        else:
            loc = exif_loc

        if (
            loc is None
            and not location_text
            and (args.location is None or args.location.strip().lower() != "none")
        ):
            sys.exit(
                "Error: No GPS coordinates found in image EXIF. Provide --location \"lat, lon\" (or --location \"Place Name\", or --location none)."
            )

        geo = (
            geocoder.reverse(float(loc["latitude"]), float(loc["longitude"]))
            if loc
            else None
        )
        existing_tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        albums = [a.strip() for a in args.albums.split(",") if a.strip()]
        photo: dict[str, Any] = {
            "photoID": img_path.stem,
            "title": args.title,
            "description": args.description,
            "dateTaken": date_taken,
            "location": loc,
            "categories": albums,
            "keywords": existing_tags,
        }
        system_tags = load_system_tags_vocabulary(
            args.system_tags, catalog_path, photo, existing_tags, geo, location_text
        )

        loc_display = (
            f"{loc['latitude']},{loc['longitude']}"
            if loc
            else (location_text or "none")
        )
        print(
            f"Image: {img_path.name} | Provider: {provider} | Model: {model} | Location: {loc_display}"
            + (f" | System tags: {len(system_tags)}" if system_tags else ""),
            file=sys.stderr,
            flush=True,
        )
        if geo and geo.get("display_name"):
            print(f"Place: {geo['display_name']}", file=sys.stderr, flush=True)

        if provider == "gemini":
            added_tags = call_gemini(
                api_key, model, img_path, photo, existing_tags, geo, system_tags, location_text
            )
        else:
            added_tags = call_ollama(
                args.ollama_url, model, img_path, photo, existing_tags, geo, system_tags, location_text
            )

        print(", ".join(added_tags))
        return

    if not catalog_path.exists():
        sys.exit(f"Error: Catalog not found: {catalog_path}")

    photos_dir = resolve_photos_dir(args.photos_dir)
    catalog: list[dict[str, Any]] = json.loads(catalog_path.read_text(encoding="utf-8"))

    targets: list[dict[str, Any]] = []
    for p in catalog:
        pid = str(p.get("photoID", ""))
        if args.photo and pid != args.photo:
            continue
        if args.folder:
            rel = str(p.get("imageDesktop", ""))
            year = str((p.get("dateTaken") or {}).get("year", ""))
            if f"/photos/{args.folder}/" not in rel and year != args.folder:
                continue
        targets.append(p)

    if args.limit > 0:
        targets = targets[: args.limit]
    if not targets:
        print("No matching photos found in catalog.")
        sys.exit(0)

    cache_path = REPO_ROOT / "data" / (
        "tag-cache.json" if provider == "gemini" else "tag-cache-ollama.json"
    )
    md_report_path = REPO_ROOT / "data" / "tag-review.md"
    csv_report_path = REPO_ROOT / "data" / "tag-review.csv"

    cache: dict[str, Any] = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(
        f"Mode: {mode} | Provider: {provider} | Model: {model} | Workers: {workers} | Photos: {len(targets)}",
        flush=True,
    )

    state_lock = threading.Lock()
    report_entries: list[dict[str, Any]] = []
    updated_count = 0
    error_count = 0
    completed = 0
    total = len(targets)

    def process_one(photo: dict[str, Any]) -> None:
        nonlocal updated_count, error_count, completed
        pid = str(photo.get("photoID", ""))
        img_path = resolve_image_path(photo, photos_dir)
        if not img_path:
            with state_lock:
                completed += 1
                print(f"[{completed}/{total}] {pid}: skipped (image file not found)", flush=True)
            return

        existing_tags = [str(t).strip() for t in (photo.get("keywords") or []) if str(t).strip()]
        loc = photo.get("location")
        loc_key = (
            f"{float(loc['latitude']):.4f},{float(loc['longitude']):.4f}"
            if loc and "latitude" in loc and "longitude" in loc
            else None
        )

        with state_lock:
            cached = None if args.force else cache.get(pid)
            if cached is not None and "location" in cached and cached["location"] != loc_key:
                cached = None

        if cached is not None:
            added_tags = clean_new_tags(cached.get("added_tags", []), existing_tags)
            source_note = "cached"
        else:
            geo = (
                geocoder.reverse(float(loc["latitude"]), float(loc["longitude"]))
                if loc_key is not None
                else None
            )
            system_tags = load_system_tags_vocabulary(
                args.system_tags, catalog_path, photo, existing_tags, geo
            )
            try:
                if provider == "gemini":
                    added_tags = call_gemini(
                        api_key, model, img_path, photo, existing_tags, geo, system_tags
                    )
                else:
                    added_tags = call_ollama(
                        args.ollama_url, model, img_path, photo, existing_tags, geo, system_tags
                    )
            except Exception as exc:
                with state_lock:
                    completed += 1
                    error_count += 1
                    print(f"[{completed}/{total}] {pid}: ERROR - {exc}", file=sys.stderr, flush=True)
                return

            with state_lock:
                cache[pid] = {
                    "title": photo.get("title", ""),
                    "location": loc_key,
                    "original_tags": existing_tags,
                    "added_tags": added_tags,
                    "model": model,
                }
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")
            source_note = provider

        did_update = False
        if args.apply and added_tags:
            seen = {t.lower() for t in existing_tags}
            merged = list(existing_tags)
            for t in added_tags:
                if t.lower() not in seen:
                    merged.append(t)
                    seen.add(t.lower())
            merged.sort(key=str.lower)
            photo["keywords"] = merged
            did_update = True

        with state_lock:
            completed += 1
            if did_update:
                updated_count += 1
            report_entries.append(
                {
                    "photo_id": pid,
                    "title": photo.get("title", ""),
                    "existing_tags": existing_tags,
                    "added_tags": added_tags,
                }
            )
            preview = ", ".join(added_tags) if added_tags else "(none)"
            print(
                f"[{completed}/{total} | edited: {updated_count} | err: {error_count}] {pid} ({source_note}): +{len(added_tags)} -> {preview}",
                flush=True,
            )

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futs = [pool.submit(process_one, p) for p in targets]
        for fut in as_completed(futs):
            fut.result()

    if args.apply and updated_count > 0:
        catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")

    report_entries.sort(key=lambda e: e["photo_id"])
    write_reports(report_entries, md_report_path, csv_report_path)
    print(
        f"\nDone. Processed: {len(report_entries)} | Updated: {updated_count} | Errors: {error_count}",
        flush=True,
    )
    print(f"  Review report (Markdown): {md_report_path}")
    print(f"  Review report (CSV):      {csv_report_path}")


if __name__ == "__main__":
    main()
