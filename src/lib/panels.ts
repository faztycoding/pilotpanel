/**
 * ทางเข้าเดียวของข้อมูล panel — รวม JSON กับรูปเข้าด้วยกันแล้วตรวจ schema ก่อนส่งต่อ
 * ตรรกะการตรวจอยู่ใน parse-panel.ts เพื่อให้ทดสอบแยกนอกแอปได้
 */

import glareshieldJson from '@data/panels/glareshield.json';
import instrumentJson from '@data/panels/instrument.json';
import overheadJson from '@data/panels/overhead.json';
import pedestalJson from '@data/panels/pedestal.json';

import { parsePanel } from './parse-panel';
import type { Control, Hotspot, Panel, PanelImage } from './types';

const RAW_PANELS: Record<string, unknown> = {
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
  'glareshield:gs_barometer_reference_selector': require('@/assets/detail/glareshield/gs_barometer_reference_selector.webp'),
  'glareshield:gs_flight_director_fd_push_button': require('@/assets/detail/glareshield/gs_flight_director_fd_push_button.webp'),
  'glareshield:gs_ls_push_button': require('@/assets/detail/glareshield/gs_ls_push_button.webp'),
  'glareshield:gs_operational_data_display_constraints': require('@/assets/detail/glareshield/gs_operational_data_display_constraints.webp'),
  'glareshield:gs_operational_data_display_waypoints': require('@/assets/detail/glareshield/gs_operational_data_display_waypoints.webp'),
  'glareshield:gs_operational_data_display_vor_dme': require('@/assets/detail/glareshield/gs_operational_data_display_vor_dme.webp'),
  'glareshield:gs_operational_data_display_ndb': require('@/assets/detail/glareshield/gs_operational_data_display_ndb.webp'),
  'glareshield:gs_operational_data_display_airports': require('@/assets/detail/glareshield/gs_operational_data_display_airports.webp'),
  'glareshield:gs_range_select_switch': require('@/assets/detail/glareshield/gs_range_select_switch.webp'),
  'glareshield:gs_adf_vor_select_switches': require('@/assets/detail/glareshield/gs_adf_vor_select_switches.webp'),
};

export function getDetailImage(panelId: string, controlId: string): PanelImage | undefined {
  return DETAIL_IMAGES[`${panelId}:${controlId}`];
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

/** hotspot ที่วางแล้วเท่านั้น — ตัวที่เป็น null ต้องไม่ถูก render */
export function placedControls(panel: Panel): (Control & { hotspot: Hotspot })[] {
  return panel.controls.filter(
    (control): control is Control & { hotspot: Hotspot } => control.hotspot !== null
  );
}
