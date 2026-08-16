import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BodyBlock } from '@/lib/types';

/**
 * render เนื้อหาคำอธิบายของ control ตาม kind
 *
 * ข้อความทุกตัวอักษรมาจากเอกสารลูกค้า ห้ามแต่ง ห้ามย่อ ห้ามแปล — render ตรงตัวเท่านั้น
 */

type Props = {
  body: BodyBlock[];
};

export function BodyBlocks({ body }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {body.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === 'bullet') {
          return (
            <View key={key} style={styles.bulletRow}>
              <ThemedText style={styles.bulletDot} themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText style={styles.bulletText}>
                {block.label ? (
                  <ThemedText type="smallBold">{block.label} </ThemedText>
                ) : null}
                {block.text}
              </ThemedText>
            </View>
          );
        }

        if (block.kind === 'note' || block.kind === 'warning') {
          const isWarning = block.kind === 'warning';
          return (
            <View
              key={key}
              style={[
                styles.callout,
                {
                  backgroundColor: isWarning ? theme.warningBackground : theme.noteBackground,
                  borderLeftColor: isWarning ? theme.warning : theme.note,
                },
              ]}>
              <ThemedText themeColor={isWarning ? 'warning' : 'note'}>{block.text}</ThemedText>
            </View>
          );
        }

        return <ThemedText key={key}>{block.text}</ThemedText>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletDot: {
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
  },
  callout: {
    borderLeftWidth: 3,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
});
