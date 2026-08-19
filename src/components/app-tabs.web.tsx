import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';

/**
 * เวอร์ชันเว็บของแท็บ — ใช้ headless Tabs API (คนละตัวกับ NativeTabs ที่ native ใช้)
 *
 * <Tabs> ของ expo-router/ui ต้องมี <TabList><TabTrigger .../></TabList> เพื่อลงทะเบียน
 * หน้าจอ ถ้ามีแค่ <TabSlot /> ลอย ๆ (โค้ดเดิม) มันไม่รู้จักหน้าจอไหนเลย แล้วโยน
 * "Couldn't find any screens for the navigator" ทำแอปเว็บพังทั้งหน้าตั้งแต่โหลด
 * (ไม่โผล่ตอน native เพราะ native ใช้ app-tabs.tsx คนละไฟล์คนละ API)
 *
 * ซ่อน TabList ด้วย display:none เพราะลูกค้าสั่งลบแถบแท็บออกจากหน้าเว็บไปแล้ว
 * (ดู git log: "ลบแถบ Expo Starter/Home/Docs ออกจากหน้าเว็บ") มีแท็บเดียวคือ "index"
 * จึงไม่มีอะไรให้สลับอยู่แล้ว แต่ยังต้องประกาศ trigger ไว้ให้ router รู้จักหน้าจอ
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList style={{ display: 'none' }}>
        <TabTrigger name="index" href="/" />
      </TabList>
    </Tabs>
  );
}
