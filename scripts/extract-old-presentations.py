#!/usr/bin/env python3
"""Extract content from old ODP and PPT presentation files to Deckset markdown.

Extracts text and images from legacy presentation formats, converting images
to webp and creating Deckset-compatible markdown files.

Usage:
    python3 extract-old-presentations.py [--dry-run] [--help]
"""

import argparse
import hashlib
import os
import re
import struct
import subprocess
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime
from io import BytesIO
from pathlib import Path

# Add venv to path
VENV_PATH = Path(__file__).parent / ".venv" / "lib"
for p in VENV_PATH.glob("python*/site-packages"):
    sys.path.insert(0, str(p))

from odf.opendocument import load as odf_load
from odf.draw import Frame, Image, Page
from odf.text import P, List, ListItem, S, Tab, LineBreak
from PIL import Image as PILImage
import olefile

# ODF XML namespaces
ODF_NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    "draw": "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    "presentation": "urn:oasis:names:tc:opendocument:xmlns:presentation:1.0",
    "xlink": "http://www.w3.org/1999/xlink",
}


BASE_DIR = Path(__file__).parent
ASSETS_DIR = BASE_DIR / "assets"
SOURCE_DIR = BASE_DIR / "old" / "apresentacoes-caelum"

# Track created files
created_files = []


def get_text_recursive(node):
    """Recursively extract text from an ODF node, preserving line breaks."""
    result = ""
    for child in node.childNodes:
        if hasattr(child, "data"):
            result += child.data
        elif child.qname and child.qname[1] == "line-break":
            result += "\n"
        elif child.qname and child.qname[1] == "tab":
            result += "\t"
        elif child.qname and child.qname[1] == "s":
            # Space element - get count attribute
            count = child.getAttribute("c")
            result += " " * (int(count) if count else 1)
        elif hasattr(child, "childNodes"):
            result += get_text_recursive(child)
    return result


def image_to_webp(image_data, output_path):
    """Convert image data to webp format and save."""
    try:
        img = PILImage.open(BytesIO(image_data))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGBA")
        else:
            img = img.convert("RGB")
        img.save(output_path, "WEBP", quality=85)
        return True
    except Exception as e:
        print(f"    Warning: Could not convert image: {e}")
        return False


def sanitize_prefix(name):
    """Create a clean ASCII prefix from a filename, handling unicode."""
    import unicodedata
    # Normalize unicode (NFD) then strip combining marks (accents)
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Replace non-alphanumeric with hyphens
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def make_image_name(prefix, index, total_images):
    """Create a descriptive image filename."""
    pad = 2 if total_images < 100 else 3
    return f"{prefix}-{str(index).zfill(pad)}.webp"


def is_template_text(text):
    """Check if text is a PowerPoint template/placeholder string."""
    templates = [
        "Click to edit", "Clique para editar",
        "Klicken Sie", "Mastertextformat",
    ]
    stripped = text.strip()
    if stripped in ("*", ""):
        return True
    for t in templates:
        if t in stripped:
            return True
    return False


def extract_odp_xml_fallback(filepath, prefix, image_map, dry_run=False):
    """Fallback ODP extraction using raw XML parsing (for old files that odfpy can't handle)."""
    slides = []

    try:
        with zipfile.ZipFile(str(filepath)) as zf:
            content_xml = zf.read("content.xml")

        root = ET.fromstring(content_xml)

        # Find all draw:page elements
        body = root.find(f".//{{{ODF_NS['office']}}}body")
        if body is None:
            return slides

        presentation = body.find(f"{{{ODF_NS['office']}}}presentation")
        if presentation is None:
            # Try drawing (some old ODP files use this)
            presentation = body.find(f"{{{ODF_NS['office']}}}drawing")
        if presentation is None:
            # Try direct page search
            pages = root.findall(f".//{{{ODF_NS['draw']}}}page")
        else:
            pages = presentation.findall(f"{{{ODF_NS['draw']}}}page")

        for page in pages:
            slide_texts = []
            slide_images = []

            # Extract all text:p elements recursively
            for p_elem in page.iter(f"{{{ODF_NS['text']}}}p"):
                text = "".join(p_elem.itertext()).strip()
                if text:
                    slide_texts.append(text)

            # Extract draw:image references
            for img_elem in page.iter(f"{{{ODF_NS['draw']}}}image"):
                href = img_elem.get(f"{{{ODF_NS['xlink']}}}href")
                if href and href in image_map:
                    slide_images.append(image_map[href])

            slides.append({"texts": slide_texts, "images": slide_images})

    except Exception as e:
        print(f"    XML fallback also failed: {e}")

    return slides


