import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ControlSheet } from '@/components/control-sheet';
import { HotspotLayer } from '@/components/hotspot-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { useTheme } from '@/hooks/use-theme';
import { getPanel, getSectionImage, sectionControls } from '@/lib/panels';
import type { Control, Hotspot } from '@/lib/types';

/**
 * ชั้น 3 โหมด image — โซนที่มีรูปของตัวเอง (เช่นหน้า ECAM ของ pedestal)
 * เข้ามาจากการแตะ entry point บนรูป panel หลัก (ดู SectionEntryLayer ใน panel/[id].tsx)
 *
 * hotspot ของ control ในหน้านี้อ้างอิงกับ section.imageSize ไม่ใช่ panel.imageSize
 * ต้องใช้ sectionControls() กรองแยกจาก placedControls() ของ panel/[id].tsx
 */

export default function SectionScreen() {
  const { id, sectionId } = useLocalSearchParams<{ id: string; sectionId: string }>();
  const theme = useTheme();
  const panel = getPanel(id);
  const section = panel?.sections.find((s) => s.id === sectionId);
  const image = panel && section ? getSectionImage(panel.panelId, section.id) : undefined;

  const [scale, setScale] = useState(1);
  const [selected, setSelected] = useState<Control | null>(null);

  const controls = useMemo(
    () => (panel && sectionId ? sectionControls(panel, sectionId) : []),
    [panel, sectionId]
  );

  const handleScaleSettled = useCallback((next: number) => setScale(next), []);
  const handlePress = useCallback((control: Control & { hotspot: Hotspot }) => {
    setSelected(control);
  }, []);
  const handleClose = useCallback(() => setSelected(null), []);

  if (!panel || !section || !section.imageSize || image === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'ไม่พบโซน' }} />
        <ThemedText>ยังไม่มีรูปสำหรับโซน &quot;{sectionId}&quot;</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: section.name }} />

      <ZoomableImage
        source={image}
        imageSize={section.imageSize}
        onScaleSettled={handleScaleSettled}
        renderOverlay={(size) => (
          <HotspotLayer
            panelId={panel.panelId}
            controls={controls}
            display={size}
            scale={scale}
            onPress={handlePress}
          />
        )}
      />

      <ControlSheet control={selected} onClose={handleClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
