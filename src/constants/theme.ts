/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    note: '#8F6424',
    noteBackground: '#FBF3E2',
    warning: '#C62A2F',
    warningBackground: '#FDF0EF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    note: '#F0C000',
    noteBackground: '#2C2210',
    warning: '#FF9592',
    warningBackground: '#331416',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * ปิด focus outline (เส้นประ) ที่เบราว์เซอร์ใส่ให้ Pressable โดย default บนเว็บ
 * เจอตอนลากผ่าน hotspot บนพรีวิวเว็บ: เมาส์กด/ลากทำให้ element ได้ focus แล้วเบราว์เซอร์
 * วาดกรอบ dashed ทับ ทั้งที่ debug={false} — ไม่เกี่ยวกับ react-native เพราะ Android ไม่มี
 * concept นี้ ใช้ Platform.select กันไม่ให้ query prop แปลกไปโผล่ใน style ของ native
 */
// 'none' เป็นค่าที่ react-native-web รองรับจริง แต่ @types/react-native ไม่มีในยูเนียนของ
// ViewStyle['outlineStyle'] (มีแค่ solid/dotted/dashed) จึงต้องผ่าน unknown ก่อน cast
export const NoWebFocusOutline: ViewStyle = Platform.select({
  web: { outlineStyle: 'none' } as unknown as ViewStyle,
  default: {} as ViewStyle,
})!;

/**
 * กรอบเส้นประที่ต้องเห็นตลอดเวลา (ไม่ใช่แค่โหมด debug) บนทุกจุดที่กดได้ — ปุ่มบนรูปแผง,
 * ปุ่มเข้าโซน ECAM, โซนเลือกแผงบนหน้าแรก ลูกค้าขอเพราะรูปแผง/หน้า ECAM ไม่มีอะไรบอกเลยว่า
 * ตรงไหนกดได้ (ปุ่มบนรูปเป็นภาพนิ่ง ไม่ใช่ปุ่ม UI ที่มี affordance ของตัวเอง)
 *
 * ใช้สีขาวโปร่งแสงเพราะพื้นหลังมีทั้งจอ ECAM สีน้ำเงินเข้มและรูปแผงหลากสี ขาวคือสีเดียว
 * ที่ตัดกับพื้นได้ทั้งสองแบบ ส่วน backgroundColor จางมาก ๆ ช่วยให้เห็นพื้นที่จริงของกรอบ
 * เวลาอยู่บนพื้นที่มีลวดลายซับซ้อน ไม่ใช่แค่เห็นเส้นขอบ
 */
export const HOTSPOT_BORDER_WIDTH = 1.5;
export const HOTSPOT_BORDER_RADIUS = 3;

export const HotspotIndicator: ViewStyle = {
  borderWidth: HOTSPOT_BORDER_WIDTH,
  borderStyle: 'dashed',
  borderColor: 'rgba(255, 255, 255, 0.75)',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  borderRadius: HOTSPOT_BORDER_RADIUS,
};