def extract_odp(filepath, dry_run=False):
    """Extract text and images from an ODP file."""
    basename = filepath.stem
    # Sanitize for use as image prefix
    prefix = sanitize_prefix(basename)

    print(f"\n{'='*60}")
    print(f"ODP: {filepath.name}")
    print(f"  Prefix: {prefix}")

    # Extract images from the zip first (needed by both parsers)
    image_map = {}  # href -> webp filename
    try:
        with zipfile.ZipFile(str(filepath)) as zf:
            pic_entries = [n for n in zf.namelist() if n.startswith("Pictures/")]
            total_pics = len(pic_entries)
            print(f"  Images: {total_pics}")

            for idx, pic_name in enumerate(pic_entries, 1):
                img_data = zf.read(pic_name)
                if len(img_data) < 100:  # Skip tiny/empty images
                    print(f"    Skipping tiny image: {pic_name} ({len(img_data)} bytes)")
                    continue

                webp_name = make_image_name(prefix, idx, total_pics)
                webp_path = ASSETS_DIR / webp_name

                if not dry_run:
                    if image_to_webp(img_data, webp_path):
                        image_map[pic_name] = webp_name
                        created_files.append(("image", webp_path))
                        print(f"    {pic_name} -> {webp_name}")
                    else:
                        # Try saving raw if conversion fails
                        ext = Path(pic_name).suffix.lower()
                        raw_name = f"{prefix}-{str(idx).zfill(2)}{ext}"
                        raw_path = ASSETS_DIR / raw_name
                        with open(raw_path, "wb") as f:
                            f.write(img_data)
                        image_map[pic_name] = raw_name
                        created_files.append(("image", raw_path))
                        print(f"    {pic_name} -> {raw_name} (raw)")
                else:
                    image_map[pic_name] = webp_name
                    print(f"    Would create: {webp_name}")
    except zipfile.BadZipFile:
        print(f"  Warning: Not a valid zip file, skipping images")

    # Try odfpy first, fall back to raw XML parsing
    use_fallback = False
    try:
        doc = odf_load(str(filepath))
        pages = doc.getElementsByType(Page)
        print(f"  Pages: {len(pages)} (odfpy)")

        # Extract text per slide
        slides = []
        for i, page in enumerate(pages):
            slide_texts = []
            slide_images = []

            paras = page.getElementsByType(P)
            for p in paras:
                t = get_text_recursive(p)
                if t.strip():
                    slide_texts.append(t.strip())

            frames = page.getElementsByType(Frame)
            for frame in frames:
                images = frame.getElementsByType(Image)
                for img in images:
                    href = img.getAttribute("href")
                    if href and href in image_map:
                        slide_images.append(image_map[href])

            slides.append({"texts": slide_texts, "images": slide_images})
    except Exception as e:
        print(f"  odfpy failed ({type(e).__name__}), using XML fallback...")
        use_fallback = True
        slides = extract_odp_xml_fallback(filepath, prefix, image_map, dry_run)
        print(f"  Pages: {len(slides)} (XML fallback)")

    return slides, image_map


