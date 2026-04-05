#!/usr/bin/env python3
"""Extract content from Keynote (.key) files into Deckset-style markdown + webp images.

Keynote files are zip archives with:
- Data/ — images, videos, and other media
- Index/Document.iwa — main document structure
- Index/Slide-*.iwa — individual slide data
- Index/MasterSlide-*.iwa — slide master templates

IWA files are snappy-compressed protobuf. We decompress and extract text strings.
"""

import sys
import os
import io
import re
import zipfile
import hashlib
import struct
from datetime import datetime
from collections import OrderedDict
from PIL import Image

try:
    import snappy
    HAS_SNAPPY = True
except ImportError:
    HAS_SNAPPY = False
    print("Warning: python-snappy not available, text extraction will be limited")

ASSETS_DIR = "/Users/peas/presentations-paulo/assets"
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.bmp', '.svg', '.pdf'}
VIDEO_EXTS = {'.mov', '.mp4', '.m4v'}


def decompress_iwa(data):
    """Decompress an IWA file (snappy frame format)."""
    if not HAS_SNAPPY:
        return data

    # IWA files use snappy framing format
    # They may start with a stream identifier
    result = b""
    pos = 0

    while pos < len(data):
        if pos + 4 > len(data):
            break

        chunk_type = data[pos]
        # Size is 3 bytes little-endian
        size = data[pos + 1] | (data[pos + 2] << 8) | (data[pos + 3] << 16)
        pos += 4

        if pos + size > len(data):
            break

        chunk_data = data[pos:pos + size]
        pos += size

        if chunk_type == 0xff:
            # Stream identifier
            continue
        elif chunk_type == 0x00:
            # Compressed data
            try:
                decompressed = snappy.decompress(chunk_data)
                result += decompressed
            except Exception:
                result += chunk_data
        elif chunk_type == 0x01:
            # Uncompressed data (skip 4-byte checksum)
            result += chunk_data[4:]
        else:
            # Unknown chunk type
            result += chunk_data

    return result


def extract_strings_from_protobuf(data):
    """Extract human-readable strings from raw protobuf data.

    We look for protobuf string fields (wire type 2) that contain readable text.
    """
    strings = []

    # Strategy: find sequences of printable UTF-8 characters
    # Protobuf strings are prefixed with field_tag + varint_length
    # We'll just scan for readable text sequences
    i = 0
    while i < len(data):
        # Try to find length-delimited fields (wire type 2)
        # field_tag = (field_number << 3) | wire_type
        byte = data[i]
        wire_type = byte & 0x07

        if wire_type == 2:  # Length-delimited
            # Skip the tag byte(s)
            j = i + 1
            # Read varint for length
            length = 0
            shift = 0
            while j < len(data):
                b = data[j]
                length |= (b & 0x7f) << shift
                shift += 7
                j += 1
                if not (b & 0x80):
                    break

            if 2 <= length <= 5000 and j + length <= len(data):
                try:
                    text = data[j:j + length].decode('utf-8', errors='strict')
                    # Filter: must have at least some letters, not be a path or binary-looking
                    if (len(text) >= 2
                            and any(c.isalpha() for c in text)
                            and not text.startswith('/')
                            and '\x00' not in text):
                        # Skip strings that look like internal identifiers
                        if not re.match(r'^[A-Z][a-z]+[A-Z]', text):  # CamelCase internals
                            strings.append(text)
                except (UnicodeDecodeError, ValueError):
                    pass

        i += 1

    return strings


