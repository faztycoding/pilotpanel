/**
 * ทางเข้าเดียวของข้อมูล panel — รวม JSON กับรูปเข้าด้วยกันแล้วตรวจ schema ก่อนส่งต่อ
 * ตรรกะการตรวจอยู่ใน parse-panel.ts เพื่อให้ทดสอบแยกนอกแอปได้
 */

import homeJson from '@data/panels/_home.json';
import glareshieldJson from '@data/panels/glareshield.json';
import instrumentJson from '@data/panels/instrument.json';
import overheadJson from '@data/panels/overhead.json';
import pedestalJson from '@data/panels/pedestal.json';

import { parsePanel } from './parse-panel';
import type { Control, Hotspot, Panel, PanelImage, Section } from './types';

const RAW_PANELS: Record<string, unknown> = {
  // _home ไม่ใช่แผงจริง แต่เป็นภาพ cockpit รวมของหน้าแรก ใช้ schema เดียวกัน
  // โซนกด 7 โซนเก็บเป็น control ที่มี target ชี้ไปยัง panelId ปลายทาง
  _home: homeJson,
  glareshield: glareshieldJson,
  instrument: instrumentJson,
  overhead: overheadJson,
  pedestal: pedestalJson,
};

/**
 * รูป panel ต้อง require แบบ static ตอน build เพื่อให้ bundler เก็บไฟล์ไปด้วย
 * require ของ asset คืน number บน native แต่คืน object บน web จึงต้องรับทั้งสองแบบ
 */
const PANEL_IMAGES: Record<string, PanelImage> = {
  _home: require('@/assets/panels/cockpit_home.webp'),
  glareshield: require('@/assets/panels/glareshield.webp'),
  instrument: require('@/assets/panels/instrument.webp'),
  overhead: require('@/assets/panels/overhead.webp'),
  pedestal: require('@/assets/panels/pedestal.webp'),
};

/**
 * รูปโคลสอัพจริงต่อปุ่ม (จาก assets/detail/<panelId>/) — Metro ต้อง require() แบบ static เท่านั้น
 * เพิ่ม key ใหม่ทุกครั้งที่ทำ detailImage ให้ control เพิ่ม (คีย์ = "<panelId>:<controlId>")
 */
const DETAIL_IMAGES: Record<string, PanelImage> = {
  // ว่างไว้ตั้งใจ — glareshield เคยมีครบ 23 ตัวแต่ถอดออกแล้ว (ดู scripts/strip-detail-images.py)
  // เหตุผล: รูปแผงเรนเดอร์จาก PDF เวกเตอร์ได้ 13575px กว้าง คมกว่าครอปจาก .docx หลายเท่า
  // (วัดความคมแล้ว detail เบลอกว่า 21/23 ตัว บางตัวห่าง 8-10 เท่า) การปะทับกลายเป็นจุดเบลอบนปุ่ม
  // ถ้าจะใช้ซ้ำในอนาคต ต้องเทียบความคมกับรูปแผงจุดนั้นก่อนทุกครั้ง
};

export function getDetailImage(panelId: string, controlId: string): PanelImage | undefined {
  return DETAIL_IMAGES[`${panelId}:${controlId}`];
}

/**
 * รูปของ section ที่มีรูปตัวเอง (เช่นหน้า ECAM ของ pedestal) — key = "<panelId>:<sectionId>"
 * Metro ต้อง require() แบบ static เท่านั้น เพิ่ม key ใหม่ทุกครั้งที่มีรูป section พร้อมใช้
 * (ยังไม่มีรูปพร้อมตอนนี้ — เพิ่มพร้อมกับ data/sections-manual.json ตอนได้รูปจริง)
 */
const SECTION_IMAGES: Record<string, PanelImage> = {
  'pedestal:bleed': require('@/assets/sections/pedestal/bleed.webp'),
  'pedestal:press': require('@/assets/sections/pedestal/press.webp'),
  'pedestal:elec': require('@/assets/sections/pedestal/elec.webp'),
  'pedestal:hyd': require('@/assets/sections/pedestal/hyd.webp'),
  'pedestal:fuel': require('@/assets/sections/pedestal/fuel.webp'),
  'pedestal:apu': require('@/assets/sections/pedestal/apu.webp'),
  'pedestal:cond': require('@/assets/sections/pedestal/cond.webp'),
  'pedestal:door': require('@/assets/sections/pedestal/door.webp'),
  'pedestal:wheel': require('@/assets/sections/pedestal/wheel.webp'),
  'pedestal:f_ctl': require('@/assets/sections/pedestal/f_ctl.webp'),
  'instrument:pfd': require('@/assets/sections/instrument/pfd.webp'),
  'instrument:nd': require('@/assets/sections/instrument/nd.webp'),
  'instrument:ewd': require('@/assets/sections/instrument/ewd.webp'),
};

export function getSectionImage(panelId: string, sectionId: string): PanelImage | undefined {
  return SECTION_IMAGES[`${panelId}:${sectionId}`];
}

const cache = new Map<string, Panel>();

