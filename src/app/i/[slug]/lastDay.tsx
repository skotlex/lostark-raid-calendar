"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
    return Number.isInteger(day) && day >= 0 && day <= 6 ? day : null;
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
 * 서버 렌더 결과와 어긋나지 않도록 첫 렌더는 요일 없는 주소로 두고, 붙은 뒤에 바꾼다.
 */
export function BoardTabLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    setDay(readLastDay());
  }, []);

  return (
    <Link href={day === null ? href : `${href}?day=${day}`} className={className}>
      {children}
    </Link>
  );
}
