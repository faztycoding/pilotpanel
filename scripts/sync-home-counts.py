#!/usr/bin/env python3

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PANEL_DIR = ROOT / "data" / "panels"
HOME_PATH = PANEL_DIR / "_home.json"


def main() -> int:
    home = json.loads(HOME_PATH.read_text(encoding="utf-8"))
    counts = {}
    for path in PANEL_DIR.glob("*.json"):
        if path.name.startswith("_"):
            continue
        panel = json.loads(path.read_text(encoding="utf-8"))
        counts[panel["panelId"]] = len(panel.get("controls", []))

    changed = 0
    for control in home.get("controls", []):
        target = control.get("target")
        if target not in counts:
            continue
        for block in control.get("body", []):
            text = block.get("text", "")
            updated = re.sub(r"—\s*\d+\s+controls\s*$", f"— {counts[target]} controls", text)
            if updated != text:
                block["text"] = updated
                changed += 1

    HOME_PATH.write_text(json.dumps(home, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"อัปเดต {changed} count ใน {HOME_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
