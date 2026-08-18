import { Pressable, StyleSheet } from 'react-native';

import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import type { Section } from '@/lib/types';

/**
 * จุดแตะบนรูป panel หลักที่พาไปดูรูปของ section เอง (เช่นปุ่มเลือกหน้าจอ ECAM บน pedestal)
 * คนละชั้นกับ HotspotLayer เพราะ target คือ Section ไม่ใช่ Control — กด onPress navigate
 * ไปหน้า section แทนการเปิด bottom sheet คำอธิบาย
 *
 * พิกัด/hitSlop คำนวณแบบเดียวกับ HotspotLayer เป๊ะ (ดู comment ที่นั่น)
 */

type SectionWithEntry = Section & { entry: NonNullable<Section['entry']> };

type Props = {
  sections: SectionWithEntry[];
  display: Size;
  scale: number;
  onPress: (section: SectionWithEntry) => void;
  /** แสดงกรอบให้เห็นตอนพัฒนา */
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
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB300',
    backgroundColor: 'rgba(255, 179, 0, 0.25)',
  },
});
