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
