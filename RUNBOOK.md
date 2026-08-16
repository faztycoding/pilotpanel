# Switch 320 — RUNBOOK
### คู่มือลงมือทำแบบ copy-paste ตั้งแต่บรรทัดแรกจนถึง APK

อ่านจากบนลงล่าง ทำตามลำดับ ห้ามข้าม STEP 0
ทุกกล่องที่ขึ้นต้นด้วย `>>> PROMPT` คือข้อความที่ก๊อปไปวางใน Cascade ตรงๆ

**Timeline อ้างอิง**
| ช่วง | ทำอะไร | งวด |
|---|---|---|
| 15–21 ส.ค. | STEP 0–5 : setup + glareshield จบ 100% | งวด 1 (จ่ายแล้ว) |
| 22–28 ส.ค. | STEP 6–7 : instrument + pedestal + search | |
| 29 ส.ค.–1 ก.ย. | STEP 8–9 : overhead + build + ส่งงาน | งวด 2 |
| 2–15 ก.ย. | warranty เฉพาะ bug | งวด 3 |

---

# STEP 0 — Setup (30 นาที, ห้ามเปิด Cascade ระหว่างนี้)

## 0.1 สร้างโปรเจกต์

```bash
npx create-expo-app@latest switch320
cd switch320
git init && git add -A && git commit -m "chore: expo baseline"
```

## 0.2 ลง dependency ทั้งหมดรอบเดียว

```bash
npx expo install \
  react-native-gesture-handler \
  react-native-reanimated \
  react-native-safe-area-context \
  react-native-screens \
  expo-image \
  expo-router

npm i @gorhom/bottom-sheet
```

> ลงครบตั้งแต่แรกเพื่อจะได้บังคับกฎ "ห้าม Cascade เพิ่ม dependency" ได้เต็มปาก
> ถ้ามันขอลงอะไรเพิ่มหลังจากนี้ = สัญญาณว่ามันกำลังออกนอก plan

## 0.3 สร้างโครงโฟลเดอร์

```bash
mkdir -p app src/components src/lib data/panels assets/panels \
         scripts tools/hotspot-mapper docs
```

## 0.4 วาง 4 ไฟล์ควบคุม

วางไฟล์ที่ได้ไปแล้วตามตำแหน่งนี้:

```
switch320/
├── .windsurfrules            <- guardrail ของ Cascade
├── AGENTS.md                 <- บริบทโปรเจกต์
├── docs/data-schema.md       <- contract ของข้อมูล
└── scripts/validate-data.mjs <- external verifier
```

## 0.5 เพิ่ม scripts ใน package.json

```json
"scripts": {
  "validate:data": "node scripts/validate-data.mjs",
  "validate:strict": "node scripts/validate-data.mjs --strict",
  "typecheck": "tsc --noEmit"
}
```

## 0.6 เปิด TypeScript strict — แก้ tsconfig.json

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

## 0.7 เตรียมรูป

```bash
# แปลงรูป panel ทุกใบเป็น WebP ก่อนใส่ assets
# ปรับ -q ตามความคมที่ยอมรับได้ 82 คือจุดที่คุ้มสุด
cwebp -q 82 overhead.png -o assets/panels/overhead.webp
cwebp -q 82 glareshield.png -o assets/panels/glareshield.webp
cwebp -q 82 instrument.png -o assets/panels/instrument.webp
cwebp -q 82 pedestal.png -o assets/panels/pedestal.webp
cwebp -q 82 cockpit_home.png -o assets/panels/cockpit_home.webp

# จด imageSize จริงไว้ ต้องใช้ตอนทำ JSON
identify assets/panels/*.webp
```

## 0.8 Checkpoint

```bash
git add -A && git commit -m "chore: project rules, schema, validator, assets"
```

