import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { CockpitBackdrop } from '@/components/cockpit-backdrop';
import { ControlSheet } from '@/components/control-sheet';
import { HotspotLayer } from '@/components/hotspot-layer';
import { SectionEntryLayer } from '@/components/section-entry-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomHint } from '@/components/zoom-hint';
import { ZoomableImage } from '@/components/zoomable-image';
import { needsZoomHint, type Size } from '@/lib/layout';
import { getPanel, getPanelImage, hotspotFocus, placedControls } from '@/lib/panels';
import type { Control, Hotspot, Section } from '@/lib/types';

export default function PanelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const panel = getPanel(id);
  const image = panel ? getPanelImage(panel.panelId) : undefined;

  const [scale, setScale] = useState(1);
  const [display, setDisplay] = useState<Size>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<Control | null>(null);

  const controls = useMemo(() => (panel ? placedControls(panel) : []), [panel]);
  // เปิดหน้ามาให้กลุ่มปุ่มจริงอยู่กลางจอ ไม่ใช่กลางรูป (สำคัญกับ glareshield ที่รูปกว้าง 11:1)
  const focus = useMemo(() => (panel ? hotspotFocus(panel) : undefined), [panel]);
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
  const showHint = needsZoomHint(hotspots, display, scale);

  if (!panel || image === undefined) {
    return (
      <CockpitBackdrop style={styles.centered}>
        <Stack.Screen options={{ title: 'ไม่พบแผง' }} />
        <ThemedText>ไม่พบข้อมูลแผง &quot;{id}&quot;</ThemedText>
      </CockpitBackdrop>
    );
  }

  return (
    <CockpitBackdrop style={styles.screen}>
      <Stack.Screen options={{ title: panel.title }} />

      <ZoomableImage
        source={image}
        imageSize={panel.imageSize}
        initialZoom="fillScreen"
        initialFocus={focus}
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

      <ZoomHint visible={showHint} />

      <ControlSheet control={selected} panelId={panel.panelId} onClose={handleClose} />
    </CockpitBackdrop>
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
