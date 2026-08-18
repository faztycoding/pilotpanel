#!/usr/bin/env python3
"""
sync-image-size.py — อัปเดต imageSize ใน data/panels/*.json ให้ตรงกับไฟล์รูปจริง

ทำไมต้องมีสคริปต์นี้: extract.py เขียน imageSize เป็น 0 เพราะมันอ่านแค่ .docx ไม่รู้ขนาดรูป
เดิมต้องกรอกมือ ซึ่งขัดกฎ "ห้ามแก้ generated JSON ด้วยมือ" — สคริปต์นี้ปิดช่องนั้น

กันพลาดที่สำคัญที่สุด: ถ้า panel นั้นวาง hotspot ไปแล้ว การเปลี่ยน imageSize เป็นสัดส่วนใหม่
จะทำให้พิกัดทุกจุดเพี้ยนทันที (hotspot เป็น ratio เทียบสัดส่วนรูป) สคริปต์จึงปฏิเสธ
เมื่อสัดส่วนเปลี่ยนเกิน ASPECT_TOLERANCE บน panel ที่มี hotspot อยู่แล้ว ต้องใส่ --force เอง

usage:
    python scripts/sync-image-size.py             # ตรวจ + อัปเดตทุก panel
    python scripts/sync-image-size.py --check     # ตรวจอย่างเดียว ไม่เขียนไฟล์
    python scripts/sync-image-size.py --force     # ยอมเปลี่ยนสัดส่วนแม้มี hotspot วางแล้ว
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("ต้องลง Pillow ก่อน:  pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "data" / "panels"
IMAGE_DIR = ROOT / "assets" / "panels"

# สัดส่วนต่างกันได้แค่ระดับปัดเศษ (0.5%) เกินกว่านี้ถือว่าเป็นการครอปใหม่ ไม่ใช่การย่อ/ขยาย
ASPECT_TOLERANCE = 0.005


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="ตรวจอย่างเดียว ไม่เขียนไฟล์")
    parser.add_argument("--force", action="store_true", help="ยอมเปลี่ยนสัดส่วนแม้มี hotspot แล้ว")
    args = parser.parse_args()

    changed = 0
    blocked = 0
    for path in sorted(PANEL_DIR.glob("*.json")):
        if path.name == "_unassigned.json":
            continue
        panel = json.loads(path.read_text(encoding="utf-8"))
        image_name = panel.get("image")
        if not image_name:
            continue
        image_path = IMAGE_DIR / image_name
        if not image_path.exists():
            print(f"  – {panel['panelId']}: ยังไม่มีไฟล์ {image_name} ข้ามไป")
            continue

        with Image.open(image_path) as img:
            real_w, real_h = img.size
        old = panel.get("imageSize") or {"w": 0, "h": 0}
        if (old.get("w"), old.get("h")) == (real_w, real_h):
            print(f"  ✓ {panel['panelId']}: {real_w}x{real_h} ตรงอยู่แล้ว")
            continue

        placed = sum(1 for c in panel.get("controls", []) if c.get("hotspot"))
        old_aspect = old["w"] / old["h"] if old.get("w") and old.get("h") else 0
        new_aspect = real_w / real_h
        aspect_moved = old_aspect > 0 and abs(new_aspect - old_aspect) / old_aspect > ASPECT_TOLERANCE

        if placed and aspect_moved and not args.force:
            print(
                f"  ✗ {panel['panelId']}: สัดส่วนเปลี่ยน {old_aspect:.4f} -> {new_aspect:.4f} "
                f"แต่มี hotspot วางแล้ว {placed} จุด — จะเพี้ยนทั้งหมด ไม่อัปเดต (ใส่ --force ถ้ายืนยัน)"
            )
            blocked += 1
            continue

        note = ""
        if aspect_moved:
            note = f"  [สัดส่วน {old_aspect:.4f} -> {new_aspect:.4f}, hotspot ที่วางแล้ว {placed} จุด]"
        print(f"  ↻ {panel['panelId']}: {old.get('w')}x{old.get('h')} -> {real_w}x{real_h}{note}")
        if not args.check:
            panel["imageSize"] = {"w": real_w, "h": real_h}
            path.write_text(json.dumps(panel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        changed += 1

    print(f"\nสรุป: อัปเดต {changed} panel" + (" (โหมด --check ไม่ได้เขียนไฟล์)" if args.check else ""))
    if blocked:
        print(f"ถูกบล็อกเพราะสัดส่วนไม่ตรงกับ hotspot ที่วางแล้ว {blocked} panel")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
