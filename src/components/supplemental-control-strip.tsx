import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Control } from '@/lib/types';

type Props = {
  controls: Control[];
  onSelect: (control: Control) => void;
};

export function SupplementalControlStrip({ controls, onSelect }: Props) {
  const theme = useTheme();
  if (controls.length === 0) return null;

  return (
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        <ThemedText type="smallBold" style={styles.heading}>
          ข้อมูลที่ไม่มีตำแหน่งในภาพ
        </ThemedText>
        {controls.map((control) => (
          <Pressable
            key={control.id}
            accessibilityHint={control.hotspotUnavailableReason}
            onPress={() => onSelect(control)}
            style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="small" style={styles.label}>
              {control.name}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  heading: {
    maxWidth: 160,
    textAlignVertical: 'center',
  },
  row: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  button: {
    minHeight: 44,
    minWidth: 88,
    maxWidth: 220,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