def extract_ppt_text(filepath):
    """Extract text from binary PPT format, organized by slides.

    PPT binary format has SlideListWithText containers that appear in order:
    1st = slides, 2nd = master slides, 3rd = notes/other.
    Within each container, SlidePersistAtoms mark slide boundaries,
    followed by text atoms belonging to that slide.

    Some older PPTs store all text in the 3rd container (notes/other).
    We collect text from ALL containers and try to group it logically.
    """
    ole = olefile.OleFileIO(str(filepath))
    data = ole.openstream("PowerPoint Document").read()
    ole.close()

    # Collect all SlideListWithText containers
    slt_containers = []  # [(start, end), ...]

    def find_slt(data, offset, end):
        """Find all SlideListWithText containers at the top level."""
        pos = offset
        while pos + 8 <= end:
            rec_ver_inst = struct.unpack_from("<H", data, pos)[0]
            rec_ver = rec_ver_inst & 0x0F
            rec_type = struct.unpack_from("<H", data, pos + 2)[0]
            rec_len = struct.unpack_from("<I", data, pos + 4)[0]
            body_start = pos + 8
            body_end = body_start + rec_len
            if body_end > end or rec_len > 50_000_000:
                break
            if rec_type == 0x0FF0:
                slt_containers.append((body_start, body_end))
            elif rec_ver == 0x0F:
                find_slt(data, body_start, body_end)
            pos = body_end

    find_slt(data, 0, len(data))

    def parse_slt(data, start, end):
        """Parse a single SlideListWithText container into slides."""
        slides = []
        current_texts = []
        pos = start
        while pos + 8 <= end:
            rec_ver_inst = struct.unpack_from("<H", data, pos)[0]
            rec_type = struct.unpack_from("<H", data, pos + 2)[0]
            rec_len = struct.unpack_from("<I", data, pos + 4)[0]
            body_start = pos + 8
            body_end = body_start + rec_len
            if body_end > end or rec_len > 50_000_000:
                break

            if rec_type == 0x03F3:  # SlidePersistAtom
                if current_texts:
                    slides.append(current_texts)
                current_texts = []
            elif rec_type == 0x0FA0:  # TextCharsAtom (UTF-16LE)
                try:
                    text = data[body_start:body_end].decode("utf-16-le")
                    if text.strip() and not is_template_text(text):
                        current_texts.append(text.strip())
                except:
                    pass
            elif rec_type == 0x0FA8:  # TextBytesAtom (Latin-1)
                try:
                    text = data[body_start:body_end].decode("latin-1")
                    if text.strip() and not is_template_text(text):
                        current_texts.append(text.strip())
                except:
                    pass
            pos = body_end

        if current_texts:
            slides.append(current_texts)
        return slides

    # Strategy: use the first SLT container that produces slides with text.
    # If the 1st (slides) container has text, use it.
    # If not, try the 3rd (notes/other) which sometimes contains slide text in older PPTs.
    # The 2nd container (masters) is almost always template text, so skip it.
    all_results = []
    for i, (start, end) in enumerate(slt_containers):
        result = parse_slt(data, start, end)
        all_results.append(result)

    # Choose the best result: first non-empty container that isn't the master (2nd)
    slides = []
    if len(all_results) >= 1 and all_results[0]:
        slides = all_results[0]
    if not slides and len(all_results) >= 3:
        # Try the 3rd container (notes/other) — some PPTs store text here
        slides = all_results[2]
    if not slides:
        # Try any container that has slides
        for result in all_results:
            if result:
                slides = result
                break

    # Filter empty slides
    slides = [s for s in slides if s]

    return slides


