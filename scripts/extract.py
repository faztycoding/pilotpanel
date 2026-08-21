#!/usr/bin/env python3
"""
extract.py — แปลง .docx ของลูกค้าเป็น data/panels/*.json ตาม docs/data-schema.md

หลักการสำคัญ (ห้ามละเมิด):
  1. ข้อความทุกตัวอักษร copy มาจาก docx ตรงตัว ไม่แต่ง ไม่ขยาย ไม่สรุป ไม่แปล
  2. ทุกย่อหน้าต้องถูก assign เข้า control สักตัว หรือถูกบันทึกใน _unassigned.json
  3. ตัวที่ heuristic ไม่มั่นใจ -> needsReview: true ไม่ใช่เดา
  4. id เป็น deterministic รันซ้ำได้ผลเดิมเสมอ
  5. hotspot = null เสมอ พิกัดมาจาก hotspot-mapper เท่านั้น

usage:
    python scripts/extract.py                 # เขียน data/panels/*.json
    python scripts/extract.py --report        # แสดงสรุปอย่างเดียว ไม่เขียนไฟล์
    python scripts/extract.py --merge         # คงค่า hotspot เดิมที่วางไว้แล้ว (ใช้ตอนรันซ้ำ)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import docx  # python-docx
except ImportError:
    sys.exit("ต้องลง python-docx ก่อน:  pip install python-docx")


# ---------------------------------------------------------------- config

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "source"
OUT_DIR = ROOT / "data" / "panels"
# โซนที่เรากำหนดเอง (เช่น ELEC / HYD บน overhead) — ไม่ได้อยู่ในเอกสาร จึงดึงจาก docx ไม่ได้
# แต่ต้องผ่าน pipeline เหมือนกัน ห้ามไปแก้ generated JSON ด้วยมือ
MANUAL_SECTIONS = ROOT / "data" / "sections-manual.json"

PANELS = [
    # (panelId, ชื่อไฟล์ docx, title, prefix ของ id)
    ("overhead",    "Overhead Panel (finish).docx",  "Overhead Panel",   "oh"),
    ("pedestal",    "Center Pedestal (finish).docx", "Center Pedestal",  "cp"),
    ("glareshield", "glareshield.docx",              "Glareshield",      "gs"),
    ("instrument",  "Instrument Panel.docx",         "Instrument Panel", "ip"),
]

# คำที่บ่งบอกว่าย่อหน้านี้เป็น "ชื่อ control" ไม่ใช่เนื้อหา
CONTROL_NOUNS = (
    r"push[\s\-]?buttons?|pushbuttons?|"
    r"selectors?|knobs?|switch(?:es)?|levers?|handles?|"
    r"lights?|indicators?|indications?|displays?|gauges?|windows?|"
    r"guards?|panels?|buttons?|controls?|pointers?"
)
RE_CONTROL_NOUN = re.compile(CONTROL_NOUNS, re.IGNORECASE)
# เหมือนกันแต่บังคับว่าคำนามต้องอยู่ท้ายบรรทัด — ใช้แยก "ALL push button" (ชื่อ)
# จาก "Two pink lights flash on..." (ประโยค ที่บังเอิญมีคำนามอยู่กลางประโยค)
RE_CONTROL_NOUN_AT_END = re.compile(r"(?:" + CONTROL_NOUNS + r")s?\s*[.)]?\s*$", re.IGNORECASE)

# map คำใน heading -> type ตาม schema (เรียงตามลำดับความจำเพาะ)
TYPE_RULES = [
    (r"push[\s\-]?button|pushbutton", "pushbutton"),
    (r"rotary|selector",              "selector"),
    (r"knob",                         "knob"),
    (r"switch",                       "switch"),
    (r"lever|handle|throttle",        "lever"),
    (r"light|annunciat",              "light"),
    (r"display|window|gauge|screen",  "display"),
    (r"button",                       "pushbutton"),
]

# prefix ที่บอกว่าเป็น bullet ย่อยของ control ปัจจุบัน ไม่ใช่ control ใหม่
BULLET_PREFIXES = (":", "-", "*", "•", "–", "—", "(")

RE_WARNING = re.compile(r"\b(warning|caution|danger|do not|never)\b", re.IGNORECASE)
RE_NOTE = re.compile(r"^\s*(note|ps|nb)\s*[:.]", re.IGNORECASE)
# Legend ในหน้า ECAM เช่น "C = Cold (Valve closed)" / "H = Hot (Valve open)"
# ไม่ใช่ control — เป็นคำอธิบายสัญลักษณ์ในรูป แต่ผ่าน heading detection เพราะเป็น Title Case สั้น ๆ
RE_LEGEND = re.compile(r"^[A-Z]\s*=\s+\S", re.IGNORECASE)

# "(9) Release Indicators" — รูปแบบรายการบนหน้า ECAM SD ของ Center Pedestal
RE_NUMBERED = re.compile(r"^\(\s*(\d{1,2})\s*\)\s*(.+)$")
# "HYD" / "APU" / "COND" — ชื่อ section บนหน้า ECAM (ยืนยันด้วย lookahead ว่าตามด้วย (1))
RE_ALLCAPS = re.compile(r"^[A-Z][A-Z0-9 /\-&]{1,24}$")

# คำขึ้นต้นที่บอกว่าเป็นประโยคอธิบาย ไม่ใช่ชื่อ control
SENTENCE_STARTERS = {
    "this", "these", "those", "the", "it", "its", "a", "an", "there",
    "pressing", "pushing", "press", "push", "turning", "setting", "selecting",
    "when", "if", "while", "during", "after", "before", "once", "in", "on",
    "displays", "display", "shows", "show", "indicates", "indicate",
    "appears", "appear", "allows", "allow", "used", "use", "controls",
    "control", "provides", "provide", "selects", "select", "illuminates",
    "comes", "turns", "turn", "gives", "give", "means", "note", "normally",
    "green", "amber", "red", "white", "blue", "magenta", "each", "both",
    "with", "for", "and", "but", "also", "always", "only", "pressed",
    "associated", "below", "above", "such", "two", "three", "one",
}

STOPWORDS = {"a", "an", "the", "of", "and", "or", "to", "in", "on", "for", "with"}

MAX_HEADING_WORDS = 9
MAX_HEADING_CHARS = 70
MIN_CAP_RATIO_WITH_NOUN = 0.5
MIN_CAP_RATIO_NO_NOUN = 0.7


# ---------------------------------------------------------------- helpers

def clean(text: str) -> str:
    """normalize whitespace อย่างเดียว ห้ามแตะเนื้อหา"""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("\u00a0", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def strip_marker(text: str) -> tuple[str, str]:
    """แยก marker หน้าบรรทัดออกจากข้อความ คืน (marker, ส่วนที่เหลือ)"""
    for p in BULLET_PREFIXES:
        if text.startswith(p) and p != "(":
            return p, text[len(p):].strip()
    return "", text


def guess_type(name: str) -> str:
    low = name.lower()
    for pattern, t in TYPE_RULES:
        if re.search(pattern, low):
            return t
    return "area"


def make_id(prefix: str, name: str, used: set[str]) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    slug = re.sub(r"_+", "_", slug)[:44] or "control"
    base = f"{prefix}_{slug}"
    if base not in used:
        used.add(base)
        return base
    n = 2
    while f"{base}_{n}" in used:
        n += 1
    used.add(f"{base}_{n}")
    return f"{base}_{n}"


def cap_ratio(text: str) -> float:
    """สัดส่วนคำที่ขึ้นต้นด้วยตัวใหญ่ — ชื่อ control เป็น Title Case ประโยคอธิบายไม่ใช่"""
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z0-9/\-']*", text)
             if w.lower() not in STOPWORDS]
    if not words:
        return 0.0
    return sum(1 for w in words if w[0].isupper()) / len(words)


def is_section_heading(text: str, next_text: str | None) -> bool:
    """
    ALLCAPS สั้น ๆ ที่ตามด้วยรายการ (1) = ชื่อ section บนหน้า ECAM เช่น HYD, APU, COND
    ต้องมี lookahead เพื่อไม่ให้ไปจับ bullet label อย่าง 'ON' / 'OFF' / 'FAULT'
    """
    if not RE_ALLCAPS.match(text) or len(text) < 2:
        return False
    if not next_text:
        return False
    return bool(re.match(r"^\(\s*1\s*\)", next_text))


def section_continues(items: list[tuple[int, str]], pos: int) -> bool:
    """
    หลังตำแหน่ง pos ยังมีรายการ "(N)" ของหน้า ECAM เดิมเหลืออยู่ไหม
    (หยุดนับเมื่อเจอ section heading ถัดไป)

    ใช้ตัดสินว่า heading ที่ไม่มีเลขคือ "ออกจากหน้า ECAM แล้ว" หรือแค่บรรทัด legend
    แทรกกลาง เช่น "C = Cold (Valve closed)" ที่อยู่ระหว่าง (3) กับ (4)
    """
    for look in range(pos + 1, len(items)):
        text = items[look][1]
        next_text = items[look + 1][1] if look + 1 < len(items) else None
        if is_section_heading(text, next_text):
            return False
        if RE_NUMBERED.match(text):
            return True
    return False


def is_control_heading(text: str) -> tuple[bool, bool, str]:
    """
    คืน (เป็น heading ไหม, มั่นใจไหม, ชื่อที่สกัดได้)

    เกณฑ์อนุรักษ์นิยม: ยอมพลาดเป็น body ดีกว่าตัด control มั่ว
    control ที่หายไปหาเจอจาก _unassigned.json และจาก body ที่ยาวผิดปกติได้
    แต่ control ที่ถูกสร้างมั่วจะทำให้ข้อมูลเพี้ยนโดยไม่มีใครรู้
    """
    if not text:
        return False, False, ""

    # legend ของหน้า ECAM เช่น "C = Cold (Valve closed)" — ไม่ใช่ control
    if RE_LEGEND.match(text):
        return False, False, ""

    # --- รูปแบบที่ชัดเจนที่สุด: "(9) Release Indicators" ---
    m = RE_NUMBERED.match(text)
    if m:
        name = m.group(2).strip().rstrip(":").strip()
        if 1 < len(name) <= MAX_HEADING_CHARS and not name.endswith((".", ",")):
            return True, True, name
        # heading กับ description อยู่บรรทัดเดียวกัน เช่น
        # "(1) Battery Charge/Discharge Indication Indications are as shown..."
        # ชื่อยาวเกิน MAX_HEADING_CHARS ลอง split ที่ control noun แรก
        noun_match = RE_CONTROL_NOUN.search(name)
        if noun_match and len(name) > MAX_HEADING_CHARS:
            heading = name[: noun_match.end()].strip()
            if 1 < len(heading) <= MAX_HEADING_CHARS and not heading.endswith((".", ",")):
                return True, True, heading
        # fallback: split ที่ SENTENCE_STARTER ตัวแรกที่ไม่ใช่คำแรก — เช่น
        # "(4) Pack Compressor Outlet Temperature Appears in Green..."
        # "Temperature" ไม่อยู่ใน CONTROL_NOUNS จึงต้องใช้ "Appears" เป็นจุดตัด
        # (หัวข้อ ECAM เป็น noun phrase เสมอ ไม่มีวันขึ้นต้นด้วย sentence starter)
        if len(name) > MAX_HEADING_CHARS:
            words = name.split()
            for wi in range(1, len(words)):
                if words[wi].lower().strip(".,;:") in SENTENCE_STARTERS:
                    heading = " ".join(words[:wi]).strip()
                    if 1 < len(heading) <= MAX_HEADING_CHARS and not heading.endswith((".", ",")):
                        return True, True, heading
                    break
        return False, False, ""

    marker, body = strip_marker(text)

    # bullet ที่ขึ้นต้นด้วย - หรือ : เป็นตัวเลือกย่อยเสมอ
    if marker in (":", "-", "–", "—"):
        return False, False, ""

    if len(body) > MAX_HEADING_CHARS or len(body.split()) > MAX_HEADING_WORDS:
        return False, False, ""
    if body.endswith((".", ",", ";")):
        return False, False, ""

    first = body.split()[0].lower().strip("*:") if body.split() else ""
    if first in SENTENCE_STARTERS:
        return False, False, ""

    has_noun = bool(RE_CONTROL_NOUN.search(body))
    ratio = cap_ratio(body)

    # กรณีคำนามอยู่ท้ายบรรทัดพอดี (ไม่ใช่กลางประโยค) — คำนวณ ratio จากส่วน "ชื่อ" ก่อนคำนาม
    # แทน เพราะคำนามพวกนี้เขียนเป็นตัวเล็กเสมอในเอกสาร มันเจือจาง ratio ของชื่อสั้น เช่น
    # "ALL push button" ratio เดิม = 1/3 (แค่ ALL ตัวใหญ่) ไม่ผ่าน threshold ทั้งที่เป็นชื่อปุ่มจริง
    # ต้องบังคับว่าคำนามอยู่ท้ายบรรทัดเท่านั้น ไม่งั้นประโยคที่บังเอิญมีคำนามกลางประโยคจะหลุดผ่านด้วย
    end_match = RE_CONTROL_NOUN_AT_END.search(body)
    if end_match:
        name_prefix = body[: end_match.start()].strip()
        if name_prefix:
            ratio = max(ratio, cap_ratio(name_prefix))

    # "Mode Select Switch: This switches between..." — ชื่อปนเนื้อหาบรรทัดเดียว
    if ":" in body and has_noun and body.index(":") < 45:
        name = body.split(":", 1)[0].strip()
        if cap_ratio(name) >= MIN_CAP_RATIO_WITH_NOUN:
            return True, True, name

    name = body.rstrip(":").strip()

    # มีคำบ่งชี้ control ชัดเจน
    if has_noun and ratio >= MIN_CAP_RATIO_WITH_NOUN:
        return True, marker != "*", name

    # ไม่มีคำบ่งชี้ แต่เป็น Title Case สั้น ๆ — เช่นชื่อโซนบน PFD ของ Instrument Panel
    # ยอมรับแต่ mark needsReview เพราะมั่นใจน้อย
    # เงื่อนไขเข้มกว่าปกติ เพราะกฎนี้คือกฎที่ตัดเกินง่ายที่สุด
    if (
        not has_noun
        and ratio >= MIN_CAP_RATIO_NO_NOUN
        and 2 <= len(body.split()) <= 6
        and ":" not in body                 # "HOT position: 30°C" = เนื้อหา ไม่ใช่ชื่อ
        and not body.isupper()              # "COLUMN 2 ANNUCIATIONS" = หัวข้อย่อยในคำอธิบาย
        and not body.endswith("-")          # "MAN FLX XX -" = label ของ bullet
        and not re.search(r"\d\s*(%|°|kt|ft|nm|psi)", body, re.IGNORECASE)
    ):
        return True, False, name

    return False, False, ""


def classify_body(text: str) -> dict:
    marker, body = strip_marker(text)

    if RE_NOTE.match(body):
        return {"kind": "note", "text": text}
    if RE_WARNING.search(body) and len(body) < 220:
        return {"kind": "warning", "text": text}
    if marker:
        # ":TEST" / "-NAV" / "*FAULT" -> bullet ที่มี label
        m = re.match(r"^([A-Z0-9][A-Z0-9 /+\-\.]{0,24})(?::|$|\s{2,})", body)
        item: dict = {"kind": "bullet", "text": text}
        if m and m.group(1).strip():
            item["label"] = m.group(1).strip()
        return item
    return {"kind": "p", "text": text}


# เอกสารลูกค้าบาง control อธิบายด้วยรูปแทนข้อความ เขียน "See image below:" เป็น text
# แปลงเป็น body block kind: 'image' แทน แล้วดึงรูปจาก assets/body-images/<panelId>/<controlId>.webp
# (ดู scripts/extract-body-images.py สำหรับการดึงรูปจาก .docx)
RE_SEE_IMAGE = re.compile(r"^see\s+image\s+below:?$", re.IGNORECASE)


def is_see_image_placeholder(text: str) -> bool:
    return bool(RE_SEE_IMAGE.match(text.strip()))


# ---------------------------------------------------------------- core

def extract_panel(panel_id: str, filename: str, title: str, prefix: str):
    path = SOURCE_DIR / filename
    if not path.exists():
        return None, [f"ไม่พบไฟล์ {path}"]

    document = docx.Document(str(path))
    paragraphs = [
        (i, clean(p.text))
        for i, p in enumerate(document.paragraphs)
        if clean(p.text)
    ]

    controls: list[dict] = []
    sections: list[dict] = []
    unassigned: list[dict] = []
    used_ids: set[str] = set()
    used_sections: set[str] = set()
    current: dict | None = None
    current_section: str | None = None
    last_heading_idx: int | None = None

    # ย่อหน้าแรกคือชื่อเอกสาร ข้ามไป
    start = 1 if paragraphs and len(paragraphs[0][1]) < 40 else 0
    items = paragraphs[start:]

    for pos, (idx, text) in enumerate(items):
        next_text = items[pos + 1][1] if pos + 1 < len(items) else None

        # --- section heading บนหน้า ECAM ---
        if is_section_heading(text, next_text):
            sid = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
            if sid not in used_sections:
                used_sections.add(sid)
                sections.append({"id": sid, "name": text})
            current_section = sid
            current = None
            continue

        previous_idx = items[pos - 1][0] if pos > 0 else idx
        if RE_ALLCAPS.match(text) and idx - previous_idx >= 8:
            current_section = None
            current = None
            unassigned.append({"sourceRef": f"{filename}#p{idx}", "text": text})
            continue

        heading, confident, name = is_control_heading(text)

        if heading:
            # sub-heading ตรวจจับ: heading ที่ตามหลัง heading ก่อนหน้าภายใน 2 paragraphs
            # และ parent ยังไม่มี body = เป็นส่วนประกอบของ parent ไม่ใช่ control ใหม่
            # เช่น "RAT AND EMER GEN light" -> "FAULT Light" / "ENG 1(2) FAULT Light" -> "FAULT Light"
            # ห้ามจับ numbered heading "(N)" เป็น sub-heading เพราะเป็น control แยกของหน้า ECAM
            numbered = bool(RE_NUMBERED.match(text))
            is_sub = (
                not numbered
                and current is not None
                and not current.get("body")
                and last_heading_idx is not None
                and idx - last_heading_idx <= 2
                and (
                    name.lower() in current["name"].lower()
                    or (
                        len(name.split()) <= 3
                        and RE_CONTROL_NOUN.search(name)
                        and RE_CONTROL_NOUN.search(current["name"])
                    )
                )
            )
            if is_sub:
                current["body"].append({"kind": "p", "text": name})
                continue

            # รายการบนหน้า ECAM ขึ้นต้นด้วย "(N)" เสมอ ส่วนปุ่มกายภาพเป็น heading ธรรมดา
            # เจอ heading ที่ไม่มีเลขและไม่มี "(N)" ตามมาอีก = ออกจากหน้า ECAM แล้ว ต้องปิด section
            # ไม่งั้นปุ่มกายภาพท้ายเอกสารจะถูกดูดเข้า section สุดท้ายทั้งหมด
            numbered = bool(RE_NUMBERED.match(text))
            if not numbered and not section_continues(items, pos):
                current_section = None

            inline = ""
            _, raw = strip_marker(text)
            if ":" in raw and raw.split(":", 1)[0].strip() == name:
                inline = raw.split(":", 1)[1].strip()
            elif RE_NUMBERED.match(text):
                # "(N) Heading Description..." — heading กับ description บรรทัดเดียว
                # is_control_heading split ที่ control noun แล้ว เก็บส่วนท้ายเป็น body
                m_num = RE_NUMBERED.match(text)
                after_num = m_num.group(2).strip()
                idx_name = after_num.find(name)
                if idx_name >= 0:
                    rest = after_num[idx_name + len(name):].strip().rstrip(":").strip()
                    if rest:
                        inline = rest

            current = {
                "id": make_id(prefix, name, used_ids),
                "name": name,
                "type": guess_type(name),
                "hotspot": None,
                "body": [],
                "sourceRef": f"{filename}#p{idx}",
                "needsReview": not confident,
            }
            if current_section:
                current["sectionId"] = current_section
            if inline:
                current["body"].append({"kind": "p", "text": inline})
            controls.append(current)
            last_heading_idx = idx
            continue

        if current is None:
            unassigned.append({"sourceRef": f"{filename}#p{idx}", "text": text})
            continue

        # "See image below" = เอกสารอธิบายด้วยรูปแทนข้อความ แปลงเป็น kind: 'image'
        # ชื่อรูป = controlId.webp ใน assets/body-images/<panelId>/ (ดู extract-body-images.py)
        if is_see_image_placeholder(text):
            current["body"].append({"kind": "image", "text": "", "image": f"{current['id']}.webp"})
        else:
            current["body"].append(classify_body(text))

    # control ที่ไม่มีเนื้อหาเลย = heuristic น่าจะตัดผิด ต้องให้คนดู
    for c in controls:
        if not c["body"]:
            c["needsReview"] = True

    panel = {
        "panelId": panel_id,
        "title": title,
        "image": f"{panel_id}.webp",
        "imageSize": {"w": 0, "h": 0},  # ต้องกรอกเองหลังเตรียมรูป (STEP 0.7)
        "sections": sections,
        "controls": controls,
    }
    return (panel, unassigned), []


def load_manual_sections() -> dict:
    """
    อ่าน data/sections-manual.json ถ้ามี

    {
      "overhead": [
        { "id": "elec", "name": "ELEC", "controlIds": ["oh_bat_1", "oh_bat_2"] }
      ],
      "pedestal": [
        {
          "id": "hyd", "name": "HYD", "controlIds": [...],
          "image": "pedestal_ecam_hyd.webp", "imageSize": {"w": 1291, "h": 1267},
          "entry": {"x": 0.42, "y": 0.05, "w": 0.03, "h": 0.02}
        }
      ]
    }

    `image`/`imageSize`/`viewport`/`entry` เป็น optional — ใส่ตอนที่รูป section
    และพิกัดปุ่มเลือกหน้าจอจริงพร้อมแล้วเท่านั้น (ดู docs/data-schema.md)
    """
    if not MANUAL_SECTIONS.exists():
        return {}
    try:
        return json.loads(MANUAL_SECTIONS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"  ✗ {MANUAL_SECTIONS.name} อ่านไม่ได้: {e}")
        return {}


def apply_manual_sections(panel: dict, manual: dict) -> list[str]:
    """merge โซนที่กำหนดเองเข้า panel คืน list ของ warning"""
    items = manual.get(panel["panelId"])
    if not items:
        return []

    by_id = {c["id"]: c for c in panel["controls"]}
    sections_by_id = {s["id"]: s for s in panel["sections"]}
    warns: list[str] = []

    for item in items:
        sid = item.get("id")
        if not sid:
            warns.append("section ไม่มี id — ข้าม")
            continue
        section = sections_by_id.get(sid)
        if section is None:
            section = {"id": sid, "name": item.get("name", sid)}
            panel["sections"].append(section)
            sections_by_id[sid] = section
        elif "name" in item:
            section["name"] = item["name"]

        if "image" in item:
            section["image"] = item["image"]
            section["imageSize"] = item.get("imageSize", {"w": 0, "h": 0})
        if "viewport" in item:
            section["viewport"] = item["viewport"]
        if "entry" in item:
            section["entry"] = item["entry"]

        for cid in item.get("controlIds", []):
            control = by_id.get(cid)
            if control is None:
                warns.append(f"{panel['panelId']}: ไม่พบ control id '{cid}' ที่ระบุใน section '{sid}'")
                continue
            control["sectionId"] = sid
    return warns


def merge_hotspots(new_panel: dict, out_path: Path) -> int:
    """คงพิกัดที่วางไว้แล้วตอนรัน extractor ซ้ำ — กันงาน mapper หายทั้งหมด

    คง hotspot + detailImage เดิม (ทั้งคู่มาจาก tools/hotspot-mapper ไม่ใช่จาก docx
    extractor ไม่มีทางรู้ค่าพวกนี้เอง ถ้าไม่ merge กลับจะหายทุกครั้งที่รันซ้ำ)
    """
    if not out_path.exists():
        return 0
    try:
        old = json.loads(out_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return 0
    old_by_id = {c["id"]: c for c in old.get("controls", [])}
    kept = 0
    for c in new_panel["controls"]:
        prev = old_by_id.get(c["id"])
        if not prev:
            continue
        if prev.get("hotspot"):
            c["hotspot"] = prev["hotspot"]
            kept += 1
        if prev.get("detailImage"):
            c["detailImage"] = prev["detailImage"]
    # คง imageSize เดิมด้วย
    if old.get("imageSize", {}).get("w"):
        new_panel["imageSize"] = old["imageSize"]
    return kept


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true", help="แสดงสรุปอย่างเดียว ไม่เขียนไฟล์")
    ap.add_argument("--merge", action="store_true", help="คงค่า hotspot เดิมที่วางไว้แล้ว")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"\nextract.py  source={SOURCE_DIR}\n{'─' * 72}")
    print(f"  {'panel':<13}{'controls':>9}{'needsReview':>13}{'body blocks':>13}{'unassigned':>12}")
    print(f"{'─' * 72}")

    total_c = total_r = total_u = 0
    all_unassigned: list[dict] = []
    manual = load_manual_sections()
    manual_warns: list[str] = []
    failed = False

    for panel_id, filename, title, prefix in PANELS:
        result, errs = extract_panel(panel_id, filename, title, prefix)
        if errs:
            for e in errs:
                print(f"  ✗ {e}")
            failed = True
            continue

        panel, unassigned = result
        manual_warns.extend(apply_manual_sections(panel, manual))
        controls = panel["controls"]
        review = sum(1 for c in controls if c["needsReview"])
        blocks = sum(len(c["body"]) for c in controls)

        out_path = OUT_DIR / f"{panel_id}.json"
        kept = merge_hotspots(panel, out_path) if args.merge else 0

        print(f"  {panel_id:<13}{len(controls):>9}{review:>13}{blocks:>13}{len(unassigned):>12}"
              + (f"   (คง hotspot {kept})" if kept else ""))

        total_c += len(controls)
        total_r += review
        total_u += len(unassigned)
        for u in unassigned:
            u["panelId"] = panel_id
        all_unassigned.extend(unassigned)

        if not args.report:
            out_path.write_text(
                json.dumps(panel, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

    print(f"{'─' * 72}")
    print(f"  {'TOTAL':<13}{total_c:>9}{total_r:>13}{'':>13}{total_u:>12}\n")

    if not args.report:
        (OUT_DIR / "_unassigned.json").write_text(
            json.dumps(all_unassigned, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"  เขียนไฟล์ลง {OUT_DIR}")

    for w in manual_warns:
        print(f"  ⚠  {w}")
    if total_r:
        print(f"\n  ⚠  มี {total_r} control ที่ needsReview=true — ต้องเปิด docx เทียบด้วยตาก่อนส่งงาน")
    if total_u:
        print(f"  ⚠  มี {total_u} ย่อหน้าที่ยังไม่ถูก assign — ดู data/panels/_unassigned.json")
    print()

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
