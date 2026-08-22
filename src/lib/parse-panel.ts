/**
 * ตรวจข้อมูล panel ให้ตรง schema — ไฟล์นี้ไม่ import alias ใด ๆ เพื่อให้รันทดสอบนอกแอปได้
 *
 * ทำไมต้อง parse ไม่ใช้ `as Panel` เฉย ๆ:
 *   JSON ที่ import มา TS จะ infer เป็น type ตามค่าที่เห็น (hotspot: null, kind: string)
 *   ซึ่ง cast ตรง ๆ ไม่ได้ ถ้าใช้ `as unknown as Panel` จะกลายเป็นเชื่อข้อมูลแบบไม่ตรวจ
 *   วันที่ schema เปลี่ยนแล้ว extractor ผลิตของไม่ตรง แอปจะพังเงียบตอน runtime
 *   parse ที่ throw ตอน __DEV__ ทำให้พังดังตอน dev แทน
 */

import type { BodyBlock, BodyKind, Control, ControlType, Hotspot, Panel, Section } from './types';
import { BODY_KINDS, CONTROL_TYPES } from './types';

class PanelDataError extends Error {
  constructor(path: string, detail: string) {
    super(`ข้อมูล panel ไม่ตรง schema ที่ ${path}: ${detail}`);
    this.name = 'PanelDataError';
  }
}

function fail(path: string, detail: string): never {
  throw new PanelDataError(path, detail);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, `ต้องเป็น object แต่ได้ ${Array.isArray(value) ? 'array' : typeof value}`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, `ต้องเป็น string แต่ได้ ${typeof value}`);
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(path, `ต้องเป็นตัวเลข แต่ได้ ${typeof value}`);
  }
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, `ต้องเป็น array แต่ได้ ${typeof value}`);
  return value;
}

function parseHotspot(value: unknown, path: string): Hotspot | null {
  if (value === null || value === undefined) return null;
  const raw = asRecord(value, path);
  const hotspot: Hotspot = {
    x: asNumber(raw.x, `${path}.x`),
    y: asNumber(raw.y, `${path}.y`),
    w: asNumber(raw.w, `${path}.w`),
    h: asNumber(raw.h, `${path}.h`),
  };
  for (const [key, n] of Object.entries(hotspot)) {
    if (n < 0 || n > 1) fail(`${path}.${key}`, `ต้องเป็น ratio 0..1 แต่ได้ ${n} — พิกัดต้องไม่ใช่ px`);
  }
  return hotspot;
}

function parseBodyBlock(value: unknown, path: string): BodyBlock {
  const raw = asRecord(value, path);
  const kind = asString(raw.kind, `${path}.kind`);
  if (!BODY_KINDS.includes(kind as BodyKind)) {
    fail(`${path}.kind`, `"${kind}" ไม่อยู่ใน ${BODY_KINDS.join(' | ')}`);
  }
  const block: BodyBlock = { kind: kind as BodyKind, text: asString(raw.text, `${path}.text`) };
  if (raw.label !== undefined) block.label = asString(raw.label, `${path}.label`);
  return block;
}