export function getPanel(panelId: string | undefined): Panel | undefined {
  if (!panelId) return undefined;
  const cached = cache.get(panelId);
  if (cached) return cached;

  const raw = RAW_PANELS[panelId];
  if (raw === undefined) return undefined;

  // production เชื่อข้อมูลที่ validate:data ตรวจผ่านตอน build แล้ว จึงข้ามการ parse ทีละ field
  const panel = __DEV__ ? parsePanel(raw, panelId) : (raw as Panel);
  cache.set(panelId, panel);
  return panel;
}

export function getPanelImage(panelId: string): PanelImage | undefined {
  return PANEL_IMAGES[panelId];
}

/**
 * จุดกลางของกลุ่ม hotspot ที่วางแล้วบนรูปแผง (ratio 0..1) — ใช้เป็นจุดเปิดหน้า
 *
 * ทำเป็น data-driven ไม่ใช่ hardcode ต่อแผง เพราะรูปแผงของลูกค้าเปลี่ยนได้ตลอด
 * แผงที่ปุ่มกระจายทั่วรูป (overhead/pedestal) ค่าที่ได้จะใกล้ 0.5 อยู่แล้ว = ไม่เปลี่ยนพฤติกรรมเดิม
 * ส่วน glareshield ที่รูปกว้าง 13575px แต่ปุ่มอยู่แค่ x 3775-7928 จะดึงจอไปที่ FCU ให้เลย
 * ไม่ต้องลากหาเอง 5 หน้าจอ
 *
 * ไม่นับ control ในโซนที่มีรูปของตัวเอง เพราะพิกัดพวกนั้นอ้างรูปคนละใบ (ดู placedControls)
 */
export function hotspotFocus(panel: Panel): { x: number; y: number } | undefined {
  const boxes = placedControls(panel).map((control) => control.hotspot);
  if (boxes.length === 0) return undefined;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

/** ภาพ cockpit รวมของหน้าแรก — ไม่ใช่แผงที่มีปุ่มให้กดอ่านคำอธิบาย */
export const HOME_PANEL_ID = '_home';

/**
 * โซนกดบนหน้าแรกที่พร้อมใช้ = มีทั้งพิกัดและปลายทาง
 * ตัวที่ไม่มี target จะกดแล้วไปไหนไม่ได้ ต้องไม่ render (กันปุ่มตายบนหน้าแรก)
 */
export function homeZones(panel: Panel): (Control & { hotspot: Hotspot; target: string })[] {
  return panel.controls.filter(
    (control): control is Control & { hotspot: Hotspot; target: string } =>
      control.hotspot !== null && typeof control.target === 'string' && control.target.length > 0
  );
}

/**
 * id ของโซนที่มีรูปของตัวเอง — control ในโซนพวกนี้มีพิกัดเทียบกับรูปของโซน ไม่ใช่รูปแผง
 * โซนที่ไม่มีรูป (เช่น "panels" ของหน้า home) เป็นแค่การจัดกลุ่ม พิกัดยังเทียบกับรูปแผง
 */
function sectionsWithOwnImage(panel: Panel): Set<string> {
  return new Set(
    panel.sections.filter((s) => s.image !== undefined && s.imageSize).map((s) => s.id)
  );
}

/**
 * hotspot ที่ต้อง render บนรูปแผง — ตัวที่เป็น null ต้องไม่ถูก render
 *
 * ต้องคัด control ที่อยู่ในโซนที่มีรูปตัวเองออกด้วย ไม่ใช่คัดแค่ null
 * พิกัดของมันเทียบกับรูปหน้า ECAM/จอ PFD ถ้าเอามาวางบนรูปแผงจะกลายเป็นจุดกดผี
 * กระจายผิดที่ทั่วแผง (pedestal 100 จุด / instrument 27 จุด) โดยไม่มีอะไรฟ้อง
 */
export function placedControls(panel: Panel): (Control & { hotspot: Hotspot })[] {
  const onOwnScreen = sectionsWithOwnImage(panel);
  return panel.controls.filter(
    (control): control is Control & { hotspot: Hotspot } =>
      control.hotspot !== null && !(control.sectionId && onOwnScreen.has(control.sectionId))
  );
}

/**
 * โซนที่เปิดดูได้จริง = มีทั้งรูปและขนาดรูป — ใช้ทำแถบสลับหน้า ECAM
 * โซนที่ยังไม่มีรูป (เช่นหน้า ENG ที่เอกสารลูกค้าไม่มีภาพ) ต้องไม่โผล่ในแถบ
 * ไม่งั้นผู้ใช้กดแล้วเจอหน้าเปล่า
 */
export function selectableSections(panel: Panel): Section[] {
  return panel.sections.filter((section) => section.image !== undefined && section.imageSize);
}

/**
 * control ของ section ที่มีรูปตัวเอง (ชั้น 3 โหมด image) — hotspot ของ control เหล่านี้
 * อ้างอิงกับ section.imageSize ไม่ใช่ panel.imageSize (ดู docs/data-schema.md)
 */
export function sectionControls(
  panel: Panel,
  sectionId: string
): (Control & { hotspot: Hotspot })[] {
  return panel.controls.filter(
    (control): control is Control & { hotspot: Hotspot } =>
      control.sectionId === sectionId && control.hotspot !== null
  );
}
