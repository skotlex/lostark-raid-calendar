"use client";

import { useEffect, useRef, useState } from "react";

import { saveThemeAction } from "./settingsActions";
import { type ThemeChoice, applyTheme } from "./theme";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-4 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** 자동. 화면(모니터) — 이 기기가 정하는 값을 따른다는 뜻. */
function SystemIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16v4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2" />
      <path d="M12 19v2" />
      <path d="M3 12h2" />
      <path d="M19 12h2" />
      <path d="m5.6 5.6 1.4 1.4" />
      <path d="m17 17 1.4 1.4" />
      <path d="m18.4 5.6-1.4 1.4" />
      <path d="m7 17-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

/** 열린다는 표시. 아이콘만 있으면 눌러도 되는지 알 수 없다. */
function CaretIcon() {
  return (
    <svg {...ICON_PROPS} className="size-3 shrink-0" strokeWidth={2}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </svg>
  );
}

const OPTIONS: { value: ThemeChoice; label: string; Icon: () => React.ReactElement }[] = [
  { value: "system", label: "자동", Icon: SystemIcon },
  { value: "light", label: "라이트", Icon: SunIcon },
  { value: "dark", label: "다크", Icon: MoonIcon },
];

/**
 * 테마 고르기.
 *
 * 예전에는 자동·라이트·다크 세 칸을 나란히 뒀다. 셋 다 그려두면 지금 값을 한눈에 알 수
 * 있지만 머리띠에서 130px 가까이 먹는다. 좁은 화면에서는 그만큼이 탭을 아래로 밀어낸다.
 * 테마는 한 번 정하면 거의 안 건드리는 값이라 그 자리를 계속 내줄 이유가 없다.
 *
 * 그래서 접어두고 지금 값만 그림으로 남긴다. 눌러서 도는 방식도 자리는 같지만, 원하는
 * 값이 두 칸 뒤면 그 사이 테마가 한 번씩 다 켜졌다 꺼진다. 목록이면 한 번에 간다.
 *
 * 높이는 옆의 나가기 버튼과 같은 값(px-2 py-1 text-xs)을 그대로 써서 맞춘다. 눈으로 맞춘
 * 여백은 글꼴이나 배율이 바뀌면 다시 어긋난다.
 */
export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 치면 닫는다. 머리띠에 떠 있는 목록이라 열린 채로 두면
  // 아래 화면을 가린다.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(next: ThemeChoice) {
    setChoice(next);
    setOpen(false);
    applyTheme(next);
    // 화면은 위에서 이미 바뀌었다. 이건 다음 로그인 때 따라오게 하려는 것뿐이라
    // 실패해도 알리지 않는다(settings.ts).
    void saveThemeAction(next).catch(() => {});
  }

  const current = OPTIONS.find((option) => option.value === choice) ?? OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`테마: ${current.label}`}
        aria-label={`테마 ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-0.5 rounded border border-border px-2 py-1 text-xs text-text-faint transition-colors hover:text-text"
      >
        <CurrentIcon />
        <CaretIcon />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="테마"
          className="absolute right-0 top-full z-20 mt-1 min-w-max overflow-hidden rounded border border-border bg-surface py-1 shadow-lg"
        >
          {OPTIONS.map((option) => {
            const active = option.value === choice;
            const Icon = option.Icon;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => pick(option.value)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-accent/15 text-accent"
                      : "text-text-dim hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <Icon />
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
