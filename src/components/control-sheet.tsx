import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { BodyBlocks } from '@/components/body-blocks';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Control } from '@/lib/types';

/**
 * แผ่นคำอธิบายที่เด้งจากด้านล่าง — ใช้ตัวเดียวตลอด เปลี่ยนแค่ control ที่ส่งเข้ามา
 * แตะ control ใหม่ทับของเดิมได้โดยไม่ต้องปิดก่อน เพราะเป็น instance เดิม
 */

const SNAP_POINTS = ['65%'];

/**
 * เช็คว่า body มีแค่ข้อความ "See image below" (หรือรูปแบบใกล้เคียง) โดยไม่มีเนื้อหาจริง
 *
 * ในเอกสารลูกค้า บาง control อธิบายด้วยรูปแทนข้อความ แล้วเขียน "See image below:" เป็น text
 * แต่ลูกค้าห้ามใส่รูปในกล่องคำอธิบาย (text only) จึงเหลือแค่ประโยคนี้ที่ไร้ความหมาย
 * ถ้าเจอให้ถือว่า body ว่าง แสดงข้อความ "ไม่มีคำอธิบาย" แทน
 */
function isSeeImagePlaceholder(body: Control['body']): boolean {
  if (body.length === 0) return false;
  const text = body
    .map((block) => block.text ?? '')
    .join(' ')
    .trim()
    .toLowerCase();
  // ประโยคที่เอกสารลูกค้าใช้จริง (เจอใน pedestal.json 3 ตัว: cp_rat, cp_apu_indications,
  // cp_spoilers_speed_brakes_indication_2) — เช็ค case-insensitive เผื่อสะกดต่างกัน
  return /^(see\s+image\s+below:?)$/.test(text);
}

type Props = {
  control: Control | null;
  onClose: () => void;
};

export function ControlSheet({ control, onClose }: Props) {
  const sheet = useRef<BottomSheet>(null);
  const theme = useTheme();

  useEffect(() => {
    if (control) {
      sheet.current?.snapToIndex(0);
    } else {
      sheet.current?.close();
    }
  }, [control]);

  return (
    <BottomSheet
      ref={sheet}
      index={-1}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: theme.background }}
      handleIndicatorStyle={{ backgroundColor: theme.textSecondary }}>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {control ? (
          <>
            <ThemedText type="subtitle" style={styles.title}>
              {control.name}
            </ThemedText>
            {control.body.length > 0 && !isSeeImagePlaceholder(control.body) ? (
              <BodyBlocks body={control.body} />
            ) : (
              // เอกสารลูกค้ามีบางรายการที่เป็นหัวข้อกลุ่ม หรืออธิบายด้วยรูปแทนข้อความ
              // (เช่น "(10) YELLOW ELEC PUMP Control" ที่ในไฟล์ต้นฉบับมีแต่รูป)
              // หรือมีแค่ "See image below" ซึ่งไร้ความหมายเพราะไม่โชว์รูป (ลูกค้าห้ามใส่รูปในกล่อง)
              // บอกตรง ๆ ดีกว่าเด้งกล่องเปล่าให้ผู้ใช้เดาว่าแอปพัง — และทำให้เห็นว่าต้องขออะไรเพิ่ม
              <ThemedText style={{ color: theme.textSecondary }}>
                เอกสารต้นฉบับไม่มีคำอธิบายข้อความสำหรับรายการนี้
              </ThemedText>
            )}
          </>
        ) : null}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
  },
});
