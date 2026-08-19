#!/usr/bin/env python3
"""
apply-sections.py — เขียนค่า image / imageSize / entry ของ section ลง data/panels/*.json

ทำไมต้องแยกจาก extract.py: extract.py อ่าน data/sections-manual.json อยู่แล้ว แต่มันสร้าง
panel ใหม่จาก .docx ทั้งไฟล์ ซึ่งมีความเสี่ยงกว่าที่จำเป็นเวลาจะแก้แค่ค่า section
(ดู docs/FAILURES.md — เคยรัน extract ทับแล้ว hotspot หายทั้งแผง) สคริปต์นี้แตะแค่ sections

หน้าที่:
  1. อ่าน entryPx (px บนรูป panel) แปลงเป็น entry ratio 0..1 ให้ตรงกับ schema
  2. อ่านขนาดจริงของไฟล์รูป section ใน assets/sections/<panel>/ มาเป็น imageSize
  3. เขียนกลับทั้งใน data/panels/<panel>.json และใน sections-manual.json
     (เขียนกลับใน manual ด้วยเพื่อให้ extract.py รอบเต็มได้ค่าเดียวกัน ไม่ต้องคำนวณซ้ำ)

section ที่ยังไม่มีรูปจะถูกข้าม แต่ยังคง entry ไว้ไม่ได้ เพราะ schema บังคับให้ entry
ใช้คู่กับ image เท่านั้น (ดู src/lib/types.ts) — ปุ่มเข้าโซนนั้นจึงยังไม่ render

usage:
    python scripts/apply-sections.py
    python scripts/apply-sections.py --check
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
MANUAL = ROOT / "data" / "sections-manual.json"
SECTION_ASSETS = ROOT / "assets" / "sections"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="ไม่เขียนไฟล์ รายงานอย่างเดียว")
    args = ap.parse_args()

    if not MANUAL.exists():
        sys.exit(f"ไม่พบ {MANUAL.relative_to(ROOT)}")
    manual = json.loads(MANUAL.read_text("utf-8"))

    manual_changed = False
    for panel_id, items in manual.items():
        if panel_id.startswith("_"):
            continue
        panel_path = PANEL_DIR / f"{panel_id}.json"
        if not panel_path.exists():
            print(f"  ! ไม่พบ {panel_path.name} ข้าม")
            continue
        panel = json.loads(panel_path.read_text("utf-8"))
        img_w, img_h = panel["imageSize"]["w"], panel["imageSize"]["h"]
        by_id = {s["id"]: s for s in panel["sections"]}
        ready = skipped = 0

        for item in items:
            sid = item["id"]
            section = by_id.get(sid)
            if section is None:
                section = {"id": sid, "name": item.get("name", sid)}
                panel["sections"].append(section)
                by_id[sid] = section
            if "name" in item:
                section["name"] = item["name"]

            # ผูก control เข้าโซน — instrument ยังไม่มี sectionId ในข้อมูลที่ extractor สร้าง
            # (pedestal มีเพราะเอกสารมีหัวข้อหน้า ECAM ชัด แต่เอกสาร instrument ไม่ได้แบ่งหัวข้อจอ)
            for cid in item.get("controlIds", []):
                control = next((c for c in panel["controls"] if c["id"] == cid), None)
                if control is None:
                    print(f"  ! {panel_id}/{sid}: ไม่พบ control '{cid}'")
                    continue
                control["sectionId"] = sid

            image_name = item.get("image")
            if not image_name:
                print(f"  – {panel_id}/{sid}: ยังไม่มีรูป ({item.get('note', 'ไม่ได้ระบุเหตุผล')})")
                skipped += 1
                continue
            image_path = SECTION_ASSETS / panel_id / image_name
            if not image_path.exists():
                print(f"  ! {panel_id}/{sid}: ไม่พบไฟล์ {image_path.relative_to(ROOT)}")
                skipped += 1
                continue

            with Image.open(image_path) as im:
                w, h = im.size
            section["image"] = image_name
            section["imageSize"] = {"w": w, "h": h}
            if item.get("imageSize") != {"w": w, "h": h}:
                item["imageSize"] = {"w": w, "h": h}
                manual_changed = True

            px = item.get("entryPx")
            if px:
                entry = {
                    "x": round(px["x0"] / img_w, 4),
                    "y": round(px["y0"] / img_h, 4),
                    "w": round((px["x1"] - px["x0"]) / img_w, 4),
                    "h": round((px["y1"] - px["y0"]) / img_h, 4),
                }
                section["entry"] = entry
                if item.get("entry") != entry:
                    item["entry"] = entry
                    manual_changed = True
            print(f"  ✓ {panel_id}/{sid}: {image_name} {w}x{h}" + ("  + ปุ่มเข้าโซน" if px else ""))
            ready += 1

        controls_in_sections = sum(1 for c in panel["controls"] if c.get("sectionId"))
        print(f"  {panel_id}: โซนพร้อมใช้ {ready} | ยังไม่มีรูป {skipped} | controls ในโซน {controls_in_sections}")
        if not args.check:
            panel_path.write_text(json.dumps(panel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if manual_changed and not args.check:
        MANUAL.write_text(json.dumps(manual, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("  อัปเดต sections-manual.json (entry ratio + imageSize) แล้ว")
    if args.check:
        print("  (โหมด --check ไม่ได้เขียนไฟล์)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
