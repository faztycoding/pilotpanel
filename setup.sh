#!/usr/bin/env bash
# Switch 320 — ติดตั้ง starter kit เข้าโปรเจกต์ Expo ที่สร้างไว้แล้ว
# รันจาก root ของโปรเจกต์:  bash setup.sh
set -e

echo "→ ตรวจว่าอยู่ใน root ของโปรเจกต์ Expo"
[ -f package.json ] || { echo "✗ ไม่เจอ package.json — cd เข้าโปรเจกต์ก่อน"; exit 1; }

echo "→ ลง dependency"
npx expo install react-native-gesture-handler react-native-reanimated \
  react-native-safe-area-context react-native-screens expo-image expo-router
npm i @gorhom/bottom-sheet

echo "→ เพิ่ม scripts ใน package.json"
node -e '
const fs=require("fs");
const p=JSON.parse(fs.readFileSync("package.json","utf8"));
p.scripts=Object.assign({},p.scripts,{
  "validate:data":"node scripts/validate-data.mjs",
  "validate:strict":"node scripts/validate-data.mjs --strict",
  "typecheck":"tsc --noEmit"
});
fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");
console.log("  ✓ scripts เพิ่มแล้ว");
'

echo "→ เปิด TypeScript strict"
cat > tsconfig.json <<'JSON'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
JSON

echo "→ สร้างโฟลเดอร์ที่เหลือ"
mkdir -p app src/components src/lib assets/panels source

echo "→ ตรวจข้อมูล"
node scripts/validate-data.mjs || true

cat <<'MSG'

──────────────────────────────────────────────
✓ ติดตั้งเสร็จ

ต่อไป:
  1. เอารูป panel ใส่ assets/panels/ (webp)
     cwebp -q 82 overhead.png -o assets/panels/overhead.webp
  2. git add -A && git commit -m "chore: starter kit"
  3. เปิด Cascade ครั้งแรก แล้ววาง prompt T1 PLANNER จาก RUNBOOK.md
──────────────────────────────────────────────
MSG
