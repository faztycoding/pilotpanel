#!/usr/bin/env python3
"""
detect-buttons.py — ตรวจจับตำแหน่งปุ่มบนรูปแผง แล้วออกรูปใส่เลขกำกับให้คนตรวจ

ทำไมต้องมี: การวาง hotspot 277 จุดด้วยมือใน tools/hotspot-mapper กินเวลาหลายชั่วโมง
แต่งานสองส่วนนี้ถนัดต่างกัน —
  * "ตำแหน่งกับขนาดของปุ่ม" โค้ดหาได้แม่นกว่ามือ (ขอบปุ่มชัดเจนในภาพ)
  * "ปุ่มนี้ชื่ออะไร" โค้ดเดาไม่ได้ เพราะชื่อในเอกสารเป็นคำบรรยาย ไม่ตรงกับป้ายบนแผง
    (เช่น "HORN SHUT OFF button" ในเอกสาร ป้ายบนรูปเขียนรวมกับปุ่มอื่นในบรรทัดเดียว)

สคริปต์นี้ทำส่วนแรก แล้วออกไฟล์ให้คนเติมส่วนที่สอง:
  assets/raw/hotspot-candidates/<panel>-overlay.png    รูปพร้อมเลขกำกับทุกปุ่ม
  assets/raw/hotspot-candidates/<panel>-candidates.json  พิกัด ratio + ชื่อที่เดาได้

ชื่อที่เดา: ถ้า PDF ต้นทางมีตัวหนังสือ vector (overhead มี 543 คำ) จะหยิบคำที่อยู่ในกรอบปุ่ม
หรือเหนือปุ่มไม่เกิน LABEL_ABOVE px มาเสนอ ส่วน pedestal/instrument ไม่มี vector text
(ตัวหนังสือเป็น pixel ในรูปที่แปะทับ) ช่องชื่อจะว่างไว้ให้คนกรอก

usage:
    python scripts/detect-buttons.py overhead
    python scripts/detect-buttons.py pedestal
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("ต้องลง Pillow กับ numpy ก่อน:  pip install pillow numpy")

try:
    import fitz  # PyMuPDF — ใช้เฉพาะตอนอ่านป้ายจาก PDF
except ImportError:
    fitz = None

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "assets" / "panels"
PDF_DIR = ROOT / "assets" / "raw" / "canva-pdf"
OUT_DIR = ROOT / "assets" / "raw" / "hotspot-candidates"

# panelId -> ไฟล์ PDF ต้นทาง (ใช้ดึงป้ายมาเดาชื่อ)
PDF_OF = {
    "overhead": "Overhead_Complete (3438 x 3124 px).pdf",
    "pedestal": "Center Pedestral_Complete (2918 x 3438 px).pdf",
    "instrument": "Instrument_Complete (3438 x 1050 px).pdf",
}

# วัดค่าจริงจาก overhead.webp: แผ่นพื้น #A0AECC (179) / ปุ่มเข้ม #262E53 (56)
# / ลูกบิด #DEE4F2 (231) / ปุ่ม FIRE #D13C17 / การ์ดแดง #B80411
# จึงต้องตรวจ 3 แบบ ปุ่มเข้มอย่างเดียวจับได้แค่ปุ่มกด ตกลูกบิดกับปุ่มฉุกเฉินไปหมด
DARK_MAX_LUMA = 80
KNOB_MIN_LUMA = 205
WARM_MIN_RED = 120
# ขนาดปุ่มที่ยอมรับ (px บนรูปเต็ม) — เล็กกว่านี้คือตัวหนังสือ/น็อต ใหญ่กว่านี้คือแผงย่อยทั้งบล็อก
MIN_SIDE, MAX_SIDE = 45, 320
# ต้องเต็มกรอบพอสมควร กันเส้นขอบหรือรูปทรงโปร่งที่ bbox ใหญ่แต่เนื้อน้อย
MIN_FILL = 0.45
# ระยะเหนือปุ่มที่ยอมรับว่าเป็นป้ายของปุ่มนั้น
LABEL_ABOVE = 70
DOWNSAMPLE = 2


def components(mask: np.ndarray) -> list[tuple[int, int, int, int, int]]:
    """คืน (x0, y0, x1, y1, area) ของทุกก้อนที่ต่อกัน — BFS บน mask ที่ย่อแล้ว"""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    out = []
    for i in range(h):
        for j in range(w):
            if not mask[i, j] or seen[i, j]:
                continue
            q = deque([(i, j)])
            seen[i, j] = True
            ys, xs, n = [], [], 0
            while q:
                y, x = q.popleft()
                n += 1
                ys.append(y)
                xs.append(x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
            out.append((min(xs), min(ys), max(xs), max(ys), n))
    return out


def pdf_labels(panel_id: str, width: int) -> list[tuple[str, float, float, float, float]]:
    """คำจาก PDF พร้อมพิกัดในหน่วย px ของรูปที่ render แล้ว"""
    name = PDF_OF.get(panel_id)
    if fitz is None or name is None or not (PDF_DIR / name).exists():
        return []
    doc = fitz.open(PDF_DIR / name)
    page = doc[0]
    scale = width / page.rect.width
    out = [
        (w[4], w[0] * scale, w[1] * scale, w[2] * scale, w[3] * scale)
        for w in page.get_text("words")
    ]
    doc.close()
    return out


def suggest_label(box: tuple[int, int, int, int], labels: list) -> str:
    """ป้ายที่อยู่ในกรอบปุ่ม หรือเหนือกรอบไม่เกิน LABEL_ABOVE — เรียงจากบนลงล่าง ซ้ายไปขวา"""
    x0, y0, x1, y1 = box
    hits = []
    for text, lx0, ly0, lx1, ly1 in labels:
        cx, cy = (lx0 + lx1) / 2, (ly0 + ly1) / 2
        inside = x0 <= cx <= x1 and y0 <= cy <= y1
        above = x0 - 20 <= cx <= x1 + 20 and y0 - LABEL_ABOVE <= cy < y0
        if inside or above:
            hits.append((round(cy), round(cx), text))
    hits.sort()
    return " ".join(h[2] for h in hits)


SUFFIX_WORDS = (
    r"\b(PUSH[- ]?BUTTONS?|PUSHBUTTONS?|BUTTONS?|SWITCHES|SWITCH|SW|SELECTORS?|KNOBS?"
    r"|ROTARY|GUARDED|LIGHTS?|INDICATIONS?|INDICATOR|PB|AND|THE)\b"
)


def normalize(text: str) -> str:
    """ตัดคำที่บอกชนิดปุ่มออก เหลือแต่ชื่อจริง เพื่อเทียบกับป้ายบนแผงได้"""
    import re

    s = text.upper().replace("/", " ").replace("-", " ")
    s = re.sub(SUFFIX_WORDS, " ", s)
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    return " ".join(s.split())


# คำบอก "สถานะ" ที่พิมพ์อยู่บนหน้าปุ่มแทบทุกปุ่ม ไม่ใช่ชื่อปุ่ม
# ถ้าไม่ตัดออก จะจับคู่เพี้ยนหนัก — เคยลองแล้วได้ oh_fault_light ไปโดน 48 ปุ่มรวด
# เพราะเกือบทุกปุ่มบนแผงมีคำ FAULT พิมพ์ไว้ครึ่งบน
STATE_WORDS = {"FAULT", "OFF", "ON", "AVAIL", "ALIGN", "AUTO", "NORM", "OPEN", "SHUT", "LO", "HI"}


def distinctive(text: str) -> str:
    """เหลือแต่คำที่บอกว่าเป็นปุ่มอะไร ตัดคำสถานะออก"""
    return " ".join(t for t in normalize(text).split() if t not in STATE_WORDS)


def match_control(guess: str, controls: list[dict]) -> tuple[str, float]:
    """
    เดา controlId จากป้ายที่อ่านได้ — คืน (controlId, คะแนน 0..1)
    คะแนนต่ำหมายถึงเดาไม่ได้ ปล่อยว่างไว้ให้คนกรอก ดีกว่าใส่ผิดแล้วไม่มีใครรู้
    """
    from difflib import SequenceMatcher

    key = distinctive(guess)
    if not key:
        return "", 0.0
    best_id, best_score = "", 0.0
    for c in controls:
        name = distinctive(c["name"])
        if not name:
            continue  # control ที่ชื่อมีแต่คำสถานะ (เช่น "FAULT Light") เดาไม่ได้ ต้องให้คนระบุ
        score = SequenceMatcher(None, key, name).ratio()
        tokens = name.split()
        # ให้คะแนนสูงเฉพาะเมื่อชื่อมีคำเฉพาะตั้งแต่ 1 คำ และโผล่ในป้ายครบทุกคำ
        if tokens and all(tok in key.split() for tok in tokens):
            score = max(score, 0.88)
        if score > best_score:
            best_id, best_score = c["id"], score
    return best_id, round(best_score, 3)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("panel", help="panelId เช่น overhead / pedestal / instrument")
    args = ap.parse_args()

    img_path = PANEL_DIR / f"{args.panel}.webp"
    if not img_path.exists():
        sys.exit(f"ไม่พบ {img_path.relative_to(ROOT)}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(img_path).convert("RGB")
    W, H = img.size
    arr = np.array(img).astype(int)
    lum = arr.mean(axis=2)
    R, G, B = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    passes = {
        "dark": lum < DARK_MAX_LUMA,  # ปุ่มกดสีน้ำเงินเข้ม
        "warm": (R > WARM_MIN_RED) & (R - B > 40) & (R - G > 15),  # FIRE / การ์ดแดง / ปุ่มส้ม
        "knob": lum > KNOB_MIN_LUMA,  # ลูกบิดสีอ่อน (สว่างกว่าแผ่นพื้น)
    }

    boxes = []
    for kind, full_mask in passes.items():
        found = 0
        for x0, y0, x1, y1, area in components(full_mask[::DOWNSAMPLE, ::DOWNSAMPLE]):
            bx0, by0 = x0 * DOWNSAMPLE, y0 * DOWNSAMPLE
            bx1, by1 = (x1 + 1) * DOWNSAMPLE, (y1 + 1) * DOWNSAMPLE
            bw, bh = bx1 - bx0, by1 - by0
            if not (MIN_SIDE <= bw <= MAX_SIDE and MIN_SIDE <= bh <= MAX_SIDE):
                continue
            if area * DOWNSAMPLE**2 < MIN_FILL * bw * bh:
                continue
            # ลูกบิดเป็นวงกลม ต้องกรองด้วยอัตราส่วนด้าน ไม่งั้นตัวหนังสือขาวจะเข้ามาด้วย
            if kind == "knob" and not (0.62 <= bw / bh <= 1.6):
                continue
            # กันซ้ำข้ามรอบ เช่น ขอบเข้มของปุ่มส้มถูกจับทั้งสองรอบ
            if any(
                bx0 < ox1 and ox0 < bx1 and by0 < oy1 and oy0 < by1
                and (min(bx1, ox1) - max(bx0, ox0)) * (min(by1, oy1) - max(by0, oy0))
                > 0.5 * min(bw * bh, (ox1 - ox0) * (oy1 - oy0))
                for ox0, oy0, ox1, oy1, _ in boxes
            ):
                continue
            boxes.append((bx0, by0, bx1, by1, kind))
            found += 1
        print(f"  รอบ {kind}: เจอ {found} ชิ้น")
    boxes.sort(key=lambda b: (b[1] // 120, b[0]))  # เรียงเป็นแถวจากบนลงล่าง
    print(f"  รวมทั้งหมด {len(boxes)} ชิ้นบน {args.panel}.webp ({W}x{H})")

    controls = json.loads((ROOT / "data" / "panels" / f"{args.panel}.json").read_text("utf-8"))["controls"]
    labels = pdf_labels(args.panel, W)
    print(f"  ป้าย vector จาก PDF: {len(labels)} คำ" + ("" if labels else "  (ไม่มี — ต้องกรอกชื่อเอง)"))

    candidates = []
    for i, (x0, y0, x1, y1, kind) in enumerate(boxes, 1):
        guess = suggest_label((x0, y0, x1, y1), labels)
        control_id, score = match_control(guess, controls)
        candidates.append(
            {
                "n": i,
                "kind": kind,
                "guess": guess,
                "controlId": control_id,  # เดามาให้ ต้องให้คนตรวจก่อนใช้
                "score": score,
                "hotspot": {
                    "x": round(x0 / W, 4),
                    "y": round(y0 / H, 4),
                    "w": round((x1 - x0) / W, 4),
                    "h": round((y1 - y0) / H, 4),
                },
                "px": {"x0": x0, "y0": y0, "x1": x1, "y1": y1},
            }
        )

    json_path = OUT_DIR / f"{args.panel}-candidates.json"
    json_path.write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    overlay = img.copy()
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 34)
    except OSError:
        font = ImageFont.load_default()
    colors = {"dark": (255, 40, 40), "warm": (40, 220, 90), "knob": (255, 220, 0)}
    for c in candidates:
        p = c["px"]
        col = colors[c["kind"]]
        draw.rectangle([p["x0"], p["y0"], p["x1"], p["y1"]], outline=col, width=4)
        tag = str(c["n"])
        tx, ty = p["x0"] + 2, max(0, p["y0"] - 38)
        draw.rectangle([tx, ty, tx + 24 + 18 * len(tag), ty + 38], fill=col)
        draw.text((tx + 8, ty + 2), tag, fill=(0, 0, 0) if c["kind"] == "knob" else (255, 255, 255), font=font)
    overlay_path = OUT_DIR / f"{args.panel}-overlay.png"
    overlay.save(overlay_path)

    named = sum(1 for c in candidates if c["guess"])
    strong = sum(1 for c in candidates if c["score"] >= 0.85)
    weak = sum(1 for c in candidates if 0 < c["score"] < 0.85)
    print(f"  อ่านป้ายได้ {named}/{len(candidates)} ปุ่ม")
    print(f"  เดา controlId: มั่นใจ {strong} | ไม่มั่นใจ {weak} | เดาไม่ได้ {len(candidates)-strong-weak}")
    print(f"  -> {json_path.relative_to(ROOT)}")
    print(f"  -> {overlay_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
