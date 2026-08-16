# DAY 1 — เริ่มโปรเจกต์ Switch 320

อ่านจากบนลงล่าง ทำทีละข้อ ห้ามข้าม
แต่ละข้อบอกชัดว่าทำที่ไหน:

- 🖥️ **TERMINAL** = พิมพ์ใน terminal
- 📝 **ไฟล์** = แก้ไฟล์ด้วยมือ
- 💬 **CASCADE** = ก๊อปวางในช่องแชท Windsurf
- 👀 **ตรวจ** = หยุดดูผลก่อนไปต่อ

---

## ข้อ 1 🖥️ TERMINAL — สร้างโปรเจกต์

```bash
npx create-expo-app@latest switch320
cd switch320
git init
git add -A
git commit -m "chore: expo baseline"
```

---

## ข้อ 2 🖥️ TERMINAL — แตก starter kit

```bash
unzip ~/Downloads/switch320-starter.zip -d .
bash setup.sh
```

รอจนขึ้น `✓ ติดตั้งเสร็จ`

---

## ข้อ 3 🖥️ TERMINAL — เตรียมรูป

```bash
mkdir -p assets/panels

cwebp -q 82 cockpit.png     -o assets/panels/cockpit_home.webp
cwebp -q 82 overhead.png    -o assets/panels/overhead.webp
cwebp -q 82 glareshield.png -o assets/panels/glareshield.webp
cwebp -q 82 instrument.png  -o assets/panels/instrument.webp
cwebp -q 82 pedestal.png    -o assets/panels/pedestal.webp

ls -la assets/panels/
```

ถ้าไม่มี `cwebp`: `brew install webp` (mac) หรือ `sudo apt install webp` (linux)

**ชื่อไฟล์ต้องตรงเป๊ะ** ไม่งั้นแอปหารูปไม่เจอ

---

## ข้อ 4 👀 ตรวจ — เช็คว่าข้อมูลมาครบ

```bash
npm run validate:data
```

ต้องเห็นแบบนี้:

```
glareshield      23 controls
instrument       31 controls
overhead         93 controls
pedestal        164 controls
TOTAL           311 controls
```

ถ้าไม่ตรง = วางไฟล์ผิดที่ กลับไปข้อ 2

```bash
git add -A
git commit -m "chore: starter kit + assets"
```

---

## ข้อ 5 🖥️ TERMINAL — เปิด Windsurf

```bash
windsurf .
```

หรือเปิดแอป Windsurf แล้ว File > Open Folder เลือกโฟลเดอร์ `switch320`

---

## ข้อ 6 💬 CASCADE — รอบวางแผน (ปิด Write mode ก่อน)

**สำคัญ: หา toggle "Write" ที่มุมช่องแชท แล้วปิดให้เป็น Chat/Read mode ก่อน**

ก๊อปทั้งก้อนนี้วางในช่องแชท:

```
คุณคือ planning agent ห้ามแก้ไฟล์ใดๆ ในรอบนี้
อ่าน AGENTS.md, .windsurfrules, docs/data-schema.md และ data/panels/glareshield.json ก่อนตอบ

TASK: T1 — Panel Viewer

GOAL
หน้า app/panel/[id].tsx แสดงรูป panel เต็มจอ ซูม/แพนได้
แตะ hotspot แล้วเปิด bottom sheet render เนื้อหาจาก control.body

SCOPE
app/panel/[id].tsx, app/_layout.tsx, src/components/, src/lib/ เท่านั้น

OUT OF SCOPE
หน้า Home, search, โหมดลิสต์, sub-panel, panel อื่นนอกจาก glareshield
ห้ามแก้ไฟล์ใน data/ และ scripts/

INPUTS
data/panels/glareshield.json  (23 controls มี hotspot เป็น null ทั้งหมด)
assets/panels/glareshield.webp

INVARIANTS
- hotspot เก็บเป็น ratio 0..1 คูณกับขนาดรูปที่ layout จริงเท่านั้น
- ห้ามมีตัวเลข px คงที่ในโค้ดคำนวณพิกัดแม้แต่ตัวเดียว
- รูปคง aspect ratio เดิมทุกขนาดจอ
- hotspot ต้องขยับตามภาพตอน zoom/pan อย่างถูกต้อง
- zoom 1x ถึง 6x
- control ที่ hotspot เป็น null ให้ข้ามไป ไม่ render และไม่ crash

ACCEPTANCE
- แตะปุ่มเดิมได้ทั้งที่ zoom 1x และ zoom 5x หลัง pan ไปมุมใดก็ตาม
- แตะพื้นที่ว่างแล้วไม่มีอะไรเปิด
- bottom sheet ปัดปิดได้ เปิดปุ่มใหม่ทับของเดิมได้
- bottom sheet สูงประมาณ 60-70% ของจอ ยังเห็นรูปด้านบน
- npx tsc --noEmit ผ่าน

ส่งกลับมา
1. ไฟล์ที่จะสร้าง/แก้ พร้อมหน้าที่ของแต่ละไฟล์
2. สูตรคำนวณพิกัดที่เสนอ เขียนเป็นสมการออกมาให้เห็นชัด
   พร้อมบอกว่า gesture-handler จะจับ tap ที่ระดับไหนของ component tree
3. edge case ที่คิดออก
4. ขั้นตอน implement เรียงลำดับ
5. assumption ที่ตั้งเอง

ห้ามอ้างข้อเท็จจริงเกี่ยวกับ repo โดยไม่ได้เปิดไฟล์ดูจริง
```

