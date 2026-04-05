#!/usr/bin/env python3
"""
Deduplicate images in presentations-paulo by content (md5 hash).

Creates:
  - assets/ directory with one copy of each unique image
  - assets-mapping.json mapping every original path to its assets/ path

Does NOT modify any markdown files or remove originals.

Usage:
  python3 dedupe-images.py [--help] [--dry-run]

Options:
  --dry-run   Print stats without creating assets/ or mapping file
  --help      Show this help message
"""

import argparse
import hashlib
import json
import os
import shutil
from collections import defaultdict
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent.resolve()
BASE_DIR = SCRIPT_DIR.parent  # project root (one level up from scripts/)
ASSETS_DIR = BASE_DIR / "assets"
MAPPING_FILE = SCRIPT_DIR / "assets-mapping.json"
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg"}


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def find_all_images(base: Path) -> list[Path]:
    """Find all image files, excluding the assets/ directory itself."""
    images = []
    for root, dirs, files in os.walk(base):
        # Skip the assets directory
        root_path = Path(root)
        if root_path == ASSETS_DIR or str(root_path).startswith(str(ASSETS_DIR) + os.sep):
            continue
        for f in files:
            p = root_path / f
            if p.suffix.lower() in IMAGE_EXTENSIONS:
                images.append(p)
    return sorted(images)


def build_hash_index(images: list[Path]) -> dict[str, list[Path]]:
    """Group images by md5 hash. Shows progress."""
    hash_to_paths: dict[str, list[Path]] = defaultdict(list)
    total = len(images)
    for i, img in enumerate(images):
        if (i + 1) % 200 == 0 or i == 0 or (i + 1) == total:
            print(f"  Hashing: {i + 1}/{total}")
        h = md5_file(img)
        hash_to_paths[h].append(img)
    return hash_to_paths


def choose_canonical_name(paths: list[Path]) -> str:
    """Pick the most common filename among duplicates."""
    name_counts: dict[str, int] = defaultdict(int)
    for p in paths:
        name_counts[p.name] += 1
    # Most common name, tie-break alphabetically
    return max(name_counts, key=lambda n: (name_counts[n], -ord(n[0])))


def compute_assets_names(hash_to_paths: dict[str, list[Path]]) -> dict[str, str]:
    """
    For each unique hash, decide a filename in assets/.

    If two different hashes would map to the same filename,
    disambiguate by appending first 6 chars of the md5 hash.
    """
    # Step 1: pick canonical name per hash
    hash_to_candidate: dict[str, str] = {}
    for h, paths in hash_to_paths.items():
        hash_to_candidate[h] = choose_canonical_name(paths)

    # Step 2: detect filename collisions (different hashes, same candidate name)
    name_to_hashes: dict[str, list[str]] = defaultdict(list)
    for h, name in hash_to_candidate.items():
        name_to_hashes[name].append(h)

    # Step 3: resolve collisions
    hash_to_final: dict[str, str] = {}
    for name, hashes in name_to_hashes.items():
        if len(hashes) == 1:
            hash_to_final[hashes[0]] = name
        else:
            # Collision: append hash prefix
            for h in hashes:
                stem = Path(name).stem
                ext = Path(name).suffix
                hash_to_final[h] = f"{stem}_{h[:6]}{ext}"

    return hash_to_final