def extract_ppt_images(filepath, prefix, dry_run=False):
    """Extract images from PPT Pictures stream."""
    image_list = []  # list of webp filenames in order

    try:
        ole = olefile.OleFileIO(str(filepath))
        if not ole.exists("Pictures"):
            ole.close()
            return image_list

        data = ole.openstream("Pictures").read()
        ole.close()

        if len(data) == 0:
            return image_list

        # Parse Pictures stream - contains OfficeArtBlip records
        type_to_ext = {
            0xF01A: "emf", 0xF01B: "wmf", 0xF01C: "pict",
            0xF01D: "jpg", 0xF01E: "png", 0xF01F: "bmp",
            0xF029: "tiff", 0xF02A: "jpg",
        }

        # Header sizes for different image types
        # Each blip has a UID (16 bytes) and possibly a second UID, then the image data
        type_to_header = {
            0xF01A: 50,  # EMF: 16 uid + 34 header
            0xF01B: 50,  # WMF: 16 uid + 34 header
            0xF01C: 50,  # PICT: 16 uid + 34 header
            0xF01D: 17,  # JPEG: 16 uid + 1 tag
            0xF01E: 17,  # PNG: 16 uid + 1 tag
            0xF01F: 17,  # DIB: 16 uid + 1 tag
            0xF029: 17,  # TIFF
            0xF02A: 17,  # JPEG2
        }

        pos = 0
        img_idx = 0
        total_count = 0

        # First pass: count images
        p = 0
        while p + 8 < len(data):
            rt = struct.unpack_from("<H", data, p + 2)[0]
            rl = struct.unpack_from("<I", data, p + 4)[0]
            if rt in type_to_ext and rl > 0:
                total_count += 1
            p += 8 + rl
            if rl == 0:
                break

        while pos + 8 < len(data):
            rec_ver_inst = struct.unpack_from("<H", data, pos)[0]
            rec_type = struct.unpack_from("<H", data, pos + 2)[0]
            rec_len = struct.unpack_from("<I", data, pos + 4)[0]

            rec_instance = (rec_ver_inst >> 4) & 0x0FFF

            if rec_len == 0 or pos + 8 + rec_len > len(data):
                break

            if rec_type in type_to_ext:
                img_idx += 1

                # Determine header size based on instance
                # If instance has bit 0 set, there's an extra 16-byte UID
                base_header = type_to_header.get(rec_type, 17)
                extra = 16 if (rec_instance & 1) else 0
                header_size = base_header + extra

                img_start = pos + 8 + header_size
                img_end = pos + 8 + rec_len

                if img_start < img_end:
                    img_data = data[img_start:img_end]

                    webp_name = make_image_name(prefix, img_idx, total_count)
                    webp_path = ASSETS_DIR / webp_name

                    if not dry_run:
                        if image_to_webp(img_data, webp_path):
                            image_list.append(webp_name)
                            created_files.append(("image", webp_path))
                            print(f"    Image {img_idx}: -> {webp_name}")
                        else:
                            # Try raw save
                            ext = type_to_ext[rec_type]
                            raw_name = f"{prefix}-{str(img_idx).zfill(2)}.{ext}"
                            raw_path = ASSETS_DIR / raw_name
                            with open(raw_path, "wb") as f:
                                f.write(img_data)
                            image_list.append(raw_name)
                            created_files.append(("image", raw_path))
                            print(f"    Image {img_idx}: -> {raw_name} (raw)")
                    else:
                        image_list.append(webp_name)
                        print(f"    Would create: {webp_name}")

            pos += 8 + rec_len

    except Exception as e:
        print(f"    Warning: Could not extract PPT images: {e}")

    return image_list


def format_ppt_text(text):
    """Clean up PPT text that may have run-together bullet points."""
    # PPT often concatenates bullet text without newlines
    # Try to split on common patterns
    # But be careful not to break genuine sentences
    return text


