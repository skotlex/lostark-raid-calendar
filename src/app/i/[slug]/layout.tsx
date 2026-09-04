import Link from "next/link";

import { requireInstance } from "@/lib/instance";

import { ThemeToggle } from "../../ThemeToggle";
import { BoardTabLink } from "./lastDay";
import { MyNameField } from "./MyNameField";

// Prisma로 DB를 읽으므로 빌드 시점에 미리 굽지 않는다.
export const dynamic = "force-dynamic";

export default async function InstanceLayout({ children, params }: LayoutProps<"/i/[slug]">) {
  const { slug } = await params;
  const instance = await requireInstance(slug);

  // `remember`가 켜진 탭은 마지막으로 보던 요일로 돌아간다(lastDay.tsx 참조).
  const tabs = [
    { href: `/i/${slug}`, label: "편성표", remember: true },
    { href: `/i/${slug}/slots`, label: "요일표 편집", remember: false },
    // 편성은 칸에서 바로 하므로 여기는 정리용 화면이다. 그래서 뒤로 뺐다.
    { href: `/i/${slug}/characters`, label: "캐릭터 관리", remember: false },
  ];

  const tabClass =
    "rounded px-3 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text";

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href={`/i/${slug}`} className="text-lg font-bold text-accent">
            {instance.name}
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
            <MyNameField />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
