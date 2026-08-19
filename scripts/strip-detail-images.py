#!/usr/bin/env python3
"""
strip-detail-images.py — ถอด detailImage ออกจาก control ของ panel ที่ระบุ

ทำไมต้องมีสคริปต์นี้: detailImage คือรูปโคลสอัพที่ดึงจาก .docx มาปะทับบนปุ่มในรูปแผง
(ดู extract-control-figures.py) มันมีประโยชน์ตอนที่รูปแผงยังความละเอียดต่ำเกินกว่าจะ
อ่านรายละเอียดปุ่มออก แต่พอเปลี่ยนไปเรนเดอร์รูปแผงจาก PDF เวกเตอร์ของลูกค้าแล้ว
รูปแผงคมกว่าครอปจาก Word หลายเท่า การปะทับกลายเป็น "จุดเบลอบนปุ่ม" ที่ลูกค้าเห็นทันที

วัดจริงบน glareshield (13575x1232): เทียบความคม (variance of Laplacian) ระหว่าง
พื้นที่เดียวกันบนรูปแผงกับรูป detail ที่ย่อ/ขยายให้เท่ากัน -> detail เบลอกว่า 21/23 ตัว
บางตัวห่างกัน 8-10 เท่า (เช่น gs_exped_push_button 1756 vs 176)

data/panels/*.json เป็น generated artifact ห้ามแก้มือ (ดู .windsurfrules) แต่ detailImage
ไม่ได้มาจาก .docx จึงไม่ถูกสร้างใหม่ตอนรัน extract — merge_hotspots() ใน extract.py คงค่าเดิม
ไว้ให้ทุกครั้ง ถ้าลบทิ้งด้วยมือแล้วรัน extract ซ้ำ ค่าเก่าจะไม่กลับมา แต่ก็ไม่มีร่องรอยว่า
ทำไมถึงลบ สคริปต์นี้จึงเป็นทั้งเครื่องมือและเอกสารประกอบการตัดสินใจ

usage:
    python scripts/strip-detail-images.py glareshield
    python scripts/strip-detail-images.py glareshield --check
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "data" / "panels"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("panel", help="panelId เช่น glareshield")
    ap.add_argument("--check", action="store_true", help="ไม่เขียนไฟล์ รายงานอย่างเดียว")
    args = ap.parse_args()

    path = PANEL_DIR / f"{args.panel}.json"
    if not path.exists():
        sys.exit(f"ไม่พบ {path.relative_to(ROOT)}")

    panel = json.loads(path.read_text("utf-8"))
    removed = []
    for control in panel["controls"]:
        if control.pop("detailImage", None) is not None:
            removed.append(control["id"])

    print(f"  {args.panel}: ถอด detailImage {len(removed)} ตัว")
    for cid in removed:
        print(f"     - {cid}")
    if not removed:
        print("     (ไม่มีอะไรต้องถอด)")

    if args.check:
        print("  (โหมด --check ไม่ได้เขียนไฟล์)")
        return 0

    if removed:
        path.write_text(json.dumps(panel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  เขียน {path.relative_to(ROOT)} แล้ว")
        print("  อย่าลืมลบ key ที่ตรงกันออกจาก DETAIL_IMAGES ใน src/lib/panels.ts ด้วย")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
