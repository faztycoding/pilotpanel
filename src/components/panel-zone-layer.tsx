import { Pressable, StyleSheet } from 'react-native';

import { NoWebFocusOutline } from '@/constants/theme';
import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import type { Control, Hotspot } from '@/lib/types';

/**
 * โซนกดบนภาพ cockpit รวมของหน้าแรก — แตะแล้วไปหน้าแผงนั้น
 *
 * คนละชั้นกับ HotspotLayer เพราะปลายทางคือการ navigate ไม่ใช่เปิดกล่องคำอธิบาย
 * และคนละชั้นกับ SectionEntryLayer เพราะต้นทางเป็น Control (มี target) ไม่ใช่ Section
 *
 * พิกัด/hitSlop คำนวณด้วยฟังก์ชันชุดเดียวกับสองชั้นนั้น เพื่อให้พฤติกรรมการกดเหมือนกันหมด
 */

/** โซนต้องมีทั้งพิกัดและปลายทาง — homeZones() ใน lib/panels.ts การันตีให้แล้ว */
type ZoneControl = Control & { hotspot: Hotspot; target: string };

type Props = {
  zones: ZoneControl[];
  display: Size;
  scale: number;
  onPress: (zone: ZoneControl) => void;
  /** วาดกรอบให้เห็นตอนพัฒนา */
  debug?: boolean;
};

export function PanelZoneLayer({ zones, display, scale, onPress, debug = false }: Props) {
  return (
    <>
      {zones.map((zone) => {
        const box = hotspotToBox(zone.hotspot, display);
        const slop = hitSlopFor(box, scale);
        return (
          <Pressable
            key={zone.id}
            accessibilityRole="button"
            accessibilityLabel={zone.name}
            onPress={() => onPress(zone)}
            hitSlop={{
              left: slop.horizontal / scale,
              right: slop.horizontal / scale,
              top: slop.vertical / scale,
              bottom: slop.vertical / scale,
            }}
            style={({ pressed }) => [
              styles.zone,
              debug && styles.debug,
              // ตอบสนองตอนกดค้าง เพราะภาพ cockpit ไม่มีอะไรบอกว่าโซนไหนกดได้
              pressed && styles.pressed,
              { left: box.left, top: box.top, width: box.width, height: box.height },
            ]}
          />
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  zone: {
    position: 'absolute',
    ...NoWebFocusOutline,
  },
  pressed: {
    backgroundColor: 'rgba(120, 200, 255, 0.28)',
    borderColor: 'rgba(180, 225, 255, 0.9)',
    borderWidth: 2,
    borderRadius: 4,
  },
  debug: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#4FC3F7',
    backgroundColor: 'rgba(79, 195, 247, 0.2)',
  },
});
