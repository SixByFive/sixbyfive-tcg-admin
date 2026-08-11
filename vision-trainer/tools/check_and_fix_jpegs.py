# FILE: tools/check_and_fix_jpegs.py
#
# PURPOSE
# - Scan a dataset folder recursively
# - Detect invalid or suspicious image files
# - Attempt to open/verify each image
# - Optionally re-save JPEGs cleanly to remove bad metadata/stream junk
#
# USAGE
#   python tools/check_and_fix_jpegs.py --root "H:/path/to/dataset"
#   python tools/check_and_fix_jpegs.py --root "H:/path/to/dataset" --fix
#
# NOTES
# - --fix will overwrite problematic JPEG/JPG files with a clean re-encoded version
# - Non-JPEG files are only checked, not converted
# - This uses Pillow, which is usually enough for cleanup

import argparse
import os
from pathlib import Path
from PIL import Image, ImageFile

# Allow Pillow to load truncated images where possible
ImageFile.LOAD_TRUNCATED_IMAGES = True

VALID_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def is_image_file(path: Path) -> bool:
    return path.suffix.lower() in VALID_EXTS


def verify_image(path: Path):
    """
    Verify image integrity without fully decoding pixel data.
    Returns (ok, message).
    """
    try:
        with Image.open(path) as img:
            img.verify()
        return True, "OK"
    except Exception as e:
        return False, f"VERIFY_FAIL: {e}"


def load_image(path: Path):
    """
    Fully load image pixel data.
    Returns (ok, message, image_mode, image_size).
    """
    try:
        with Image.open(path) as img:
            img.load()
            return True, "LOADED", img.mode, img.size
    except Exception as e:
        return False, f"LOAD_FAIL: {e}", None, None


def clean_resave_jpeg(path: Path):
    """
    Re-encode a JPEG cleanly.
    This removes messy metadata / malformed stream issues in many cases.
    """
    tmp_path = path.with_suffix(path.suffix + ".tmp")

    with Image.open(path) as img:
        # Force decode and normalize mode
        img = img.convert("RGB")
        img.save(
            tmp_path,
            format="JPEG",
            quality=95,
            optimize=True,
            progressive=False,
        )

    # Replace original only after successful write
    os.replace(tmp_path, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, help="Root dataset folder")
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Re-save JPEG/JPG files cleanly if they can be opened",
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return

    total = 0
    ok_count = 0
    bad_count = 0
    fixed_count = 0

    bad_files = []

    for path in root.rglob("*"):
        if not path.is_file() or not is_image_file(path):
            continue

        total += 1
        verify_ok, verify_msg = verify_image(path)
        load_ok, load_msg, mode, size = load_image(path)

        if verify_ok and load_ok:
            ok_count += 1
            print(f"[OK] {path} | {mode} | {size}")
            continue

        bad_count += 1
        bad_files.append((path, verify_msg, load_msg))
        print(f"[BAD] {path}")
        print(f"      verify={verify_msg}")
        print(f"      load={load_msg}")

        # Only try to fix JPEGs that still load
        if args.fix and path.suffix.lower() in {'.jpg', '.jpeg'} and load_ok:
            try:
                clean_resave_jpeg(path)
                fixed_count += 1
                print(f"      [FIXED] Re-saved JPEG cleanly")
            except Exception as e:
                print(f"      [FIX_FAIL] {e}")

    print("\n=== SUMMARY ===")
    print(f"Total checked: {total}")
    print(f"OK: {ok_count}")
    print(f"Bad/suspicious: {bad_count}")
    print(f"Fixed: {fixed_count}")

    if bad_files:
        print("\n=== BAD FILES ===")
        for path, verify_msg, load_msg in bad_files:
            print(f"{path}")
            print(f"  verify={verify_msg}")
            print(f"  load={load_msg}")


if __name__ == "__main__":
    main()