/**
 * type ของข้อมูล panel — ต้องตรงกับ docs/data-schema.md เสมอ
 * schema เป็น contract ระหว่าง extract.py, hotspot-mapper และแอป
 */

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

export const BODY_KINDS = ['p', 'bullet', 'note', 'warning'] as const;
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
  sectionId?: string;
};

export type Section = {
  id: string;
  name: string;
  /** ถ้ามี = โซนนี้ใช้รูปของตัวเอง (หน้า ECAM) พิกัดอ้างกับ section.imageSize */
  image?: string;
  imageSize?: ImageSize;
  /** ใช้เมื่อไม่มี image = zoom ไปที่กรอบนี้บนรูป panel เดิม */
  viewport?: Hotspot;
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
