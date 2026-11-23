#!/usr/bin/env python3
"""
AI-assisted photo tagger for Lumenist companion .txt metadata files.

Inspects each photo alongside its GPS coordinates (reverse-geocoded via
OpenStreetMap Nominatim), title, description, and existing tags, then asks
Gemini Vision to suggest only missing, specific, non-redundant tags.

Zero external Python dependencies (uses stdlib + macOS `sips` if available).

Usage:
  # Dry run on a single photo (default: does not modify .txt files)
  python3 scripts/tag-photos.py --photo d20261026144835

  # Dry run on one year folder
  python3 scripts/tag-photos.py --folder 2026

  # Analyze all photos and write updated tags to local .txt files
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


def load_env_file(env_path: Path) -> None:
    """Load key=value pairs from .env.local without overriding existing env vars."""
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
    for env_key in ("PHOTOS_SOURCE_DIR", "LOCAL_PHOTO_DIR"):
        val = os.environ.get(env_key, "").strip()
        if val:
            return Path(val).expanduser().resolve()
    return (REPO_ROOT / "public" / "photos").resolve()


def find_image_for_txt(txt_path: Path) -> Path | None:
    base = txt_path.stem
    parent = txt_path.parent
    for ext in (".jpg", ".jpeg", ".png", ".webp", "_desktop.jpg"):
        cand = parent / f"{base}{ext}"
        if cand.exists():
            return cand
    return None


def parse_txt(txt_path: Path) -> tuple[list[str], dict[str, str], str]:
    """Return (raw_lines, fields_dict, tag_field_name)."""
    raw_text = txt_path.read_text(encoding="utf-8", errors="replace")
    lines = raw_text.splitlines()
    fields: dict[str, str] = {}
    tag_field = "keyword"
    for line in lines:
        if ":" in line:
            k, v = line.split(":", 1)
            k_clean = k.strip()
            fields[k_clean] = v.strip()
            if k_clean in ("tags", "keyword"):
                tag_field = k_clean
    return lines, fields, tag_field


def split_csv_field(val: str) -> list[str]:
    if not val:
        return []
    return [item.strip() for item in val.split(",") if item.strip()]


def parse_coords(location_str: str) -> tuple[float, float] | None:
    if not location_str:
        return None
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$", location_str)
    if not m:
        return None
    return float(m.group(1)), float(m.group(2))


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
                with urllib.request.urlopen(req, timeout=15) as resp:
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
    """Resize image to max_dim with macOS `sips` if available, return (mime, b64)."""
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


def build_prompt(
    fields: dict[str, str],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
) -> str:
    date_parts = [
        fields.get("year", ""),
        fields.get("month", ""),
        fields.get("day", ""),
    ]
    date_str = "-".join(p for p in date_parts if p) or "unknown"

    geo_summary = "none"
    if geo:
        geo_summary = json.dumps(
            {
                "name": geo.get("name"),
                "display_name": geo.get("display_name"),
                "address": geo.get("address"),
            },
            ensure_ascii=False,
        )

    return f"""You are a fine-art & nature photography archivist adding missing search tags to an existing curated photo catalog.

Photo metadata:
- Title: {fields.get('title', '')}
- Description: {fields.get('description', '')}
- Date: {date_str}
- GPS coordinates: {fields.get('location', 'none')}
- Reverse-geocoded place: {geo_summary}
- Existing categories/albums: {fields.get('category', fields.get('albums', ''))}
- Existing tags (DO NOT repeat or duplicate any of these): {', '.join(existing_tags) if existing_tags else '(none)'}

Task:
Look closely at the photograph and its location/metadata. Suggest all genuinely relevant, high-value NEW search tags that are clearly supported by what is visible in the photo or its verified location. Use as few or as many as are truly warranted for this specific scene—do not pad with filler and do not omit important relevant terms.

