"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { UNDECIDED } from "@/lib/week";

/**
 * 마지막으로 보던 요일.
 *
 * 편성표는 `?day=` 없이 들어오면 **오늘 요일**을 편다. 처음 열 때는 그게 맞지만,
 * 수요일 편성을 보다가 캐릭터 관리에 갔다 오면 오늘로 되돌아가 버린다. 보던 자리를
 * 잃는 셈이라 요일을 기억해 두고 상단 탭으로 돌아올 때 붙여준다.
 *
 * 서버가 알 수 없는 값(브라우저마다 다르다)이라 localStorage에 둔다. 저장이 막혀도
 * 오늘 요일로 떨어질 뿐 앱은 그대로 동작한다.
 */
const STORAGE_KEY = "loa-raid-board:last-day";

function readLastDay(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const day = Number(raw);
    // 미정(7)도 편성표의 탭 하나다. 여기서 자르면 미정을 보다 나갔을 때만 오늘로 끌려간다.
    return Number.isInteger(day) && day >= 0 && day <= UNDECIDED ? day : null;
  } catch {
    return null;
  }
}

/** 편성표가 그리는 요일을 기록한다. 화면에는 아무것도 그리지 않는다. */
export function RememberDay({ day }: { day: number }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(day));
    } catch {
      // 저장이 막혀도 이번 방문 동안은 주소의 day가 유지된다.
    }
  }, [day]);

  return null;
}

/**
 * 상단 "편성표" 탭.
 *
 * **누르는 순간에 읽는다.** 예전에는 마운트할 때 한 번만 읽었는데, 이 탭은 레이아웃에
 * 있어서 화면을 옮겨도 다시 마운트되지 않는다. 그래서 편성표에서 요일을 바꾼 뒤
 * 캐릭터 관리에 갔다가 돌아오면 처음 들어왔을 때의 요일로 끌려갔다.
 *
 * href는 요일 없는 주소로 둔다. 서버 렌더 결과와 어긋나지 않고, 새 탭으로 열거나
 * 주소를 복사하면 오늘 요일이 열린다.
 */
export function TabLink({
  href,
  label,
  icon,
  remember,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  /** 편성표 탭만. 마지막으로 보던 요일로 되돌아간다 */
  remember?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // 지금 보고 있는 탭은 좁은 화면에서도 이름을 펼쳐 둔다. 어디에 있는지 모르게 되지 않게.
  const active = pathname === href;

  return (
    <Link
      href={href}
      className="tab-link"
      title={label}
      data-active={active ? "" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={(e) => {
        if (!remember) return;
        // 새 탭·새 창으로 여는 조작은 브라우저에 맡긴다.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const day = readLastDay();
        if (day === null) return;
        e.preventDefault();
        router.push(`${href}?day=${day}`);
      }}
    >
      {icon}
      <span className="tab-label">{label}</span>
    </Link>
  );
}
