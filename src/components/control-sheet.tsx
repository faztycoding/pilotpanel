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
            <BodyBlocks body={control.body} />
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
