import { StyleSheet, View } from 'react-native';

import { hotspotToBox, type Size } from '@/lib/layout';
import type { Control, Hotspot } from '@/lib/types';

/**
 * กล่อง hotspot วางทับรูป — พิกัดเป็น ratio คูณกับขนาดรูปบนจอเท่านั้น
 *
 * component นี้ต้องเป็นลูกของ Animated.View ที่ถือ transform ของรูป
 * จะได้ขยับ/ขยายตามรูปเองโดยไม่ต้องรู้เรื่อง scale หรือ translate
 *
 * ยังไม่รับ tap ในขั้นนี้ (ทำใน T1 ขั้นถัดไป) ตอนนี้แสดงกรอบเพื่อตรวจว่าพิกัดตรงปุ่มจริง
 */

type Props = {
  controls: (Control & { hotspot: Hotspot })[];
  display: Size;
  /** แสดงกรอบให้เห็นตอนพัฒนา ปิดได้เมื่อไม่ต้องตรวจพิกัด */
  debug?: boolean;
};

export function HotspotLayer({ controls, display, debug = false }: Props) {
  return (
    <>
      {controls.map((control) => {
        const box = hotspotToBox(control.hotspot, display);
        return (
          <View
            key={control.id}
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
    // ยังไม่รับ tap ในขั้นนี้ — เปิดเป็น Pressable ตอนทำ tap logic
    pointerEvents: 'none',
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
});
