#!/usr/bin/env python3
"""
Migrate presentations to centralized WebP assets.

Steps:
  0. Scan for .webp files in source dirs missing from assets-mapping.json
  1. Convert all PNG/JPG/JPEG in assets/ to WebP (quality 85)
  2. Update all markdown files: local image refs → relative path to assets/*.webp
  3. Optionally remove per-directory image copies (--cleanup)

Uses assets-mapping.json (from dedupe-images.py) as source of truth
for mapping original image paths to their canonical assets/ location.

Usage:
  python3 migrate-to-webp.py [--dry-run] [--cleanup] [--quality N]

Options:
  --dry-run     Show what would happen without making changes
  --cleanup     Remove per-directory image copies after migration
  --quality N   WebP quality (1-100, default: 85)
  --help        Show this help message

Examples:
  python3 migrate-to-webp.py --dry-run          # Preview changes
  python3 migrate-to-webp.py                     # Convert + update markdowns
  python3 migrate-to-webp.py --cleanup           # Also remove local image copies
  python3 migrate-to-webp.py --quality 90        # Higher quality WebP
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent.resolve()
BASE_DIR = SCRIPT_DIR.parent  # project root (one level up from scripts/)
ASSETS_DIR = BASE_DIR / "assets"
MAPPING_FILE = SCRIPT_DIR / "assets-mapping.json"
CONVERTIBLE_EXTS = {".png", ".jpg", ".jpeg"}
KEEP_AS_IS_EXTS = {".svg", ".gif"}
IMAGE_EXTS = CONVERTIBLE_EXTS | KEEP_AS_IS_EXTS | {".webp"}

# Matches Deckset image syntax: ![modifiers](filename.ext)
# Handles multiple images per line: ![inline](a.png) ![inline](b.png)
IMAGE_RE = re.compile(r'(!\[([^\]]*)\]\(([^)]+)\))')


def parse_args():
    parser = argparse.ArgumentParser(
        description="Migrate presentations to centralized WebP assets.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__.split("Usage:")[0],
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without making changes")
    parser.add_argument("--cleanup", action="store_true",
                        help="Remove per-directory image copies after migration")
    parser.add_argument("--quality", type=int, default=85,
                        help="WebP quality (1-100, default: 85)")
    return parser.parse_args()


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def load_mapping() -> dict[str, str]:
    """Load assets-mapping.json: {original_relative_path: assets/filename}."""
    if not MAPPING_FILE.exists():
        print(f"ERROR: {MAPPING_FILE} not found. Run dedupe-images.py first.")
        sys.exit(1)
    with open(MAPPING_FILE) as f:
        return json.load(f)


def save_mapping(mapping: dict[str, str]):
    """Save updated assets-mapping.json."""
    with open(MAPPING_FILE, "w") as f:
        json.dump(mapping, f, indent=2, sort_keys=True)


def patch_missing_webps(orig_mapping: dict[str, str], dry_run: bool) -> int:
    """
    Step 0: Find .webp files in source dirs that are missing from
    assets-mapping.json, copy them to assets/, and add to the mapping.
    """
    print(f"\n{'=' * 60}")
    print(f"STEP 0: Patch unmapped .webp files")
    print(f"{'=' * 60}")

    added = 0
    exclude_dirs = {ASSETS_DIR, BASE_DIR / "old"}

    for root, dirs, files in os.walk(BASE_DIR):
        root_path = Path(root)
        if any(root_path == ex or str(root_path).startswith(str(ex) + os.sep)
               for ex in exclude_dirs):
            continue
        for fname in files:
            if not fname.lower().endswith(".webp"):
                continue
            fpath = root_path / fname
            rel_key = str(fpath.relative_to(BASE_DIR))

            if rel_key in orig_mapping:
                continue  # already mapped

            # Determine asset name — check for conflicts
            asset_name = fname
            asset_path = ASSETS_DIR / asset_name
            if asset_path.exists():
                # Same name already in assets/ — check if same content
                if md5_file(fpath) == md5_file(asset_path):
                    # Same file, just add mapping
                    orig_mapping[rel_key] = f"assets/{asset_name}"
                    added += 1
                    continue
                else:
                    # Different content, add hash suffix
                    h = md5_file(fpath)[:6]
                    asset_name = f"{fpath.stem}_{h}.webp"
                    asset_path = ASSETS_DIR / asset_name

            if not dry_run:
                shutil.copy2(fpath, asset_path)
            orig_mapping[rel_key] = f"assets/{asset_name}"
            added += 1
            print(f"  + {rel_key} → assets/{asset_name}")

    if not dry_run and added > 0:
        save_mapping(orig_mapping)

    print(f"  Added {added} webp files to mapping")
    return added


def convert_assets_to_webp(quality: int, dry_run: bool) -> dict[str, str]:
    """
    Convert PNG/JPG/JPEG in assets/ to WebP. Returns mapping of
    old asset filename -> new asset filename (with .webp extension).
    Files already in WebP, SVG, and GIF are kept as-is.
    """
    rename_map = {}  # old_filename -> new_filename (within assets/)
    converted = 0
    skipped = 0
    kept = 0
    total_orig = 0
    total_new = 0

    files = sorted(ASSETS_DIR.iterdir())
    convertible = [f for f in files if f.is_file() and f.suffix.lower() in CONVERTIBLE_EXTS]
    already_webp = [f for f in files if f.is_file() and f.suffix.lower() == ".webp"]
    keep_files = [f for f in files if f.is_file() and f.suffix.lower() in KEEP_AS_IS_EXTS]

    print(f"\n{'=' * 60}")
    print(f"STEP 1: Convert images in assets/ to WebP (quality {quality})")
    print(f"{'=' * 60}")
    print(f"  Convertible (PNG/JPG/JPEG): {len(convertible)}")
    print(f"  Already WebP:               {len(already_webp)}")
    print(f"  Keep as-is (SVG/GIF):       {len(keep_files)}")

    # Already WebP → identity mapping
    for f in already_webp:
        rename_map[f.name] = f.name
        kept += 1

    # SVG/GIF → identity mapping
    for f in keep_files:
        rename_map[f.name] = f.name
        kept += 1

    # Convert PNG/JPG/JPEG → WebP
    for i, f in enumerate(convertible, 1):
        webp_name = f.stem + ".webp"
        webp_path = ASSETS_DIR / webp_name

        # Handle naming conflict: foo.png and foo.jpg both exist
        if webp_path.exists() and f.name not in rename_map:
            webp_name = f.stem + f"_{f.suffix[1:]}.webp"
            webp_path = ASSETS_DIR / webp_name

        rename_map[f.name] = webp_name
        orig_size = f.stat().st_size
        total_orig += orig_size

        if dry_run:
            tmp_webp = Path(f"/tmp/webp-estimate/{webp_name}")
            tmp_webp.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["cwebp", "-q", str(quality), str(f), "-o", str(tmp_webp)],
                capture_output=True,
            )
            new_size = tmp_webp.stat().st_size if tmp_webp.exists() else orig_size
        else:
            result = subprocess.run(
                ["cwebp", "-q", str(quality), str(f), "-o", str(webp_path)],
                capture_output=True,
            )
            if result.returncode != 0:
                print(f"  WARNING: Failed to convert {f.name}: {result.stderr.decode()[:100]}")
                rename_map[f.name] = f.name  # keep original
                skipped += 1
                continue
            new_size = webp_path.stat().st_size
            f.unlink()  # remove original after successful conversion

        total_new += new_size
        converted += 1

        if i % 50 == 0 or i == len(convertible):
            print(f"  {i}/{len(convertible)} converted...")

    print(f"\n  Results:")
    print(f"    Converted:  {converted}")
    print(f"    Kept as-is: {kept}")
    print(f"    Skipped:    {skipped}")
    if total_orig > 0:
        saved = total_orig - total_new
        print(f"    Size:       {total_orig // 1024 // 1024}MB → {total_new // 1024 // 1024}MB "
              f"(saved {saved // 1024 // 1024}MB, {saved * 100 // total_orig}%)")

    return rename_map


def find_markdowns() -> list[Path]:
    """Find all markdown files, excluding special files."""
    mds = []
    exclude_dirs = {ASSETS_DIR}
    exclude_names = {"CLAUDE.md", "README.md"}

    for root, dirs, files in os.walk(BASE_DIR):
        root_path = Path(root)
        if any(root_path == ex or str(root_path).startswith(str(ex) + os.sep)
               for ex in exclude_dirs):
            continue
        for f in files:
            if f.endswith(".md") and f not in exclude_names:
                mds.append(root_path / f)
    return sorted(mds)


def relative_assets_path(md_path: Path) -> str:
    """Calculate relative path from a markdown's directory to assets/."""
    md_dir = md_path.parent
    return os.path.relpath(ASSETS_DIR, md_dir)


