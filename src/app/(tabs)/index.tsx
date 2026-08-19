import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CockpitBackdrop } from '@/components/cockpit-backdrop';
import { PanelZoneLayer } from '@/components/panel-zone-layer';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { getPanel, getPanelImage, HOME_PANEL_ID, homeZones } from '@/lib/panels';
import type { Control, Hotspot } from '@/lib/types';

/**
 * หน้าแรก — ภาพ cockpit รวม แตะแผงไหนก็เข้าแผงนั้น
 *
 * ใช้ initialZoom="contain" ต่างจากหน้า panel ที่ใช้ "fillScreen" เพราะหน้านี้ต้องเห็น
 * ทุกแผงพร้อมกันเพื่อเลือก ไม่ได้มีไว้อ่านตัวอักษรบนปุ่ม (ยังบีบนิ้วซูมดูใกล้ ๆ ได้)
 *
 * โซนกดเก็บเป็น control ใน data/panels/_home.json ที่มี target ชี้ panelId ปลายทาง
 * ไม่ได้ hardcode ไว้ในหน้านี้ เพราะพิกัดต้องขยับตามรูปที่ลูกค้าอัปเดต
 */

export default function HomeScreen() {
  const router = useRouter();
  const panel = getPanel(HOME_PANEL_ID);
  const image = getPanelImage(HOME_PANEL_ID);

  const [scale, setScale] = useState(1);
  const zones = useMemo(() => (panel ? homeZones(panel) : []), [panel]);

  const handleScaleSettled = useCallback((next: number) => setScale(next), []);
  const handlePress = useCallback(
    (zone: Control & { hotspot: Hotspot; target: string }) => {
      router.push(`/panel/${zone.target}`);
    },
    [router]
  );

  if (!panel || image === undefined) {
    return (
      <SafeAreaView style={styles.screen}>
        <CockpitBackdrop style={styles.centered}>
          <ThemedText>ยังไม่มีภาพห้องนักบินสำหรับหน้าแรก</ThemedText>
        </CockpitBackdrop>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <CockpitBackdrop style={styles.screen}>
        <ZoomableImage
          source={image}
          imageSize={panel.imageSize}
          initialZoom="contain"
          onScaleSettled={handleScaleSettled}
          renderOverlay={(size) => (
            <PanelZoneLayer zones={zones} display={size} scale={scale} onPress={handlePress} />
          )}
        />
      </CockpitBackdrop>
    </SafeAreaView>
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