def find_markdown_references(base: Path) -> dict[str, list[str]]:
    """Find which markdown files reference which image filenames (informational)."""
    md_refs: dict[str, list[str]] = defaultdict(list)
    for root, dirs, files in os.walk(base):
        root_path = Path(root)
        if root_path == ASSETS_DIR or str(root_path).startswith(str(ASSETS_DIR) + os.sep):
            continue
        for f in files:
            if f.endswith(".md"):
                md_path = root_path / f
                try:
                    content = md_path.read_text(encoding="utf-8", errors="replace")
                except Exception:
                    continue
                # Look for image references (markdown and HTML)
                for img_ext in IMAGE_EXTENSIONS:
                    if img_ext in content.lower():
                        md_refs[str(md_path.relative_to(base))].append(str(md_path))
                        break
    return md_refs


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print stats without creating files")
    args = parser.parse_args()

    print(f"Base directory: {BASE_DIR}")
    print()

    # Step 1: Find all images
    print("Step 1: Finding all images...")
    images = find_all_images(BASE_DIR)
    total_count = len(images)
    total_size = sum(img.stat().st_size for img in images)
    print(f"  Found {total_count} image files ({total_size / 1024 / 1024:.2f} MB)")
    print()

    # Step 2: Hash them
    print("Step 2: Hashing images by content (md5)...")
    hash_to_paths = build_hash_index(images)
    unique_count = len(hash_to_paths)
    print(f"  Unique images by content: {unique_count}")
    duplicate_count = total_count - unique_count
    print(f"  Duplicates: {duplicate_count}")
    print()

    # Step 3: Compute unique sizes
    unique_size = 0
    for h, paths in hash_to_paths.items():
        unique_size += paths[0].stat().st_size
    saved_size = total_size - unique_size
    print(f"Step 3: Size analysis")
    print(f"  Total size (all images):    {total_size / 1024 / 1024:.2f} MB")
    print(f"  Unique size (deduplicated): {unique_size / 1024 / 1024:.2f} MB")
    print(f"  Savings:                    {saved_size / 1024 / 1024:.2f} MB ({saved_size / total_size * 100:.1f}%)")
    print()

    # Show top duplicates
    print("Top 10 most duplicated images:")
    sorted_dupes = sorted(hash_to_paths.items(), key=lambda x: len(x[1]), reverse=True)
    for i, (h, paths) in enumerate(sorted_dupes[:10]):
        size_each = paths[0].stat().st_size
        print(f"  {i+1}. {paths[0].name} — {len(paths)} copies, {size_each / 1024:.1f} KB each")
    print()

    if args.dry_run:
        print("Dry run — not creating assets/ or mapping file.")
        return

    # Step 4: Compute asset filenames
    print("Step 4: Computing asset filenames...")
    hash_to_final = compute_assets_names(hash_to_paths)

    # Check for any remaining collisions (shouldn't happen)
    final_names = list(hash_to_final.values())
    if len(final_names) != len(set(final_names)):
        print("  ERROR: filename collision after disambiguation!")
        from collections import Counter
        for name, cnt in Counter(final_names).most_common(5):
            if cnt > 1:
                print(f"    {name}: {cnt}")
        return

    print(f"  {len(hash_to_final)} unique filenames assigned")
    # How many needed disambiguation?
    disambiguated = sum(1 for name in hash_to_final.values() if len(Path(name).stem.split("_")[-1]) == 6)
    print(f"  Disambiguated (hash suffix): ~{disambiguated}")
    print()

    # Step 5: Create assets/ and copy files
    print("Step 5: Creating assets/ directory and copying unique images...")
    ASSETS_DIR.mkdir(exist_ok=True)
    copied = 0
    for h, final_name in hash_to_final.items():
        src = hash_to_paths[h][0]  # Copy first occurrence
        dst = ASSETS_DIR / final_name
        shutil.copy2(src, dst)
        copied += 1
        if copied % 100 == 0 or copied == len(hash_to_final):
            print(f"  Copied: {copied}/{len(hash_to_final)}")
    print()

    # Step 6: Build mapping
    print("Step 6: Building assets-mapping.json...")
    mapping = {}
    for h, paths in hash_to_paths.items():
        final_name = hash_to_final[h]
        assets_path = f"assets/{final_name}"
        for p in paths:
            rel = str(p.relative_to(BASE_DIR))
            mapping[rel] = assets_path

    # Sort by key for readability
    mapping = dict(sorted(mapping.items()))

    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)
    print(f"  Written {len(mapping)} entries to {MAPPING_FILE.name}")
    print()

    # Final summary
    assets_size = sum((ASSETS_DIR / f).stat().st_size for f in os.listdir(ASSETS_DIR) if (ASSETS_DIR / f).is_file())
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Total original images:   {total_count}")
    print(f"  Unique images (by md5):  {unique_count}")
    print(f"  Duplicates removed:      {duplicate_count}")
    print(f"  Original total size:     {total_size / 1024 / 1024:.2f} MB")
    print(f"  Assets directory size:   {assets_size / 1024 / 1024:.2f} MB")
    print(f"  Space savings:           {saved_size / 1024 / 1024:.2f} MB ({saved_size / total_size * 100:.1f}%)")
    print(f"  Mapping entries:         {len(mapping)}")
    print(f"  Assets directory:        {ASSETS_DIR}")
    print(f"  Mapping file:            {MAPPING_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