def extract_slide_text(iwa_data):
    """Extract readable text from a slide's IWA data."""
    decompressed = decompress_iwa(iwa_data)
    raw_strings = extract_strings_from_protobuf(decompressed)

    # Filter out Keynote internal strings
    filtered = []
    skip_patterns = [
        r'^SFT',  # Keynote internal
        r'^TSWP',  # Text storage
        r'^KN',  # Keynote
        r'^TP',  # Table
        r'^TSD',  # Drawing
        r'^TSA',  # Animation
        r'^TSK',  # Task
        r'^TST',  # Table
        r'^TSW',  # Wrap
        r'^TSP',  # Storage
        r'^TSS',  # Style
        r'^TSU',  # Utility
        r'^com\.apple',
        r'^NS[A-Z]',
        r'^CT[A-Z]',
        r'^CG[A-Z]',
        r'^\d+\.\d+\.\d+',  # Version strings
        r'^Default',  # Default style names
        r'^Body$',
        r'^Title$',
        r'^Subtitle$',
        r'^Bullet$',
        r'^Label$',
        r'^[A-F0-9]{8}-[A-F0-9]{4}',  # UUIDs
        r'iwa$',
        r'\.iwa$',
    ]

    # Exact-match strings known to be Keynote internals
    skip_exact = {
        'Transition', 'none', 'Capa', 'All at Once', 'In', 'Out',
        'Pr', 'en', 'es', 'decimal', 'BT', 'BD', 'Dissolve',
        'Move In', 'Push', 'Reveal', 'Cover', 'Wipe',
        'Fade', 'Flip', 'Cube', 'Doorway', 'Iris',
        'Magic Move', 'Object Cube', 'Object Flip', 'Object Pop',
        'By Bullet', 'By Build', 'By Highlighted Build',
        'After Previous', 'With Previous', 'On Click',
        'Scale', 'Opacity', 'Duration', 'Delay',
    }

    for s in raw_strings:
        s = s.strip()
        if not s:
            continue
        if len(s) < 3:
            continue
        if s in skip_exact:
            continue
        if any(re.match(p, s) for p in skip_patterns):
            continue
        # Skip if it's mostly special characters
        alpha_ratio = sum(1 for c in s if c.isalpha() or c.isspace()) / max(len(s), 1)
        if alpha_ratio < 0.3:
            continue
        # Skip strings that look like encoded/binary garbage
        if any(ord(c) > 0x700 for c in s):
            continue
        # Skip very short strings (< 3 chars of actual letters)
        letter_count = sum(1 for c in s if c.isalpha())
        if letter_count < 3:
            continue
        filtered.append(s)

    # Remove substrings: if "onde estamos" exists, remove "onde est", "onde esta", "onde estam"
    # Sort by length descending so longer strings take priority
    deduped = []
    filtered_sorted = sorted(filtered, key=len, reverse=True)
    for s in filtered_sorted:
        # Check if s is a prefix/substring of any already-kept string
        is_substring = False
        for kept in deduped:
            if s in kept and s != kept:
                is_substring = True
                break
        if not is_substring:
            deduped.append(s)

    # Restore original order
    result = [s for s in filtered if s in deduped]
    return result


