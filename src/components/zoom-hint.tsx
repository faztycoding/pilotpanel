import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * ป้ายบอกให้บีบนิ้วซูม — ใช้ทั้งหน้า panel และหน้าโซน (หน้า ECAM / จอ PFD)
 * การตัดสินว่าจะโผล่เมื่อไรอยู่ใน needsZoomHint() ของ lib/layout.ts ไม่ได้อยู่ที่นี่
 *
 * pointerEvents none สำคัญ: ป้ายลอยทับรูป ถ้ารับ touch จะบังปุ่มที่อยู่ใต้มัน
 */

type Props = {
  visible: boolean;
};

export function ZoomHint({ visible }: Props) {
  const theme = useTheme();
  if (!visible) return null;

  return (
    <View style={[styles.hint, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small">บีบนิ้วเพื่อซูมดูปุ่ม</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    position: 'absolute',
    pointerEvents: 'none',
    alignSelf: 'center',
    bottom: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
});
