import { Pressable, StyleSheet } from 'react-native';

import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import type { Control, Hotspot } from '@/lib/types';

/**
 * ปุ่มที่วางทับรูป — พิกัดเป็น ratio คูณกับขนาดรูปบนจอเท่านั้น
 *
 * component นี้ต้องเป็นลูกของ Animated.View ที่ถือ transform ของรูป
 * RN จะใส่ transform เดียวกันให้ทั้ง hit area ด้วย ปุ่มจึงขยับ/ขยายตามรูปเอง
 * ไม่ต้องคำนวณ inverse transform ตอนแตะ = ไม่มีทางที่พิกัดกดจะเพี้ยนจากพิกัดที่เห็น
 */

type PlacedControl = Control & { hotspot: Hotspot };

type Props = {
  controls: PlacedControl[];
  display: Size;
  /** scale ปัจจุบัน ใช้ขยาย hitSlop ตอนกล่องเล็กกว่านิ้ว */
  scale: number;
  onPress: (control: PlacedControl) => void;
  /** แสดงกรอบให้เห็นตอนพัฒนา */
  debug?: boolean;
};

export function HotspotLayer({ controls, display, scale, onPress, debug = false }: Props) {
  return (
    <>
      {controls.map((control) => {
        const box = hotspotToBox(control.hotspot, display);
        const slop = hitSlopFor(box, scale);
        return (
          <Pressable
            key={control.id}
            onPress={() => onPress(control)}
            // hitSlop หน่วย dp เป็นค่าของนิ้วมนุษย์ ไม่ใช่ค่าของรูป จึงไม่ขัดกฎห้าม px ในการคำนวณพิกัด
            // หารด้วย scale เพราะ hitSlop ถูกขยายด้วย transform ของ parent ไปแล้ว
            hitSlop={{
              left: slop.horizontal / scale,
              right: slop.horizontal / scale,
              top: slop.vertical / scale,
              bottom: slop.vertical / scale,
            }}
            style={[
              styles.hotspot,
              debug && styles.debug,
              { left: box.left, top: box.top, width: box.width, height: box.height },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  hotspot: {
    position: 'absolute',
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
});
