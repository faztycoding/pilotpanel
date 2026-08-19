import { StyleSheet } from 'react-native';
import { Pressable, type GestureType } from 'react-native-gesture-handler';

import { NoWebFocusOutline } from '@/constants/theme';
import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import type { Section } from '@/lib/types';

/**
 * จุดแตะบนรูป panel หลักที่พาไปดูรูปของ section เอง (เช่นปุ่มเลือกหน้าจอ ECAM บน pedestal)
 * คนละชั้นกับ HotspotLayer เพราะ target คือ Section ไม่ใช่ Control — กด onPress navigate
 * ไปหน้า section แทนการเปิด bottom sheet คำอธิบาย
 *
 * พิกัด/hitSlop คำนวณแบบเดียวกับ HotspotLayer เป๊ะ (ดู comment ที่นั่น)
 * ใช้ Pressable จาก react-native-gesture-handler + requireExternalGestureToFail
 * ด้วยเหตุผลเดียวกัน: กันปุ่มแย่ง responder ตอนนิ้วกำลังลากผ่าน (ดู comment ใน hotspot-layer.tsx)
 */

type SectionWithEntry = Section & { entry: NonNullable<Section['entry']> };

type Props = {
  sections: SectionWithEntry[];
  display: Size;
  scale: number;
  /** gesture การเลื่อน/ซูมของรูปแม่ — ให้ปุ่มยอมแพ้ก่อนถ้านิ้วกำลังลากอยู่จริง */
  panGesture: GestureType;
  onPress: (section: SectionWithEntry) => void;
  /** แสดงกรอบให้เห็นตอนพัฒนา */
  debug?: boolean;
};

export function SectionEntryLayer({
  sections,
  display,
  scale,
  panGesture,
  onPress,
  debug = false,
}: Props) {
  return (
    <>
      {sections.map((section) => {
        const box = hotspotToBox(section.entry, display);
        const slop = hitSlopFor(box, scale);
        return (
          <Pressable
            key={section.id}
            onPress={() => onPress(section)}
            simultaneousWithExternalGesture={panGesture}
            hitSlop={{
              left: slop.horizontal / scale,
              right: slop.horizontal / scale,
              top: slop.vertical / scale,
              bottom: slop.vertical / scale,
            }}
            style={[
              styles.entry,
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
  entry: {
    position: 'absolute',
    ...NoWebFocusOutline,
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB300',
    backgroundColor: 'rgba(255, 179, 0, 0.25)',
  },
});
