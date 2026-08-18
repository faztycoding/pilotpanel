#!/usr/bin/env python3
"""
clean-doc-figures.py — เตรียมรูปจอจากเอกสารลูกค้าให้พร้อมใช้เป็น asset

รูปในเอกสารมีกรอบแดงกับคำอธิบายที่ผู้เขียนวาดทับไว้เพื่อชี้ตำแหน่ง ต้องเอาออกก่อนใช้ในแอป
แต่ห้ามลบสีแดงที่เป็นสัญลักษณ์การบินจริง (แถบ VMAX/VLS บนสเกลความเร็ว, ริบบิ้น Ground
Reference ข้างสเกลระดับความสูง) ซึ่งเป็นสีแดงเหมือนกันเป๊ะ

วิธีแยก 2 ชั้น:
  1. เอาเฉพาะสีแดงสดจัด (R>165, G<75, B<75) — พื้นดินสีส้มของ attitude indicator มี G~140
     จึงไม่เข้าเกณฑ์ (เคยพลาดตรงนี้ ทำให้พื้นดินเลอะทั้งแถบ)
  2. เอาเฉพาะที่เป็นเส้นตรงยาวเกิน 200px — กรอบอธิบายยาว 400-1200px
     ส่วนแถบ VMAX จริงสูงไม่ถึง 120px จึงรอด
  3. โซนที่มีสัญลักษณ์แดงจริงถูกกันไว้ทั้งโซน (KEEP_ZONES) ไม่แตะเลย

usage:
    python scripts/clean-doc-figures.py
    ผลลัพธ์: assets/raw/instrument-clean/{pfd,nd,ewd}.png
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit("ต้องลง Pillow กับ numpy ก่อน:  pip install pillow numpy")

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets" / "raw" / "Instrument Panel"
OUT_DIR = ROOT / "assets" / "raw" / "instrument-clean"

MIN_LINE_LEN = 200
# โซนที่ห้ามแตะ (ratio ของความกว้าง) เพราะมีสีแดงที่เป็นข้อมูลการบินจริง
KEEP_ZONES = {
    "pfd": [(0.0, 0.155), (0.90, 1.0)],  # สเกลความเร็วซ้าย / Ground Reference ขวา
}


def long_line_mask(red: np.ndarray) -> np.ndarray:
    """คืน mask ของพิกเซลแดงที่อยู่ในเส้นตรงยาว (แนวนอนหรือแนวตั้ง) เท่านั้น"""
    out = np.zeros_like(red)

    def scan(arr: np.ndarray, horizontal: bool) -> None:
        for i in range(arr.shape[0]):
            idx = np.where(arr[i])[0]
            if len(idx) == 0:
                continue
            start = prev = idx[0]
            for j in list(idx[1:]) + [None]:
                if j is not None and j == prev + 1:
                    prev = j
                    continue
                if prev - start + 1 >= MIN_LINE_LEN:
                    if horizontal:
                        out[i, start : prev + 1] = True
                    else:
                        out[start : prev + 1, i] = True
                if j is None:
                    break
                start = prev = j

    scan(red, True)
    scan(red.T, False)
    return out


def inpaint(arr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """เติมพิกเซลใน mask ด้วย median ของเพื่อนบ้านที่ไม่อยู่ใน mask ขยายรัศมีจนเติมได้ครบ"""
    h, w = mask.shape
    out = arr.astype(float).copy()
    remaining = mask.copy()
    for radius in (5, 9, 14, 22, 32):
        ys, xs = np.where(remaining)
        if len(ys) == 0:
            break
        for y, x in zip(ys, xs):
            y0, y1 = max(0, y - radius), min(h, y + radius + 1)
            x0, x1 = max(0, x - radius), min(w, x + radius + 1)
            clean = ~mask[y0:y1, x0:x1]
            if clean.sum() < 6:
                continue
            out[y, x] = np.median(arr[y0:y1, x0:x1][clean], axis=0)
            remaining[y, x] = False
    return np.clip(out, 0, 255)


def remove_annotation_boxes(img: Image.Image, keep_zones: list[tuple[float, float]]) -> Image.Image:
    arr = np.array(img.convert("RGB")).astype(int)
    h, w = arr.shape[:2]
    keep = np.zeros((h, w), bool)
    for lo, hi in keep_zones:
        keep[:, int(lo * w) : int(hi * w)] = True

    for _ in range(2):  # รอบสองเก็บขอบที่ถูก antialias ไว้จนหลุดรอบแรก
        R, G, B = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        bright_red = (R > 165) & (G < 75) & (B < 75)
        lines = long_line_mask(bright_red & ~keep)
        soft_red = (R - G > 25) & (R - B > 25) & (G < 115) & (R > 60)
        mask = np.array(
            Image.fromarray((lines * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7))
        ) > 0
        mask &= soft_red & ~keep
        if not mask.any():
            break
        print(f"     ลบเส้นกรอบ {int(mask.sum())} พิกเซล (กันโซนสัญลักษณ์จริงไว้ {int(keep.sum())})")
        arr = inpaint(arr, mask).round().astype(int)
    return Image.fromarray(arr.astype(np.uint8))


def bbox_of(arr: np.ndarray, mask: np.ndarray, pad: int) -> tuple[int, int, int, int]:
    ys, xs = np.where(mask)
    return (xs.min() + pad, ys.min() + pad, xs.max() - pad + 1, ys.max() - pad + 1)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # PFD — รูปเต็มจอ มีกรอบแดงอธิบาย 5 กรอบ
    print("  PFD (image2.jpg):")
    pfd = remove_annotation_boxes(Image.open(SRC_DIR / "image2.jpg"), KEEP_ZONES["pfd"])
    pfd.save(OUT_DIR / "pfd.png")
    print(f"     -> pfd.png {pfd.size}")

    # ND — ครอปเอาแต่จอ ตัดคำอธิบายรอบนอกออก (กรอบจอเป็นสีเขียวอมฟ้า)
    src = Image.open(SRC_DIR / "image8.jpg").convert("RGB")
    a = np.array(src).astype(int)
    teal = (a[:, :, 1] > 90) & (a[:, :, 2] > 90) & (a[:, :, 0] < 90)
    nd = src.crop(bbox_of(a, teal, 6))
    nd.save(OUT_DIR / "nd.png")
    print(f"  ND (image8.jpg) -> nd.png {nd.size}")

    # E/WD — image9 มีทั้งจอ E/WD ด้านบนและรูป COND+คำอธิบายด้านล่าง
    # กรอบแดงของจอจริงอยู่ x96-1074 y62-681; bbox ของ "สีแดงทั้งหมด" ใช้ไม่ได้ เพราะ
    # คำอธิบายด้านล่างก็มีลูกศรแดง ทำให้ครอปติดทั้งหน้า (เคยพลาด ได้ไฟล์สูง 1067px)
    # ครอปด้านในกรอบจอโดยตรง ไม่แก้พิกเซลภายในแม้แต่จุดเดียว
    src = Image.open(SRC_DIR / "image9.jpg").convert("RGB")
    ewd = src.crop((110, 72, 1061, 672))
    ewd.save(OUT_DIR / "ewd.png")
    print(f"  E/WD (image9.jpg) -> ewd.png {ewd.size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
