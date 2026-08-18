#!/usr/bin/env python3
"""
place-hotspots.py — เขียนพิกัด hotspot ลง data/panels/*.json จากผลตรวจจับปุ่ม

ท่อทำงาน:
    1. scripts/detect-buttons.py <panel>     หาตำแหน่งปุ่ม + เดาชื่อจากป้าย vector
    2. (คนตรวจ) แก้ไฟล์ <panel>-manual.json  ระบุคู่ที่โค้ดเดาไม่ได้/เดาผิด
    3. scripts/place-hotspots.py <panel>     เขียนลง JSON

ทำไมต้องมีขั้นที่ 2: ชื่อ control ในเอกสารเป็นคำบรรยาย ไม่ตรงกับป้ายบนแผง และมี control
ที่ชื่อมีแต่คำสถานะ (เช่น "FAULT Light" ซ้ำหลายตัว) ซึ่งไม่มีทางเดาอัตโนมัติว่าเป็นของปุ่มไหน
สคริปต์นี้จึงเขียนเฉพาะคู่ที่มั่นใจ ที่เหลือปล่อย hotspot เป็น null ตามเดิม
ปล่อย null ปลอดภัยกว่าเดา เพราะ null = ยังไม่ render ปุ่มนั้น (validate จะรายงานเป็น warning)

ไฟล์ manual override: assets/raw/hotspot-candidates/<panel>-manual.json
    { "12": "oh_pack_1_push_button", "13": "" }   // "" = ปุ่มนี้ไม่ใช่ control ใด ข้ามไป

usage:
    python scripts/place-hotspots.py overhead
    python scripts/place-hotspots.py overhead --check     # ไม่เขียนไฟล์ รายงานอย่างเดียว
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "data" / "panels"
CAND_DIR = ROOT / "assets" / "raw" / "hotspot-candidates"

# คะแนนขั้นต่ำที่ยอมให้เขียนอัตโนมัติ ต่ำกว่านี้ต้องคนยืนยันผ่าน manual override
MIN_SCORE = 0.85


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("panel")
    ap.add_argument("--check", action="store_true", help="ไม่เขียนไฟล์ รายงานอย่างเดียว")
    args = ap.parse_args()

    cand_path = CAND_DIR / f"{args.panel}-candidates.json"
    if not cand_path.exists():
        sys.exit(f"ยังไม่มี {cand_path.relative_to(ROOT)} — รัน scripts/detect-buttons.py {args.panel} ก่อน")
    candidates = json.loads(cand_path.read_text("utf-8"))

    manual_path = CAND_DIR / f"{args.panel}-manual.json"
    manual = json.loads(manual_path.read_text("utf-8")) if manual_path.exists() else {}
    print(f"  manual override: {len(manual)} รายการ" if manual else "  manual override: ไม่มี")

    panel_path = PANEL_DIR / f"{args.panel}.json"
    panel = json.loads(panel_path.read_text("utf-8"))
    by_id = {c["id"]: c for c in panel["controls"]}

    # รวมคู่ที่จะใช้: manual ชนะการเดาอัตโนมัติเสมอ
    chosen: dict[str, dict] = {}
    skipped_dup: list[tuple[str, int]] = []
    for cand in candidates:
        key = str(cand["n"])
        if key in manual:
            control_id = manual[key]
            if not control_id:
                continue  # คนระบุว่าปุ่มนี้ไม่ใช่ control ใด
        elif cand.get("score", 0) >= MIN_SCORE and cand.get("controlId"):
            control_id = cand["controlId"]
        else:
            continue
        if control_id not in by_id:
            print(f"  ! ปุ่ม {cand['n']}: ไม่มี controlId '{control_id}' ใน {args.panel}.json ข้าม")
            continue
        if control_id in chosen:
            # 1 control ในเอกสารตรงกับปุ่มจริงหลายปุ่ม (เช่น DISCH มี 7 ปุ่ม)
            # schema เก็บได้จุดเดียว จึงใช้ปุ่มบนสุด-ซ้ายสุดเป็นตัวแทน แล้วรายงานที่เหลือ
            skipped_dup.append((control_id, cand["n"]))
            continue
        chosen[control_id] = cand

    written = 0
    for control_id, cand in chosen.items():
        control = by_id[control_id]
        if control.get("hotspot"):
            continue  # มีพิกัดอยู่แล้ว (วางด้วย hotspot-mapper) ไม่ทับของเดิม
        control["hotspot"] = cand["hotspot"]
        written += 1

    total = len(panel["controls"])
    placed = sum(1 for c in panel["controls"] if c.get("hotspot"))
    print(f"  ปุ่มที่ตรวจเจอ {len(candidates)} | จับคู่ได้ {len(chosen)} | เขียนใหม่ {written}")
    print(f"  {args.panel}: มีพิกัดแล้ว {placed}/{total} controls")
    if skipped_dup:
        print(f"  control ที่ตรงกับปุ่มจริงหลายปุ่ม (ใช้ปุ่มแรกเป็นตัวแทน): {len(skipped_dup)} ปุ่มที่เหลือถูกข้าม")
        for cid, n in skipped_dup[:8]:
            print(f"     {cid} <- ปุ่ม {n}")

    if args.check:
        print("  (โหมด --check ไม่ได้เขียนไฟล์)")
        return 0
    panel_path.write_text(json.dumps(panel, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  เขียน {panel_path.relative_to(ROOT)} แล้ว")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