Strict rules:
1. DO NOT repeat any existing tag (including trivial singular/plural duplicates of an existing tag).
2. Use Title Case for proper nouns (landmarks, parks, rivers, mountains, towns, counties, states, 2-letter US state abbreviations if missing, e.g. "TN", "Tennessee", "Appalachian Mountains", "John P. Cable Mill").
3. Use lowercase for common visual subjects, features, weather, lighting, seasons, flora/fauna, and structures (e.g. "waterwheel", "wooden bridge", "split-rail fence", "autumn", "fog", "reflection", "granite", "wildflowers").
4. Include BOTH the full US state name and 2-letter state code ONLY if the photo is in the US and either is missing from existing tags.
5. NO generic filler words (avoid: nature, scenic, outdoor, photography, photo, landscape, beautiful, view, travel, USA, United States, daytime).
6. Do NOT guess obscure species or landmark names unless confident from the image + coordinates/description.
7. Return JSON matching the schema: {{"added_tags": ["tag1", "tag2", ...]}}."""


def call_gemini(
    api_key: str,
    model: str,
    image_path: Path,
    fields: dict[str, str],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
) -> list[str]:
    mime, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(fields, existing_tags, geo)

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
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                resp_json = json.loads(resp.read().decode("utf-8"))
            text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(text)
            raw_tags = parsed.get("added_tags", [])
            if not isinstance(raw_tags, list):
                return []
            return clean_new_tags(raw_tags, existing_tags)
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                wait = 2 ** (attempt + 1)
                print(
                    f"  [retry] HTTP {exc.code} for {image_path.name}, waiting {wait}s...",
                    file=sys.stderr,
                )
                time.sleep(wait)
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
    fields: dict[str, str],
    existing_tags: list[str],
    geo: dict[str, Any] | None,
) -> list[str]:
    _, img_b64 = prepare_image_base64(image_path)
    prompt = build_prompt(fields, existing_tags, geo)

    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [img_b64],
            }
        ],
        "format": {
            "type": "object",
            "properties": {
                "added_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                }
            },
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
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            resp_json = json.loads(resp.read().decode("utf-8"))
        text = resp_json["message"]["content"]
        parsed = json.loads(text)
        raw_tags = parsed.get("added_tags", [])
        if not isinstance(raw_tags, list):
            return []
        return clean_new_tags(raw_tags, existing_tags)
    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not reach Ollama at {ollama_url} (is Ollama running?): {exc}"
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc


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


def apply_tags_to_txt(txt_path: Path, added_tags: list[str]) -> list[str]:
    """Merge added_tags into keyword: or tags: line, sorted case-insensitively."""
    raw_text = txt_path.read_text(encoding="utf-8", errors="replace")
    newline = "\r\n" if "\r\n" in raw_text else "\n"
    trailing_nl = raw_text.endswith("\n")
    lines = raw_text.splitlines()

    tag_line_idx = None
    tag_key = "keyword"
    existing: list[str] = []
    for idx, line in enumerate(lines):
        if line.startswith("keyword:") or line.startswith("tags:"):
            tag_line_idx = idx
            tag_key, val = line.split(":", 1)
            existing = split_csv_field(val)
            break

    existing_lower = {t.lower() for t in existing}
    merged = list(existing)
    for t in added_tags:
        if t.lower() not in existing_lower:
            merged.append(t)
            existing_lower.add(t.lower())

    merged.sort(key=lambda s: s.lower())
    new_line = f"{tag_key}:{','.join(merged)}"

    if tag_line_idx is not None:
        lines[tag_line_idx] = new_line
    else:
        lines.append(f"tags:{','.join(merged)}")

    out_text = newline.join(lines) + (newline if trailing_nl else "")
    txt_path.write_text(out_text, encoding="utf-8")
    return merged


def collect_txt_files(
    photos_dir: Path, photo_id: str | None, folder: str | None, all_photos: bool
) -> list[Path]:
    all_txts: list[Path] = []
    for sub in sorted(photos_dir.iterdir()):
        if not sub.is_dir():
            continue
        if folder and sub.name != folder:
            continue
        for f in sorted(sub.iterdir()):
            if (
                f.is_file()
                and f.suffix.lower() == ".txt"
                and not f.name.endswith("_desktop.txt")
                and f.name.lower() != "sample.txt"
            ):
                if photo_id and f.stem != photo_id:
                    continue
                all_txts.append(f)

    if not photo_id and not folder and not all_photos:
        raise SystemExit(
            "Specify one of --photo <ID>, --folder <name>, or --all."
        )
    return all_txts


def write_reports(
    entries: list[dict[str, Any]], md_path: Path, csv_path: Path
) -> None:
    md_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Photo Tagging Review Report",
        "",
        f"Total photos processed: **{len(entries)}**",
        "",
        "| Photo ID | Folder | Title | Added Tags | Existing Tags |",
        "| --- | --- | --- | --- | --- |",
    ]
    for e in entries:
        title = (e.get("title") or "").replace("|", "\\|")
        added = ", ".join(e.get("added_tags") or []).replace("|", "\\|")
        existing = ", ".join(e.get("existing_tags") or []).replace("|", "\\|")
        lines.append(
            f"| `{e['photo_id']}` | `{e['folder']}` | {title} | {added} | {existing} |"
        )
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            ["photo_id", "folder", "title", "location", "existing_tags", "added_tags"]
        )
        for e in entries:
            w.writerow(
                [
                    e["photo_id"],
                    e["folder"],
                    e.get("title", ""),
                    e.get("location", ""),
                    ",".join(e.get("existing_tags") or []),
                    ",".join(e.get("added_tags") or []),
                ]
            )


def main() -> None:
    load_env_file(REPO_ROOT / ".env.local")

    parser = argparse.ArgumentParser(
        description="Enrich Lumenist photo .txt tags using Gemini Vision + GPS."
    )
    parser.add_argument("--photo", help="Single photoID to process (e.g. d20261026144835)")
    parser.add_argument("--folder", help="Single subfolder to process (e.g. 2026)")
    parser.add_argument("--all", action="store_true", help="Process all photos")
    parser.add_argument("--photos-dir", help="Override photos directory")
    parser.add_argument(
        "--provider",
        choices=("gemini", "ollama"),
        default="gemini",
        help="Vision model provider: gemini (cloud) or ollama (local) (default: gemini)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help=f"Model name (default: {DEFAULT_GEMINI_MODEL} for gemini, {DEFAULT_OLLAMA_MODEL} for ollama)",
    )
    parser.add_argument(
        "--ollama-url",
        default=os.environ.get("OLLAMA_HOST", DEFAULT_OLLAMA_URL),
        help=f"Ollama base URL (default: {DEFAULT_OLLAMA_URL})",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Concurrent requests (default: 4 for gemini, 1 for ollama)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write merged tags into .txt files (default is dry-run)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-query Gemini even if photoID is already in cache",
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Optional cap on number of photos to process"
    )
    args = parser.parse_args()

    provider = args.provider
    if provider == "gemini":
        model = args.model or os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        workers = args.workers if args.workers is not None else 4
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            print(
                "Error: GEMINI_API_KEY is not set. Add GEMINI_API_KEY=... to .env.local or export it.",
                file=sys.stderr,
            )
            sys.exit(1)
    else:
        model = args.model or os.environ.get("OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL)
        workers = args.workers if args.workers is not None else 1
        api_key = ""

    photos_dir = resolve_photos_dir(args.photos_dir)
    if not photos_dir.exists():
        print(f"Error: Photos directory not found: {photos_dir}", file=sys.stderr)
        sys.exit(1)

    txt_files = collect_txt_files(photos_dir, args.photo, args.folder, args.all)
    if args.limit > 0:
        txt_files = txt_files[: args.limit]
    if not txt_files:
        print("No matching .txt files found.")
        sys.exit(0)

    cache_name = "tag-cache.json" if provider == "gemini" else "tag-cache-ollama.json"
    cache_path = REPO_ROOT / "data" / cache_name
    geo_cache_path = REPO_ROOT / "data" / "geocode-cache.json"
    md_report_path = REPO_ROOT / "data" / "tag-review.md"
    csv_report_path = REPO_ROOT / "data" / "tag-review.csv"

    cache: dict[str, Any] = {}
    if cache_path.exists():
        try:
            cache = json.loads(cache_path.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    geocoder = Geocoder(geo_cache_path)

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(
        f"Mode: {mode} | Provider: {provider} | Model: {model} | Workers: {workers} | Photos: {len(txt_files)}",
        flush=True,
    )
    print(f"Directory: {photos_dir}\n", flush=True)

    report_entries: list[dict[str, Any]] = []
    updated_count = 0
    already_edited_count = 0
    error_count = 0
    completed = 0
    state_lock = threading.Lock()
    total = len(txt_files)

    def process_one(txt_path: Path) -> None:
        nonlocal updated_count, already_edited_count, error_count, completed
        photo_id = txt_path.stem
        folder_name = txt_path.parent.name
        image_path = find_image_for_txt(txt_path)
        if not image_path:
            with state_lock:
                completed += 1
                print(
                    f"[{completed}/{total} | edited: {updated_count + already_edited_count} | err: {error_count}] {folder_name}/{photo_id}: skipped (no image file)",
                    flush=True,
                )
            return

        _, fields, tag_field = parse_txt(txt_path)
        existing_tags = split_csv_field(fields.get(tag_field, ""))
        coords = parse_coords(fields.get("location", ""))

        with state_lock:
            cached_entry = None if args.force else cache.get(photo_id)

        if cached_entry is not None:
            cached_added = cached_entry.get("added_tags", [])
            added_tags = clean_new_tags(cached_added, existing_tags)
            report_existing = cached_entry.get("original_tags", existing_tags)
            report_added = cached_added
            source_note = "cached"
        else:
            geo = geocoder.reverse(coords[0], coords[1]) if coords else None
            try:
                if provider == "gemini":
                    added_tags = call_gemini(
                        api_key=api_key,
                        model=model,
                        image_path=image_path,
                        fields=fields,
                        existing_tags=existing_tags,
                        geo=geo,
                    )
                else:
                    added_tags = call_ollama(
                        ollama_url=args.ollama_url,
                        model=model,
                        image_path=image_path,
                        fields=fields,
                        existing_tags=existing_tags,
                        geo=geo,
                    )
            except Exception as exc:
                with state_lock:
                    completed += 1
                    error_count += 1
                    print(
                        f"[{completed}/{total} | edited: {updated_count + already_edited_count} | err: {error_count}] {folder_name}/{photo_id}: ERROR - {exc}",
                        file=sys.stderr,
                        flush=True,
                    )
                return

            with state_lock:
                cache[photo_id] = {
                    "folder": folder_name,
                    "title": fields.get("title", ""),
                    "location": fields.get("location", ""),
                    "original_tags": existing_tags,
                    "added_tags": added_tags,
                    "model": model,
                }
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(
                    json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8"
                )
            report_existing = existing_tags
            report_added = added_tags
            source_note = provider

        did_update = False
        was_already_edited = False
        if args.apply:
            if added_tags:
                apply_tags_to_txt(txt_path, added_tags)
                did_update = True
            elif source_note == "cached" and report_added:
                was_already_edited = True

        with state_lock:
            completed += 1
            if did_update:
                updated_count += 1
            elif was_already_edited:
                already_edited_count += 1
            report_entries.append(
                {
                    "photo_id": photo_id,
                    "folder": folder_name,
                    "title": fields.get("title", ""),
                    "location": fields.get("location", ""),
                    "existing_tags": report_existing,
                    "added_tags": report_added,
                }
            )
            added_preview = ", ".join(report_added) if report_added else "(none)"
            print(
                f"[{completed}/{total} | edited: {updated_count + already_edited_count} | err: {error_count}] {folder_name}/{photo_id} ({source_note}): +{len(report_added)} -> {added_preview}",
                flush=True,
            )

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = [pool.submit(process_one, p) for p in txt_files]
        for fut in as_completed(futures):
            fut.result()

    report_entries.sort(key=lambda e: (e["folder"], e["photo_id"]))
    write_reports(report_entries, md_report_path, csv_report_path)
    total_edited = updated_count + already_edited_count
    print("\nDone.", flush=True)
    print(
        f"  Processed: {len(report_entries)} | Successful edits: {total_edited} (this run: {updated_count}, already edited: {already_edited_count}) | Errors: {error_count}",
        flush=True,
    )
    print(f"  Review report (Markdown): {md_report_path}", flush=True)
    print(f"  Review report (CSV):      {csv_report_path}", flush=True)


if __name__ == "__main__":
    main()