---

## ข้อ 7 👀 ตรวจ — อ่านคำตอบข้อ 2 ให้ละเอียด

นี่คือจุดที่สำคัญที่สุดของทั้งโปรเจกต์

สูตรที่ **ถูก** ต้องหน้าตาประมาณนี้:
```
displayW = ความกว้างรูปหลัง layout (จาก onLayout ไม่ใช่ img.width)
screenX  = hotspot.x * displayW * scale + translateX
screenY  = hotspot.y * displayH * scale + translateY
boxW     = hotspot.w * displayW * scale
```

สูตรที่ **ผิด** ต้องสั่งแก้:
- ใช้ `imageSize.w` จาก JSON มาคูณตรงๆ (นั่นคือขนาดไฟล์ ไม่ใช่ขนาดบนจอ)
- ใช้ `Dimensions.get('window')` มาคำนวณ (ไม่รู้ว่ารูปถูก letterbox เท่าไร)
- ลืม `scale` หรือลืม `translate`

ถ้าผิดให้ตอบกลับไปว่า:
```
สูตรข้อ 2 ผิด displayW ต้องมาจาก onLayout ของ container ที่ครอบรูป
ไม่ใช่ imageSize จาก JSON เพราะรูปถูก scale ให้พอดีจอแล้ว
แก้แผนใหม่แล้วส่งมาอีกรอบ ยังห้ามแก้ไฟล์
```

---

## ข้อ 8 💬 CASCADE — รอบลงมือ (เปิด Write mode)

```
implement ตาม plan ที่อนุมัติแล้วเท่านั้น
ห้ามออกนอก scope ห้าม refactor ที่ไม่ได้ขอ ห้ามเพิ่ม dependency

ก่อนเริ่ม: ใส่ hotspot สมมติให้ 3 controls แรกใน data/panels/glareshield.json
เพื่อใช้ทดสอบ (อันนี้เป็นข้อยกเว้นเดียวที่อนุญาตให้แตะ data/)
และกรอก imageSize ให้ตรงกับไฟล์ assets/panels/glareshield.webp

เสร็จแล้วให้:
- รัน npx tsc --noEmit และรายงานคำสั่ง + ผลลัพธ์จริง
- list ไฟล์ที่แก้ทั้งหมด
- บอก assumption ที่ตั้งเอง
- บอกความเสี่ยงที่ยังเหลือ

ห้ามเขียนว่าเสร็จแล้วถ้ายังไม่ได้รันคำสั่งจริง
```

---

## ข้อ 9 🖥️ TERMINAL — ทดสอบเครื่องจริง

```bash
npx expo start
```

ยิง QR เข้า Poco X7 แล้วเช็ค 3 อย่างนี้:

- [ ] ซูมสุด แล้วลากไปมุมขวาล่าง แตะปุ่มยังตรงตัวเดิม
- [ ] หมุนจอเป็นแนวนอน พิกัดยังตรง
- [ ] ลองบน Tab S9 FE+ (จออัตราส่วนต่างกันมาก คือจุดที่มักพัง)

ถ้าผ่านทั้ง 3:

```bash
git add -A
git commit -m "feat(T1): panel viewer with ratio-based hotspots"
```

**ถ้าไม่ผ่าน** ตอบกลับ Cascade ว่า:
```
บนเครื่องจริง <อาการที่เจอ>
อ่านโค้ดคำนวณพิกัดอีกรอบ หาสาเหตุก่อนแก้ อย่าเดา
บอกมาว่าสาเหตุคืออะไรและจะแก้ยังไง ยังไม่ต้องแก้
```

---

## ข้อ 10 🖥️ ทำเอง — วาง hotspot จริง 23 จุด

```bash
open tools/hotspot-mapper/index.html
```

