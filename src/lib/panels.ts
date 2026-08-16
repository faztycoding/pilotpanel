/**
 * ทางเข้าเดียวของข้อมูล panel — รวม JSON กับรูปเข้าด้วยกันแล้วตรวจ schema ก่อนส่งต่อ
 * ตรรกะการตรวจอยู่ใน parse-panel.ts เพื่อให้ทดสอบแยกนอกแอปได้
 */

import glareshieldJson from '@data/panels/glareshield.json';
import instrumentJson from '@data/panels/instrument.json';
import overheadJson from '@data/panels/overhead.json';
import pedestalJson from '@data/panels/pedestal.json';

import { parsePanel } from './parse-panel';
import type { Control, Hotspot, Panel } from './types';

const RAW_PANELS: Record<string, unknown> = {
  glareshield: glareshieldJson,
  instrument: instrumentJson,
  overhead: overheadJson,
  pedestal: pedestalJson,
};

/** รูป panel ต้อง require แบบ static ตอน build เพื่อให้ bundler เก็บไฟล์ไปด้วย */
const PANEL_IMAGES = {
  glareshield: require('@/assets/panels/glareshield.webp'),
  instrument: require('@/assets/panels/instrument.webp'),
  overhead: require('@/assets/panels/overhead.webp'),
  pedestal: require('@/assets/panels/pedestal.webp'),
} as const;

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

export function getPanelImage(panelId: string): number | undefined {
  if (panelId in PANEL_IMAGES) {
    return PANEL_IMAGES[panelId as keyof typeof PANEL_IMAGES];
  }
  return undefined;
}

/** hotspot ที่วางแล้วเท่านั้น — ตัวที่เป็น null ต้องไม่ถูก render */
export function placedControls(panel: Panel): (Control & { hotspot: Hotspot })[] {
  return panel.controls.filter(
    (control): control is Control & { hotspot: Hotspot } => control.hotspot !== null
  );
}
