#!/usr/bin/env python3
"""
build-panel-images.py — render PDF จาก Canva เป็น assets/panels/*.webp

ทำไมต้องเป็นสคริปต์: PDF ใน assets/raw/canva-pdf/ คือ source of truth ของรูปแผง
ถ้าแก้ pixel บนไฟล์ .webp ด้วยมือ พอ re-render รอบหน้าการแก้จะหายเงียบ ๆ
ทุกการลบ/แก้จุดบนรูปจึงต้องประกาศไว้ใน PATCHES เพื่อให้ผลลัพธ์ทำซ้ำได้เสมอ

ทำไม render ที่ขนาดเท่า canvas ไม่ดันขึ้น 2x: bitmap ในหน่วยความจำโตเป็น 4 เท่า
(3438x3124 = 43MB -> 6876x6248 = 172MB ต่อรูปหนึ่งใบ) เสี่ยง OOM บนมือถือเป้าหมาย
และเกินเพดาน texture ของ GPU บางรุ่น ตัวอักษรใน PDF เป็น vector อยู่แล้วจึงคมพอที่ 1x

usage:
    python scripts/build-panel-images.py            # render ทุก panel ที่มี PDF
    python scripts/build-panel-images.py --check    # ตรวจว่า patch ยังตรงจุดไหม ไม่เขียนไฟล์
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("ต้องลง PyMuPDF ก่อน:  pip install pymupdf")

try:
    from PIL import Image
except ImportError:
    sys.exit("ต้องลง Pillow ก่อน:  pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
PDF_DIR = ROOT / "assets" / "raw" / "canva-pdf"
OUT_DIR = ROOT / "assets" / "panels"

WEBP_QUALITY = 88

# panelId -> (ชื่อไฟล์ PDF, ความกว้างเป้าหมายเป็น px ตาม canvas ที่ตั้งใน Canva)
SOURCES = {
    "overhead": ("Overhead_Complete (3438 x 3124 px).pdf", 3438),
    "pedestal": ("Center Pedestral_Complete (2918 x 3438 px).pdf", 2918),
}

# จุดที่ต้องลบออกจากรูปที่ render มา — วิธีลบคือก๊อปพื้นจากบริเวณข้างเคียงที่ลายเหมือนกัน
# (dx, dy) = ระยะที่ไปหยิบพื้นมาปิด เลือกให้อยู่ในแถบที่สีสม่ำเสมอในแนวนั้น
# panelId -> list ของ (คำอธิบาย, x0, y0, x1, y1, dx, dy)
PATCHES = {
    "overhead": [
        # ลูกศรสามเหลี่ยมเขียวโดด ๆ ทับมุมขวาบนปุ่ม RAM AIR — ไม่มีในของจริง ลูกค้าสั่งเอาออก
        # ฝั่งซ้ายของขอบปุ่มเดียวกันสีสม่ำเสมอ ต่างกันแค่ 4-5 ค่าสี จึงหยิบมาปิดได้แบบไม่เห็นรอย
        ("green triangle บนปุ่ม RAM AIR (ในปุ่ม)", 1586, 2258, 1606, 2292, -60, 0),
        # ขอบขวาของสามเหลี่ยมล้นออกไปบนพื้นหลังสว่าง ต้องหยิบพื้นหลังจากด้านขวามาปิดแทน
        ("green triangle บนปุ่ม RAM AIR (ส่วนที่ล้นบนพื้นหลัง)", 1606, 2258, 1612, 2280, 30, 0),
    ],
}


def is_green(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel[0], pixel[1], pixel[2]
    return g > 120 and g - r > 50 and g - b > 50


def count_green(img: Image.Image, box: tuple[int, int, int, int]) -> int:
    region = img.crop(box)
    return sum(1 for p in region.getdata() if is_green(p))


def apply_patches(img: Image.Image, panel_id: str) -> None:
    for label, x0, y0, x1, y1, dx, dy in PATCHES.get(panel_id, []):
        before = count_green(img, (x0, y0, x1, y1))
        donor = img.crop((x0 + dx, y0 + dy, x1 + dx, y1 + dy))
        if count_green(donor, (0, 0, donor.width, donor.height)):
            sys.exit(f"  ✗ {panel_id}: พื้นต้นทางของ patch '{label}' มีสีเขียวปนอยู่ ต้องเลือก dx/dy ใหม่")
        img.paste(donor, (x0, y0))
        after = count_green(img, (x0, y0, x1, y1))
        print(f"     patch '{label}': พิกเซลเขียว {before} -> {after}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="ไม่เขียนไฟล์ แค่รายงานผล")
    args = parser.parse_args()

    for panel_id, (pdf_name, target_w) in SOURCES.items():
        pdf_path = PDF_DIR / pdf_name
        if not pdf_path.exists():
            print(f"  – {panel_id}: ไม่มี {pdf_name} ข้ามไป")
            continue
        doc = fitz.open(pdf_path)
        page = doc[0]
        zoom = target_w / page.rect.width
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        doc.close()
        print(f"  ↻ {panel_id}: render {img.width}x{img.height} จาก {pdf_name}")
        apply_patches(img, panel_id)
        out = OUT_DIR / f"{panel_id}.webp"
        if not args.check:
            img.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
            print(f"     เขียน {out.relative_to(ROOT)} ({out.stat().st_size / 1024 / 1024:.2f} MB)")

    if args.check:
        print("\n(โหมด --check ไม่ได้เขียนไฟล์)")
    else:
        print("\nเสร็จ — รัน scripts/sync-image-size.py ต่อถ้าขนาดรูปเปลี่ยน")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