> **ถึงตรงนี้ค่อยเปิด Cascade ครั้งแรกได้**
> เหตุผล: Cascade อ่าน rules ตอนเริ่ม session ถ้าปล่อยให้มันเขียนโค้ดชุดแรกก่อนมีกฎ
> โค้ดชุดนั้นจะกลายเป็น pattern ที่มันเลียนแบบต่อไปทั้งโปรเจกต์ ล้างยาก

---

# STEP 1 — T1 Panel Viewer (งานที่สำคัญที่สุด)

ทำ 2 รอบเสมอ: **Plan รอบนึง → Implement อีกรอบนึง**

## 1.1 PLAN — ปิด Write mode ก่อน

```
>>> PROMPT — T1 PLANNER

คุณคือ planning agent ห้ามแก้ไฟล์ใดๆ ในรอบนี้
อ่าน AGENTS.md, .windsurfrules, docs/data-schema.md ก่อนตอบ

TASK: T1 — Panel Viewer vertical slice

GOAL
แสดงรูป panel เดียว (glareshield) ซูม/แพนได้ แตะ hotspot แล้วเปิด bottom sheet
render เนื้อหาจาก control.body

SCOPE
app/panel/[id].tsx, src/components/, src/lib/ เท่านั้น

OUT OF SCOPE
extractor, hotspot mapper, panel อื่น, search, หน้า Home, การแก้ data/

INPUTS
data/panels/glareshield.json ตาม docs/data-schema.md
assets/panels/glareshield.webp

INVARIANTS
- hotspot เก็บเป็น ratio 0..1 คูณกับขนาดรูปที่ layout จริงเท่านั้น
- ห้ามมีตัวเลข px คงที่ในโค้ดคำนวณพิกัดแม้แต่ตัวเดียว
- รูปคง aspect ratio เดิมทุกขนาดจอ
- hotspot ต้องขยับตามภาพตอน zoom/pan อย่างถูกต้อง
- zoom สูงสุด 6x ต่ำสุด 1x

ACCEPTANCE
- แตะปุ่มเดิมได้ทั้งที่ zoom 1x และ zoom 5x หลัง pan ไปมุมใดก็ตาม
- แตะพื้นที่ว่างแล้วไม่มีอะไรเปิด
- bottom sheet ปัดปิดได้ เปิดปุ่มใหม่ทับของเดิมได้
- npx tsc --noEmit ผ่าน

ส่งกลับมา
1. ไฟล์ที่จะสร้าง/แก้ พร้อมหน้าที่ของแต่ละไฟล์
2. สูตรคำนวณพิกัดที่เสนอ เขียนเป็นสมการออกมาให้เห็นชัด
   พร้อมบอกว่า gesture-handler จะจับ tap ที่ระดับไหนของ tree
3. edge case ที่คิดออก
4. ขั้นตอน implement เรียงลำดับ
5. คำถาม/assumption ที่ยังไม่ชัด

ห้ามอ้างข้อเท็จจริงเกี่ยวกับ repo โดยไม่ได้เปิดไฟล์ดูจริง
```

> **อ่านข้อ 2 ให้ละเอียดที่สุดในทั้งโปรเจกต์**
> ถ้าสูตรพิกัดผิด กว่าจะรู้คือตอนวาง hotspot ไปแล้ว 200 จุด แล้วต้องรื้อใหม่หมด
> สูตรที่ถูกต้องหน้าตาประมาณ:
> `screenX = (hotspot.x * imgW) * scale + translateX`
> โดย `imgW` = ความกว้างรูปหลัง layout ไม่ใช่ความกว้างไฟล์ต้นฉบับ

## 1.2 IMPLEMENT — เปิด Write mode

