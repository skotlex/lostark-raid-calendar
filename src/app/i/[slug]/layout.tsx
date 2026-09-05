import Image from "next/image";
import { cookies } from "next/headers";
import Link from "next/link";

import { requireInstance } from "@/lib/instance";
import { requireSession } from "@/lib/session";

import { THEME_COOKIE, toThemeChoice } from "../../theme";
import { ThemeToggle } from "../../ThemeToggle";
import { BoardTabLink } from "./lastDay";
import { Viewer } from "./Viewer";

// Prisma로 DB를 읽으므로 빌드 시점에 미리 굽지 않는다.
export const dynamic = "force-dynamic";

export default async function InstanceLayout({ children, params }: LayoutProps<"/i/[slug]">) {
  const { slug } = await params;
  // 편성표 전체가 이 레이아웃 아래에 있으므로 여기 한 곳이 관문이 된다.
  // 서버 액션은 레이아웃을 거치지 않으니 액션마다 따로 확인한다(actions.ts).
  const session = await requireSession(`/i/${slug}`);
  const instance = await requireInstance(slug);
  // 켜진 버튼을 첫 렌더부터 맞춘다. 루트 레이아웃이 <html>에 박는 값과 같은 쿠키다.
  const theme = toThemeChoice((await cookies()).get(THEME_COOKIE)?.value);

  // `remember`가 켜진 탭은 마지막으로 보던 요일로 돌아간다(lastDay.tsx 참조).
  const tabs = [
    { href: `/i/${slug}`, label: "편성표", remember: true },
    { href: `/i/${slug}/slots`, label: "요일표 편집", remember: false },
    // 편성은 칸에서 바로 하므로 여기는 정리용 화면이다. 그래서 뒤로 뺐다.
    { href: `/i/${slug}/characters`, label: "캐릭터 관리", remember: false },
    // 막지 않는 대신 남긴다(CLAUDE.md 3.4). 무엇이 바뀌었는지 보는 곳이다.
    { href: `/i/${slug}/history`, label: "편집 이력", remember: false },
  ];

  const tabClass =
    "rounded px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text";

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-5 py-2">
          {/*
            로고는 애니메이션 WebP다. unoptimized가 없으면 Next의 이미지 최적화가
            첫 프레임만 남긴 정지 이미지로 바꿔버린다.
          */}
          <Link href={`/i/${slug}`} className="flex shrink-0 items-center" title={instance.name}>
            <Image
              src="/logo.webp"
              alt={instance.name}
              width={102}
              height={128}
              priority
              unoptimized
              className="h-11 w-auto"
            />
          </Link>

          <nav className="flex gap-1">
            {tabs.map((tab) =>
              tab.remember ? (
                <BoardTabLink key={tab.href} href={tab.href} className={tabClass}>
                  {tab.label}
                </BoardTabLink>
              ) : (
                <Link key={tab.href} href={tab.href} className={tabClass}>
                  {tab.label}
                </Link>
              ),
            )}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <Viewer session={session} />
            <ThemeToggle initial={theme} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
