import type { Metadata } from "next";

import "./globals.css";
import { THEME_INIT_SCRIPT } from "./theme";

export const metadata: Metadata = {
  title: "레이드 편성표",
  description: "로스트아크 길드 레이드 편성표",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 테마 스크립트가 첫 페인트 전에 data-theme을 붙이므로 서버 HTML과 달라진다.
    // 의도한 차이라 경고를 끈다.
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