```
>>> PROMPT — T1 IMPLEMENTER

implement เฉพาะ plan ที่อนุมัติแล้วเท่านั้น
ห้ามออกนอก scope ห้าม refactor ที่ไม่ได้ขอ ห้ามเพิ่ม dependency

ก่อนเริ่ม: สร้าง data/panels/glareshield.json แบบ mock ที่มี 3 controls
พร้อม hotspot สมมติ เพื่อใช้ทดสอบ viewer (ของจริงจะมาจาก extractor ทีหลัง)

เสร็จแล้วให้:
- รัน npx tsc --noEmit และรายงานคำสั่ง + ผลลัพธ์จริง
- list ไฟล์ที่แก้ทั้งหมด
- บอก assumption ที่ตั้งเอง
- บอกความเสี่ยงที่ยังเหลือ

ห้ามเขียนว่า "เสร็จแล้ว" ถ้ายังไม่ได้รันคำสั่งจริง
```

## 1.3 ทดสอบด้วยมือ

```bash
npx expo start
# ยิง QR เข้า Poco X7
```

เช็ค 3 อย่างนี้ให้ผ่านก่อนไปต่อ:
- [ ] zoom สุด แล้ว pan ไปมุมขวาล่าง แตะปุ่มยังตรงตัวเดิม
- [ ] หมุนจอ แนวนอน/แนวตั้ง แล้วพิกัดยังตรง
- [ ] ลองบน Tab S9 FE+ ด้วย (aspect ratio ต่างกันมาก คือจุดที่มักพัง)

```bash
git add -A && git commit -m "feat(T1): panel viewer with ratio-based hotspots"
```

---

# STEP 2 — Extractor (เขียนให้แล้ว ไม่ต้องใช้ Cascade)

`scripts/extract.py` รันได้เลย ผ่านเอกสารจริงทั้ง 4 ไฟล์แล้ว

```bash
mkdir -p source
# วางไฟล์ .docx 4 ไฟล์ลงใน source/ โดยใช้ชื่อเดิมจากลูกค้า:
#   Overhead Panel (finish).docx
#   Center Pedestal (finish).docx
#   glareshield.docx
#   Instrument Panel.docx

pip install python-docx
python scripts/extract.py --report     # ดูสรุปก่อน ไม่เขียนไฟล์
python scripts/extract.py              # เขียนจริงลง data/panels/
npm run validate:data
```

ผลลัพธ์ที่ควรได้:

| panel | controls | needsReview |
|---|---|---|
| overhead | 93 | 3 |
| pedestal | 164 | 14 |
| glareshield | 23 | 0 |
| instrument | 31 | 23 |
| **รวม** | **311** | **40** |

**สำคัญ: ถ้าต้องรัน extractor ซ้ำหลังวาง hotspot ไปแล้ว ต้องใส่ `--merge` เสมอ**
```bash
python scripts/extract.py --merge      # คงพิกัดที่วางไว้แล้วทุกจุด
```
ลืมใส่ = พิกัดที่นั่งวางมาหลายชั่วโมงหายหมด

## 2.1 QA ข้อมูลด้วยมือ — ห้ามข้าม

เริ่มจาก 40 ตัวที่ `needsReview: true` ก่อน เปิด docx เทียบทีละตัว
แล้วดูตัวที่ `body` ยาวผิดปกติ (เกิน 15 blocks) — แปลว่า extractor รวม control หลายตัวเข้าด้วยกัน

```bash
# หา control ที่ body ยาวผิดปกติ
python3 -c "
import json,glob
for f in glob.glob('data/panels/*.json'):
    if '_' in f.split('/')[-1][0]: continue
    d=json.load(open(f))
    for c in d['controls']:
        if len(c['body'])>15: print(len(c['body']), d['panelId'], c['name'])
"
```

ทุกครั้งที่เจอ pattern ที่พลาด → **แก้ heuristic ใน extract.py แล้วรันใหม่ด้วย `--merge`**
ห้ามแก้ JSON ด้วยมือ แล้วจดลง `docs/FAILURES.md`

พอ QA ครบแล้วให้ล็อกตัวเลขจริงลง `BASELINE` ใน `scripts/validate-data.mjs`
และลด `BASELINE_TOLERANCE` เหลือ 2

