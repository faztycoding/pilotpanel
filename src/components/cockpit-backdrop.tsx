import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const NEBULA_BG = require('@/assets/images/cockpit-nebula-bg.webp');

/**
 * พื้นหลังเนบิวลาที่ใช้ร่วมกันทุกหน้า panel/section/home — แทนที่ theme.background
 * สีทึบเดิม ให้เข้าธีม "ห้องนักบิน" มากขึ้น (ลูกค้าขอ)
 *
 * โผล่เฉพาะพื้นที่ที่ไม่มีรูปแผงบัง เช่น letterbox ของหน้า home (initialZoom="contain")
 * แถบบนล่างของ glareshield (ภาพแบน 7.6:1) และขอบรอบกรอบจอ ECAM ในหน้าโซน
 * ไม่กระทบพื้นที่แสดงรูปแผงเอง เพราะรูปแผงวาดทับอยู่ข้างบนเป็นชั้นถัดไปเสมอ
 *
 * ใส่ชั้นทึบแสงบาง ๆ ทับรูปเนบิวลา เพื่อให้ตัวหนังสือ (หน้า error, hint) ยังคงอ่านออก
 * ไม่ว่าจุดนั้นของรูปจะสว่างหรือมืด — ไม่พึ่ง contrast ของรูปดาราศาสตร์ที่ควบคุมไม่ได้
 */

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function CockpitBackdrop({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <Image source={NEBULA_BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
});