function parseControl(value: unknown, path: string): Control {
  const raw = asRecord(value, path);
  const type = asString(raw.type, `${path}.type`);
  if (!CONTROL_TYPES.includes(type as ControlType)) {
    fail(`${path}.type`, `"${type}" ไม่อยู่ใน ${CONTROL_TYPES.join(' | ')}`);
  }
  const body = asArray(raw.body, `${path}.body`).map((block, i) =>
    parseBodyBlock(block, `${path}.body[${i}]`)
  );
  const bodyUnavailableReason = raw.bodyUnavailableReason === undefined
    ? undefined
    : asString(raw.bodyUnavailableReason, `${path}.bodyUnavailableReason`);
  // body ว่างเป็นปัญหา "คุณภาพข้อมูล" ไม่ใช่ "รูปร่างผิด" — validate:data gate ไว้ตอน build แล้ว
  // ที่นี่จึงเตือนแทนการ throw ไม่งั้นแอปจะพังใน dev เพราะงานข้อมูลที่ยังค้างอยู่
  if (body.length === 0 && bodyUnavailableReason === undefined) {
    console.warn(`[panel] ${path}: body ว่าง — กดแล้วจะไม่มีอะไรขึ้น (ดู npm run validate:data)`);
  }
  if (body.length > 0 && bodyUnavailableReason !== undefined) {
    fail(`${path}.bodyUnavailableReason`, 'มีเหตุผลว่า body ไม่มี แต่ body มีข้อมูลอยู่แล้ว');
  }

  const control: Control = {
    id: asString(raw.id, `${path}.id`),
    name: asString(raw.name, `${path}.name`),
    type: type as ControlType,
    hotspot: parseHotspot(raw.hotspot, `${path}.hotspot`),
    body,
    sourceRef: asString(raw.sourceRef, `${path}.sourceRef`),
    needsReview: raw.needsReview === true,
  };
  if (bodyUnavailableReason !== undefined) {
    control.bodyUnavailableReason = bodyUnavailableReason;
  }
  if (raw.hotspotUnavailableReason !== undefined) {
    control.hotspotUnavailableReason = asString(
      raw.hotspotUnavailableReason,
      `${path}.hotspotUnavailableReason`
    );
  }
  if (control.hotspot !== null && control.hotspotUnavailableReason !== undefined) {
    fail(`${path}.hotspotUnavailableReason`, 'มีเหตุผลว่า hotspot ไม่มี แต่ hotspot มีข้อมูลอยู่แล้ว');
  }
  if (raw.sectionId !== undefined) {
    control.sectionId = asString(raw.sectionId, `${path}.sectionId`);
  }
  if (raw.target !== undefined) {
    control.target = asString(raw.target, `${path}.target`);
  }
  if (raw.detailImage !== undefined) {
    control.detailImage = asString(raw.detailImage, `${path}.detailImage`);
  }
  return control;
}

function parseSection(value: unknown, path: string): Section {
  const raw = asRecord(value, path);
  const section: Section = {
    id: asString(raw.id, `${path}.id`),
    name: asString(raw.name, `${path}.name`),
  };
  if (raw.image !== undefined) {
    section.image = asString(raw.image, `${path}.image`);
    const size = asRecord(raw.imageSize, `${path}.imageSize`);
    section.imageSize = {
      w: asNumber(size.w, `${path}.imageSize.w`),
      h: asNumber(size.h, `${path}.imageSize.h`),
    };
  }
  if (raw.viewport !== undefined) {
    const viewport = parseHotspot(raw.viewport, `${path}.viewport`);
    if (viewport) section.viewport = viewport;
  }
  if (raw.entry !== undefined) {
    const entry = parseHotspot(raw.entry, `${path}.entry`);
    if (entry) section.entry = entry;
  }
  return section;
}

export function parsePanel(value: unknown, path: string): Panel {
  const raw = asRecord(value, path);
  const size = asRecord(raw.imageSize, `${path}.imageSize`);
  const imageSize = {
    w: asNumber(size.w, `${path}.imageSize.w`),
    h: asNumber(size.h, `${path}.imageSize.h`),
  };
  if (imageSize.w <= 0 || imageSize.h <= 0) {
    fail(`${path}.imageSize`, 'ยังเป็น 0 — ต้องกรอกขนาดจริงของไฟล์รูปก่อน');
  }

  const panel: Panel = {
    panelId: asString(raw.panelId, `${path}.panelId`),
    title: asString(raw.title, `${path}.title`),
    image: asString(raw.image, `${path}.image`),
    imageSize,
    sections: asArray(raw.sections, `${path}.sections`).map((section, i) =>
      parseSection(section, `${path}.sections[${i}]`)
    ),
    controls: asArray(raw.controls, `${path}.controls`).map((control, i) =>
      parseControl(control, `${path}.controls[${i}]`)
    ),
  };
  if (raw.titleTh !== undefined) panel.titleTh = asString(raw.titleTh, `${path}.titleTh`);
  return panel;
}
