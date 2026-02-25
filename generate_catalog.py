#!/usr/bin/env python3
"""
Generate a polished PDF catalog for the furniture showcase.
Multi-page per item is fine — focus on good image sizes and clean layout.
"""

import json
import math
import os
import base64
import io
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, HRFlowable, KeepInFrame
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from PIL import Image as PILImage, ImageOps

BASE_DIR = "/workspace/project/groups/furniture-showcase"
DATA_FILE = os.path.join(BASE_DIR, "data/furniture.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "furniture_catalog.pdf")

PAGE_W, PAGE_H = letter  # 8.5 x 11 inches
MARGIN = 0.65 * inch
CONTENT_W = PAGE_W - 2 * MARGIN
CONTENT_H = PAGE_H - 2 * MARGIN

# Images: 2 per row
IMG_GAP = 10  # gap between columns
IMG_COL_W = (CONTENT_W - IMG_GAP) / 2
MAX_IMG_H = 4.0 * inch  # generous — multi-page ok
SINGLE_IMG_MAX_H = 5.5 * inch  # for items with only 1 image, can be taller

# Bundle definitions: (bundle_id, [individual item IDs])
BUNDLE_GROUPS = [
    ("item-076", ["item-054", "item-055", "item-056", "item-057", "item-059"]),  # Tate C&B
    ("item-068", ["item-013", "item-014", "item-015", "item-016"]),              # Modernica grey
    ("item-073", ["item-021", "item-041"]),                                       # FLOYD + mattress #1
    ("item-074", ["item-022", "item-042"]),                                       # FLOYD + mattress #2
    ("item-069", ["item-008", "item-009", "item-010"]),                           # Bubble Club
    ("item-075", ["item-017", "item-018"]),                                       # Cowhide rugs
    ("item-072", ["item-048", "item-049"]),                                       # Varnado armchairs
    ("item-070", ["item-064", "item-065"]),                                       # White desk + chair
    ("item-071", ["item-060", "item-061"]),                                       # Fireplace set
]

BUNDLE_IDS = {bg[0] for bg in BUNDLE_GROUPS}
BUNDLED_INDIVIDUAL_IDS = set()
for _, ids in BUNDLE_GROUPS:
    BUNDLED_INDIVIDUAL_IDS.update(ids)


def load_data():
    """Build an interleaved item list sorted by price descending."""
    with open(DATA_FILE) as f:
        data = json.load(f)
    visible = {i["id"]: i for i in data["items"] if not i.get("hidden", False)}

    bundle_lookup = {}
    bundle_data = {}
    for bundle_id, individual_ids in BUNDLE_GROUPS:
        if bundle_id not in visible:
            continue
        individuals = [visible[iid] for iid in individual_ids if iid in visible]
        individuals.sort(key=lambda x: x.get("price", 0), reverse=True)
        bundle_data[bundle_id] = (visible[bundle_id], individuals)
        for iid in individual_ids:
            if iid in visible:
                bundle_lookup[iid] = bundle_id

    all_items = [v for k, v in visible.items() if k not in BUNDLE_IDS]
    all_items.sort(key=lambda x: x.get("price", 0), reverse=True)

    sequence = []
    emitted_bundles = set()
    emitted_items = set()

    for item in all_items:
        iid = item["id"]
        if iid in emitted_items:
            continue

        if iid in bundle_lookup:
            bid = bundle_lookup[iid]
            if bid in emitted_bundles:
                continue
            emitted_bundles.add(bid)
            bundle_item, individuals = bundle_data[bid]
            for ind in individuals:
                if ind["id"] not in emitted_items:
                    sequence.append((ind, False))
                    emitted_items.add(ind["id"])
            sequence.append((bundle_item, True))
        else:
            sequence.append((item, False))
            emitted_items.add(iid)

    return sequence


def get_thumbnail_path(img_path):
    if img_path.startswith("images/full/"):
        thumb = img_path.replace("images/full/", "images/thumbnails/").replace(".jpg", "-thumb.jpg")
        full_thumb = os.path.join(BASE_DIR, thumb)
        if os.path.exists(full_thumb):
            return full_thumb
        full = os.path.join(BASE_DIR, img_path)
        return full if os.path.exists(full) else None
    return None


def load_pil_image(img_path):
    """Load PIL image from file path, fix EXIF, convert to RGB."""
    try:
        if img_path.startswith("data:"):
            header, b64data = img_path.split(",", 1)
            img_bytes = base64.b64decode(b64data)
            pil_img = PILImage.open(io.BytesIO(img_bytes))
        elif img_path.startswith("images/"):
            file_path = get_thumbnail_path(img_path)
            if not file_path:
                return None
            pil_img = PILImage.open(file_path)
        else:
            return None

        pil_img = ImageOps.exif_transpose(pil_img)
        if pil_img.mode in ("RGBA", "P"):
            pil_img = pil_img.convert("RGB")
        return pil_img
    except Exception as e:
        print(f"    Image error ({img_path[:50]}): {e}")
        return None


def pil_to_flowable(pil_img, display_w, display_h):
    """Convert PIL image to reportlab Image at the given display size.
    Renders at 1.5x display resolution max (to save memory), quality 82.
    """
    target_w = max(1, int(display_w * 1.5))
    target_h = max(1, int(display_h * 1.5))
    # Don't upscale beyond actual size
    orig_w, orig_h = pil_img.size
    if target_w > orig_w:
        target_w = orig_w
        target_h = orig_h
    pil_img = pil_img.resize((target_w, target_h), PILImage.LANCZOS)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=82)
    buf.seek(0)
    pil_img.close()
    return Image(buf, width=display_w, height=display_h)


