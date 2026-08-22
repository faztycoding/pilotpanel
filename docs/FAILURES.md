# FAILURES & FINDINGS — Switch 320

## Findings

### รูป panel ทั้ง 4 มาจาก docx ไม่ใช่จากลูกค้าโดยตรง
`image1` ของแต่ละ docx = ภาพรวมทั้งแผง (pattern ที่ใช้ได้กับทั้ง 4 ไฟล์)

| panel | ไฟล์ต้นทางใน docx | ขนาด |
|---|---|---|
| overhead | `Overhead Panel (finish).docx` → `word/media/image1.jpg` | 1007x913 |
| pedestal | `Center Pedestal (finish).docx` → `word/media/image1.png` | 768x905 |
| glareshield | `glareshield.docx` → `word/media/image1.jpg` | 1962x259 |
| instrument | `Instrument Panel.docx` → `word/media/image1.jpg` | 2017x615 |

`cockpit_home.webp` มาจาก `รูปตอนเข้า.png` (2360x1640) ที่ลูกค้าส่งแยกมา ไม่ได้เก็บต้นฉบับใน repo

### วิธีดึงรูปใหม่ถ้าต้องทำซ้ำ
`assets/raw/` อยู่ใน `.gitignore` (116 ไฟล์ ไม่ขึ้น repo) เครื่องใหม่ต้องรันใหม่:
```bash
cd source && for f in *.docx; do
  mkdir -p "../assets/raw/${f%.docx}"
  unzip -o -j -q "$f" "word/media/*" -d "../assets/raw/${f%.docx}"
done
```
แปลงเป็น webp ด้วย `.venv/bin/python` + Pillow (`cwebp` ไม่มีในเครื่อง และ `sips` **เขียน webp ไม่ได้** — มันรายงานว่าสำเร็จแต่ไม่สร้างไฟล์ ห้ามเชื่อ exit code ของ sips)

### sections ของ pedestal คือหน้า ECAM ไม่ใช่โซนกายภาพบนแผง
11 sections (ENG, BLEED, PRESS, HYD, APU, COND, DOOR, WHEEL, ELEC, FUEL, F/CTL) ตรงกับปุ่มเลือกหน้าบน
ECAM Control Panel (`pedestal/image3.jpeg` 1024x326) ไม่ใช่ตำแหน่งบนแผง pedestal

ไดอะแกรมหน้า ECAM แต่ละหน้ามี **เลขกำกับ (callout) ที่ตรงกับลำดับ control ใน section นั้นเป๊ะ**
ยืนยันแล้ว 4 หน้า: HYD 13 callouts = 13 controls, APU 10 = 10, WHEEL 10 = 10, COND 6 = 6
=> ตอนวาง hotspot ของ pedestal ใช้เลข callout เป็นตัวอ้างอิงได้เลย ไม่ต้องเดา

### ตำแหน่ง anchor ของรูปใน docx ไม่ตรงกับ section ที่รูปนั้นอธิบาย
รูปเป็น floating image ผูกกับย่อหน้าท้าย section **ก่อนหน้า** เช่น `image16.jpg` anchor อยู่ใต้ DOOR
แต่เนื้อหาคือหน้า WHEEL — **ห้าม map รูปกับ section ด้วยลำดับ anchor ต้องดูเนื้อหาจริง**

แยกประเภทรูปเร็ว ๆ ได้ด้วยความสว่างเฉลี่ย: หน้า ECAM พื้นดำ (brightness < 90), แผงกายภาพเทาอ่อน (> 90)

## Failures

### extractor ดูดปุ่มกายภาพเข้า section ของหน้า ECAM
`current_section` ไม่มีเงื่อนไขปิด พอเจอ heading `F/CTL` แล้วทุก control หลังจากนั้นจนจบไฟล์
ตกเป็นของ `f_ctl` หมด — f_ctl บวมเป็น 53 ทั้งที่หน้า F/CTL จริงมี callout แค่ 8

แก้ด้วยกฎจากหลักฐานในเอกสารเอง: รายการหน้า ECAM ขึ้นต้นด้วย `(N)` เสมอ ปุ่มกายภาพไม่มีเลข
heading ที่ไม่มีเลข **และไม่มี `(N)` ตามมาอีกก่อนถึง section ถัดไป** = ปิด section (`section_continues()`)

