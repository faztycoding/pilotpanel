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
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "data" / "panels"
CAND_DIR = ROOT / "assets" / "raw" / "hotspot-candidates"

# คะแนนขั้นต่ำที่ยอมให้เขียนอัตโนมัติ ต่ำกว่านี้ต้องคนยืนยันผ่าน manual override
MIN_SCORE = 0.85

# control ที่เป็น "ไฟบนปุ่ม" ไม่ใช่ปุ่มแยก — บน A320 ปุ่มกดหนึ่งปุ่มแบ่งเป็นสองส่วน
# ครึ่งบนคือไฟแจ้งเตือน (FAULT / SMOKE / OPEN) ครึ่งล่างคือป้ายชื่อปุ่มที่กดได้
# เอกสารจึงแยกเป็นสองรายการติดกัน: ปุ่มแม่มาก่อน แล้วไฟตามมาทันที
# วางไฟไว้ครึ่งบนของปุ่มแม่ = ตรงกับของจริง และทำให้กดอ่านคำอธิบายไฟได้แยกจากปุ่ม
LIGHT_NAME = r"\bLIGHTS?\b"
# ชื่อที่มีคำว่า light แต่เป็น "ตัวควบคุม" ไม่ใช่ไฟแจ้งเตือน เช่น
#   "OVHD INTEG light knob" (ลูกบิดหมุนปรับไฟ) / "ANN Light switch" (สวิตช์ทดสอบไฟ)
# ถ้าไม่คัดออก จะถูกวางทับครึ่งบนของปุ่มอื่นแบบผิดตำแหน่ง (เจอจาก overlay: ไปกองที่ปุ่ม WING)
NOT_A_LIGHT = r"\b(KNOB|SWITCH|SELECTOR|BUTTON)\b"
LIGHT_TOP_RATIO = 0.45

