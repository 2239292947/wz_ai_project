import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入 - 智能多格式批量下单系统",
  description: "智能多格式批量下单系统 V2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-full bg-bg antialiased">
        {children}
      </body>
    </html>
  );
}
