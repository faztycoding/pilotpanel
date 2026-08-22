# Data Schema — Switch 320

โครงสร้างนี้คือ **contract** ระหว่าง extractor, hotspot mapper และ app
เปลี่ยนเมื่อไหร่ = high risk task ต้อง plan ก่อนเสมอ

## Panel file: `data/panels/<panelId>.json`

```json
{
  "panelId": "glareshield",
  "title": "Glareshield",
  "titleTh": "แผงบังแดด",
  "image": "glareshield.webp",
  "imageSize": { "w": 4096, "h": 920 },
  "sections": [
    { "id": "fcu", "name": "FCU" }
  ],
  "controls": [
    {
      "id": "gs_loc_pb",
      "sectionId": "fcu",
      "name": "LOC push-button",
      "type": "pushbutton",
      "hotspot": { "x": 0.4312, "y": 0.6180, "w": 0.0210, "h": 0.1400 },
      "body": [
        {
          "kind": "p",
          "text": "Pushing this button arms, engages or disengages the tuned or programmed localizer. Lights up green when ON."
        }
      ],
      "sourceRef": "glareshield.docx#p37",
      "needsReview": false
    }
  ]
}
```

## หน้าแรก: `data/panels/_home.json`

ไฟล์ที่ขึ้นต้นด้วย `_` ถูก `validate-data.mjs` ข้าม เพราะไม่ใช่ panel ที่มี baseline count

`_home.json` เก็บกรอบที่กดได้บนภาพรวม cockpit ทุก control เป็น `type: "area"` และมี `target`
ชี้ไป `panelId` ปลายทาง — หลายกรอบชี้ปลายทางเดียวกันได้ (เช่นจอกัปตันกับจอผู้ช่วยไปหน้า
`instrument` ทั้งคู่) `id` ใช้ระบุ "กรอบ" ส่วน `target` ใช้ระบุ "ปลายทาง" จึงต้องแยกกัน

```json
{ "id": "home_instrument_capt", "name": "PFD / ND กัปตัน", "type": "area", "target": "instrument" }
```

## Section: 2 โหมด

section รองรับ 2 แบบ ขึ้นกับว่าโซนนั้นอยู่บนรูป panel เดิมหรือเป็นรูปคนละใบ

**โหมด viewport** — โซนบนรูป panel เดียวกัน (ใช้กับ overhead) ชั้น 3 คือ zoom ไปที่กรอบนี้
```json
{ "id": "elec", "name": "ELEC", "viewport": { "x": 0.30, "y": 0.10, "w": 0.20, "h": 0.30 } }
```

**โหมด image** — โซนที่เป็นรูปคนละใบ (ใช้กับหน้า ECAM ของ pedestal) ชั้น 3 คือ render รูปนี้แทน
```json
{
  "id": "hyd",
  "name": "HYD",
  "image": "pedestal_ecam_hyd.webp",
  "imageSize": { "w": 1291, "h": 1267 },
  "entry": { "x": 0.42, "y": 0.05, "w": 0.03, "h": 0.02 }
}
```

`entry` คือตำแหน่งบนรูป panel หลัก (ratio เทียบ `panel.imageSize` เดิม ไม่ใช่ `section.imageSize`)
ที่ผู้ใช้แตะแล้ว navigate เข้าไปดูรูปของ section นั้น (route `panel/[id]/section/[sectionId]`)
ปกติคือตำแหน่งปุ่มเลือกหน้าจอ ECAM จริงบนแผง (เช่นปุ่ม `HYD` บนแผง ECAM control panel ของ pedestal)
ถ้ายังไม่มี `entry` = โซนนั้นเข้าไม่ได้จาก UI ยัง (รอวางพิกัด) แต่ข้อมูลยังอยู่ครบใน `controls[].sectionId`

กติกาการ render ชั้น 3:
- ถ้า section มี `image` -> ใช้รูปนั้น และ `hotspot` ของ control ในโซนนี้อ้างอิงกับ `section.imageSize`
  เข้าถึงผ่านการแตะตำแหน่ง `entry` บนรูป panel หลัก
- ถ้าไม่มี `image` -> zoom ไปที่ `viewport` บนรูป panel เดิม `hotspot` อ้างอิงกับ `panel.imageSize` ตามปกติ
  (โหมดนี้ยังไม่มี entry point ใน UI จริง — รอ implement)
- ทั้ง `viewport` และ `image` เป็น optional ถ้าไม่มีทั้งคู่ = section เป็นแค่ป้ายจัดกลุ่ม ไม่มีชั้น 3

## Field rules

