import type { Metadata } from "next";
import { cookies } from "next/headers";

import "./globals.css";
import { THEME_COOKIE, toThemeChoice } from "./theme";

export const metadata: Metadata = {
  title: "레이드 편성표",
  description: "로스트아크 길드 레이드 편성표",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 서버가 테마를 알고 첫 HTML에 박는다. 그래서 기본 색이 번쩍이지 않고,
  // 첫 페인트 전에 돌 인라인 스크립트도 필요 없다(theme.ts).
  const theme = toThemeChoice((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="ko"
      className="h-full antialiased"
      data-theme={theme === "system" ? undefined : theme}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