def resolve_asset(
    filename: str,
    md_dir_rel: Path,
    orig_mapping: dict[str, str],
) -> tuple[str | None, str | None]:
    """
    Resolve an image filename from a markdown to its assets/ path.

    Returns (asset_path, warning) — one of them is always None.
    """
    orig_key = str(md_dir_rel / filename)
    asset_path = orig_mapping.get(orig_key)

    if asset_path is not None:
        return asset_path, None

    # Not found by exact key — search by filename across all dirs
    candidates = [
        (k, v) for k, v in orig_mapping.items()
        if k.endswith("/" + filename)
    ]

    if not candidates:
        return None, f"  NOT FOUND: {orig_key}"

    # Check if all candidates resolve to the same asset
    unique_assets = set(v for _, v in candidates)

    if len(unique_assets) == 1:
        # All copies are the same file — no ambiguity
        return candidates[0][1], None

    # True ambiguity: different content, same filename
    # Prefer the candidate from the same parent directory name
    dir_name = md_dir_rel.parts[0] if md_dir_rel.parts else ""
    same_dir = [(k, v) for k, v in candidates if k.startswith(dir_name + "/")]
    if same_dir:
        return same_dir[0][1], None

    # Can't resolve — pick first and warn
    return candidates[0][1], (
        f"  AMBIGUOUS: {orig_key} → {len(unique_assets)} different assets, "
        f"using {candidates[0][1]}"
    )


