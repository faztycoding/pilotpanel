import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Section } from '@/lib/types';

/**
 * แถบสลับหน้า ECAM ที่อยู่ใต้จอ — เลียนปุ่มเลือกหน้าบนแผง ECAM control panel จริง
 *
 * มีเพื่อให้ผู้ใช้สลับหน้า HYD -> ELEC -> FUEL ได้ทันทีโดยไม่ต้องย้อนกลับไปแผงแล้วหาปุ่มใหม่
 * ซึ่งเป็นเส้นทางที่นักเรียนจะใช้บ่อยที่สุดเวลาทบทวนหลายระบบต่อกัน
 *
 * ชื่อบนปุ่มตัดคำ "(ECAM)" ออก เพราะอยู่ในบริบทหน้า ECAM แล้ว การซ้ำทำให้ปุ่มยาวเกิน
 */

type Props = {
  sections: Section[];
  activeId: string;
  onSelect: (section: Section) => void;
};

export function EcamPageStrip({ sections, activeId, onSelect }: Props) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <Pressable
            key={section.id}
            onPress={() => onSelect(section)}
            disabled={active}
            style={[
              styles.tab,
              { backgroundColor: active ? theme.backgroundSelected : 'transparent' },
            ]}>
            <ThemedText
              type="small"
              style={[styles.label, { color: active ? theme.text : theme.textSecondary }]}>
              {section.name.replace(/\s*\(ECAM\)\s*/i, '')}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    alignItems: 'center',
  },
  tab: {
    // 44dp ขั้นต่ำตาม AGENTS.md — แถบนี้กดด้วยนิ้วเหมือนปุ่มบนแผง
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
