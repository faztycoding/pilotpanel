import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  clamp,
  fillScreenScale,
  fitContain,
  focusTranslate,
  maxScaleFor,
  maxTranslate,
  type Size
} from '@/lib/layout';
import type { ImageSize, PanelImage } from '@/lib/types';

/**
 * รูป panel ที่ซูม/แพนได้ พร้อมชั้น overlay ที่ขยับตามรูปเอง
 *
 * หัวใจของ component นี้: overlay ถูก render เป็น "ลูก" ของ Animated.View ตัวเดียวกับรูป
 * transform จึงถูกใส่ให้โดย RN ทั้งก้อน ทำให้พิกัด hotspot ไม่ต้องคูณ scale หรือบวก translate
 * ในโค้ดเลย — ตัดโอกาสพิกัดเพี้ยนออกไปทั้งหมด
 */

const MIN_SCALE = 1;

type Props = {
  source: PanelImage;
  imageSize: ImageSize;
  /**
   * ซูมตั้งต้นตอนเปิดหน้า
   *   'contain'    = เห็นรูปทั้งใบพอดีจอ (letterbox) เหมาะกับหน้าภาพรวม
   *   'fillScreen' = เต็มจอแบบ cover โผล่กลางรูป ล้นแกนไหนก็เลื่อนแกนนั้น
   *                  เหมาะกับหน้า panel ที่ต้องอ่านตัวอักษรบนปุ่มให้ออกตั้งแต่เปิดมา
   */
  initialZoom?: 'contain' | 'fillScreen';
  /**
   * จุดที่ต้องการให้อยู่กลางจอตอนเปิดหน้า (ratio 0..1 บนรูป) — ไม่ใส่ = กลางรูป
   * ใช้กับ glareshield ที่ปุ่มจริงกระจุกอยู่แค่ 31% ของรูป (ดู focusTranslate ใน lib/layout.ts)
   */
  initialFocus?: { x: number; y: number };
  /**
   * render ทับบนรูป ได้รับขนาดรูปจริงบนจอเพื่อคูณกับ ratio
   *
   * panGesture ส่งออกมาด้วยเพื่อให้ปุ่มที่วางทับ (HotspotLayer / SectionEntryLayer /
   * PanelZoneLayer) ประกาศ requireExternalGestureToFail={panGesture} ได้ — ถ้าไม่ประกาศ
   * นิ้วที่กำลังลากผ่านปุ่มจะโดน Pressable ของ react-native เองแย่ง responder ไปก่อน
   * (คนละระบบกับ react-native-gesture-handler) ทำให้ลากค้างตรงปุ่มแทนที่จะไหลต่อ
   */
  renderOverlay?: (display: Size, panGesture: GestureType) => ReactNode;
  /** แจ้งขนาดรูปบนจอหลัง layout ให้หน้าจอด้านนอกใช้ตัดสินใจเรื่อง UI ได้ */
  onDisplayChange?: (display: Size) => void;
  /**
   * แจ้ง scale ตอน "นิ่งแล้ว" (ปล่อยนิ้ว) ไม่ใช่ทุกเฟรม
   * ใช้คำนวณ hitSlop กับตัดสินใจแสดง hint — ระหว่างบีบนิ้วไม่มีใครแตะปุ่ม ค่าค้างจึงไม่เป็นปัญหา
   */
  onScaleSettled?: (scale: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function ZoomableImage({
  source,
  imageSize,
  initialZoom = 'contain',
  initialFocus,
  renderOverlay,
  onDisplayChange,
  onScaleSettled,
  style,
}: Props) {
  const [container, setContainer] = useState<Size>({ width: 0, height: 0 });

  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  // scale ที่นิ่งแล้ว ใช้ส่งขึ้น JS thread — แยกจาก scale ที่วิ่งทุกเฟรม
  const settledScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // ขนาดรูปบนจอ มาจาก onLayout ของ container เท่านั้น ไม่ใช่จาก imageSize ใน JSON
  const display = useMemo(() => fitContain(container, imageSize), [container, imageSize]);
  const maxScale = useMemo(() => maxScaleFor(container, display), [container, display]);
  const ready = display.width > 0 && display.height > 0;

  useEffect(() => {
    if (ready) onDisplayChange?.(display);
  }, [display, onDisplayChange, ready]);

  // pan แยกออกมาจาก gesture ที่ประกอบแล้ว เพราะ Pressable ที่วางทับ (ดู HotspotLayer)
  // ต้องอ้าง requireExternalGestureToFail กับ "ตัว Pan เดี่ยว ๆ" เท่านั้น — Simultaneous(pinch, pan)
  // เป็นชนิด ComposedGesture ซึ่งไม่อยู่ใน union ของ GestureType จึงส่งเข้า relation prop ไม่ได้
  const { gesture, pan } = useMemo(() => {
    // ห้ามสร้าง closure ธรรมดามาเรียกใน worklet — เรียก maxTranslate ตรง ๆ เท่านั้น
    // (ตัวมันมี 'worklet' แล้ว) ไม่งั้น crash ระดับ native ตอนแตะครั้งแรก
    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        'worklet';
        scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, maxScale);
      })
      .onEnd(() => {
        'worklet';
        savedScale.value = scale.value;
        settledScale.value = scale.value;
        const limit = maxTranslate(container, display, scale.value);
        translateX.value = clamp(translateX.value, -limit.width, limit.width);
        translateY.value = clamp(translateY.value, -limit.height, limit.height);
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    const pan = Gesture.Pan()
      .onUpdate((event) => {
        'worklet';
        const limit = maxTranslate(container, display, scale.value);
        translateX.value = clamp(
          savedTranslateX.value + event.translationX,
          -limit.width,
          limit.width
        );
        translateY.value = clamp(
          savedTranslateY.value + event.translationY,
          -limit.height,
          limit.height
        );
      })
      .onEnd(() => {
        'worklet';
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    return { gesture: Gesture.Simultaneous(pinch, pan), pan };
  }, [
    container,
    display,
    maxScale,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    settledScale,
    translateX,
    translateY,
  ]);

  // ส่งค่าข้าม thread เฉพาะตอนซูมนิ่งแล้ว ไม่ใช่ทุกเฟรม
  useAnimatedReaction(
    () => settledScale.value,
    (next, previous) => {
      if (previous !== null && next !== previous && onScaleSettled) {
        runOnJS(onScaleSettled)(next);
      }
    },
    [onScaleSettled]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    if (width === container.width && height === container.height) return;
    const nextContainer = { width, height };
    setContainer(nextContainer);
    // ต้องคำนวณจาก container ใหม่ตรงนี้ ไม่ใช่จาก display ใน useMemo ซึ่งยังเป็นค่าของรอบก่อน
    const nextDisplay = fitContain(nextContainer, imageSize);
    const initialScale =
      initialZoom === 'fillScreen' ? fillScreenScale(nextContainer, nextDisplay) : MIN_SCALE;
    const start = initialFocus
      ? focusTranslate(nextContainer, nextDisplay, initialScale, initialFocus)
      : { width: 0, height: 0 };
    // จอเปลี่ยนขนาดแล้ว ค่าซูม/เลื่อนเดิมอาจเกินขอบใหม่ กลับไปตั้งต้นเพื่อไม่ให้ค้างนอกกรอบ
    scale.value = withTiming(initialScale);
    savedScale.value = initialScale;
    settledScale.value = initialScale;
    translateX.value = withTiming(start.width);
    translateY.value = withTiming(start.height);
    savedTranslateX.value = start.width;
    savedTranslateY.value = start.height;
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {ready ? (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[{ width: display.width, height: display.height }, animatedStyle]}>
            <Image
              source={source}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
              // เว็บ: <img> มี native drag-to-select เปิดโดย default ถ้าไม่ปิดไว้
              // มันจะแย่ง pointer capture จาก Pan gesture ทำให้เลื่อนซ้ายขวาไม่ได้เลย
              // (ทดสอบแล้ว: ปิดเฉพาะจุดนี้พอ ไม่กระทบ native ที่ไม่มีพฤติกรรมนี้อยู่แล้ว)
              draggable={false}
            />
            {renderOverlay?.(display, pan)}
          </Animated.View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
