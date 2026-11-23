#!/usr/bin/env python3
"""
AI-assisted photo tagger for Lumenist's data/photos.json catalog.

Inspects each photo alongside its GPS coordinates (reverse-geocoded via
OpenStreetMap Nominatim), title, description, and existing tags, then asks
Gemini Vision (or local Ollama) to suggest only missing, specific,
non-redundant tags.

Zero external Python dependencies (uses stdlib + macOS `sips` if available).

Usage:
  # Tag a standalone image not yet added to the site (prints comma-separated tags)
  python3 scripts/tag-photos.py --image /path/to/photo.jpg

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


def prepare_image_base64(image_path: Path, max_dim: int = 1024) -> tuple[str, str]:
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


def build_prompt(
    photo: dict[str, Any],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
) -> str:
    dt = photo.get("dateTaken") or {}
    date_str = (
        f"{dt.get('year', '')}-{dt.get('month', '')}-{dt.get('day', '')}".strip("-")
        or "unknown"
    )
    loc = photo.get("location")
    loc_str = f"{loc['latitude']},{loc['longitude']}" if loc else "none"
    geo_summary = json.dumps(geo, ensure_ascii=False) if geo else "none"

    return f"""You are a fine-art & nature photography archivist adding missing search tags to an existing curated photo catalog.

Photo metadata:
- Title: {photo.get('title', '')}
- Description: {photo.get('description', '')}
- Date: {date_str}
- GPS coordinates: {loc_str}
- Reverse-geocoded place: {geo_summary}
- Existing albums: {', '.join(photo.get('categories') or [])}
- Existing tags (DO NOT repeat or duplicate any of these): {', '.join(existing_tags) if existing_tags else '(none)'}

Task:
Look closely at the photograph and its location/metadata. Suggest all genuinely relevant, high-value NEW search tags that are clearly supported by what is visible in the photo or its verified location. Use as few or as many as are truly warranted for this specific scene—do not pad with filler and do not omit important relevant terms.

Strict rules:
1. DO NOT repeat any existing tag (including trivial singular/plural duplicates of an existing tag).
2. Use Title Case for proper nouns (landmarks, parks, rivers, mountains, towns, counties, states, 2-letter US state abbreviations if missing, e.g. "TN", "Tennessee", "Appalachian Mountains").
3. Use lowercase for common visual subjects, features, weather, lighting, seasons, flora/fauna, and structures (e.g. "waterwheel", "wooden bridge", "split-rail fence", "autumn", "fog", "reflection").
4. Include BOTH the full US state name and 2-letter state code ONLY if the photo is in the US and either is missing from existing tags.
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
) -> list[str]:
    mime, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(photo, existing_tags, geo)

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
) -> list[str]:
    _, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(photo, existing_tags, geo)

    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": prompt, "images": [img_b64]}],
        "format": {
            "type": "object",
            "properties": {"added_tags": {"type": "array", "items": {"type": "string"}}},
            "required": ["added_tags"],
        },
        "options": {"temperature": 0.2},
    }

    url = f"{ollama_url.rstrip('/')}/api/chat"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        resp_json = json.loads(resp.read().decode("utf-8"))
    parsed = json.loads(resp_json["message"]["content"])
    raw_tags = parsed.get("added_tags", [])
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
        description="Enrich Lumenist data/photos.json tags using Gemini Vision (or Ollama) + GPS."
    )
    parser.add_argument("--image", help="Standalone local image file to tag (not yet in catalog)")
    parser.add_argument("--title", default="", help="Optional title context (used with --image)")
    parser.add_argument("--description", default="", help="Optional description context (used with --image)")
    parser.add_argument("--tags", default="", help="Optional comma-separated existing tags to exclude (used with --image)")
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
        "--provider", choices=("gemini", "ollama"), default="gemini"
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

    geo_cache_path = REPO_ROOT / "data" / "geocode-cache.json"
    geocoder = Geocoder(geo_cache_path)

    # Standalone image mode (for images not yet added to the site)
    if args.image:
        img_path = Path(args.image).expanduser().resolve()
        if not img_path.exists() or not img_path.is_file():
            sys.exit(f"Error: Image file not found: {img_path}")

        date_taken, exif_loc = extract_exif_metadata(img_path)
        loc = (
            {"latitude": args.lat, "longitude": args.lon}
            if args.lat is not None and args.lon is not None
            else exif_loc
        )
        geo = (
            geocoder.reverse(float(loc["latitude"]), float(loc["longitude"]))
            if loc
            else None
        )
        existing_tags = [t.strip() for t in args.tags.split(",") if t.strip()]
        photo: dict[str, Any] = {
            "photoID": img_path.stem,
            "title": args.title,
            "description": args.description,
            "dateTaken": date_taken,
            "location": loc,
            "categories": [],
            "keywords": existing_tags,
        }

        print(
            f"Image: {img_path.name} | Provider: {provider} | Model: {model}"
            + (f" | GPS: {loc['latitude']},{loc['longitude']}" if loc else " | GPS: none"),
            file=sys.stderr,
            flush=True,
        )
        if geo and geo.get("display_name"):
            print(f"Place: {geo['display_name']}", file=sys.stderr, flush=True)

        if provider == "gemini":
            added_tags = call_gemini(api_key, model, img_path, photo, existing_tags, geo)
        else:
            added_tags = call_ollama(args.ollama_url, model, img_path, photo, existing_tags, geo)

        print(", ".join(added_tags))
        return

    catalog_path = Path(args.catalog).resolve()
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
            try:
                if provider == "gemini":
                    added_tags = call_gemini(api_key, model, img_path, photo, existing_tags, geo)
                else:
                    added_tags = call_ollama(args.ollama_url, model, img_path, photo, existing_tags, geo)
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
