import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "สิงห์บุรี เฝ้าระวังน้ำ | ฝนและแนวโน้มน้ำ 7 วัน",
  description:
    "ติดตามพยากรณ์ฝนและแนวโน้มน้ำ 7 วัน พร้อมแหล่งข้อมูลและช่องทางช่วยเหลือ",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
