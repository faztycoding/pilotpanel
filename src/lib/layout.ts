/**
 * คณิตศาสตร์ของพิกัด hotspot — ฟังก์ชันบริสุทธิ์ทั้งไฟล์ ไม่มี React ไม่มี side effect
 *
 * กฎเหล็ก:
 *   - ขนาดรูปบนจอ (displayW/H) ต้องมาจาก onLayout ของ container เท่านั้น
 *     ห้ามใช้ imageSize จาก JSON เป็นขนาด และห้ามใช้ Dimensions.get()
 *   - imageSize ใช้เป็น "อัตราส่วน" อย่างเดียว
 *   - พิกัด hotspot เป็น ratio 0..1 คูณกับ displayW/H เท่านั้น ไม่มี px คงที่
 */

import type { Hotspot, ImageSize } from './types';

export type Size = {
  width: number;
  height: number;
};

export type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** ขนาดต่ำสุดของ hit target ตาม AGENTS.md — ค่าของนิ้วมนุษย์ ไม่ใช่ค่าของรูป */
export const MIN_HIT_TARGET_DP = 44;

const MIN_MAX_SCALE = 6;
const MAX_MAX_SCALE = 20;

/**
 * เพดานซูมต้องสูงกว่าค่าซูมเริ่มต้นเป็นเท่าตัว ไม่ใช่เท่ากัน
 * ถ้าเท่ากัน (เคสก่อนแก้) หน้า panel จะเปิดมาแล้วติดเพดานทันที บีบนิ้วเข้าต่อไม่ได้เลย
 */
const ZOOM_HEADROOM = 3;

/**
 * ฟังก์ชันนี้ถูกเรียกจาก gesture callback ที่รันบน UI thread ต้องมี 'worklet'
 * ถ้าไม่มี react-native-worklets จะ crash ระดับ native (ไม่ใช่ red box) ดู docs/FAILURES.md
 * ตอนรันใน node ธรรมดา directive นี้เป็นแค่ string ไม่มีผล จึงยังทดสอบแยกได้
 */
export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

/**
 * จัดรูปแบบ contain: รูปพอดีใน container โดยคงอัตราส่วนเดิม
 * เคส glareshield 7.6:1 บนจอตั้งจะติดความกว้าง เหลือที่ว่างบนล่างเยอะ (letterbox)
 */
export function fitContain(container: Size, image: ImageSize): Size {
  if (container.width <= 0 || container.height <= 0 || image.w <= 0 || image.h <= 0) {
    return { width: 0, height: 0 };
  }
  const fitScale = Math.min(container.width / image.w, container.height / image.h);
  return { width: image.w * fitScale, height: image.h * fitScale };
}

/**
 * แปลง hotspot ratio -> กล่องบน view ของรูป (ตอน scale=1 translate=0)
 *
 * ไม่ต้องคูณ scale หรือบวก translate ที่นี่ เพราะกล่องนี้เป็นลูกของ Animated.View
 * ตัวเดียวกับรูป transform จึงถูกใส่ให้โดย RN เอง
 */
export function hotspotToBox(hotspot: Hotspot, display: Size): Box {
  return {
    left: hotspot.x * display.width,
    top: hotspot.y * display.height,
    width: hotspot.w * display.width,
    height: hotspot.h * display.height,
  };
}

/**
 * ระยะ pan สูงสุดที่ยอมได้ก่อนรูปจะหลุดขอบ container
 * ถ้ารูป (หลังซูม) เล็กกว่า container ในแกนไหน แกนนั้นได้ 0 = ล็อกกลาง
 * เคส glareshield ที่ scale=1: displayH เล็กกว่า containerH มาก -> maxY = 0
 */
export function maxTranslate(container: Size, display: Size, scale: number): Size {
  'worklet';
  return {
    width: Math.max(0, (display.width * scale - container.width) / 2),
    height: Math.max(0, (display.height * scale - container.height) / 2),
  };
}