ต้องมี lookahead เพราะมีบรรทัด legend แทรกกลาง เช่น `C = Cold (Valve closed)` ระหว่าง (3) กับ (4)
ของ BLEED ถ้าปิด section ทันทีที่เจอ heading ไม่มีเลข bleed จะตกจาก 17 เหลือ 3

ผลหลังแก้: f_ctl 53->8, eng 11->10 (MCDU หลุดออก), pedestal = 111 ในหน้า ECAM + 53 ปุ่มกายภาพ = 164 เท่าเดิม

### FL: setup.sh เขียนทับ tsconfig.json ทั้งไฟล์ ทำ alias หาย
- **Symptom** — bundle พังแต่ `tsc` ผ่าน: `Unable to resolve module @/assets/images/tutorial-web.png`
  กระทบ 5 ไฟล์ที่ import `@/assets/*` (`explore.tsx`, `animated-icon.tsx`, `animated-icon.web.tsx`,
  `app-tabs.tsx`, `web-badge.tsx`) — `tsc` จับไม่ได้เพราะเรียกผ่าน `require()` ซึ่งคืน `any`
- **Root cause** — template ของ expo ตั้ง alias ไว้ 2 ตัว (`@/*` -> `./src/*` และ `@/assets/*` -> `./assets/*`)
  แต่ `setup.sh` ใช้ `cat > tsconfig.json` เขียนทับทั้งไฟล์เหลือตัวเดียว
  `include` ก็หาย `.expo/types/**/*.ts` กับ `expo-env.d.ts` ไปด้วย ซึ่งจำเป็นกับ `typedRoutes` ที่เปิดอยู่
- **Detection** — เจอตอน `npx expo export -p web` **ไม่ใช่ตอน typecheck** gate ที่มีอยู่จับไม่ได้เลย
- **Prevention** — script ที่แก้ config ของ template ต้อง **merge ไม่ใช่ overwrite**
  แก้แล้วใน `setup.sh`: อ่าน JSON เดิม เติมเฉพาะคีย์ที่ต้องการ เติม alias เฉพาะที่ยังไม่มี
  ถ้าไฟล์เดิม parse ไม่ได้ให้ exit 1 ไม่แตะต้อง (`set -e` จะหยุด setup ทันที)
- **Guardrail** — เพิ่ม `npx expo export -p web` เข้า verification checklist
  `tsc --noEmit` ผ่านไม่ได้แปลว่า bundle ได้ ต้องรัน bundler จริงเมื่อแตะโค้ดใน `src/`

### AI image gen ใช้ทำ background panel ไม่ได้ — 3 รอบทดลอง ล้มเหลวทั้งหมด
ทดลองสั่ง ChatGPT-style chat image gen (ไม่มี mask/inpaint) วาดแผง glareshield ใหม่โดยอ้างอิงรูปต้นฉบับ
เพื่อเปลี่ยนโทนสี ผลลัพธ์พังคนละแบบทุกรอบ แม้ prompt รอบหลังระบุรายละเอียดครบ (จำนวน controls,
ไม่สมมาตร, ห้ามมีตัวอักษร, aspect ratio ที่ต้องการ):

1. รอบ 1: ตัวอักษรบนปุ่มเพี้ยน (แก้ด้วยการห้ามมีตัวอักษรเลยในรอบถัดไป)
2. รอบ 2: อัตราส่วนภาพรวมผิดชัดเจน (3.0 แทน 7.575) — AI ใส่ padding ขาวรอบภาพ
3. รอบ 3: อัตราส่วน**ภาพรวม**ตรง (7.587) แต่ AI ใส่ขอบดำบาง ๆ ซ่อนไว้บน-ล่าง ทำให้
   **เนื้อหาจริงข้างในบีบเพี้ยนเป็น 13.1:1** ตรวจไม่เจอถ้าดูแค่ขนาดไฟล์ ต้องหา bounding box
   ของเนื้อหาจริง (เทียบกับพื้นดำเป๊ะ ไม่ใช่แค่ brightness threshold เพราะโทนมืดจะถูกนับเป็นพื้นผิดๆ)

**สรุป: การสั่ง AI วาดทั้ง panel ใหม่ผ่าน chat (ไม่มี mask) ไม่นิ่งพอสำหรับงานที่ต้องแม่นระดับพิกเซล**
แม้แค่เปลี่ยนแต่สไตล์/สี ไม่ใช่เนื้อหา ก็ยังเสี่ยงเรื่องสัดส่วนสูง โดยเฉพาะภาพอัตราส่วนแปลก (7.6:1)

