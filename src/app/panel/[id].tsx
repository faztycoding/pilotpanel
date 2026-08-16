import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { HotspotLayer } from '@/components/hotspot-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shouldHintZoom, type Size } from '@/lib/layout';
import { getPanel, getPanelImage, placedControls } from '@/lib/panels';

const ZOOM_HINT_THRESHOLD = 2;

export default function PanelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const panel = getPanel(id);
  const image = panel ? getPanelImage(panel.panelId) : undefined;

  const [zoomedEnough, setZoomedEnough] = useState(false);
  const [display, setDisplay] = useState<Size>({ width: 0, height: 0 });

  const controls = useMemo(() => (panel ? placedControls(panel) : []), [panel]);
  const handleZoomedEnoughChange = useCallback((next: boolean) => setZoomedEnough(next), []);
  const handleDisplayChange = useCallback((next: Size) => setDisplay(next), []);

  // เตือนให้ซูมเมื่อยังซูมไม่พอ และ hotspot ส่วนใหญ่เล็กกว่านิ้ว (เคส glareshield 7.6:1)
  const showHint =
    !zoomedEnough &&
    display.height > 0 &&
    shouldHintZoom(
      controls.map((control) => control.hotspot),
      display,
      1
    );

  if (!panel || image === undefined) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'ไม่พบแผง' }} />
        <ThemedText>ไม่พบข้อมูลแผง &quot;{id}&quot;</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: panel.title }} />

      <ZoomableImage
        source={image}
        imageSize={panel.imageSize}
        zoomHintThreshold={ZOOM_HINT_THRESHOLD}
        onZoomedEnoughChange={handleZoomedEnoughChange}
        onDisplayChange={handleDisplayChange}
        renderOverlay={(size) => <HotspotLayer controls={controls} display={size} debug />}
      />

      {showHint ? (
        <View style={[styles.hint, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">บีบนิ้วเพื่อซูมดูปุ่ม</ThemedText>
        </View>
      ) : null}
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
