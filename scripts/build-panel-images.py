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
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("ต้องลง Pillow กับ numpy ก่อน:  pip install pillow numpy")

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


# ---------------------------------------------------------------- recolor เส้นระบบ
# ดีไซน์ใน Canva ใช้สีเขียว 2 เฉดปนกันโดยไม่ได้ตั้งใจ — เส้นเดียวกันเปลี่ยนสีกลางทาง
# และหัวลูกศรคนละสีกับเส้น ลูกค้าสั่งให้เป็นสีเดียวกันทั้งหมด โดยยึดสีเส้นหลักเป็นหลัก
TARGET_GREEN = (76, 157, 50)  # #4C9D32 สีเส้นหลักที่ใช้มากที่สุดในรูป

# เกณฑ์แยก "เขียวผิดเฉด" ออกจากของที่ห้ามแตะ: ไฟ LED เขียวบนคีย์ ENT/CLR มีค่าแดง ~87
# ส่วนหัวลูกศร/เส้นที่ผิดเฉดมีค่าแดง 0-46 จึงใช้ค่าแดงเป็นตัวแบ่ง
RECOLOR_MAX_RED = 60
# ค่าแดงอย่างเดียวไม่พอ — ขอบ LED ที่ไล่สีกับปุ่มน้ำเงินเข้มก็มีค่าแดงต่ำเข้าเกณฑ์ไปด้วย
# เส้นระบบทั้งหมดอยู่บนแผ่นพื้นสีเทาอ่อน ส่วน LED อยู่บนปุ่มสีน้ำเงินเข้ม จึงคัดด้วยความสว่าง
# ของพื้นหลังใต้พิกเซลนั้นอีกชั้น (กันไฟ LED ทุกดวงในรูปพร้อมกัน ไม่ต้องไล่ระบุตำแหน่ง)
RECOLOR_MIN_BG_LUMA = 120
# panelId ที่ต้อง recolor (pedestal ใช้สีเขียวคนละบริบท ไม่แตะ)
RECOLOR_PANELS = {"overhead"}


def estimate_background(arr: np.ndarray, green: np.ndarray, block: int = 16) -> np.ndarray:
    """
    ประมาณสีพื้นหลังใต้เส้น โดยหา median ของพิกเซลที่ไม่ใช่เขียวในบล็อก 16x16
    ต้องทำเป็นบล็อกเพราะพื้นหลังในรูปมีทั้งแผ่นสีเทาอ่อนและปุ่มสีน้ำเงินเข้ม
    ใช้ค่าเดียวทั้งรูปจะทำให้ขอบเส้นบนปุ่มเพี้ยน
    """
    h, w = green.shape
    bg = np.zeros_like(arr)
    global_bg = np.median(arr[~green], axis=0)
    for by in range(0, h, block):
        for bx in range(0, w, block):
            sub = arr[by : by + block, bx : bx + block]
            sub_green = green[by : by + block, bx : bx + block]
            clean = sub[~sub_green]
            bg[by : by + block, bx : bx + block] = (
                np.median(clean, axis=0) if len(clean) else global_bg
            )
    return bg


def recolor_green(img: Image.Image, panel_id: str) -> None:
    if panel_id not in RECOLOR_PANELS:
        return
    arr = np.array(img).astype(float)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    green_any = (g > r + 12) & (g > b + 12) & (g > 60)
    bg = estimate_background(arr, green_any)
    on_light_plate = bg.mean(axis=2) > RECOLOR_MIN_BG_LUMA
    core = green_any & (g > 120) & (r < RECOLOR_MAX_RED) & on_light_plate
    if not core.any():
        print("     recolor: ไม่พบเขียวผิดเฉด ข้าม")
        return

    ink_wrong = np.median(arr[core], axis=0)
    # ขอบเส้นถูก antialias กับพื้นหลัง ค่าแดงจะสูงขึ้นจนหลุด core ต้องขยายออก 2 px
    # ไม่งั้นจะเหลือขอบสีเดิมเป็นรัศมีบาง ๆ ซึ่งเห็นชัดตอนซูมลึก
    grown = np.array(
        Image.fromarray((core * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
    ) > 0
    mask = grown & green_any & on_light_plate

    # alpha = สัดส่วนหมึกที่ทับพื้นหลังอยู่ หาโดยฉายเวกเตอร์ (pixel - bg) ลงบน (ink - bg)
    delta = ink_wrong - bg
    denom = (delta * delta).sum(axis=2)
    denom[denom == 0] = 1
    alpha = np.clip(((arr - bg) * delta).sum(axis=2) / denom, 0, 1)
    # พิกเซลที่อยู่ลึกในเส้น (ไม่ติดขอบ) ต้องทึบเต็ม 100% เสมอ ไม่ต้องเชื่อค่าที่ประมาณได้
    # เพราะสีผิดมีหลายเฉด (หัวลูกศรเข้มกว่าเส้น) การประมาณจะได้ค่าต่ำกว่าจริงแล้วเหลือสีเดิมจาง ๆ
    interior = np.array(
        Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))
    ) > 0
    alpha = np.where(interior, 1.0, alpha)
    alpha = np.where(mask, alpha, 0)[:, :, None]

    # ทับด้วยสีเป้าหมายจริง ไม่ใช่บวกส่วนต่าง — เพราะสีผิดมีหลายเฉด ถ้าบวกส่วนต่างเท่ากันหมด
    # เฉดที่ต่างจากค่ากลางจะเพี้ยนไปอีกทาง (หัวลูกศรจะสว่างเกินเส้น)
    # ขอบที่ alpha < 1 ต้องผสมกับ "พื้นหลังที่ประมาณไว้" ไม่ใช่สีเดิมของพิกเซล
    # ถ้าผสมกับสีเดิม เฉดผิดจะยังค้างอยู่ในขอบเป็นรัศมีบาง ๆ ซึ่งเห็นตอนซูมลึก
    out = alpha * np.array(TARGET_GREEN, dtype=float) + (1 - alpha) * bg
    out = np.where(mask[:, :, None], out, arr)
    img.paste(Image.fromarray(out.round().astype(np.uint8)))
    print(
        f"     recolor: เขียวผิดเฉด #{int(ink_wrong[0]):02X}{int(ink_wrong[1]):02X}"
        f"{int(ink_wrong[2]):02X} -> #{TARGET_GREEN[0]:02X}{TARGET_GREEN[1]:02X}"
        f"{TARGET_GREEN[2]:02X}  แก้ {int(mask.sum())} พิกเซล"
    )


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
        recolor_green(img, panel_id)
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
