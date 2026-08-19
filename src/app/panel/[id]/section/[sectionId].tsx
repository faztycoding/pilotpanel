import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CockpitBackdrop } from '@/components/cockpit-backdrop';
import { ControlSheet } from '@/components/control-sheet';
import { EcamPageStrip } from '@/components/ecam-page-strip';
import { HotspotLayer } from '@/components/hotspot-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomHint } from '@/components/zoom-hint';
import { ZoomableImage } from '@/components/zoomable-image';
import { Spacing } from '@/constants/theme';
import { needsZoomHint, type Size } from '@/lib/layout';
import { getPanel, getSectionImage, sectionControls, selectableSections } from '@/lib/panels';
import type { Control, Hotspot, Section } from '@/lib/types';

/**
 * ชั้น 3 โหมด image — โซนที่มีรูปของตัวเอง (หน้า ECAM ของ pedestal)
 * เข้ามาจากการแตะปุ่มเลือกหน้าบนรูป panel (ดู SectionEntryLayer ใน panel/[id].tsx)
 *
 * hotspot ของ control ในหน้านี้อ้างอิงกับ section.imageSize ไม่ใช่ panel.imageSize
 * ต้องใช้ sectionControls() กรองแยกจาก placedControls() ของ panel/[id].tsx
 *
 * หน้านี้จัดเป็น "จอ" ไม่ใช่รูปลอย ๆ: วางรูปในกรอบสีเข้มเลียนขอบจอ DU จริง แล้วมีแถบ
 * ปุ่มเลือกหน้าอยู่ใต้จอเหมือนบนแผง ECAM control panel — สลับหน้าได้ทันทีโดยไม่ต้องย้อนกลับ
 */

export default function SectionScreen() {
  const { id, sectionId } = useLocalSearchParams<{ id: string; sectionId: string }>();
  const router = useRouter();
  const panel = getPanel(id);
  const section = panel?.sections.find((s) => s.id === sectionId);
  const image = panel && section ? getSectionImage(panel.panelId, section.id) : undefined;

  const [scale, setScale] = useState(1);
  const [display, setDisplay] = useState<Size>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<Control | null>(null);

  const controls = useMemo(
    () => (panel && sectionId ? sectionControls(panel, sectionId) : []),
    [panel, sectionId]
  );
  const pages = useMemo(() => (panel ? selectableSections(panel) : []), [panel]);

  const handleScaleSettled = useCallback((next: number) => setScale(next), []);
  const handleDisplayChange = useCallback((next: Size) => setDisplay(next), []);
  const handlePress = useCallback((control: Control & { hotspot: Hotspot }) => {
    setSelected(control);
  }, []);
  const handleClose = useCallback(() => setSelected(null), []);
  const handleSelectPage = useCallback(
    (next: Section) => {
      if (!panel) return;
      // replace ไม่ใช่ push เพราะการสลับหน้า ECAM ไม่ควรทับ stack ให้ผู้ใช้ต้องกดย้อนหลายครั้ง
      router.replace(`/panel/${panel.panelId}/section/${next.id}`);
    },
    [panel, router]
  );

  if (!panel || !section || !section.imageSize || image === undefined) {
    return (
      <SafeAreaView style={styles.screen}>
        <CockpitBackdrop style={styles.centered}>
          <Stack.Screen options={{ title: 'ไม่พบโซน' }} />
          <ThemedText>ยังไม่มีรูปสำหรับโซน &quot;{sectionId}&quot;</ThemedText>
        </CockpitBackdrop>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <CockpitBackdrop style={styles.screen}>
        <Stack.Screen options={{ title: section.name }} />

      <View style={styles.bezel}>
        <ZoomableImage
          source={image}
          imageSize={section.imageSize}
          onScaleSettled={handleScaleSettled}
          onDisplayChange={handleDisplayChange}
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
        <ZoomHint
          visible={needsZoomHint(
            controls.map((control) => control.hotspot),
            display,
            scale
          )}
        />
      </View>

      {pages.length > 1 ? (
        <EcamPageStrip sections={pages} activeId={section.id} onSelect={handleSelectPage} />
      ) : null}

      <ControlSheet control={selected} panelId={panel.panelId} onClose={handleClose} />
      </CockpitBackdrop>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  /** ขอบจอ DU — สีเข้มคงที่ทั้งสองธีม เพราะจอ ECAM จริงมีขอบดำเสมอ ไม่ตามธีมของแอป
   *
   * margin ใช้ Spacing.one (4dp) แทน two (8dp) เพื่อใช้พื้นที่จอให้คุ้ม
   * สำคัญบน Poco X7 (จอสูง 444dp) ที่ 8dp×2 + border 2px = 18dp เปลืองไป 4% ของจอ
   * บน Tab S9 FE+ (จอสูง 1067dp) ผลกระทบน้อย แต่ลดได้ก็ดี */
  bezel: {
    flex: 1,
    backgroundColor: '#0B0D12',
    borderWidth: 2,
    borderColor: '#2A2F3A',
    borderRadius: Spacing.one,
    margin: Spacing.one,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