1. เลือกไฟล์ `assets/panels/glareshield.webp`
2. เลือกไฟล์ `data/panels/glareshield.json`
3. มันเด้งไปตัวแรกที่ยังไม่มีพิกัดเอง
4. ลากกรอบครอบปุ่ม → กด `Enter` → ตัวถัดไป
5. วนจนครบ 23 จุด
6. กด **Export JSON** แล้วเอาไฟล์ทับ `data/panels/glareshield.json`

```bash
npm run validate:data
git add -A
git commit -m "data: glareshield hotspots complete"
```

ใช้เวลาประมาณ 20-30 นาที ถ้ามีกรอบขึ้นสีแดง = ทับกันเกิน 30% ต้องลากใหม่

---

## ข้อ 11 💬 CASCADE — หน้า Home

```
TASK: T4 — Home screen
RISK: low ไม่ต้อง plan แยก implement ได้เลย

GOAL
app/index.tsx เป็นหน้าแรกของแอป เปิดมาเห็นทันที ไม่มี splash ไม่มี onboarding

LAYOUT บนลงล่าง
1. header สูงประมาณ 48dp: ชื่อ "Switch 320" ซ้าย, ไอคอนแว่นขยายขวา (ยังไม่ต้องทำงาน)
2. ข้อความ hint ตัวเล็ก "แตะแผงที่ต้องการ"
3. รูป cockpit_home.webp มี hotspot 4 จุดครอบแต่ละแผง
4. grid 2x2 ปุ่มข้อความ 4 อัน แสดงชื่อแผง + จำนวน control
   Overhead 93 / Glareshield 23 / Instrument 31 / Center Pedestal 164
   อ่านจำนวนจาก controls.length ของแต่ละไฟล์ ห้าม hardcode ตัวเลข

ทั้งรูปและปุ่ม grid กดแล้วไปหน้าเดียวกันคือ /panel/[id]

SCOPE
app/index.tsx, app/_layout.tsx, src/components/, data/panels/_home.json

INVARIANTS
- ใช้ HotspotLayer ตัวเดียวกับ T1 ห้ามเขียนตรรกะพิกัดซ้ำ
- พิกัด 4 จุดเก็บใน data/panels/_home.json ตาม schema เดิม
- ห้ามเพิ่ม splash screen, login, onboarding, settings, favorites
- ห้ามใส่ animation เปลี่ยนหน้าที่นานเกิน 200ms

ACCEPTANCE
- แตะครบ 4 แผงทั้งจากรูปและจากปุ่ม เข้าถูกหน้าทุกทาง
- กด back กลับ Home ได้
- npx tsc --noEmit ผ่าน
```

จากนั้นเปิด mapper วางพิกัด 4 จุดใน `_home.json` เหมือนข้อ 10

---

## ข้อ 12 🖥️ TERMINAL — build APK ตัวแรก

📝 สร้างไฟล์ `eas.json`:

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    }
  }
}
```

```bash
npm i -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

รอ 10-15 นาที ได้ลิงก์โหลด APK

---

## ข้อ 13 ส่งลูกค้า

ส่งไป 3 อย่าง:
1. ลิงก์ APK
2. screenshot 2-3 รูป
3. ข้อความยืนยัน scope (ฉบับที่ร่างไว้)

พร้อมบอกว่าตอนนี้ Glareshield ใช้ได้จริงแล้ว อีก 3 แผงกำลังทำ

---

# สรุปเวลาที่ใช้

| ข้อ | เวลา |
|---|---|
| 1-5 setup | 45 นาที |
| 6-9 T1 viewer | 2-3 ชม. |
| 10 วาง hotspot | 30 นาที |
| 11 Home | 1 ชม. |
| 12-13 build + ส่ง | 30 นาที |
| **รวม** | **ประมาณ 6 ชม.** |

แบ่งทำ 2-3 วันได้สบาย ไม่ต้องรวดเดียว

---

# กฎ 5 ข้อตอนคุยกับ Cascade

1. **งานสำคัญ plan ก่อนเสมอ** ปิด Write mode ให้มันวางแผน อ่าน แล้วค่อยให้ทำ
2. **มันบอกว่าเสร็จ ถามกลับทุกครั้ง** "รันคำสั่งอะไร ผลลัพธ์อะไร ขอ output จริง"
3. **มันขอลง lib ใหม่ ปฏิเสธก่อน** ถามว่าทำไมของที่มีอยู่ไม่พอ
4. **มันแก้ไฟล์นอก scope** `git checkout -- <ไฟล์>` ทันที แล้วสั่งใหม่ให้แคบลง
5. **เจอ bug เดิมซ้ำครั้งที่ 2** หยุด แก้ที่ .windsurfrules ไม่ใช่แก้เคสนั้น