def make_image_grid(image_paths):
    """
    Build a table of images in a 2-column grid.
    Processes images one at a time to minimize memory usage.
    image_paths: list of image path strings (up to MAX_IMAGES_PER_ITEM).
    """
    n = len(image_paths)
    if n == 0:
        return []

    img_flowables = []
    for i, img_path in enumerate(image_paths):
        pil_img = load_pil_image(img_path)
        if not pil_img:
            continue
        orig_w, orig_h = pil_img.size

        if n == 1:
            # Single image: use full content width
            ratio = CONTENT_W / orig_w
            disp_w = CONTENT_W
            disp_h = orig_h * ratio
            if disp_h > SINGLE_IMG_MAX_H:
                scale = SINGLE_IMG_MAX_H / disp_h
                disp_w *= scale
                disp_h = SINGLE_IMG_MAX_H
        else:
            # Multi-image: column width
            ratio = IMG_COL_W / orig_w
            disp_w = IMG_COL_W
            disp_h = orig_h * ratio
            if disp_h > MAX_IMG_H:
                scale = MAX_IMG_H / disp_h
                disp_w *= scale
                disp_h = MAX_IMG_H

        fl = pil_to_flowable(pil_img, disp_w, disp_h)
        # pil_img is closed inside pil_to_flowable
        img_flowables.append(fl)

    if not img_flowables:
        return []

    if len(img_flowables) == 1:
        return [img_flowables[0]]

    rows = []
    for i in range(0, len(img_flowables), 2):
        row = img_flowables[i:i + 2]
        if len(row) == 1:
            row.append(Spacer(1, 1))
        rows.append(row)

    col_w = CONTENT_W / 2
    tbl = Table(rows, colWidths=[col_w, col_w], hAlign="LEFT")
    tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return [tbl]


def build_styles():
    styles = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "ItemTitle",
            parent=styles["Heading1"],
            fontSize=20,
            textColor=colors.HexColor("#1a1a2e"),
            spaceAfter=2,
            spaceBefore=0,
            leading=24,
            fontName="Helvetica-Bold",
        ),
        "category": ParagraphStyle(
            "Category",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#6c757d"),
            spaceAfter=6,
            fontName="Helvetica-Oblique",
        ),
        "price": ParagraphStyle(
            "Price",
            parent=styles["Normal"],
            fontSize=22,
            textColor=colors.HexColor("#2d6a4f"),
            fontName="Helvetica-Bold",
            spaceAfter=2,
            leading=26,
        ),
        "retail": ParagraphStyle(
            "RetailPrice",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#adb5bd"),
            spaceBefore=2,
            spaceAfter=10,
            leading=14,
        ),
        "desc": ParagraphStyle(
            "Description",
            parent=styles["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#333333"),
            leading=15,
            spaceAfter=10,
            spaceBefore=0,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontSize=7.5,
            textColor=colors.HexColor("#aaaaaa"),
            alignment=TA_CENTER,
        ),
        "normal": styles["Normal"],
    }


def build_item_story(item, styles, idx, total):
    """
    Build the story elements for one item.
    Multi-page is fine — images get generous sizing.
    Returns a list of flowables ending with a PageBreak.
    """
    story = []

    name = item.get("name", "Unnamed Item")
    category = item.get("category", "").capitalize()
    price = item.get("price")
    retail_price = item.get("retailPrice")
    description = item.get("description", "").strip()
    images = item.get("images", [])
    item_id = item.get("id", "")

    # ── Header block ────────────────────────────────────────────────────
    story.append(Paragraph(name, styles["title"]))

    if category:
        story.append(Paragraph(f"{category}", styles["category"]))

    story.append(HRFlowable(width=CONTENT_W, thickness=2,
                             color=colors.HexColor("#2d6a4f")))
    story.append(Spacer(1, 8))

    # ── Pricing ─────────────────────────────────────────────────────────
    if price is not None:
        if price == 0:
            story.append(Paragraph("Best Offer", styles["price"]))
        else:
            story.append(Paragraph(f"${price:,.0f}", styles["price"]))

    if retail_price and retail_price > 0 and price and price > 0 and retail_price != price:
        savings = retail_price - price
        savings_pct = int((savings / retail_price) * 100)
        story.append(Paragraph(
            f"Retail: ${retail_price:,.0f}  ·  Save ${savings:,.0f}  ({savings_pct}% off)",
            styles["retail"]
        ))
    elif retail_price and retail_price > 0 and (not price or price == 0):
        story.append(Paragraph(
            f"Retail: ${retail_price:,.0f}",
            styles["retail"]
        ))

    # ── Description ─────────────────────────────────────────────────────
    if description:
        story.append(Spacer(1, 4))
        clean_desc = description.replace("\n\n", "<br/><br/>").replace("\n", "<br/>")
        story.append(Paragraph(clean_desc, styles["desc"]))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width=CONTENT_W, thickness=0.5,
                             color=colors.HexColor("#dee2e6")))
    story.append(Spacer(1, 10))

    # ── Images ──────────────────────────────────────────────────────────
    # Cap at 4 images per item for memory efficiency
    if images:
        img_elements = make_image_grid(images[:4])
        story.extend(img_elements)

    # ── Footer ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width=CONTENT_W, thickness=0.5,
                             color=colors.HexColor("#dee2e6")))
    story.append(Spacer(1, 3))
    story.append(Paragraph(
        f"Item {idx} of {total}  ·  {item_id}  ·  All items subject to prior sale",
        styles["footer"]
    ))

    story.append(PageBreak())
    return story


