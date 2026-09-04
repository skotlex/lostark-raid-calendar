import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "레이드 편성표",
  description: "로스트아크 길드 레이드 편성표",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
