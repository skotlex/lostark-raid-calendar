import { Analytics } from "@vercel/analytics/next";
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
      <body className="min-h-full flex flex-col">
        {children}

        {/*
          Vercel 웹 애널리틱스.

          **Supabase 무료 한도와 상관이 없다**(CLAUDE.md 2-4). 여기서 나가는 요청은
          Vercel로 가고 우리 DB나 함수를 거치지 않아, egress를 지키려고 둔 장치들
          (`IDLE_STOP_MS` 등)과 겹치지 않는다.

          쿠키를 쓰지 않으므로 로그인 게이트(4장) 앞뒤 어디서든 그대로 돈다. 배포된
          곳에서만 실제로 보내고 로컬 개발에서는 아무것도 하지 않는다.

          루트 레이아웃에 둔다. 여기가 로그인 화면까지 감싸는 유일한 자리라
          `/i/[slug]` 아래에 붙이면 정작 사람들이 처음 닿는 화면이 빠진다.
        */}
        <Analytics />
      </body>
    </html>
  );
}
