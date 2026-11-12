#!/usr/bin/env python3
"""
Batch resize images from RRKPhoto_fullsize into www/rrkphoto.com/photos
- Resizes clean fullsize images to max 1600px along longest edge
- Uses macOS native sips (CoreImage/ImageIO) for color profile accuracy and speed
- Quality set to 85 (optimal balance for screen fidelity and fast loading)
"""

import os
import sys
import glob
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

FULLSIZE_DIR = "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/Photography/rrkphoto/RRKPhoto_fullsize"
WWW_PHOTOS_DIR = "/Users/ketchemr/Library/CloudStorage/GoogleDrive-ketchemr@gmail.com/My Drive/www/rrkphoto.com/photos"
MAX_DIMENSION = 1600
JPEG_QUALITY = 85

def index_fullsize():
    fullsize_map = {}
    pattern = os.path.join(FULLSIZE_DIR, "**", "*.jpg")
    for f in glob.glob(pattern, recursive=True):
        base = os.path.basename(f)
        if "_fullsize.jpg" in base:
            key = base.replace("_fullsize.jpg", "")
            fullsize_map[key] = f
        elif ".jpg" in base:
            key = base.replace(".jpg", "")
            fullsize_map[key] = f
    return fullsize_map

def process_photo(item):
    target_path, src_path = item
    try:
        cmd = [
            "sips",
            "-s", "formatOptions", str(JPEG_QUALITY),
            "-Z", str(MAX_DIMENSION),
            src_path,
            "--out", target_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        if res.returncode == 0:
            return True, target_path, None
        else:
            return False, target_path, res.stderr
    except Exception as e:
        return False, target_path, str(e)

def main():
    print(f"Indexing fullsize images from: {FULLSIZE_DIR} ...")
    fullsize_map = index_fullsize()
    print(f"Found {len(fullsize_map)} fullsize images.")

    target_pattern = os.path.join(WWW_PHOTOS_DIR, "**", "*_desktop.jpg")
    www_photos = sorted(glob.glob(target_pattern, recursive=True))
    print(f"Found {len(www_photos)} target desktop photos in www/rrkphoto.com/photos.")

    tasks = []
    missing = []
    for target in www_photos:
        base = os.path.basename(target)
        key = base.replace("_desktop.jpg", "").replace(".jpg", "")
        if key in fullsize_map:
            tasks.append((target, fullsize_map[key]))
        else:
            missing.append(target)

    print(f"Ready to process {len(tasks)} photos ({len(missing)} missing fullsize source).")
    if missing:
        print("Missing sources:")
        for m in missing:
            print("  ", m)

    start_time = time.time()
    success_count = 0
    fail_count = 0

    # Use 8 concurrent threads for fast batch processing on Mac Apple Silicon
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(process_photo, item): item for item in tasks}
        for future in as_completed(futures):
            ok, target, err = future.result()
            if ok:
                success_count += 1
                if success_count % 100 == 0 or success_count == len(tasks):
                    print(f"  Processed {success_count}/{len(tasks)} photos...")
            else:
                fail_count += 1
                print(f"  FAILED: {target}: {err}")

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.2f} seconds!")
    print(f"Successfully replaced: {success_count}")
    print(f"Failed: {fail_count}")
    print(f"Skipped (missing source): {len(missing)}")

if __name__ == "__main__":
    main()