**ทางที่ใช้ได้จริงแทน**: ปรับสีจากรูปต้นฉบับด้วยโค้ด (`ImageOps.colorize` บน grayscale) — พิกเซลตำแหน่งเดิม
100% ไม่มีความเสี่ยงเรื่อง hotspot เพี้ยนเลย ตรวจสอบตัวเองแล้วด้วย `verify_ai_image.py` (เดิมทำไว้ตรวจ
รูป AI แต่ใช้ตรวจรูปที่ปรับสีเองได้เหมือนกัน) กรอบ 3 hotspot ที่วางไว้ยังตรงปุ่มเป๊ะหลัง crop+colorize

**เครื่องมือที่ทำไว้ระหว่างทาง** (`/tmp/verify_ai_image.py`, ยังไม่ได้ย้ายเข้า `tools/`):
ซ้อนกรอบ hotspot ที่มีอยู่แล้วทับรูปใดก็ได้ เพื่อเช็คตำแหน่งโดยไม่ต้องวัดด้วยตา — มีประโยชน์ต่อไปถ้าจะ
ลองปรับ/เปลี่ยนรูป panel อีกในอนาคต ควรย้ายเข้า `tools/` ถ้าจะใช้งานถาวร

### glareshield.webp มีแถบดำที่หัวภาพจากต้นฉบับ (แก้แล้ว)
`assets/panels/glareshield.webp` (ที่ดึงจาก `glareshield.docx` image1) มีแถบดำสูง 83px (32% ของภาพ)
อยู่ด้านบน มาจากต้นฉบับเอง ไม่ใช่ error ระหว่างแปลงไฟล์ — crop ออกแล้ว เปลี่ยน `imageSize` เป็น
`1962x176` และคำนวณ hotspot ratio ของ 3 controls ที่วางไว้แล้วใหม่ตามสัดส่วนที่เปลี่ยน
(`new_y = (old_y*259 - 83) / 176`, `new_h = old_h*259 / 176`) ตรวจซ้ำด้วย `verify_ai_image.py` แล้วตรง

### รัน `python scripts/extract.py` โดยไม่ใส่ `--merge` ล้าง hotspot/detailImage ที่วางไว้แล้วทั้งหมด
ทดลองรัน `extract.py` เฉย ๆ (ไม่มี flag) เพื่อเทส `apply_manual_sections` ที่เพิ่งแก้ ผลคือ hotspot
ทั้ง 23 ตัวของ glareshield (วางด้วย hotspot-mapper ไปแล้ว) กลายเป็น `null` หมด, `imageSize` กลับเป็น
`0x0`, `detailImage` หายหมด — เพราะ extractor ดึงจาก docx สดใหม่ทุกครั้ง ไม่รู้จักงานที่ mapper วางทับไว้

**กู้ทันเพราะยังไม่ commit** (`git checkout -- data/panels/`) ถ้า commit ไปแล้วจะกู้ยากกว่ามาก

`extract.py` มี `--merge` flag อยู่แล้ว (`merge_hotspots()`) แต่ตัว flag เดิมคง **แค่ hotspot** ไม่คง
`detailImage` — แก้ให้คง `detailImage` ด้วยแล้ว (อ่าน object เดิมทั้งตัวจาก `old_by_id` ไม่ใช่แค่ hotspot map)

**กฎที่ต้องจำ: ห้ามรัน `scripts/extract.py` โดยไม่มี `--merge` เด็ดขาด หลังเริ่มวาง hotspot ตัวแรกไปแล้ว**
รันแบบปลอดภัยเสมอ: `.venv/bin/python scripts/extract.py --merge`

### extractor ดูดปุ่มชื่อสั้น (ALL/CLR/STS/RCL/TEST/...) เข้า body ของปุ่มก่อนหน้า — เจอตอนเทียบกับ docx จริง
เปิด `Center Pedestal (finish).docx` เทียบกับ `pedestal.json` เจอว่า `ALL push button`,
`CLR push button`, `STS push button`, `RCL push button` (มีคำอธิบายจากลูกค้าครบ) หายไปจาก
control ทั้งหมด — ไม่ได้อยู่ใน `_unassigned.json` ด้วยซ้ำ ไปโผล่เป็น body พ่วงของ
`cp_yaw_control_indications` (control ก่อนหน้าในเอกสาร) ทำให้ปุ่มนั้นมีคำอธิบายผิดปนกัน