def build_bundle_divider(bundle_name, bundle_counter, styles):
    """A full-page Special Bundle Offer divider."""
    story = []
    story.append(Spacer(1, 2.8 * inch))
    story.append(HRFlowable(width=CONTENT_W, thickness=3,
                             color=colors.HexColor("#2d6a4f")))
    story.append(Spacer(1, 0.35 * inch))
    story.append(Paragraph(
        "Special Bundle Offer",
        ParagraphStyle(f"BD_title_{bundle_counter}", fontSize=32,
                       textColor=colors.HexColor("#1a1a2e"),
                       fontName="Helvetica-Bold", alignment=TA_CENTER,
                       spaceAfter=12)
    ))
    story.append(Paragraph(
        bundle_name,
        ParagraphStyle(f"BD_name_{bundle_counter}", fontSize=18,
                       textColor=colors.HexColor("#2d6a4f"),
                       fontName="Helvetica-Bold", alignment=TA_CENTER,
                       spaceAfter=8)
    ))
    story.append(Paragraph(
        "Buy them together and save",
        ParagraphStyle(f"BD_sub_{bundle_counter}", fontSize=14,
                       textColor=colors.HexColor("#6c757d"),
                       alignment=TA_CENTER, spaceAfter=8)
    ))
    story.append(Spacer(1, 0.35 * inch))
    story.append(HRFlowable(width=CONTENT_W, thickness=3,
                             color=colors.HexColor("#2d6a4f")))
    story.append(PageBreak())
    return story


def generate_pdf():
    print(f"Loading data from {DATA_FILE}...")
    sequence = load_data()
    total = len(sequence)
    print(f"Found {total} sequence entries.")

    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=letter,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
        title="Furniture Catalog",
        author="Bluelabel Furniture Showcase",
    )

    styles = build_styles()
    story = []

    # ── Cover ────────────────────────────────────────────────────────────
    individual_count = sum(1 for _, is_b in sequence if not is_b)
    bundle_count = sum(1 for _, is_b in sequence if is_b)
    story.append(Spacer(1, 2.2 * inch))
    story.append(Paragraph(
        "Furniture Catalog",
        ParagraphStyle("Cover", fontSize=44, textColor=colors.HexColor("#1a1a2e"),
                       fontName="Helvetica-Bold", alignment=TA_CENTER, spaceAfter=16)
    ))
    story.append(Spacer(1, 0.2 * inch))
    story.append(HRFlowable(width=CONTENT_W * 0.6, thickness=2.5,
                             color=colors.HexColor("#2d6a4f"), hAlign="CENTER"))
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph(
        f"{individual_count} Items Available",
        ParagraphStyle("CoverSub", fontSize=16, textColor=colors.HexColor("#6c757d"),
                       alignment=TA_CENTER, spaceAfter=6)
    ))
    story.append(Paragraph(
        f"Including {bundle_count} Special Bundle Offers",
        ParagraphStyle("CoverSub2", fontSize=13, textColor=colors.HexColor("#2d6a4f"),
                       alignment=TA_CENTER, spaceAfter=8)
    ))
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph(
        "Prices negotiable  ·  All items available for immediate sale",
        ParagraphStyle("CoverNote", fontSize=11, textColor=colors.HexColor("#999999"),
                       alignment=TA_CENTER)
    ))
    story.append(PageBreak())

    # ── Item pages ───────────────────────────────────────────────────────
    idx = 1
    bundle_counter = 0
    for item, is_bundle in sequence:
        name = item.get("name", item.get("id", f"Item {idx}"))

        if is_bundle:
            bundle_counter += 1
            story.extend(build_bundle_divider(name, bundle_counter, styles))
            print(f"  [BUNDLE DIVIDER] {name}")

        print(f"  [{idx}/{total}] {name}")
        story.extend(build_item_story(item, styles, idx, total))
        idx += 1

    print(f"\nBuilding PDF: {OUTPUT_FILE}")
    doc.build(story)
    print(f"Done! PDF saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_pdf()
