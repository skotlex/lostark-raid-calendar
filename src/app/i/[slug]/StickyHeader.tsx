"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 화면 맨 위에 붙는 머리줄.
 *
 * 잰 높이를 `--header-h`에 실어둔다. 편성표의 요일 줄이 이 값만큼 내려와 붙어야
 * 머리줄에 가려지지 않는다(page.tsx).
 *
 * 상수로 박지 않는 이유는 로고·탭·나가기가 한 줄에 다 못 들어가면 줄바꿈이 일어나
 * 높이가 화면 폭마다 달라지기 때문이다. 좁은 화면에서 요일 줄이 머리줄 밑에 숨는다.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const write = () => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    };
    write();

    const observer = new ResizeObserver(write);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header ref={ref} className="sticky top-0 z-30 border-b border-border bg-surface">
      {children}
    </header>
  );
}