```bash
git add -A && git commit -m "feat: docx extractor + panel data (311 controls)"
```

---

# STEP 2-OLD — ถ้าอยากให้ Cascade เขียน extractor เอง (ไม่จำเป็นแล้ว)

```
>>> PROMPT — T2 PLANNER

planning agent ห้ามแก้ไฟล์
อ่าน docs/data-schema.md ให้ครบก่อน

TASK: T2 — Extractor docx -> JSON

GOAL
เขียน scripts/extract.py แปลง .docx 4 ไฟล์เป็น data/panels/*.json ตาม schema

INPUTS
source/Overhead Panel (finish).docx      -> overhead     (~151 controls)
source/Center Pedestal (finish).docx     -> pedestal     (~98)
source/glareshield.docx                  -> glareshield  (~23)
source/Instrument Panel.docx             -> instrument   (~19)

RISK: HIGH
เนื้อหาเป็นข้อมูลการบินที่นักเรียนจะใช้อ่านสอบ ข้อมูลผิด = ความเสียหายจริง

INVARIANTS ที่ห้ามละเมิดเด็ดขาด
- ห้ามแต่ง ขยาย สรุป ตีความ หรือแปลเนื้อหาใดๆ
  ต้อง copy ข้อความจาก docx มาตรงตัวอักษรต่ออักษร
- ถ้าไม่แน่ใจว่าย่อหน้าไหนเป็นชื่อ control หรือเป็นเนื้อหา
  ให้ใส่ needsReview: true ห้ามเดา
- ห้ามข้ามย่อหน้าใดๆ ทุกย่อหน้าต้องถูก assign เข้า control สักตัว
  หรือถูกบันทึกใน unassigned.json
- output hotspot ให้เป็น null ทุกตัว (พิกัดจะมาจาก mapper ใน T3)
- id ต้อง deterministic รันซ้ำแล้วได้ id เดิมเสมอ

ACCEPTANCE
- node scripts/validate-data.mjs รันผ่าน (ยกเว้น error เรื่อง hotspot ที่ยังว่าง)
- จำนวน control ต่อ panel อยู่ในช่วง baseline ±5
- scripts/extract.py --report พิมพ์สรุป: control ที่ได้, ย่อหน้าที่ตกหล่น,
  จำนวน needsReview
- unassigned.json ต้องมีย่อหน้าเหลือน้อยที่สุด

ส่งกลับมา
1. heuristic ที่จะใช้แยกหัวข้อ control ออกจากเนื้อหา อธิบายให้ละเอียด
   พร้อมยกตัวอย่างย่อหน้าจริงจากไฟล์มา 5 เคสที่คิดว่าจะแยกยาก
2. วิธี map ข้อความ bullet/note/warning เข้า body[].kind
3. วิธีสร้าง id ที่ deterministic
4. เคสที่คาดว่าจะพลาด
5. ขั้นตอน implement

ต้องเปิดไฟล์ .docx จริงมาดูก่อนตอบ ห้ามเดาโครงสร้าง
```

จากนั้น implement แล้วรัน:

```bash
python scripts/extract.py --report
npm run validate:data
```

## 2.1 QA ข้อมูลด้วยมือ — ห้ามข้าม

สุ่มเช็ค 15 control เทียบกับ docx ต้นฉบับทีละตัว โดยเลือกจาก:
- ตัวที่ `needsReview: true` ทั้งหมด
- ย่อหน้าที่มี bullet ซ้อนหลายชั้น
- ย่อหน้าที่มีสัญลักษณ์พิเศษ (α, °, *, ที่มี quote)

ทุกครั้งที่เจอ pattern ที่ extractor พลาด → **แก้ที่ extract.py แล้วรันใหม่**
ห้ามแก้ JSON ด้วยมือเด็ดขาด แล้วจดลง `docs/FAILURES.md`:

