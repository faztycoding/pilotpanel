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
  "imageSize": { "w": 1291, "h": 1267 }
}
```

กติกาการ render ชั้น 3:
- ถ้า section มี `image` -> ใช้รูปนั้น และ `hotspot` ของ control ในโซนนี้อ้างอิงกับ `section.imageSize`
- ถ้าไม่มี `image` -> zoom ไปที่ `viewport` บนรูป panel เดิม `hotspot` อ้างอิงกับ `panel.imageSize` ตามปกติ
- ทั้ง `viewport` และ `image` เป็น optional ถ้าไม่มีทั้งคู่ = section เป็นแค่ป้ายจัดกลุ่ม ไม่มีชั้น 3

## Field rules

| field | rule |
|---|---|
| `panelId` | หนึ่งใน `overhead` \| `glareshield` \| `instrument` \| `pedestal` |
| `imageSize` | ขนาดจริงของไฟล์รูป ใช้คำนวณ aspect ratio เท่านั้น |
| `controls[].id` | `<panelPrefix>_<snake_case>` ต้อง unique ทั้งไฟล์ **ห้ามเปลี่ยนหลังสร้าง** |
| `controls[].type` | `pushbutton` \| `knob` \| `selector` \| `switch` \| `lever` \| `light` \| `display` \| `area` |
| `hotspot` | ทุกค่าเป็น ratio 0..1 เทียบกับรูป ห้าม px |
| `body[].kind` | `p` \| `bullet` \| `note` \| `warning` \| `heading` |
| `sections[].image` | optional ชื่อไฟล์ใน `assets/panels/` ถ้ามี = โซนนี้ใช้รูปของตัวเอง |
| `sections[].imageSize` | บังคับเมื่อมี `image` ขนาดจริงของไฟล์นั้น |
| `sections[].viewport` | optional ratio 0..1 บนรูป panel เดิม ใช้เมื่อไม่มี `image` |
| `sourceRef` | ชี้กลับไปย่อหน้าต้นทางใน docx ใช้ตอน QA |
| `needsReview` | `true` เมื่อ extractor ไม่มั่นใจ ต้องเป็น `false` ทั้งหมดก่อนส่งงาน |

## Invariants (validate-data.mjs ตรวจข้อเหล่านี้)

1. `id` ไม่ซ้ำภายใน panel และไม่ซ้ำข้าม panel
2. ทุก control มี `hotspot` และมี `body` อย่างน้อย 1 block
3. `0 <= x, y <= 1` และ `x + w <= 1`, `y + h <= 1`
4. hotspot ไม่ซ้อนทับกันเกิน 30% ของพื้นที่อันที่เล็กกว่า
5. hotspot ไม่เล็กเกินจนกดไม่โดน (ดู threshold ใน script)
6. `sectionId` ทุกตัวต้องมีอยู่ใน `sections`
7. จำนวน control ต่อ panel ต้องอยู่ในช่วง baseline ±5
8. ไม่มี `needsReview: true` เหลืออยู่ (บังคับเฉพาะโหมด `--strict` ก่อนส่งงาน)

## Baseline counts
```
overhead     93
pedestal    164
glareshield  23
instrument   31
TOTAL       311
```