# ขนาดกรอบเวลาวางจากตำแหน่งป้าย (ป้ายอยู่เหนือตัวควบคุมเสมอบนแผงนี้)
# หน่วยเป็น px ของรูปเต็ม วัดจากปุ่ม/ลูกบิดจริงบน overhead.webp
BOX_BY_TYPE = {
    "knob": (190, 190),
    "selector": (190, 190),
    "switch": (120, 175),
    "pushbutton": (150, 130),
    "light": (150, 70),
    "lever": (120, 200),
    "display": (200, 120),
    "area": (200, 200),
}
LABEL_GAP = 12  # ระยะจากขอบล่างของป้ายถึงขอบบนของกรอบ


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

    def overlaps_existing(box: dict, skip_id: str = "") -> str:
        """
        คืน id ของ control ที่กรอบนี้ทับเกินครึ่ง — ใช้กันการวางซ้อนกัน
        เคสจริงที่เจอ: เอกสารมี "MODE SEL push button" สองรายการ (FUEL กับ CABIN PRESS)
        แต่ป้าย vector บนรูปมีคำว่า MODE SEL จุดเดียว ทำให้ทั้งสองตัวไปลงปุ่มเดียวกัน
        validate จับได้ว่าทับ 100% ซึ่งแปลว่าผู้ใช้จะกดโดนผิดตัว
        """
        for other in panel["controls"]:
            if other["id"] == skip_id or not other.get("hotspot"):
                continue
            o = other["hotspot"]
            ix = max(0.0, min(box["x"] + box["w"], o["x"] + o["w"]) - max(box["x"], o["x"]))
            iy = max(0.0, min(box["y"] + box["h"], o["y"] + o["h"]) - max(box["y"], o["y"]))
            inter = ix * iy
            if inter > 0.5 * min(box["w"] * box["h"], o["w"] * o["h"]):
                return other["id"]
        return ""

    # ---- ชั้นที่ 2: ไฟบนปุ่ม -> ครึ่งบนของปุ่มแม่ที่อยู่ก่อนหน้าในเอกสาร
    lights = 0
    controls = panel["controls"]
    for i, control in enumerate(controls):
        if control.get("hotspot") or not re.search(LIGHT_NAME, control["name"], re.I):
            continue
        if re.search(NOT_A_LIGHT, control["name"], re.I):
            continue
        # ต้องเป็น control ที่อยู่ติดกันในเอกสารเท่านั้น
        # ถ้าไล่ย้อนขึ้นไปหลายตัว จะไปเจอปุ่มคนละโซนแล้ววางผิดที่ (เจอจาก overlay รอบก่อน)
        if i == 0:
            continue
        parent = controls[i - 1]
        if not parent.get("hotspot") or re.search(LIGHT_NAME, parent["name"], re.I):
            continue
        box = parent["hotspot"]
        top_h = round(box["h"] * LIGHT_TOP_RATIO, 4)
        control["hotspot"] = {"x": box["x"], "y": box["y"], "w": box["w"], "h": top_h}
        # ปุ่มแม่เหลือครึ่งล่าง เพื่อไม่ให้สองกรอบทับกันแล้วกดปนกัน
        parent["hotspot"] = {
            "x": box["x"],
            "y": round(box["y"] + top_h, 4),
            "w": box["w"],
            "h": round(box["h"] - top_h, 4),
        }
        lights += 1
    print(f"  ไฟบนปุ่ม (วางครึ่งบนของปุ่มแม่): {lights} ตัว")

    # ---- ชั้นที่ 3: วางจากตำแหน่งป้าย vector สำหรับลูกบิด/สวิตช์ที่ตรวจจับไม่เจอ
    anchored = 0
    labels_path = CAND_DIR / f"{args.panel}-label-anchors.json"
    if labels_path.exists():
        anchors = json.loads(labels_path.read_text("utf-8"))
        img_w, img_h = panel["imageSize"]["w"], panel["imageSize"]["h"]
        for control_id, ref in anchors.items():
            control = by_id.get(control_id)
            if control is None or control.get("hotspot"):
                continue
            cx = (ref["x0"] + ref["x1"]) / 2
            # ถ้ามีปุ่มที่ตรวจจับเจอ "ใต้ป้ายนี้พอดี" ให้ใช้กรอบจริงของปุ่มนั้น แม่นกว่ากรอบเดา
            # (ตรวจจับเจอตำแหน่งจริงระดับพิกเซล แต่จับคู่ชื่อไม่ได้ ป้ายเป็นตัวบอกว่าปุ่มไหน)
            snap = None
            for cand in candidates:
                if cand["controlId"] and cand["controlId"] in chosen:
                    continue  # ปุ่มนี้ถูกใช้ไปแล้ว
                p = cand["px"]
                if p["x0"] - 30 <= cx <= p["x1"] + 30 and ref["y1"] - 25 <= p["y0"] <= ref["y1"] + 170:
                    if snap is None or p["y0"] < snap["y0"]:
                        snap = p
            if snap is not None:
                box = {
                    "x": round(snap["x0"] / img_w, 4),
                    "y": round(snap["y0"] / img_h, 4),
                    "w": round((snap["x1"] - snap["x0"]) / img_w, 4),
                    "h": round((snap["y1"] - snap["y0"]) / img_h, 4),
                }
                clash = overlaps_existing(box, control_id)
                if clash:
                    print(f"     ข้าม {control_id}: กรอบทับ {clash} (ป้ายเดียวกันแต่เป็นสองปุ่ม)")
                    continue
                control["hotspot"] = box
                anchored += 1
                continue
            bw, bh = BOX_BY_TYPE.get(control["type"], (150, 150))
            top = ref["y1"] + LABEL_GAP
            x0 = max(0, min(img_w - bw, cx - bw / 2))
            y0 = max(0, min(img_h - bh, top))
            box = {
                "x": round(x0 / img_w, 4),
                "y": round(y0 / img_h, 4),
                "w": round(bw / img_w, 4),
                "h": round(bh / img_h, 4),
            }
            clash = overlaps_existing(box, control_id)
            if clash:
                print(f"     ข้าม {control_id}: กรอบทับ {clash}")
                continue
            control["hotspot"] = box
            anchored += 1
        print(f"  วางจากตำแหน่งป้าย: {anchored} ตัว")

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