```markdown
## FL-001
Symptom: bullet ที่ขึ้นต้นด้วย `*` ถูกจับเป็นชื่อ control ใหม่
Root cause: heuristic ดูแค่ความยาวบรรทัด
Fix: เช็ค prefix `*` และ `-` ก่อนตัดสินว่าเป็นหัวข้อ
Guardrail: เพิ่ม unit test ใน extract.py กับ 3 ย่อหน้าตัวอย่าง
```

```bash
git add -A && git commit -m "feat(T2): docx extractor + panel data"
```

---

# STEP 3 — Hotspot Mapper (เขียนให้แล้ว ไม่ต้องใช้ Cascade)

`tools/hotspot-mapper/index.html` เปิดใช้ได้เลย ไม่มี build step ไม่มี CDN ทำงาน offline

```bash
open tools/hotspot-mapper/index.html      # macOS
# xdg-open tools/hotspot-mapper/index.html  # Linux
```

**ขั้นตอน**
1. เลือกไฟล์รูป panel
2. เลือกไฟล์ JSON ของ panel เดียวกัน (มันกรอก `imageSize` ให้อัตโนมัติจากรูป)
3. มันจะเด้งไปที่ control แรกที่ยังไม่มีพิกัดให้เอง
4. ลากกรอบบนรูป → กด `Enter` → ตัวถัดไป → วนไปจนครบ
5. กด **Export JSON** เอาไฟล์ไปทับ `data/panels/<panelId>.json`

**คีย์ลัด**

| คีย์ | ทำอะไร |
|---|---|
| `Enter` / `↓` | ตัวถัดไปที่ยังไม่มีพิกัด |
| `↑` | ตัวก่อนหน้า |
| `Ctrl+Z` | undo (เก็บ 50 ขั้น) |
| `Delete` | ลบพิกัดของตัวที่เลือก |
| `Space` + ลาก / คลิกขวาลาก | pan |
| scroll | zoom ที่ตำแหน่งเมาส์ |
| `F` | ซูมพอดีจอ |
| พิมพ์ `!` ในช่องกรอง | แสดงเฉพาะตัวที่ยังไม่ได้วาง |

**ฟีเจอร์ที่ช่วยกัน bug**
- กรอบที่ทับกันเกิน 30% แสดงเป็น **สีแดง** ทันที ไม่ต้องรอ validator ฟ้อง
- ลากกรอบเล็กกว่าเกณฑ์ → เตือนทันทีว่าอาจกดไม่โดนบนมือถือ
- autosave ลง localStorage ทุกครั้งที่วาง ถ้าปิด browser พลาดจะถามกู้คืนให้
- ตอน Export ถ้ายังวางไม่ครบหรือมีกรอบทับกัน จะถามยืนยันก่อน

**ลำดับที่แนะนำ:** glareshield (23) → instrument (31) → overhead (93) → pedestal (164)
เริ่มจากไฟล์เล็กเพื่อจับจังหวะมือก่อน แล้วค่อยลุยไฟล์ใหญ่

```bash
npm run validate:data      # ต้องผ่านก่อน commit ทุกครั้ง
git add -A && git commit -m "data: <panel> hotspots complete"
```

---

# STEP 3-OLD — ถ้าอยากให้ Cascade เขียน mapper เอง (ไม่จำเป็นแล้ว)

