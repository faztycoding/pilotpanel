#!/usr/bin/env python3

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "sections" / "pedestal" / "eng.webp"
W, H = 1554, 998
WHITE = "#F4F7F2"
GREEN = "#36F28B"
AMBER = "#FFB629"
CYAN = "#57D9FF"
DIM = "#789088"
BG = "#060909"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(BOLD if bold else FONT, size)


def centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: str, size: int, bold: bool = False) -> None:
    f = font(size, bold)
    box = draw.textbbox((0, 0), text, font=f)
    draw.text((xy[0] - (box[2] - box[0]) / 2, xy[1] - (box[3] - box[1]) / 2), text, font=f, fill=fill)


def pair(draw: ImageDraw.ImageDraw, y: int, value: str = "--", fill: str = GREEN, size: int = 37) -> None:
    centered(draw, (445, y), value, fill, size, True)
    centered(draw, (1109, y), value, fill, size, True)


def separator(draw: ImageDraw.ImageDraw, y: int) -> None:
    draw.line((170, y, 1384, y), fill="#163329", width=2)


def valve(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.ellipse((cx - 29, cy - 29, cx + 29, cy + 29), outline=GREEN, width=4)
    draw.line((cx - 20, cy - 20, cx + 20, cy + 20), fill=GREEN, width=4)
    draw.line((cx + 20, cy - 20, cx - 20, cy + 20), fill=GREEN, width=4)


def gauge(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.arc((cx - 58, cy - 42, cx + 58, cy + 74), 195, 345, fill=WHITE, width=4)
    draw.line((cx, cy + 17, cx + 39, cy - 13), fill=GREEN, width=5)
    draw.ellipse((cx - 5, cy + 12, cx + 5, cy + 22), fill=GREEN)


image = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(image)
for y in range(0, H, 6):
    draw.line((0, y, W, y), fill="#08100E", width=1)
draw.rounded_rectangle((24, 20, W - 24, H - 20), radius=28, outline="#24342F", width=4)
draw.rounded_rectangle((42, 38, W - 42, H - 38), radius=22, outline="#0F1E19", width=2)

centered(draw, (W // 2, 66), "ENG", WHITE, 48, True)
centered(draw, (445, 71), "1", WHITE, 34, True)
centered(draw, (1109, 71), "2", WHITE, 34, True)
draw.line((W // 2, 102, W // 2, 958), fill="#153127", width=2)

centered(draw, (W // 2, 123), "BLEED PRESS", WHITE, 24)
pair(draw, 157)
centered(draw, (W // 2, 162), "PSI", CYAN, 18)
separator(draw, 188)

centered(draw, (W // 2, 211), "FUEL USED", WHITE, 24)
pair(draw, 251)
centered(draw, (W // 2, 256), "KG", CYAN, 18)
separator(draw, 286)

centered(draw, (W // 2, 307), "OIL QTY", WHITE, 24)
pair(draw, 341)
centered(draw, (W // 2, 346), "QT", CYAN, 18)
separator(draw, 370)

centered(draw, (W // 2, 394), "OIL PRESS", WHITE, 24)
gauge(draw, 445, 437)
gauge(draw, 1109, 437)
centered(draw, (W // 2, 461), "PSI", CYAN, 18)
separator(draw, 489)

centered(draw, (W // 2, 511), "OIL TEMP", WHITE, 24)
pair(draw, 545)
centered(draw, (W // 2, 550), "°C", CYAN, 18)
separator(draw, 574)

centered(draw, (W // 2, 597), "VIB", GREEN, 25, True)
centered(draw, (W // 2 - 55, 633), "N1", WHITE, 21)
pair(draw, 633, "--.-", GREEN, 31)
centered(draw, (W // 2 - 55, 662), "N2", WHITE, 21)
pair(draw, 662, "--.-", GREEN, 31)
separator(draw, 688)

centered(draw, (W // 2, 710), "OIL FILTER", WHITE, 23)
centered(draw, (445, 738), "CLOG", AMBER, 27, True)
centered(draw, (1109, 738), "CLOG", AMBER, 27, True)
separator(draw, 757)

centered(draw, (W // 2, 778), "FUEL FILTER", WHITE, 23)
centered(draw, (445, 806), "CLOG", AMBER, 27, True)
centered(draw, (1109, 806), "CLOG", AMBER, 27, True)
separator(draw, 825)

centered(draw, (W // 2, 846), "IGN", WHITE, 23)
pair(draw, 874, "A/B", GREEN, 26)
separator(draw, 893)

centered(draw, (W // 2, 915), "START VALVE", WHITE, 23)
valve(draw, 445, 951)
valve(draw, 1109, 951)
centered(draw, (W // 2, 967), "TRAINING SCHEMATIC • CUSTOMER DOCX CONTENT", DIM, 14)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, "WEBP", quality=92, method=6)
print(f"{OUTPUT.relative_to(ROOT)} {W}x{H}")
