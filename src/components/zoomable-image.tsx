import { Image } from 'expo-image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

import { clamp, fitContain, maxScaleFor, maxTranslate, type Size } from '@/lib/layout';
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
  /** render ทับบนรูป ได้รับขนาดรูปจริงบนจอเพื่อคูณกับ ratio */
  renderOverlay?: (display: Size) => ReactNode;
  /** แจ้งขนาดรูปบนจอหลัง layout ให้หน้าจอด้านนอกใช้ตัดสินใจเรื่อง UI ได้ */
  onDisplayChange?: (display: Size) => void;
  /** แจ้งเมื่อระดับซูมข้ามเกณฑ์ที่ถือว่า "ซูมพอแล้ว" ใช้ตัดสินใจแสดง hint */
  zoomHintThreshold?: number;
  onZoomedEnoughChange?: (zoomedEnough: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export function ZoomableImage({
  source,
  imageSize,
  renderOverlay,
  onDisplayChange,
  zoomHintThreshold = 2,
  onZoomedEnoughChange,
  style,
}: Props) {
  const [container, setContainer] = useState<Size>({ width: 0, height: 0 });

  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
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

  const gesture = useMemo(() => {
    const limitFor = (nextScale: number) => maxTranslate(container, display, nextScale);

    const pinch = Gesture.Pinch()
      .onUpdate((event) => {
        'worklet';
        scale.value = clamp(savedScale.value * event.scale, MIN_SCALE, maxScale);
      })
      .onEnd(() => {
        'worklet';
        savedScale.value = scale.value;
        const limit = limitFor(scale.value);
        translateX.value = clamp(translateX.value, -limit.width, limit.width);
        translateY.value = clamp(translateY.value, -limit.height, limit.height);
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      });

    const pan = Gesture.Pan()
      .onUpdate((event) => {
        'worklet';
        const limit = limitFor(scale.value);
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

    return Gesture.Simultaneous(pinch, pan);
  }, [
    container,
    display,
    maxScale,
    savedScale,
    savedTranslateX,
    savedTranslateY,
    scale,
    translateX,
    translateY,
  ]);

  // ส่งค่าข้าม thread เฉพาะตอน "ข้ามเกณฑ์" ไม่ใช่ทุกเฟรม
  useAnimatedReaction(
    () => scale.value >= zoomHintThreshold,
    (zoomedEnough, previous) => {
      if (previous !== null && zoomedEnough !== previous && onZoomedEnoughChange) {
        runOnJS(onZoomedEnoughChange)(zoomedEnough);
      }
    },
    [zoomHintThreshold, onZoomedEnoughChange]
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
    setContainer({ width, height });
    // จอเปลี่ยนขนาดแล้ว ค่าซูม/เลื่อนเดิมอาจเกินขอบใหม่ กลับไปตั้งต้นเพื่อไม่ให้ค้างนอกกรอบ
    scale.value = withTiming(MIN_SCALE);
    savedScale.value = MIN_SCALE;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      {ready ? (
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={[{ width: display.width, height: display.height }, animatedStyle]}>
            <Image source={source} style={StyleSheet.absoluteFill} contentFit="fill" />
            {renderOverlay?.(display)}
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
