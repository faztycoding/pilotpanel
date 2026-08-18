import { Image } from 'expo-image';
import { Pressable, StyleSheet } from 'react-native';

import { hitSlopFor, hotspotToBox, type Size } from '@/lib/layout';
import { getDetailImage } from '@/lib/panels';
import type { Control, Hotspot } from '@/lib/types';

/**
 * ปุ่มที่วางทับรูป — พิกัดเป็น ratio คูณกับขนาดรูปบนจอเท่านั้น
 *
 * component นี้ต้องเป็นลูกของ Animated.View ที่ถือ transform ของรูป
 * RN จะใส่ transform เดียวกันให้ทั้ง hit area ด้วย ปุ่มจึงขยับ/ขยายตามรูปเอง
 * ไม่ต้องคำนวณ inverse transform ตอนแตะ = ไม่มีทางที่พิกัดกดจะเพี้ยนจากพิกัดที่เห็น
 *
 * ถ้า control มี detailImage จะวาดรูปโคลสอัพจริง (จาก docx) ทับพื้นที่ hotspot ก่อน
 * เพราะรูปแผงเต็มความละเอียดต่ำเกินกว่าจะอ่านรายละเอียดปุ่มออกตอนซูม — คนละที่กับรูปใน
 * bottom sheet ซึ่งลูกค้าห้ามใส่รูปประกอบ อันนี้คือตัวปุ่มบนรูปแผงเอง ไม่ใช่กล่องคำอธิบาย
 */

type PlacedControl = Control & { hotspot: Hotspot };

type Props = {
  panelId: string;
  controls: PlacedControl[];
  display: Size;
  /** scale ปัจจุบัน ใช้ขยาย hitSlop ตอนกล่องเล็กกว่านิ้ว */
  scale: number;
  onPress: (control: PlacedControl) => void;
  /** แสดงกรอบให้เห็นตอนพัฒนา */
  debug?: boolean;
};

export function HotspotLayer({ panelId, controls, display, scale, onPress, debug = false }: Props) {
  return (
    <>
      {controls.map((control) => {
        const box = hotspotToBox(control.hotspot, display);
        const slop = hitSlopFor(box, scale);
        const detailImage = getDetailImage(panelId, control.id);
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
            ]}>
            {detailImage ? (
              // allowDownscaling={false} จำเป็น: default เป็น true = expo-image decode รูปเท่าขนาด
              // layout ของกล่องนี้ (เล็กระดับสิบ dp) การซูมเป็น transform ของ parent ไม่เปลี่ยนขนาด
              // layout ให้ รูปจึงถูกขยายจากตัวที่ย่อแล้ว = เบลอตอนซูม ซึ่งคือตอนที่ต้องการความชัดสุด
              // (contentFit="fill" ไม่โดนปัญหานี้ แต่ตรงนี้ต้องใช้ cover เพื่อไม่ให้รูปปุ่มยืดผิดสัดส่วน)
              <Image
                source={detailImage}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                allowDownscaling={false}
              />
            ) : null}
          </Pressable>
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
