# AGENTS.md — Switch 320

## What this project is
Offline Android app (APK) สำหรับนักเรียนการบิน แสดงข้อมูลปุ่มควบคุมห้องนักบิน Airbus A320
โมเดลการใช้งาน: เปิดแอป -> เห็นภาพ cockpit -> แตะเลือก panel -> ซูม -> แตะปุ่ม -> อ่านคำอธิบาย

**หัวใจของโปรเจกต์คือ data pipeline ไม่ใช่ UI**
ตัวแอปเป็น image map ธรรมดา งานจริง 80% คือแปลง .docx 4 ไฟล์ -> JSON 291 controls
พร้อมพิกัด hotspot ที่กดถูกตัว

## Architecture
```
รูป panel (WebP)  +  panels/*.json
        |
   ZoomableImage (gesture-handler + reanimated)
        |
   HotspotLayer  <- absolute Pressable, พิกัด ratio * containerSize
        |
   BottomSheet   <- render control.body
```
ทุกอย่าง static import ตอน build ไม่มี network call ตลอด runtime

## Data source of truth
| ไฟล์ต้นทาง | Panel | controls โดยประมาณ |
|---|---|---|
| Overhead Panel (finish).docx | overhead | 151 |
| Center Pedestal (finish).docx | pedestal | 98 |
| glareshield.docx | glareshield | 23 |
| Instrument Panel.docx | instrument | 19 |

ตัวเลขนี้คือ baseline ถ้า `validate:data` รายงานจำนวนต่างจากนี้เกิน ±5 แปลว่า extractor พัง

## Directory map
```
app/                  expo-router screens
src/components/       UI ที่ reuse ได้
src/lib/              logic (search, hotspot math, types)
data/panels/*.json    GENERATED ห้ามแก้มือ
assets/panels/*.webp  รูปพื้นหลังแต่ละ panel
scripts/extract.py    docx -> JSON draft
scripts/validate-data.mjs  external verifier
tools/hotspot-mapper/ HTML tool วางพิกัดปุ่ม
docs/data-schema.md   สัญญาของโครงสร้างข้อมูล
docs/FAILURES.md      failure library
```

## Definition of Done (ทุก task)
1. behavior ตรงกับ acceptance criteria ใน task contract
2. `npx tsc --noEmit` ผ่าน
3. `npm run validate:data` ผ่าน (ถ้า task แตะ data หรือ hotspot)
4. diff ไม่มีไฟล์ที่ไม่เกี่ยวข้อง
5. ทดสอบบนเครื่องจริงแล้วถ้าเป็น UI (Poco X7 / Tab S9 FE+)
6. มี evidence report

## Known constraints
- เครื่องเป้าหมาย: Poco X7 (6.7") และ Galaxy Tab S9 FE+ (12.4") aspect ratio ต่างกันมาก
- hit target ต่ำสุด 44x44 dp หลัง zoom ถ้าเล็กกว่านั้นต้องบังคับซูมก่อนกด
- APK ควรต่ำกว่า 100MB -> รูปทุกใบต้องเป็น WebP

## Git workflow policy
- **ทุกครั้งที่ทำงานเสร็จเป็นก้อน (task/feature/fix)**: ให้ `git add -A && git commit` แล้ว `git push` ไปที่ `origin main` ทันที ไม่ต้องรอให้ user สั่งซ้ำทุกรอบ
- เขียน commit message สั้น กระชับ บอกว่า "ทำไม" มากกว่า "ทำอะไร"
- ยกเว้น: งานที่ยังไม่เสร็จ/พังอยู่ระหว่างทำ (WIP กลางคัน), หรือ diff มีไฟล์ credential/secret หลุดมา ให้หยุดถามก่อน
- ห้าม force push / rewrite history โดยไม่ถาม user ก่อนเสมอ

## Risk levels
| งาน | risk | autonomy ที่ให้ agent |
|---|---|---|
| UI component, styling, navigation | low | ปล่อยได้เต็มที่ |
| search, bottom sheet content render | low | ปล่อยได้ |
| hotspot coordinate math | medium | ต้อง plan ก่อน + validate |
| extractor / schema change | high | ต้อง plan + review diff ทุกบรรทัด |
| แก้ data/panels/*.json | ห้าม | ต้องผ่าน script เท่านั้น |
