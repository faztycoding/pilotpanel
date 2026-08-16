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

## Open items

- callout count ยืนยันด้วยตาแล้ว 5 หน้า (hyd 13, apu 10, wheel 10, cond 6, f_ctl 8 — ตรงทั้งหมด)
  เหลือ **press 7, door 7, elec 12, fuel 11, bleed 17** ที่ยังไม่ได้นับ callout จริง
  ไม่ต้องนับตอนนี้ — ตอนวาง hotspot ต้องเปิดรูปอยู่แล้ว ถ้าเลขไม่พอกับจำนวน control จะเห็นทันทีใน mapper
- `bleed` มี control ปลอม 2 ตัวจาก legend: `cp_c_cold_valve_closed`, `cp_h_hot_valve_open`
  (`validate:data` จับได้แล้วว่า empty body)
- `(4) Pack Compressor Outlet Temperature ...` ของ BLEED ยาวเกิน `MAX_HEADING_CHARS` (70)
  เลยไม่ถูกจับเป็น control — ชื่อกับคำอธิบายติดกันในย่อหน้าเดียว
- `overhead` / `instrument` / `glareshield` ยังไม่มี section เลย เพราะเอกสารไม่ได้ใช้ pattern ALLCAPS + `(1)`
  โซนของ overhead เป็นสิ่งที่เรากำหนดเอง ต้องกรอกผ่าน `data/sections-manual.json` (extractor รองรับแล้ว)
