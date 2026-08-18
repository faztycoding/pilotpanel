#!/usr/bin/env python3
"""
extract-control-figures.py — ดึงรูปโคลสอัพของปุ่มแต่ละตัวออกจาก .docx ของลูกค้า

เอกสารลูกค้าวางรูปโคลสอัพไว้ "เหนือหัวข้อของปุ่มนั้น" เสมอ เช่น
    p54 [รูปปุ่ม ADR]  ->  p55 "ADR 1/2/3 push button"
จึงจับคู่รูปกับ control ได้แน่นอนด้วยลำดับย่อหน้า ไม่ต้องเดาจากชื่อ
(control ทุกตัวมี sourceRef เป็นเลขย่อหน้าอยู่แล้ว เช่น "Overhead Panel (finish).docx#p55")

ใช้ผลลัพธ์ได้ 2 ทาง:
  1. เป็น detailImage ปะทับบนปุ่มในแอป (แบบที่ glareshield ใช้ครบ 23/23 แล้ว)
  2. เป็นตัวช่วยให้คนจับคู่ว่า "ปุ่มหมายเลข N บนแผง คือ control ตัวไหน"

control ที่ไม่มีรูปของตัวเอง (เช่น "FAULT Light" ซึ่งใช้รูปร่วมกับปุ่มแม่) จะถูกข้าม
ไม่ยัดรูปของปุ่มอื่นให้ เพราะจะกลายเป็นข้อมูลผิด

usage:
    python scripts/extract-control-figures.py            # ทุก panel
    python scripts/extract-control-figures.py overhead   # เฉพาะ panel เดียว
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import docx
    from docx.oxml.ns import qn
except ImportError:
    sys.exit("ต้องลง python-docx ก่อน:  pip install python-docx")

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("ต้องลง Pillow ก่อน:  pip install pillow")

import io

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "source"
PANEL_DIR = ROOT / "data" / "panels"
OUT_ROOT = ROOT / "assets" / "raw" / "control-figures"

DOCX_OF = {
    "overhead": "Overhead Panel (finish).docx",
    "pedestal": "Center Pedestal (finish).docx",
    "instrument": "Instrument Panel.docx",
    "glareshield": "glareshield.docx",
}

# รูปต้องอยู่เหนือหัวข้อไม่เกินกี่ย่อหน้าจึงถือว่าเป็นรูปของ control นั้น
MAX_GAP = 3
# รูปที่เล็กกว่านี้เป็นไอคอน/สัญลักษณ์ในบรรทัด ไม่ใช่โคลสอัพปุ่ม
MIN_FIGURE_SIDE = 90


def figures_by_paragraph(document: docx.Document) -> dict[int, list[bytes]]:
    out: dict[int, list[bytes]] = {}
    for i, para in enumerate(document.paragraphs):
        for blip in para._p.xpath(".//a:blip"):
            rid = blip.get(qn("r:embed"))
            if rid is None:
                continue
            blob = document.part.related_parts[rid].blob
            out.setdefault(i, []).append(blob)
    return out


def process(panel_id: str) -> tuple[int, int]:
    docx_name = DOCX_OF.get(panel_id)
    if docx_name is None or not (SOURCE_DIR / docx_name).exists():
        print(f"  – {panel_id}: ไม่พบ {docx_name} ข้ามไป")
        return 0, 0

    document = docx.Document(SOURCE_DIR / docx_name)
    figures = figures_by_paragraph(document)
    controls = json.loads((PANEL_DIR / f"{panel_id}.json").read_text("utf-8"))["controls"]

    out_dir = OUT_ROOT / panel_id
    out_dir.mkdir(parents=True, exist_ok=True)
    saved = 0
    pairs = []
    for control in controls:
        ref = control["sourceRef"]
        if "#p" not in ref:
            continue
        pno = int(ref.split("#p")[1])
        before = [i for i in figures if i < pno]
        if not before:
            continue
        nearest = max(before)
        if pno - nearest > MAX_GAP:
            continue  # control นี้ไม่มีรูปของตัวเอง ใช้รูปร่วมกับปุ่มแม่ที่อยู่ก่อนหน้า
        # ย่อหน้าหนึ่งอาจมีหลายรูป เอารูปใหญ่สุดเป็นตัวแทน
        best = None
        for blob in figures[nearest]:
            im = Image.open(io.BytesIO(blob)).convert("RGB")
            if min(im.size) < MIN_FIGURE_SIDE:
                continue
            if best is None or im.size[0] * im.size[1] > best.size[0] * best.size[1]:
                best = im
        if best is None:
            continue
        path = out_dir / f"{control['id']}.png"
        best.save(path)
        pairs.append((control["id"], control["name"], best))
        saved += 1

    if pairs:
        sheet_cols = 4
        cell = 340
        rows = (len(pairs) + sheet_cols - 1) // sheet_cols
        sheet = Image.new("RGB", (cell * sheet_cols, cell * rows), (22, 22, 26))
        draw = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)
        except OSError:
            font = ImageFont.load_default()
        for idx, (cid, name, im) in enumerate(pairs):
            thumb = im.copy()
            thumb.thumbnail((cell - 20, cell - 60))
            px, py = (idx % sheet_cols) * cell + 10, (idx // sheet_cols) * cell + 46
            sheet.paste(thumb, (px, py))
            draw.text((px, py - 40), f"{idx + 1}. {name[:34]}", fill=(255, 220, 0), font=font)
            draw.text((px, py - 20), cid[:44], fill=(150, 200, 255), font=font)
        sheet.save(OUT_ROOT / f"{panel_id}-sheet.png")

    print(f"  {panel_id}: ดึงรูปโคลสอัพได้ {saved}/{len(controls)} controls (รูปในเอกสาร {len(figures)} ย่อหน้า)")
    return saved, len(controls)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("panel", nargs="?", help="panelId — ไม่ระบุ = ทำทุก panel")
    args = ap.parse_args()
    targets = [args.panel] if args.panel else list(DOCX_OF)
    total_saved = total_controls = 0
    for panel in targets:
        s, t = process(panel)
        total_saved += s
        total_controls += t
    print(f"\nรวม: {total_saved}/{total_controls} controls มีรูปโคลสอัพของตัวเอง")
    print(f"ผลลัพธ์อยู่ใน {OUT_ROOT.relative_to(ROOT)}/ (gitignored — เป็นไฟล์ตั้งต้น ไม่ใช่ asset)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
