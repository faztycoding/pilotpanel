#!/usr/bin/env node
/**
 * validate-data.mjs — external verifier ของ Switch 320
 *
 * นี่คือ "test suite" ตัวจริงของโปรเจกต์นี้
 * bug ที่ลูกค้าจะเจอไม่ใช่แอป crash แต่คือ "กดปุ่มนี้แล้วขึ้นข้อมูลของอีกปุ่ม"
 * script นี้จับ bug ประเภทนั้น
 *
 * usage: node scripts/validate-data.mjs [--strict]
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = "data/panels";
const STRICT = process.argv.includes("--strict");

// baseline = จำนวนที่ extractor ดึงได้จริง ณ วันที่ตั้งค่า
// หลัง QA ด้วยมือครบแล้วให้ล็อกตัวเลขนี้ใหม่และลด tolerance เหลือ 2
const BASELINE = { overhead: 110, pedestal: 173, glareshield: 24, instrument: 39 };
const BASELINE_TOLERANCE = 2;

// hit target ขั้นต่ำ: 44dp บนจอกว้าง 360dp ที่แสดงรูปเต็มความกว้าง
// = 44/360 ≈ 0.122 ของความกว้างรูป ที่ zoom 1x
// แต่เราอนุญาตให้ซูมได้ 6x ดังนั้น threshold จริง = 0.122 / 6 ≈ 0.020
const MIN_HOTSPOT_RATIO = 0.02;
const MAX_OVERLAP_RATIO = 0.3;

const VALID_TYPES = ["pushbutton","knob","selector","switch","lever","light","display","area"];
// ไม่มี "heading" เพราะ extract.py ไม่เคยผลิตออกมาเลย — schema ต้องสะท้อนของจริง
const VALID_KINDS = ["p","bullet","note","warning","image"];

const errors = [];
const warnings = [];
const seenGlobalIds = new Map();

const err = (panel, msg) => errors.push(`[${panel}] ${msg}`);
const warn = (panel, msg) => warnings.push(`[${panel}] ${msg}`);

function overlapRatio(a, b) {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ox * oy;
  if (inter === 0) return 0;
  const smaller = Math.min(a.w * a.h, b.w * b.h);
  return smaller === 0 ? 1 : inter / smaller;
}

function validatePanel(file) {
  const raw = readFileSync(join(DATA_DIR, file), "utf8");
  let panel;
  try {
    panel = JSON.parse(raw);
  } catch (e) {
    errors.push(`[${file}] JSON parse failed: ${e.message}`);
    return null;
  }

  const p = panel.panelId ?? file;

  if (!panel.panelId) err(p, "missing panelId");
  if (!panel.image) err(p, "missing image");
  if (!panel.imageSize?.w || !panel.imageSize?.h) {
    // ยังไม่ได้กรอกขนาดรูปจริง = ปกติก่อนเตรียม asset เสร็จ แต่ห้ามเหลือตอนส่งงาน
    (STRICT ? err : warn)(p, "imageSize ยังเป็น 0 — กรอกขนาดจริงของไฟล์รูปด้วย");
  }

  const sectionIds = new Set((panel.sections ?? []).map((s) => s.id));
  const controls = panel.controls ?? [];

  // --- sections (entry point เข้าโซนที่มีรูปของตัวเอง เช่นหน้า ECAM ของ pedestal) ---
  for (const s of panel.sections ?? []) {
    if (s.entry === undefined) continue;
    if (!s.image || !s.imageSize?.w || !s.imageSize?.h) {
      err(p, `section "${s.id}": มี entry แต่ไม่มี image/imageSize คู่กัน`);
    }
    const e = s.entry;
    for (const k of ["x", "y", "w", "h"]) {
      if (typeof e[k] !== "number" || Number.isNaN(e[k]) || e[k] < 0 || e[k] > 1) {
        err(p, `section "${s.id}": entry.${k} ต้องเป็น ratio 0..1`);
      }
    }
    if (e.x + e.w > 1.0001 || e.y + e.h > 1.0001) {
      err(p, `section "${s.id}": entry extends past image edge`);
    }
  }

  if (controls.length === 0) {
    err(p, "no controls at all");
    return panel;
  }

  const localIds = new Set();

  for (const c of controls) {
    const label = c.id ?? c.name ?? "<unnamed>";

    // --- identity ---
    if (!c.id) { err(p, `${label}: missing id`); continue; }
    if (localIds.has(c.id)) err(p, `${c.id}: duplicate id within panel`);
    localIds.add(c.id);
    if (seenGlobalIds.has(c.id)) {
      err(p, `${c.id}: duplicate id, also in ${seenGlobalIds.get(c.id)}`);
    } else {
      seenGlobalIds.set(c.id, p);
    }

    if (!c.name?.trim()) err(p, `${c.id}: missing name`);
    if (c.type && !VALID_TYPES.includes(c.type)) err(p, `${c.id}: invalid type "${c.type}"`);
    if (c.sectionId && !sectionIds.has(c.sectionId)) {
      err(p, `${c.id}: sectionId "${c.sectionId}" not declared in sections`);
    }

    // --- body ---
    if (!Array.isArray(c.body) || c.body.length === 0) {
      // empty body + needsReview = เอกสารต้นฉบับไม่มีคำอธิบาย (เช่น backdrop/label บน ECAM)
      // ถือเป็นงานค้างตามแผน ไม่ใช่ regression
      if (c.bodyUnavailableReason?.trim()) {
        warn(p, `${c.id}: empty body (${c.bodyUnavailableReason})`);
      } else if (c.needsReview) {
        warn(p, `${c.id}: empty body (needsReview — เอกสารไม่มีคำอธิบาย)`);
      } else {
        err(p, `${c.id}: empty body — ปุ่มนี้กดแล้วจะไม่มีอะไรขึ้น`);
      }
    } else {
      if (c.bodyUnavailableReason?.trim()) {
        err(p, `${c.id}: มีทั้ง body และ bodyUnavailableReason`);
      }
      for (const b of c.body) {
        if (!VALID_KINDS.includes(b.kind)) err(p, `${c.id}: invalid body kind "${b.kind}"`);
        if (b.kind !== "image" && !b.text?.trim()) err(p, `${c.id}: body block with empty text`);
      }
    }

    // --- hotspot ---
    const h = c.hotspot;
    if (h === null || h === undefined) {
      // ยังไม่ได้วางพิกัด = ปกติก่อนทำ T5 แต่ห้ามเหลือตอนส่งงาน
      if (c.hotspotUnavailableReason?.trim()) {
        warn(p, `${c.id}: ไม่มี hotspot (${c.hotspotUnavailableReason})`);
      } else {
        (STRICT ? err : warn)(p, `${c.id}: ยังไม่ได้วางพิกัด hotspot`);
      }
      continue;
    }
    if (c.hotspotUnavailableReason?.trim()) {
      err(p, `${c.id}: มีทั้ง hotspot และ hotspotUnavailableReason`);
    }

    for (const k of ["x", "y", "w", "h"]) {
      if (typeof h[k] !== "number" || Number.isNaN(h[k])) {
        err(p, `${c.id}: hotspot.${k} is not a number`);
      }
    }
    if (h.w <= 0 || h.h <= 0) err(p, `${c.id}: hotspot has zero or negative size`);
    if (h.x < 0 || h.y < 0) err(p, `${c.id}: hotspot out of bounds (negative)`);
    if (h.x + h.w > 1.0001 || h.y + h.h > 1.0001) {
      err(p, `${c.id}: hotspot extends past image edge`);
    }
    if (h.x > 1 || h.y > 1 || h.w > 1 || h.h > 1) {
      err(p, `${c.id}: hotspot value > 1 — น่าจะใส่เป็น px ไม่ใช่ ratio`);
    }
    if (h.w < MIN_HOTSPOT_RATIO || h.h < MIN_HOTSPOT_RATIO) {
      warn(p, `${c.id}: hotspot เล็กมาก (${h.w.toFixed(4)}x${h.h.toFixed(4)}) อาจกดไม่โดนแม้ซูมสุด`);
    }

    if (c.needsReview === true) {
      (STRICT ? err : warn)(p, `${c.id}: needsReview ยังเป็น true`);
    }
  }

  // --- overlap ---
  // ต้องเทียบกันเฉพาะ control ที่อยู่ใน "ระบบพิกัดเดียวกัน" เท่านั้น
  // control ที่มี sectionId ใช้ ratio เทียบกับ section.imageSize (รูปหน้า ECAM ของโซนนั้น)
  // ส่วนที่ไม่มี sectionId เทียบกับ panel.imageSize — เอามาทับกันไม่ได้ คนละรูปคนละขนาด
  // (ถ้าไม่แยก จะได้ error ปลอมเป็นร้อยรายการทันทีที่โซนเริ่มมี hotspot)
  const bySpace = new Map();
  for (const c of controls) {
    if (!c.hotspot || !c.id) continue;
    const key = c.sectionId ?? "__panel__";
    if (!bySpace.has(key)) bySpace.set(key, []);
    bySpace.get(key).push(c);
  }
  // control ที่กินพื้นที่เกือบทั้งรูปคือ "ชั้นพื้นหลัง" ของโซนนั้น เช่น ip_primary_flight_display
  // ที่เป็นคำอธิบายจอ PFD ทั้งจอ แล้วมีสัญลักษณ์ย่อย 25 ตัววางทับอยู่ด้านบน
  // HotspotLayer render ตามลำดับใน array และตัวพื้นหลังมาก่อนเสมอ (เอกสารเขียนหัวข้อจอไว้ก่อน)
  // จึงกดสัญลักษณ์ย่อยได้ปกติ ส่วนที่ว่างจะได้คำอธิบายจอรวม — ไม่ใช่ความผิดพลาดของพิกัด
  const isBackdrop = (c) => c.hotspot.w * c.hotspot.h >= 0.9;
  for (const [space, group] of bySpace) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (isBackdrop(group[i]) || isBackdrop(group[j])) continue;
        const r = overlapRatio(group[i].hotspot, group[j].hotspot);
        if (r > MAX_OVERLAP_RATIO) {
          const where = space === "__panel__" ? "" : ` (โซน ${space})`;
          err(p, `${group[i].id} ทับ ${group[j].id} ${(r * 100).toFixed(0)}%${where} — จะกดผิดตัว`);
        }
      }
    }
  }

  // --- baseline count ---
  const expected = BASELINE[panel.panelId];
  if (expected !== undefined) {
    const diff = Math.abs(controls.length - expected);
    if (diff > BASELINE_TOLERANCE) {
      err(p, `control count ${controls.length} ห่างจาก baseline ${expected} เกิน ±${BASELINE_TOLERANCE} — extractor น่าจะพลาด`);
    }
  }

  return panel;
}

// ---- run ----
let files;
try {
  files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
} catch {
  console.error(`✗ ไม่พบโฟลเดอร์ ${DATA_DIR}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`✗ ไม่มีไฟล์ JSON ใน ${DATA_DIR}`);
  process.exit(1);
}

console.log(`\nvalidate-data ${STRICT ? "(strict)" : ""}\n${"─".repeat(60)}`);

let total = 0;
let withHotspots = 0;
for (const f of files.sort()) {
  const panel = validatePanel(f);
  if (!panel?.controls) continue;
  const n = panel.controls.length;
  const hs = panel.controls.filter((c) => c.hotspot).length;
  total += n;
  withHotspots += hs;
  const pct = n ? Math.round((hs / n) * 100) : 0;
  console.log(
    `  ${(panel.panelId ?? f).padEnd(14)} ${String(n).padStart(4)} controls   ` +
    `hotspot ${String(hs).padStart(4)}/${String(n).padEnd(4)} (${pct}%)`
  );
}

console.log(`${"─".repeat(60)}`);
console.log(`  TOTAL          ${String(total).padStart(4)} controls   hotspot ${withHotspots}/${total}`);

if (warnings.length) {
  console.log(`\n⚠  warnings (${warnings.length})`);
  for (const w of warnings.slice(0, 30)) console.log(`   ${w}`);
  if (warnings.length > 30) console.log(`   ... อีก ${warnings.length - 30} รายการ`);
}

if (errors.length) {
  console.log(`\n✗ errors (${errors.length})`);
  for (const e of errors.slice(0, 50)) console.log(`   ${e}`);
  if (errors.length > 50) console.log(`   ... อีก ${errors.length - 50} รายการ`);
  console.log("");
  process.exit(1);
}

console.log(`\n✓ data ผ่านทั้งหมด\n`);