```
>>> PROMPT — T3

TASK: T3 — Hotspot Mapper tool

GOAL
สร้าง tools/hotspot-mapper/index.html ไฟล์เดียว ไม่มี build step ไม่มี framework
เปิดใน browser แล้วใช้วางพิกัด hotspot ได้ทันที

SCOPE
tools/hotspot-mapper/ เท่านั้น ห้ามแตะโค้ดแอป

FEATURES
- โหลดไฟล์รูป + ไฟล์ JSON จากเครื่อง (input type=file)
- แสดงรูปเต็ม ซูม/แพนได้ด้วย scroll + drag
- panel ซ้าย: list control ทั้งหมดจาก JSON
  แยกสีชัดเจนว่าตัวไหนวางพิกัดแล้ว ตัวไหนยัง
- คลิกเลือก control -> ลากกรอบสี่เหลี่ยมบนรูป -> เซฟพิกัดเป็น ratio 0..1
- กด Enter หรือลูกศรลง = ข้ามไป control ถัดไปที่ยังไม่มีพิกัดอัตโนมัติ
- แสดงกรอบที่วางแล้วทั้งหมดทับบนรูป กรอบที่ทับกันให้เป็นสีแดง
- ปุ่ม Export ดาวน์โหลด JSON ที่มี hotspot ครบกลับมา
- แสดง progress: วางแล้ว N / ทั้งหมด M
- Ctrl+Z undo ได้อย่างน้อย 20 ขั้น

INVARIANTS
- พิกัดที่ export ต้องเป็น ratio 0..1 เทียบขนาดรูปต้นฉบับเสมอ
- ห้ามแก้ field อื่นใน JSON นอกจาก hotspot
- ต้องทำงานได้แบบ offline ไม่โหลด CDN ใดๆ

ACCEPTANCE
- วางพิกัดได้เร็วกว่า 3 วินาทีต่อจุดเมื่อใช้ keyboard flow
- export แล้ว node scripts/validate-data.mjs ผ่าน
```

> **ทำไมต้องเสียเวลา 3–4 ชม. สร้าง tool:**
> 291 จุด × hardcode ในโค้ด ≈ 15–20 ชม. และแก้ยากมาก
> 291 จุด × 3 วินาที ด้วย tool ≈ 4 ชม. รวมสร้าง tool แล้วยังประหยัดกว่า 8+ ชม.

---

# STEP 4 — วาง hotspot glareshield (ทำเอง ไม่ใช้ AI)

```bash
open tools/hotspot-mapper/index.html
# โหลด assets/panels/glareshield.webp + data/panels/glareshield.json
# ลากครบ 23 จุด -> Export -> ทับไฟล์เดิม
npm run validate:data
```

ถ้า validator ฟ้อง overlap = กลับไปแก้ในทูล ห้ามปล่อยผ่าน
แล้วเปิดแอปเช็คด้วยตาว่ากดตรงตัวจริง

```bash
git add -A && git commit -m "data: glareshield hotspots complete"
```

---

# STEP 5 — T4 Home + Navigation → ปิดงวด 1

```
>>> PROMPT — T4

TASK: T4 — Home screen + navigation
RISK: low ทำได้เลยไม่ต้อง plan แยก

GOAL
app/index.tsx แสดงภาพ cockpit เต็ม (assets/panels/cockpit_home.webp)
มี hotspot 4 จุดครอบ Overhead / Glareshield / Instrument / Center Pedestal
แตะแล้ว navigate ไป /panel/[id]

SCOPE
app/index.tsx, app/_layout.tsx, src/components/ เท่านั้น

INVARIANTS
- ใช้ HotspotLayer ตัวเดียวกับ T1 ห้ามเขียนตรรกะพิกัดซ้ำ
- พิกัด 4 จุดเก็บใน data/panels/_home.json ตาม schema เดิม
- ห้ามแก้ไฟล์ที่ T1 สร้างนอกจากจำเป็นจริง ถ้าจำเป็นให้บอกเหตุผล

ACCEPTANCE
- แตะครบ 4 แผงแล้วเข้าถูกหน้า
- กด back กลับ Home ได้
- npx tsc --noEmit ผ่าน
```

**Build APK ตัวแรกส่งลูกค้า:**

```bash
npx eas build --platform android --profile preview
```

`eas.json`:
```json
{ "build": { "preview": { "android": { "buildType": "apk" } } } }
```

ส่ง APK + screenshot ให้ลูกค้า พร้อมข้อความยืนยัน scope ที่คุยกันไว้

---

# STEP 6 — T5 Search

