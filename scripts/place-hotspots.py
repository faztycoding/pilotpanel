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
    ap.add_argument(
        "--reset",
        action="store_true",
        help="ล้าง hotspot ทั้งแผงก่อนวางใหม่ — ใช้เมื่อลบพิกัดออกจากไฟล์มือแล้วไม่อยากให้ค้าง",
    )
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
    if args.reset:
        # ทุกชั้นการวางเป็น deterministic จากไฟล์มือ + ผลตรวจจับ จึงสร้างใหม่จากศูนย์ได้
        # จำเป็นเมื่อลบพิกัดออกจากไฟล์มือ (เช่นอ่านผิดสเกลแล้วต้องทิ้ง) ไม่งั้นค่าเก่าค้างในไฟล์
        cleared = sum(1 for c in panel["controls"] if c.get("hotspot"))
        for c in panel["controls"]:
            c["hotspot"] = None
        print(f"  --reset: ล้างพิกัดเดิม {cleared} จุด")

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

    def overlaps_existing(box: dict, skip_id: str = "", section_id: str | None = None) -> str:
        """
        คืน id ของ control ที่กรอบนี้ทับเกินครึ่ง — ใช้กันการวางซ้อนกัน
        เคสจริงที่เจอ: เอกสารมี "MODE SEL push button" สองรายการ (FUEL กับ CABIN PRESS)
        แต่ป้าย vector บนรูปมีคำว่า MODE SEL จุดเดียว ทำให้ทั้งสองตัวไปลงปุ่มเดียวกัน
        validate จับได้ว่าทับ 100% ซึ่งแปลว่าผู้ใช้จะกดโดนผิดตัว
        """
        for other in panel["controls"]:
            if other["id"] == skip_id or not other.get("hotspot"):
                continue
            # ratio ของ control ในโซนอ้างรูปของโซนนั้น เทียบข้ามโซนไม่มีความหมาย
            if other.get("sectionId") != section_id:
                continue
            o = other["hotspot"]
            ix = max(0.0, min(box["x"] + box["w"], o["x"] + o["w"]) - max(box["x"], o["x"]))
            iy = max(0.0, min(box["y"] + box["h"], o["y"] + o["h"]) - max(box["y"], o["y"]))
            inter = ix * iy
            if inter > 0.5 * min(box["w"] * box["h"], o["w"] * o["h"]):
                return other["id"]
        return ""

    # ---- ชั้นที่ 4: พิกัดที่คนอ่านจากภาพเอง (ปุ่มที่ป้ายเป็น pixel ไม่ใช่ vector)
    # อยู่ใน data/hotspots-manual.json เพราะเป็น "ข้อมูลที่คนเขียน" ไม่ใช่ generated
    # จึงต้อง commit ขึ้น repo ได้ (แบบเดียวกับ data/sections-manual.json ที่ extract.py ใช้)
    #   { "overhead": { "oh_seat_belts_switch": { "x0": 1924, "y0": 2954, "x1": 2022, "y1": 3070 } } }
    boxes_path = ROOT / "data" / "hotspots-manual.json"
    manual_boxes = 0
    if boxes_path.exists():
        img_w, img_h = panel["imageSize"]["w"], panel["imageSize"]["h"]
        all_boxes = json.loads(boxes_path.read_text("utf-8"))
        # control ที่อยู่ในโซน (หน้า ECAM) มีพิกัดเทียบกับ "รูปของโซนนั้น" ไม่ใช่รูปแผง
        # ตาม docs/data-schema.md — ถ้าใช้ขนาดรูปแผงหารจะเพี้ยนทั้งหน้า
        section_size = {
            s["id"]: s["imageSize"] for s in panel["sections"] if s.get("imageSize", {}).get("w")
        }
        # ล้างพิกัดเดิมของทุกตัวที่มีในไฟล์นี้ก่อน เพราะพิกัดที่ชั้นก่อนหน้าเดาไว้อาจยังค้างอยู่
        # แล้วไปชนกับพิกัดที่ยืนยันของตัวอื่น ทำให้ตัวที่ถูกต้องถูกข้ามไปแทน
        for control_id in all_boxes.get(args.panel, {}):
            if control_id in by_id:
                by_id[control_id]["hotspot"] = None
        for control_id, px in all_boxes.get(args.panel, {}).items():
            control = by_id.get(control_id)
            if control is None:
                print(f"  ! ไม่มี controlId '{control_id}' ใน {args.panel}.json")
                continue
            sid = control.get("sectionId")
            base = section_size.get(sid) if sid else None
            if sid and base is None:
                print(f"  ! {control_id}: อยู่ในโซน '{sid}' ที่ยังไม่มีรูป ข้าม")
                continue
            bw_ref = base["w"] if base else img_w
            bh_ref = base["h"] if base else img_h
            box = {
                "x": round(px["x0"] / bw_ref, 4),
                "y": round(px["y0"] / bh_ref, 4),
                "w": round((px["x1"] - px["x0"]) / bw_ref, 4),
                "h": round((px["y1"] - px["y0"]) / bh_ref, 4),
            }
            # พิกัดที่คนระบุชนะการเดาเสมอ ถ้าทับกับตัวที่เดาไว้ ให้ล้างตัวที่เดาออก
            # เคสจริง: "TEST push button" (ของ CARGO SMOKE) ถูกเดาไปลงปุ่ม APU FIRE
            # เพราะป้ายข้างปุ่มนั้นอ่านได้ว่า "APU TEST" — ต้องให้พิกัดที่ยืนยันแล้วทับได้
            clash = overlaps_existing(box, control_id, sid)
            if clash and clash not in all_boxes.get(args.panel, {}):
                by_id[clash]["hotspot"] = None
                print(f"     ล้างที่เดาไว้ {clash} เพราะทับกับพิกัดที่ยืนยันของ {control_id}")
            elif clash:
                print(f"     ข้าม {control_id}: กรอบทับ {clash} (ทั้งคู่เป็นพิกัดที่ยืนยัน)")
                continue
            control["hotspot"] = box
            manual_boxes += 1
        print(f"  พิกัดที่ระบุเอง: {manual_boxes} ตัว")

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

    # ---- ชั้นสุดท้าย: ไฟบนปุ่ม -> ครึ่งบนของปุ่มแม่ที่อยู่ก่อนหน้าในเอกสาร
    # ต้องรันหลังทุกชั้น เพราะปุ่มแม่อาจถูกวางในชั้น manual/label ซึ่งมาทีหลัง
    # ถ้ารันก่อน ไฟที่ปุ่มแม่ยังไม่มีพิกัดจะตกขบวนไปเลย (เจอจริง 6 ดวง)
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
        # ปุ่มแม่ต้องเป็นปุ่มกดเท่านั้น ไฟแจ้งเตือนไม่เคยอยู่บนลูกบิดหรือสวิตช์โยก
        # เคสจริง: "IR 1/2/3 Light" อยู่ถัดจาก "SYS selector knob" ในเอกสาร
        # ถ้าไม่เช็คชนิด ไฟจะไปเกาะครึ่งบนของลูกบิด SYS ซึ่งผิดตำแหน่งคนละที่
        if parent["type"] != "pushbutton":
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
