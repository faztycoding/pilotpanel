import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getBodyImage } from '@/lib/panels';
import type { BodyBlock } from '@/lib/types';

/**
 * render เนื้อหาคำอธิบายของ control ตาม kind
 *
 * ข้อความทุกตัวอักษรมาจากเอกสารลูกค้า ห้ามแต่ง ห้ามย่อ ห้ามแปล — render ตรงตัวเท่านั้น
 * รูป (kind: 'image') มาจากเอกสารลูกค้าเช่นกัน ดึงจาก .docx ด้วย scripts/extract-body-images.py
 * ใช้ตอนเอกสารอธิบายด้วยรูปแทนข้อความ (เช่น "See image below" ใน ECAM HYD/FUEL/F-CTL)
 */

type Props = {
  body: BodyBlock[];
  /** panelId ของ control เจ้าของ body — ใช้ค้นรูปประกอบจาก BODY_IMAGES */
  panelId: string;
  /** controlId ของ control เจ้าของ body — คู่กับ panelId เป็น key ของรูป */
  controlId: string;
};

export function BodyBlocks({ body, panelId, controlId }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {body.map((block, index) => {
        const key = `${block.kind}-${index}`;

        if (block.kind === 'image') {
          const source = getBodyImage(panelId, controlId);
          if (source === undefined) return null;
          return (
            <View key={key} style={styles.imageContainer}>
              <Image
                source={source}
                style={styles.image}
                contentFit="contain"
                allowDownscaling={false}
                accessibilityLabel={block.text || undefined}
              />
              {block.text ? (
                <ThemedText type="small" style={styles.caption} themeColor="textSecondary">
                  {block.text}
                </ThemedText>
              ) : null}
            </View>
          );
        }

        if (block.kind === 'bullet') {
          return (
            <View key={key} style={styles.bulletRow}>
              <ThemedText style={styles.bulletDot} themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText style={styles.bulletText}>
                {block.label ? <ThemedText type="smallBold">{block.label} </ThemedText> : null}
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
  imageContainer: {
    gap: Spacing.one,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: Spacing.one,
  },
  caption: {
    textAlign: 'center',
  },
});