def update_markdowns(
    orig_mapping: dict[str, str],
    asset_rename: dict[str, str],
    dry_run: bool,
) -> tuple[int, int, list[str]]:
    """
    Update image references in all markdown files.

    Returns (files_changed, refs_updated, warnings).
    """
    markdowns = find_markdowns()

    print(f"\n{'=' * 60}")
    print(f"STEP 2: Update markdown image references")
    print(f"{'=' * 60}")
    print(f"  Markdowns found: {len(markdowns)}")

    files_changed = 0
    total_refs = 0
    warnings = []

    for md_path in markdowns:
        rel_assets = relative_assets_path(md_path)
        md_dir_rel = md_path.parent.relative_to(BASE_DIR)

        with open(md_path, "r", encoding="utf-8", errors="replace") as f:
            original_content = f.read()

        new_content = original_content
        refs_in_file = 0

        for full_match, modifiers, filename in IMAGE_RE.findall(original_content):
            # Skip URLs
            if filename.startswith(("http://", "https://")):
                continue

            # Skip if already pointing to assets/
            if "assets/" in filename:
                continue

            ext = Path(filename).suffix.lower()
            if ext not in IMAGE_EXTS:
                continue

            # Resolve to assets/ path
            asset_path, warning = resolve_asset(filename, md_dir_rel, orig_mapping)

            if warning:
                warnings.append(f"{warning} (from {md_path.name})")
            if asset_path is None:
                continue

            # Get just the filename from "assets/foo.png"
            asset_filename = Path(asset_path).name

            # Apply rename (png/jpg → webp)
            new_asset_filename = asset_rename.get(asset_filename, asset_filename)

            # Build new reference
            new_ref = f"{rel_assets}/{new_asset_filename}"
            old_ref_pattern = f"![{modifiers}]({filename})"
            new_ref_pattern = f"![{modifiers}]({new_ref})"

            new_content = new_content.replace(old_ref_pattern, new_ref_pattern)
            refs_in_file += 1

        if new_content != original_content:
            if not dry_run:
                with open(md_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
            files_changed += 1
            total_refs += refs_in_file

    print(f"  Files {'to change' if dry_run else 'changed'}:     {files_changed}")
    print(f"  References {'to update' if dry_run else 'updated'}:  {total_refs}")

    return files_changed, total_refs, warnings


def cleanup_local_images(orig_mapping: dict[str, str], dry_run: bool) -> int:
    """Remove per-directory image copies (originals that are now in assets/)."""
    print(f"\n{'=' * 60}")
    print(f"STEP 3: Clean up per-directory image copies")
    print(f"{'=' * 60}")

    removed = 0
    total_freed = 0

    for orig_rel, asset_rel in orig_mapping.items():
        orig_path = BASE_DIR / orig_rel
        if not orig_path.exists():
            continue
        if orig_path.parent == ASSETS_DIR:
            continue

        size = orig_path.stat().st_size
        total_freed += size
        removed += 1

        if not dry_run:
            orig_path.unlink()

    print(f"  Files {'to remove' if dry_run else 'removed'}: {removed}")
    print(f"  Space {'to free' if dry_run else 'freed'}:   {total_freed // 1024 // 1024}MB")

    return removed


def main():
    args = parse_args()

    if args.dry_run:
        print("=" * 60)
        print("  DRY RUN — no changes will be made")
        print("=" * 60)

    # Check prerequisites
    result = subprocess.run(["which", "cwebp"], capture_output=True)
    if result.returncode != 0:
        print("ERROR: cwebp not found. Install with: brew install webp")
        sys.exit(1)

    # Load the dedup mapping
    orig_mapping = load_mapping()
    print(f"Loaded {len(orig_mapping)} image mappings from assets-mapping.json")

    # Step 0: Patch unmapped .webp files
    patched = patch_missing_webps(orig_mapping, dry_run=args.dry_run)

    # Step 1: Convert assets to WebP
    asset_rename = convert_assets_to_webp(args.quality, args.dry_run)

    # Step 2: Update markdowns
    files_changed, refs_updated, warnings = update_markdowns(
        orig_mapping, asset_rename, args.dry_run,
    )

    # Step 3: Cleanup (optional)
    if args.cleanup:
        cleanup_local_images(orig_mapping, args.dry_run)
    else:
        print(f"\n  Skipping cleanup (use --cleanup to remove per-directory copies)")

    # Warnings
    if warnings:
        print(f"\n{'=' * 60}")
        print(f"WARNINGS ({len(warnings)}):")
        print(f"{'=' * 60}")
        for w in warnings:
            print(w)

    # Summary
    print(f"\n{'=' * 60}")
    label = "DRY RUN SUMMARY" if args.dry_run else "DONE"
    print(f"  {label}")
    print(f"  WebPs patched:       {patched}")
    print(f"  Assets converted:    {len(asset_rename)}")
    print(f"  Markdowns updated:   {files_changed}")
    print(f"  Image refs updated:  {refs_updated}")
    if warnings:
        print(f"  Warnings:            {len(warnings)}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
