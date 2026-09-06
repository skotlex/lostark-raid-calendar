"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * 본문 스크롤 영역.
 *
 * 스크롤을 화면 전체가 아니라 이 안에서 낸다. 머리줄이 스크롤 바깥에 있어야 스크롤바가
 * 서고 안 서고에 따라 머리줄 폭이 달라지지 않는다(globals.css의 `.page-scroll`).
 *
 * 대신 화면 자체는 스크롤되지 않아, 메뉴를 옮길 때 Next가 하던 "맨 위로"가 듣지 않는다.
 * 아래로 한참 내려간 채 다른 메뉴로 가면 그 화면도 중간부터 열린다. 여기서 대신 올린다.
 *
 * 주소의 물음표만 바뀌는 이동(요일 탭, 주차 넘기기)은 경로가 그대로라 걸리지 않는다.
 * 같은 화면 안에서 옮겨 다니는 것이라 보던 자리를 지키는 편이 맞다.
 */
export function MainScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <main ref={ref} className="page-scroll min-h-0 flex-1">
      <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
    </main>
  );
}