/**
 * สเกลที่ทำให้รูปเต็มจอพอดี (แบบ cover) ล้นแกนไหนก็ให้ผู้ใช้เลื่อนแกนนั้น
 * ใช้เป็นค่าซูมเริ่มต้นของหน้า panel: เปิดมาโผล่กลางรูป ปุ่มใหญ่พออ่านได้ทันที
 *
 * หลัง fitContain รูปจะติดขอบจอแกนเดียว อีกแกนเหลือที่ว่าง — สูตรนี้เลือกแกนที่เหลือที่ว่าง
 * ไปขยายให้เต็ม ผลคือรูปแบน (glareshield) ล้นซ้ายขวาให้เลื่อนแนวนอน
 * ส่วนรูปเกือบจัตุรัส (overhead/pedestal) ล้นบนล่างให้เลื่อนแนวตั้ง — กฎเดียวใช้ได้ทุก panel
 */
export function fillScreenScale(container: Size, display: Size): number {
  if (display.width <= 0 || display.height <= 0) return 1;
  return Math.max(container.width / display.width, container.height / display.height, 1);
}

/**
 * ซูมสูงสุด: ปกติ 6x แต่รูปที่แบนมาก (glareshield) ต้องซูมได้ลึกกว่านั้น
 * เพราะค่าเริ่มต้นของมันคือ fillScreenScale ซึ่งสูงอยู่แล้ว ถ้าเพดานไม่เผื่อ headroom
 * ผู้ใช้จะซูมเข้าต่อไม่ได้เลยตั้งแต่เปิดหน้ามา
 */
export function maxScaleFor(container: Size, display: Size): number {
  if (display.height <= 0) return MIN_MAX_SCALE;
  return clamp(fillScreenScale(container, display) * ZOOM_HEADROOM, MIN_MAX_SCALE, MAX_MAX_SCALE);
}

/** hitSlop ต่อด้าน เพื่อดันกล่องที่เล็กกว่านิ้วให้ถึง MIN_HIT_TARGET_DP */
export function hitSlopFor(box: Box, scale: number): { horizontal: number; vertical: number } {
  return {
    horizontal: Math.max(0, (MIN_HIT_TARGET_DP - box.width * scale) / 2),
    vertical: Math.max(0, (MIN_HIT_TARGET_DP - box.height * scale) / 2),
  };
}

/**
 * เกินระดับนี้ถือว่าผู้ใช้ซูมเองแล้ว ไม่ต้องเตือนอีก
 * ต่ำกว่านี้แม้ hitSlop จะดันกล่องให้ถึง 44dp ได้ แต่พื้นที่กดของปุ่มที่อยู่ชิดกันจะทับกัน
 * (วัดแล้ว: overhead 34 คู่ / pedestal 16 คู่ ตอนเปิดหน้ามา) ซึ่งทำให้กดโดนตัวข้าง ๆ
 */
export const ZOOM_HINT_MAX_SCALE = 2;

/**
 * ควรขึ้นคำเตือนให้ซูมไหม — รวมเงื่อนไขทั้งหมดไว้ที่เดียวเพื่อให้หน้า panel กับหน้าโซน
 * ตัดสินเหมือนกันเป๊ะ (ก่อนหน้านี้หน้าโซนไม่เตือนเลย ทั้งที่ pfd/bleed/hyd/f_ctl ก็มีจุดชิดกัน)
 */
export function needsZoomHint(hotspots: Hotspot[], display: Size, scale: number): boolean {
  if (scale >= ZOOM_HINT_MAX_SCALE || display.height <= 0) return false;
  return shouldHintZoom(hotspots, display, scale);
}

/**
 * ควรบอกผู้ใช้ให้ซูมก่อนไหม — จริงเมื่อเกินครึ่งของ hotspot เล็กกว่านิ้ว
 * ใช้ตัดสินใจแสดง hint ไม่ได้ใช้คำนวณพิกัด
 */
export function shouldHintZoom(hotspots: Hotspot[], display: Size, scale: number): boolean {
  if (hotspots.length === 0) return false;
  const tooSmall = hotspots.filter((hotspot) => {
    const box = hotspotToBox(hotspot, display);
    return box.width * scale < MIN_HIT_TARGET_DP || box.height * scale < MIN_HIT_TARGET_DP;
  });
  return tooSmall.length * 2 > hotspots.length;
}