```
>>> PROMPT — T5

TASK: T5 — Search
RISK: low

GOAL
ช่องค้นหาบน Home พิมพ์ชื่อปุ่มแล้วเจอ กดผลลัพธ์แล้วเด้งไปหน้า panel นั้น
พร้อม highlight hotspot และเปิด bottom sheet ให้เลย

SCOPE
app/index.tsx, src/components/SearchBar.tsx, src/lib/search.ts

INVARIANTS
- ใช้ String.toLowerCase().includes() เท่านั้น ห้ามลง fuzzy search library
- ค้นทั้ง name และเนื้อหาใน body
- deep link ผ่าน route param /panel/[id]?focus=<controlId>

ACCEPTANCE
- พิมพ์ "EMER CANC" เจอปุ่มใน pedestal
- พิมพ์ "localizer" เจอ LOC push-button จากเนื้อหา ไม่ใช่แค่ชื่อ
- กดผลแล้วเปิดหน้า panel ซูมไปที่ปุ่มนั้นและเปิด sheet อัตโนมัติ
```

---

# STEP 7 — Instrument + Center Pedestal

ไม่ต้องใช้ Cascade ในการวาง hotspot ใช้ tool อย่างเดียว

```bash
# instrument 19 จุด
# pedestal 98 จุด — panel นี้ปุ่มแน่นมาก
npm run validate:data
```

**ถ้า validator ฟ้อง hotspot เล็กเกินหลายจุดใน pedestal** = สัญญาณว่าต้องแตกเป็น sub-panel

```
>>> PROMPT — T6 (ใช้เมื่อจำเป็นเท่านั้น)

TASK: T6 — Sub-panel drill-down
GOAL
เพิ่มชั้น sub-panel ให้ panel ที่ปุ่มแน่นเกินกว่านิ้วจะกดถูก
แตะโซน -> ซูมเข้าไปเป็นภาพย่อยที่มี hotspot ของตัวเอง

INVARIANTS
- ต้องไม่ทำลาย schema เดิม ใช้ sections ที่มีอยู่แล้วเป็น sub-panel
- panel ที่ไม่มี sub-panel ต้องทำงานเหมือนเดิมทุกประการ

ACCEPTANCE
- validate:data ยังผ่าน
- glareshield/instrument พฤติกรรมไม่เปลี่ยนเลย
```

```bash
git add -A && git commit -m "data: instrument + pedestal complete"
```

---

# STEP 8 — Overhead (151 จุด, ครึ่งนึงของงานทั้งหมด)

เผื่อเวลา 2 วันเต็ม แบ่งเป็น section: ADIRS / ELEC / HYD / FUEL / AIR COND / ANTI-ICE / LIGHTS / APU / ENG START

ทำทีละ section แล้ว commit ทีละ section:

```bash
npm run validate:data
git add -A && git commit -m "data: overhead ELEC section"
```

---

# STEP 9 — ส่งงาน (ตั้งเป้า 31 ส.ค. เผื่อ buffer 1 วัน)

## 9.1 Final gate

```bash
npm run validate:strict     # ต้องไม่เหลือ needsReview เลย
npm run typecheck
npx expo-doctor
```

## 9.2 Checklist ทดสอบเครื่องจริง

- [ ] Poco X7 — เปิดครบทุก panel ไม่ค้าง
- [ ] Tab S9 FE+ — พิกัดตรงทุก panel (aspect ratio ต่างกันมาก)
- [ ] สุ่มกด 30 ปุ่มกระจายทั้ง 4 panel เทียบกับ docx ต้นฉบับ
- [ ] เปิดโหมดเครื่องบิน (offline) แล้วใช้งานได้ครบ
- [ ] ขนาด APK < 100MB
- [ ] เปิดแอปครั้งแรกช้ากว่า 3 วิไหม (ถ้าช้าให้ preload รูปแบบ progressive)

## 9.3 Build ตัวส่ง

```bash
npx eas build --platform android --profile preview
```