def slides_to_markdown(slides, images, file_date, original_filename, is_ppt=False):
    """Convert extracted slides to Deckset markdown format."""
    date_str = file_date.strftime("%Y-%m-%d")

    lines = []
    lines.append(f"<!-- Extracted from: {original_filename} -->")
    lines.append(f"<!-- Original date: {date_str} -->")
    lines.append("")

    if is_ppt:
        # For PPT, slides are lists of text strings
        for i, slide_texts in enumerate(slides):
            if i > 0:
                lines.append("")
                lines.append("---")
                lines.append("")

            if not slide_texts:
                lines.append("<!-- empty slide -->")
                continue

            # First text block is usually the title
            title = slide_texts[0]
            # Clean up concatenated text (PPT joins lines)
            title = title.split("\r")[0] if "\r" in title else title
            lines.append(f"# {title}")
            lines.append("")

            # Remaining text blocks are body content
            for text in slide_texts[1:]:
                # Split on carriage returns (PPT uses \r for line breaks within text boxes)
                parts = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
                for part in parts:
                    part = part.strip()
                    if part:
                        lines.append(f"- {part}")
                lines.append("")
    else:
        # For ODP, slides have texts and images
        for i, slide in enumerate(slides):
            if i > 0:
                lines.append("")
                lines.append("---")
                lines.append("")

            texts = slide["texts"]
            slide_images = slide["images"]

            if not texts and not slide_images:
                lines.append("<!-- empty slide -->")
                continue

            # First text is usually the title
            if texts:
                lines.append(f"# {texts[0]}")
                lines.append("")

                for text in texts[1:]:
                    # Multi-line text: each line becomes a bullet
                    text_lines = text.split("\n")
                    for tl in text_lines:
                        tl = tl.strip()
                        if tl:
                            lines.append(f"- {tl}")
                    lines.append("")

            # Add images
            for img_name in slide_images:
                lines.append(f"![inline](../../assets/{img_name})")
                lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def get_file_mtime(filepath):
    """Get file modification time as datetime."""
    mtime = os.path.getmtime(filepath)
    return datetime.fromtimestamp(mtime)


def set_file_mtime(filepath, dt):
    """Set file modification time to match original."""
    timestamp = dt.timestamp()
    os.utime(filepath, (timestamp, timestamp))


def process_odp(filepath, dry_run=False):
    """Process a single ODP file."""
    slides, image_map = extract_odp(filepath, dry_run)

    if not slides:
        print(f"  No content extracted!")
        return None

    file_date = get_file_mtime(filepath)
    md_content = slides_to_markdown(slides, image_map, file_date, filepath.name, is_ppt=False)

    md_path = filepath.with_suffix(".md")
    slide_count = len(slides)

    if not dry_run:
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        set_file_mtime(md_path, file_date)
        created_files.append(("markdown", md_path))
        print(f"  Created: {md_path.name} ({slide_count} slides, date={file_date.strftime('%Y-%m-%d')})")
    else:
        print(f"  Would create: {md_path.name} ({slide_count} slides)")

    return {"path": md_path, "slides": slide_count, "date": file_date, "images": len(image_map)}


def generate_image_only_markdown(images, file_date, original_filename):
    """Generate markdown for image-only presentations (one image per slide)."""
    date_str = file_date.strftime("%Y-%m-%d")
    lines = []
    lines.append(f"<!-- Extracted from: {original_filename} -->")
    lines.append(f"<!-- Original date: {date_str} -->")
    lines.append(f"<!-- Image-only presentation: text was embedded in images -->")
    lines.append("")

    for i, img_name in enumerate(images):
        if i > 0:
            lines.append("")
            lines.append("---")
            lines.append("")
        lines.append(f"![](../../assets/{img_name})")

    return "\n".join(lines).rstrip() + "\n"


def resolve_md_path(filepath):
    """Resolve the output markdown path, avoiding conflicts with existing .md files.

    If an ODP version already produced a .md, use -ppt suffix for the PPT version.
    """
    md_path = filepath.with_suffix(".md")

    # Check if a sibling ODP file exists (which would also produce a .md)
    odp_sibling = filepath.with_suffix(".odp")
    if filepath.suffix == ".ppt" and odp_sibling.exists():
        stem = filepath.stem
        md_path = filepath.parent / f"{stem}-ppt.md"

    return md_path


