import { Pressable, StyleSheet } from 'react-native';

import { HotspotIndicator, NoWebFocusOutline } from '@/constants/theme';
import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import type { Section } from '@/lib/types';

/**
 * จุดแตะบนรูป panel หลักที่พาไปดูรูปของ section เอง (เช่นปุ่มเลือกหน้าจอ ECAM บน pedestal)
 * คนละชั้นกับ HotspotLayer เพราะ target คือ Section ไม่ใช่ Control — กด onPress navigate
 * ไปหน้า section แทนการเปิด bottom sheet คำอธิบาย
 *
 * พิกัด/hitSlop คำนวณแบบเดียวกับ HotspotLayer เป๊ะ ใช้ Pressable ของ react-native ตามเหตุผล
 * เดียวกัน (ดู comment ยาวใน hotspot-layer.tsx): เคยลองสลับไปใช้ Pressable ของ
 * react-native-gesture-handler เพื่อกันปุ่มแย่งตอนลากผ่าน แต่ทำให้กดปุ่มไม่ติดเลยทั้งแผง
 *
 * แสดงกรอบเส้นประ (HotspotIndicator) ตลอดเวลาเหมือน HotspotLayer — ปุ่มเข้าโซน ECAM ก็เป็น
 * ภาพนิ่งบนรูปแผงเหมือนกัน ไม่มี affordance ของตัวเอง
 */

type SectionWithEntry = Section & { entry: NonNullable<Section['entry']> };

type Props = {
  sections: SectionWithEntry[];
  display: Size;
  scale: number;
  onPress: (section: SectionWithEntry) => void;
  /** เพิ่มไฮไลต์สีสดตอนพัฒนา (เข้มกว่า HotspotIndicator ที่โชว์ผู้ใช้จริงตลอดเวลา) */
  debug?: boolean;
};

export function SectionEntryLayer({ sections, display, scale, onPress, debug = false }: Props) {
  return (
    <>
      {sections.map((section) => {
        const box = hotspotToBox(section.entry, display);
        const slop = hitSlopFor(box, scale);
        return (
          <Pressable
            key={section.id}
            onPress={() => onPress(section)}
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
    ...HotspotIndicator,
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB300',
    backgroundColor: 'rgba(255, 179, 0, 0.25)',
  },
});