| field | rule |
|---|---|
| `panelId` | หนึ่งใน `overhead` \| `glareshield` \| `instrument` \| `pedestal` |
| `imageSize` | ขนาดจริงของไฟล์รูป ใช้คำนวณ aspect ratio เท่านั้น |
| `controls[].id` | `<panelPrefix>_<snake_case>` ต้อง unique ทั้งไฟล์ **ห้ามเปลี่ยนหลังสร้าง** |
| `controls[].type` | `pushbutton` \| `knob` \| `selector` \| `switch` \| `lever` \| `light` \| `display` \| `area` |
| `hotspot` | ทุกค่าเป็น ratio 0..1 เทียบกับรูป ห้าม px |
| `hotspotUnavailableReason` | optional เหตุผลจากการ audit ว่าต้นฉบับไม่มีตำแหน่งให้วาง เช่น conditional indication, ข้อมูลซ้ำ หรือ hardware คนละรุ่น; เมื่อมี field นี้ `hotspot` ต้องเป็น `null` |
| `bodyUnavailableReason` | optional เหตุผลจากการ audit ว่าเอกสารมีเฉพาะชื่อหัวข้อและไม่มีคำอธิบาย; เมื่อมี field นี้อนุญาตให้ `body` ว่างได้ |
| `body[].kind` | `p` \| `bullet` \| `note` \| `warning` |
| `body[].label` | optional มีได้เฉพาะ `kind: "bullet"` — label สั้นที่ `extract.py` แยกออกมา เช่น `ON` / `FAULT` render เป็นตัวหนานำหน้า `text` |
| `controls[].target` | optional `panelId` ปลายทาง ถ้ามี = แตะแล้ว navigate ไปหน้านั้นแทนการเปิดคำอธิบาย |
| `controls[].detailImage` | optional path ใน `assets/detail/<panelId>/` รูปโคลสอัพจริงจาก docx ของปุ่มนั้น วางทับ hotspot box แทนพื้นเบลอ (ไม่ใช่รูปใน sheet คำอธิบาย ลูกค้าห้าม) |
| `sections[].image` | optional ชื่อไฟล์ใน `assets/panels/` ถ้ามี = โซนนี้ใช้รูปของตัวเอง |
| `sections[].imageSize` | บังคับเมื่อมี `image` ขนาดจริงของไฟล์นั้น |
| `sections[].viewport` | optional ratio 0..1 บนรูป panel เดิม ใช้เมื่อไม่มี `image` |
| `sections[].entry` | optional ratio 0..1 บนรูป panel หลัก (`panel.imageSize`) ตำแหน่งแตะเพื่อเข้าโซนนี้ ใช้คู่กับ `image` |
| `sourceRef` | ชี้กลับไปย่อหน้าต้นทางใน docx ใช้ตอน QA |
| `needsReview` | `true` เมื่อ extractor ไม่มั่นใจ ต้องเป็น `false` ทั้งหมดก่อนส่งงาน |

## Invariants (validate-data.mjs ตรวจข้อเหล่านี้)

1. `id` ไม่ซ้ำภายใน panel และไม่ซ้ำข้าม panel
2. ทุก control มี `hotspot` และมี `body` อย่างน้อย 1 block ยกเว้นมี `hotspotUnavailableReason`/`bodyUnavailableReason` ที่ผ่านการ audit แล้ว
3. `0 <= x, y <= 1` และ `x + w <= 1`, `y + h <= 1`
4. hotspot ไม่ซ้อนทับกันเกิน 30% ของพื้นที่อันที่เล็กกว่า
5. hotspot ไม่เล็กเกินจนกดไม่โดน (ดู threshold ใน script)
6. `sectionId` ทุกตัวต้องมีอยู่ใน `sections`
7. จำนวน control ต่อ panel ต้องอยู่ในช่วง baseline ±2
8. ไม่มี `needsReview: true` เหลืออยู่ (บังคับเฉพาะโหมด `--strict` ก่อนส่งงาน)
9. ถ้า section มี `entry` ต้อง `0 <= x,y,w,h <= 1` เหมือน hotspot ปกติ และต้องมี `image`+`imageSize` คู่กันเสมอ

## Baseline counts
```
overhead    110
pedestal    173
glareshield  24
instrument   39
TOTAL       346
```
(อัปเดตหลัง audit DOCX ทุก panel: แยก heading ที่เคยถูกกลืนเข้า body เพิ่ม 4 controls ใน overhead,
5 controls ใน pedestal, 1 control ใน glareshield และ 8 indications ใน instrument; รายการ conditional/duplicate/hardware คนละรุ่นยังคง id เดิม
แต่ใช้ `hotspotUnavailableReason` แทนการเดาพิกัด ดู docs/FAILURES.md)