def extract_keynote(key_path, output_md_path, image_prefix, orig_timestamp):
    """Extract images and text from a Keynote file."""
    print(f"Opening {key_path}...")

    orig_date = datetime.fromtimestamp(orig_timestamp).strftime("%Y-%m-%d")
    orig_date_full = datetime.fromtimestamp(orig_timestamp).strftime("%Y-%m-%d %H:%M:%S")

    with zipfile.ZipFile(key_path, 'r') as zf:
        all_names = zf.namelist()

        # 1. Extract images from Data/
        data_files = [n for n in all_names if n.startswith('Data/')]
        image_files = []
        video_files = []

        for df in data_files:
            ext = os.path.splitext(df)[1].lower()
            if ext in IMAGE_EXTS:
                image_files.append(df)
            elif ext in VIDEO_EXTS:
                video_files.append(df)

        print(f"  Found {len(image_files)} images, {len(video_files)} videos in Data/")

        # Extract and convert images
        image_count = 0
        hash_to_name = {}
        extracted_images = []  # (original_name, webp_name)

        for img_file in sorted(image_files):
            image_count += 1
            if image_count % 20 == 1:
                print(f"  Converting image {image_count} de {len(image_files)}...")

            try:
                img_data = zf.read(img_file)
                img_hash = hashlib.md5(img_data).hexdigest()[:12]

                if img_hash in hash_to_name:
                    extracted_images.append((img_file, hash_to_name[img_hash]))
                    continue

                img_name = f"{image_prefix}-{image_count:03d}.webp"
                img_path = os.path.join(ASSETS_DIR, img_name)

                ext = os.path.splitext(img_file)[1].lower()
                if ext == '.svg' or ext == '.pdf':
                    # Can't easily convert SVG/PDF to webp with PIL
                    # Save as-is
                    raw_ext = ext
                    img_name = f"{image_prefix}-{image_count:03d}{raw_ext}"
                    img_path = os.path.join(ASSETS_DIR, img_name)
                    with open(img_path, 'wb') as f:
                        f.write(img_data)
                else:
                    img = Image.open(io.BytesIO(img_data))
                    if img.mode in ('RGBA', 'LA', 'PA', 'P'):
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        img.save(img_path, 'WEBP', quality=85)
                    else:
                        img = img.convert('RGB')
                        img.save(img_path, 'WEBP', quality=85)

                hash_to_name[img_hash] = img_name
                extracted_images.append((img_file, img_name))

            except Exception as e:
                print(f"    Warning: Could not convert {img_file}: {e}")

        unique_images = len(hash_to_name)
        print(f"  Extracted {unique_images} unique images (from {len(image_files)} total)")

        # 2. Try to extract text from slide IWA files
        slide_files = sorted(
            [n for n in all_names if re.match(r'Index/Slide-\d+\.iwa$', n)],
            key=lambda x: int(re.search(r'Slide-(\d+)', x).group(1))
        )

        print(f"  Found {len(slide_files)} slide files")

        slide_texts = OrderedDict()
        for sf in slide_files:
            try:
                iwa_data = zf.read(sf)
                texts = extract_slide_text(iwa_data)
                if texts:
                    slide_texts[sf] = texts
            except Exception as e:
                print(f"    Warning: Could not read {sf}: {e}")

        # Also try Document.iwa for overall structure
        doc_texts = []
        try:
            doc_data = zf.read('Index/Document.iwa')
            doc_texts = extract_slide_text(doc_data)
        except:
            pass

    # 3. Build markdown
    slides_md = []
    total_slides = max(len(slide_texts), len(slide_files))

    # Create image-only slides with whatever text we found
    # Strategy: pair images with slide text in order
    image_idx = 0
    images_per_slide = max(1, len(extracted_images) // max(total_slides, 1))

    slide_num = 0
    for sf, texts in slide_texts.items():
        slide_num += 1
        parts = []

        # Add some images for this slide
        for _ in range(images_per_slide):
            if image_idx < len(extracted_images):
                _, webp_name = extracted_images[image_idx]
                parts.append(f"![](../../assets/{webp_name})")
                image_idx += 1

        # Add extracted text
        for text in texts:
            parts.append(text)

        if parts:
            slides_md.append("\n\n".join(parts))

    # Add remaining images as slides
    while image_idx < len(extracted_images):
        batch = []
        for _ in range(max(1, images_per_slide)):
            if image_idx < len(extracted_images):
                _, webp_name = extracted_images[image_idx]
                batch.append(f"![](../../assets/{webp_name})")
                image_idx += 1
        if batch:
            slides_md.append("\n\n".join(batch))

    # If we got no slide text at all, create image-only slides
    if not slide_texts and extracted_images:
        print("  No text extracted from slides, creating image-only markdown")
        slides_md = []
        for _, webp_name in extracted_images:
            slides_md.append(f"![](../../assets/{webp_name})")

    header = f"""<!-- Original file: {os.path.basename(key_path)} -->
<!-- Original date: {orig_date_full} -->
<!-- Extracted: {datetime.now().strftime("%Y-%m-%d")} -->
<!-- {total_slides} slides detected, {unique_images} unique images extracted -->
<!-- Note: Text extraction from Keynote IWA format is best-effort -->

"""

    md_content = header + "\n\n---\n\n".join(slides_md)

    with open(output_md_path, 'w') as f:
        f.write(md_content)

    print(f"  Wrote {output_md_path} ({len(slides_md)} slides in md, {unique_images} images)")
    return len(slides_md), unique_images


if __name__ == "__main__":
    base = "/Users/peas/presentations-paulo"

    files = [
        {
            "key": f"{base}/old/caelum-benchmark-rebrand/APRE_CAELUM_ID/CAELUM_ID.key",
            "md": f"{base}/old/caelum-benchmark-rebrand/APRE_CAELUM_ID/CAELUM_ID.md",
            "prefix": "caelum-id",
            "timestamp": 1550689750,  # Feb 20, 2019
        },
        {
            "key": f"{base}/old/caelum-benchmark-rebrand/CAELUM_PLATAFORMA.key",
            "md": f"{base}/old/caelum-benchmark-rebrand/CAELUM_PLATAFORMA.md",
            "prefix": "caelum-plataforma",
            "timestamp": 1545167722,  # Dec 18, 2018
        },
    ]

    for f in files:
        print(f"\n{'='*60}")
        print(f"Processing: {os.path.basename(f['key'])}")
        print(f"{'='*60}")
        slides, images = extract_keynote(f["key"], f["md"], f["prefix"], f["timestamp"])

        # Preserve original modification date
        touch_date = datetime.fromtimestamp(f["timestamp"]).strftime("%Y%m%d%H%M.%S")
        os.system(f"touch -t {touch_date} '{f['md']}'")
        print(f"  Set modification date to {touch_date}")

    print("\nDone!")