def process_ppt(filepath, dry_run=False):
    """Process a single PPT file."""
    basename = filepath.stem
    prefix = sanitize_prefix(basename)

    # Add "-ppt" suffix to prefix if sibling ODP exists (to avoid image name collision)
    odp_sibling = filepath.with_suffix(".odp")
    if odp_sibling.exists():
        prefix = prefix + "-ppt"

    print(f"\n{'='*60}")
    print(f"PPT: {filepath.name}")
    print(f"  Prefix: {prefix}")

    # Extract text
    slides = extract_ppt_text(filepath)
    print(f"  Slides (text): {len(slides)}")

    # Extract images
    images = extract_ppt_images(filepath, prefix, dry_run)
    print(f"  Images extracted: {len(images)}")

    file_date = get_file_mtime(filepath)
    md_path = resolve_md_path(filepath)

    if not slides and not images:
        print(f"  No content extracted!")
        return None

    if not slides and images:
        # Image-only presentation
        print(f"  Image-only presentation, creating image gallery markdown")
        md_content = generate_image_only_markdown(images, file_date, filepath.name)
        slide_count = len(images)
    else:
        md_content = slides_to_markdown(slides, images, file_date, filepath.name, is_ppt=True)
        slide_count = len(slides)

    if not dry_run:
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        set_file_mtime(md_path, file_date)
        created_files.append(("markdown", md_path))
        print(f"  Created: {md_path.name} ({slide_count} slides, date={file_date.strftime('%Y-%m-%d')})")
    else:
        print(f"  Would create: {md_path.name} ({slide_count} slides)")

    return {"path": md_path, "slides": slide_count, "date": file_date, "images": len(images)}


def check_pdf_assets():
    """Check for PDF files in assets that should be images, and convert them."""
    print(f"\n{'='*60}")
    print("Checking for PDF assets that should be images...")

    pdf_assets = list(ASSETS_DIR.glob("*.pdf"))
    if not pdf_assets:
        print("  No PDF files found in assets/")
        return

    for pdf_path in pdf_assets:
        print(f"  Found: {pdf_path.name} ({pdf_path.stat().st_size} bytes)")
        webp_path = pdf_path.with_suffix(".webp")

        try:
            # Try to open as image (some PDFs are single-page images)
            img = PILImage.open(pdf_path)
            img.save(webp_path, "WEBP", quality=85)
            print(f"    Converted to: {webp_path.name}")
            created_files.append(("converted", webp_path))
        except Exception:
            print(f"    Cannot convert (not a simple image PDF)")


def main():
    parser = argparse.ArgumentParser(
        description="Extract old ODP/PPT presentations to Deckset markdown"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be done without creating files"
    )
    args = parser.parse_args()

    if not ASSETS_DIR.exists():
        ASSETS_DIR.mkdir(parents=True)

    # ODP files
    odp_files = sorted(SOURCE_DIR.glob("*.odp"))
    # PPT files
    ppt_files = sorted(SOURCE_DIR.glob("*.ppt"))

    print(f"Found {len(odp_files)} ODP files and {len(ppt_files)} PPT files")
    print(f"Assets directory: {ASSETS_DIR}")
    if args.dry_run:
        print("DRY RUN - no files will be created")

    results = []

    for f in odp_files:
        result = process_odp(f, args.dry_run)
        if result:
            results.append(result)

    for f in ppt_files:
        result = process_ppt(f, args.dry_run)
        if result:
            results.append(result)

    # Check for PDF assets
    if not args.dry_run:
        check_pdf_assets()

    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")

    md_files = [f for t, f in created_files if t == "markdown"]
    img_files = [f for t, f in created_files if t == "image"]

    print(f"\nMarkdown files created: {len(md_files)}")
    for r in sorted(results, key=lambda x: x["date"]):
        print(f"  {r['path'].name:50s}  {r['slides']:3d} slides  {r['images']:3d} images  {r['date'].strftime('%Y-%m-%d')}")

    print(f"\nImages created: {len(img_files)}")

    total_img_size = sum(f.stat().st_size for f in img_files if f.exists())
    print(f"Total image size: {total_img_size / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
