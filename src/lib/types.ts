/**
 * type ของข้อมูล panel — ต้องตรงกับ docs/data-schema.md เสมอ
 * schema เป็น contract ระหว่าง extract.py, hotspot-mapper และแอป
 */

import type { ImageSource } from 'expo-image';

/** require() ของ asset คืน number บน native และ object บน web */
export type PanelImage = ImageSource | number;

export const CONTROL_TYPES = [
  'pushbutton',
  'knob',
  'selector',
  'switch',
  'lever',
  'light',
  'display',
  'area',
] as const;
export type ControlType = (typeof CONTROL_TYPES)[number];

export const BODY_KINDS = ['p', 'bullet', 'note', 'warning', 'image'] as const;
export type BodyKind = (typeof BODY_KINDS)[number];

/** พิกัดเป็น ratio 0..1 เทียบกับรูปเสมอ ห้ามเก็บเป็น px */
export type Hotspot = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BodyBlock = {
  kind: BodyKind;
  text: string;
  /** มีได้เฉพาะ bullet — label สั้นที่ extract.py แยกออกมา เช่น ON / FAULT */
  label?: string;
  /**
   * มีได้เฉพาะ kind: 'image' — ชื่อไฟล์รูปใน assets/body-images/<panelId>/
   * ใช้ตอนเอกสารลูกค้าอธิบายด้วยรูปแทนข้อความ (เช่น "See image below" ใน ECAM HYD/FUEL/F-CTL)
   * text ใช้เป็น alt description (ว่างได้ ถ้าเอกสารไม่มี caption)
   */
  image?: string;
};

export type Control = {
  id: string;
  name: string;
  type: ControlType;
  /** null = ยังไม่ได้วางพิกัด ต้องข้ามไปไม่ render */
  hotspot: Hotspot | null;
  body: BodyBlock[];
  sourceRef: string;
  needsReview: boolean;
  bodyUnavailableReason?: string;
  hotspotUnavailableReason?: string;
  sectionId?: string;
  /** panelId ปลายทาง — ถ้ามี แตะแล้ว navigate ไปหน้านั้นแทนการเปิดคำอธิบาย (ใช้ใน _home.json) */
  target?: string;
  /**
   * ไฟล์ใน assets/detail/<panelId>/ — โคลสอัพจริงจาก docx ของปุ่มนี้
   * วางทับตำแหน่ง hotspot บนรูปแผงโดยตรง (คนละที่กับรูปใน bottom sheet ซึ่งลูกค้าห้าม)
   * แก้ปัญหารูปแผงเต็มความละเอียดต่ำเกินกว่าจะอ่านรายละเอียดปุ่มออกตอนซูม
   */
  detailImage?: string;
};

export type Section = {
  id: string;
  name: string;
  /** ถ้ามี = โซนนี้ใช้รูปของตัวเอง (หน้า ECAM) พิกัดอ้างกับ section.imageSize */
  image?: string;
  imageSize?: ImageSize;
  /** ใช้เมื่อไม่มี image = zoom ไปที่กรอบนี้บนรูป panel เดิม */
  viewport?: Hotspot;
  /**
   * ตำแหน่งบนรูป panel หลัก (ratio เทียบ panel.imageSize) ที่แตะแล้วเข้าโซนนี้
   * ไม่มี = โซนนี้ยังเข้าไม่ได้จากรูป (รอวางพิกัดปุ่มเลือกหน้าจริงบนแผง)
   * ใช้คู่กับ `image` เท่านั้น (โหมด viewport ยังไม่มี entry point ใน UI)
   */
  entry?: Hotspot;
};

export type ImageSize = {
  w: number;
  h: number;
};

export type Panel = {
  panelId: string;
  title: string;
  titleTh?: string;
  image: string;
  imageSize: ImageSize;
  sections: Section[];
  controls: Control[];
};
