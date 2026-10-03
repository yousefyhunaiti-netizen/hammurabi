import type { Metadata } from "next";
import "./globals.css";
import SiteMotion from "./components/SiteMotion";

export const metadata: Metadata = {
  title: "حمورابي | منصة المحامين الأولى في الأردن",
  description: "منصة حمورابي تربطك بمحامين ومكاتب محاماة موثوقة في الأردن، احجز موعداً أو استشارة قانونية سريعة عبر الإنترنت.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <SiteMotion />
      </body>
    </html>
  );
}