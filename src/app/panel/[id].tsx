import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ControlSheet } from '@/components/control-sheet';
import { HotspotLayer } from '@/components/hotspot-layer';
import { SectionEntryLayer } from '@/components/section-entry-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { shouldHintZoom, type Size } from '@/lib/layout';
import { getPanel, getPanelImage, placedControls } from '@/lib/panels';
import type { Control, Hotspot, Section } from '@/lib/types';

const ZOOM_HINT_THRESHOLD = 2;

export default function PanelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const panel = getPanel(id);
  const image = panel ? getPanelImage(panel.panelId) : undefined;

  const [scale, setScale] = useState(1);
  const [display, setDisplay] = useState<Size>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<Control | null>(null);

  const controls = useMemo(() => (panel ? placedControls(panel) : []), [panel]);
  const hotspots = useMemo(() => controls.map((control) => control.hotspot), [controls]);
  // section ที่มีทั้งรูปตัวเองและตำแหน่งเข้าบนรูปหลักแล้ว — ที่เหลือรอวางพิกัด ยังไม่ render
  const sectionEntries = useMemo(
    () =>
      (panel?.sections ?? []).filter(
        (section): section is Section & { entry: Hotspot } =>
          section.entry !== undefined && section.image !== undefined
      ),
    [panel]
  );

  const handleDisplayChange = useCallback((next: Size) => setDisplay(next), []);
  const handleScaleSettled = useCallback((next: number) => setScale(next), []);
  const handlePress = useCallback((control: Control & { hotspot: Hotspot }) => {
    setSelected(control);
  }, []);
  const handleClose = useCallback(() => setSelected(null), []);
  const handleSectionPress = useCallback(
    (section: Section) => {
      if (!panel) return;
      router.push(`/panel/${panel.panelId}/section/${section.id}`);
    },
    [panel, router]
  );

  // เตือนให้ซูมเมื่อยังซูมไม่พอ และ hotspot ส่วนใหญ่เล็กกว่านิ้ว (เคส glareshield 7.6:1)
  const showHint =
    scale < ZOOM_HINT_THRESHOLD &&
    display.height > 0 &&
    shouldHintZoom(hotspots, display, scale);

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
        initialZoom="fillScreen"
        onScaleSettled={handleScaleSettled}
        onDisplayChange={handleDisplayChange}
        renderOverlay={(size) => (
          <>
            <HotspotLayer
              panelId={panel.panelId}
              controls={controls}
              display={size}
              scale={scale}
              onPress={handlePress}
            />
            <SectionEntryLayer
              sections={sectionEntries}
              display={size}
              scale={scale}
              onPress={handleSectionPress}
            />
          </>
        )}
      />

      {showHint ? (
        <View style={[styles.hint, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">บีบนิ้วเพื่อซูมดูปุ่ม</ThemedText>
        </View>
      ) : null}

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