## 9.4 ส่งลูกค้า

แนบไปด้วย:
- ไฟล์ APK
- วิธีติดตั้ง (ต้องเปิด "ติดตั้งจากแหล่งที่ไม่รู้จัก")
- สรุปจำนวนปุ่มที่กดได้ต่อ panel
- ย้ำว่าช่วงตรวจรับ 14 วันครอบคลุมเฉพาะ bug ตาม scope เดิม
  ไม่รวมการเพิ่มปุ่มหรือฟีเจอร์ใหม่

---

# ภาคผนวก A — กฎการใช้ Cascade ตลอดโปรเจกต์

| สถานการณ์ | ทำยังไง |
|---|---|
| งาน low risk (UI, styling, navigation) | สั่ง implement ตรงๆ ไม่ต้อง plan |
| งาน medium risk (พิกัด, sub-panel) | plan รอบนึง → อ่าน → implement รอบนึง |
| งาน high risk (extractor, แก้ schema) | plan → อ่าน diff ทุกบรรทัด → implement → QA มือ |
| แตะ data/panels/*.json | **ห้าม** ต้องผ่าน script หรือ tool เท่านั้น |
| Cascade บอกว่า "เสร็จแล้ว" | ถามกลับ: รันคำสั่งอะไร ผลลัพธ์อะไร ขอ output จริง |
| Cascade ขอลง dependency | ปฏิเสธก่อน ถามว่าทำไมของที่มีอยู่ไม่พอ |
| Cascade แก้ไฟล์นอก scope | rollback ทันที `git checkout -- <file>` แล้วสั่งใหม่ให้แคบลง |
| เจอ bug เดิมซ้ำครั้งที่ 2 | หยุด แก้ที่ rules/script ไม่ใช่แก้เคสนั้น แล้วจดลง FAILURES.md |

## Prompt สั้นที่ใช้บ่อย

**ตอนไม่เชื่อว่ามันทำจริง**
```
แสดง output จริงของคำสั่งที่รันมาให้ดู ถ้ายังไม่ได้รันให้บอกว่ายังไม่ได้รัน
```

**ตอนมันเริ่มลาก scope**
```
หยุด task ระบุ scope ไว้แค่ <ไฟล์> ทำไมถึงแก้ <ไฟล์อื่น>
ถ้าไม่จำเป็นจริงให้ revert ส่วนนั้นออก
```

**ตอนจะ commit**
```
สรุป diff ที่จะ commit ให้ดู list ไฟล์ + บรรทัดที่เปลี่ยน
บอกด้วยว่ามีไฟล์ไหนที่ไม่เกี่ยวกับ task นี้ติดมาบ้าง
```

---

# ภาคผนวก B — จำนวน control อ้างอิง

| Panel | baseline | ไฟล์ต้นทาง |
|---|---|---|
| overhead | 151 | Overhead Panel (finish).docx |
| pedestal | 98 | Center Pedestal (finish).docx |
| glareshield | 23 | glareshield.docx |
| instrument | 19 | Instrument Panel.docx |
| **รวม** | **291** | |

ถ้า `validate:data` รายงานตัวเลขห่างจากนี้เกิน ±5 = extractor พลาด อย่าปล่อยผ่าน

---

# ภาคผนวก C — สิ่งที่ห้ามทำตลอดโปรเจกต์

1. ห้ามแก้ `data/panels/*.json` ด้วยมือ
2. ห้ามใช้หน่วย px ในโค้ดคำนวณพิกัด
3. ห้ามให้ AI แต่ง/ขยาย/แปลเนื้อหาการบิน
4. ห้ามเปลี่ยน `control.id` หลังสร้างแล้ว
5. ห้ามลง dependency นอกรายการใน STEP 0.2
6. ห้าม commit โดยที่ `validate:data` ยังไม่ผ่าน
7. ห้ามรับ feature ใหม่ในช่วง warranty 2–15 ก.ย.