**root cause**: `is_control_heading()` คำนวณ `cap_ratio()` จากทั้งบรรทัด รวมคำนาม (push button/
knob/switch...) ที่เขียนเป็นตัวเล็กเสมอในเอกสารด้วย — ชื่อสั้นแบบ "ALL push button" มีตัวใหญ่
แค่ 1 จาก 3 คำ = ratio 0.33 ไม่ถึง threshold 0.5 ทั้งที่เป็นชื่อปุ่มจริง (ตัวอย่างที่ผ่านได้เดิม
อย่าง "EMER CANC push button" รอด because 2/4 = 0.5 พอดี — เป็น false negative ที่ผ่านมาแบบเสี่ยง)

**แก้**: ถ้าคำนามอยู่ **ท้ายบรรทัดพอดี** (`RE_CONTROL_NOUN_AT_END`) ให้คำนวณ ratio จากส่วนชื่อ
ก่อนคำนามแทน (ไม่รวมคำนามเจือจาง) ต้องบังคับว่าอยู่ท้ายบรรทัดเท่านั้น — ลองแบบไม่บังคับตำแหน่ง
ก่อนแล้วพัง: overhead จาก 93 พุ่งเป็น 116 (+23) เพราะประโยคที่บังเอิญมีคำนามกลางประโยคอย่าง
"Two pink lights flash on all area call panels" หลุดผ่านไปด้วย (ลง "panels" ท้ายประโยคพอดี
แต่ prefix ยาวจนกว่า ratio ยังต่ำอยู่ — คือรอดเพราะ ratio ไม่ใช่เพราะ anchor แต่บรรทัดอื่นไม่รอด)

ผลหลังแก้ (ยืนยันด้วย `git diff` — เป็น pure addition ไม่มีบรรทัด `"name"` ถูกลบเลยทั้ง 2 ไฟล์):
overhead 93->108 (+15 ปุ่มจริงที่กู้กลับมา), pedestal 164->169 (+5: ALL/CLR/STS/RCL + CLR ตัวที่ 2
ของแผง transponder ซึ่งเป็นปุ่มคนละตัวกับ CLR ของ ECAM control panel จริง ๆ ไม่ใช่ duplicate)
glareshield/instrument ไม่กระทบเลย (ตัวเลขเดิม 23/31 คงที่) — อัปเดต baseline ใน
validate-data.mjs + docs/data-schema.md + AGENTS.md เป็น 108/169/23/31 = 331 แล้ว

### Audit รอบส่งมอบพบ heading ถูกกลืนและ hotspot ที่ไม่มีหลักฐาน

ตรวจ DOCX ครบทั้ง 4 panel แล้วพบ heading จริงที่ heuristic เดิมกลืนเข้า body: overhead 4, pedestal 5,
glareshield 1 และ instrument 8 รายการ จึงเก็บรายการบังคับไว้ใน `data/extraction-manual.json`
และเพิ่ม baseline เป็น 110/173/24/39 = 346 controls โดยไม่เปลี่ยน id เดิม

หน้า ECAM นับ callout ครบ: ENG 10, BLEED 16, PRESS 8, HYD 13, APU 10, COND 6, DOOR 7,
WHEEL 10, ELEC 13, FUEL 11, F/CTL 8. ลบ legend ปลอมของ BLEED 2 ตัวและกู้
`Pack Compressor Outlet Temperature` กลับมาแล้ว

รายการที่เอกสารมีแต่รูปไม่มีตำแหน่งให้กดจริง (conditional indication, ข้อมูลซ้ำ, WXR hardware
คนละรุ่น) คง control และข้อความต้นฉบับไว้ แต่ใช้ `hotspotUnavailableReason` แทนการเดาพิกัด
ส่วนหัวข้อที่เอกสารไม่มีคำอธิบายใช้ `bodyUnavailableReason`; `validate:strict` ตรวจว่าห้ามมีทั้ง
เหตุผล unavailable และค่าจริงพร้อมกัน

ลูกค้ายืนยันให้ overhead และ glareshield ทำตามเอกสารเดิมโดยกดบนรูป panel โดยตรง ไม่ต้องสร้าง
section เพิ่ม; instrument มี PFD/ND/EWD และ pedestal มี ECAM 11 sections ตามเอกสาร

## Open items

- ไม่มี data blocker ที่ยังไม่ได้จัดประเภท; รายการที่ไม่มี hotspot/body มีเหตุผลจาก source audit ครบและ
  `npm run validate:strict` ต้องผ่านก่อนส่งทุกครั้ง
