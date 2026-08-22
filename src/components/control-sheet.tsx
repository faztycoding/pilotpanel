import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BodyBlocks } from '@/components/body-blocks';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Control } from '@/lib/types';

/**
 * แผ่นคำอธิบายที่เด้งจากด้านล่าง — ใช้ตัวเดียวตลอด เปลี่ยนแค่ control ที่ส่งเข้ามา
 * แตะ control ใหม่ทับของเดิมได้โดยไม่ต้องปิดก่อน เพราะเป็น instance เดิม
 *
 * snap point คำนวณแบบ dynamic: 65% ของจอ แต่ไม่เกิน 480dp
 * บนมือถือ (Poco X7 จอสูง 444dp) 65% = 288dp พอดี
 * บนแท็บเล็ต (Tab S9 FE+ จอสูง 1067dp) 65% = 693dp สูงเกินจนเหลือที่ว่างเยอะ
 * จึง cap ที่ 480dp — กล่องยังอ่านสบาย ไม่บังรูปแผงจนมืดทั้งจอ
 */

const SHEET_MAX_DP = 480;

type Props = {
  control: Control | null;
  /** panelId ของ control — ส่งต่อให้ BodyBlocks เพื่อค้นรูปประกอบ (BODY_IMAGES) */
  panelId?: string;
  onClose: () => void;
};

export function ControlSheet({ control, panelId, onClose }: Props) {
  const sheet = useRef<BottomSheet>(null);
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    const target = Math.min(windowHeight * 0.65, SHEET_MAX_DP);
    // @gorhom/bottom-sheet รับค่าเป็น string เช่น '65%' หรือ number เป็น dp
    return [target];
  }, [windowHeight]);

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
      snapPoints={snapPoints}
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
            {control.hotspotUnavailableReason ? (
              <View style={[styles.emptyBody, { backgroundColor: theme.noteBackground }]}>
                <ThemedText type="small" themeColor="note">
                  รายการนี้ไม่มีตำแหน่งบนภาพ: {control.hotspotUnavailableReason}
                </ThemedText>
              </View>
            ) : null}
            {control.body.length > 0 ? (
              <BodyBlocks body={control.body} panelId={panelId ?? ''} controlId={control.id} />
            ) : (
              // เอกสารลูกค้ามีบางรายการที่เป็นหัวข้อกลุ่ม หรืออธิบายด้วยรูปแทนข้อความ
              // (เช่น "(10) YELLOW ELEC PUMP Control" ที่ในไฟล์ต้นฉบับมีแต่รูป)
              // บอกตรง ๆ ดีกว่าเด้งกล่องเปล่าให้ผู้ใช้เดาว่าแอปพัง — และทำให้เห็นว่าต้องขออะไรเพิ่ม
              <View
                style={[
                  styles.emptyBody,
                  {
                    backgroundColor: control.bodyUnavailableReason
                      ? theme.noteBackground
                      : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  type="smallBold"
                  themeColor={control.bodyUnavailableReason ? 'note' : undefined}>
                  {control.bodyUnavailableReason
                    ? 'ไม่มีคำอธิบายในเอกสารต้นฉบับ'
                    : 'ยังไม่มีคำอธิบาย'}
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{
                    color: control.bodyUnavailableReason ? theme.note : theme.textSecondary,
                  }}>
                  {control.bodyUnavailableReason ??
                    'เอกสารต้นฉบับไม่มีคำอธิบายข้อความสำหรับรายการนี้'}
                </ThemedText>
              </View>
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
  emptyBody: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
});
