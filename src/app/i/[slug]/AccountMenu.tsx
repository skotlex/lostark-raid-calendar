"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { saveThemeAction } from "../../settingsActions";
import { type ThemeChoice, applyTheme } from "../../theme";

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

function LogoutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17 5 12l5-5" />
      <path d="M5 12h11" />
    </svg>
  );
}

/** 열린다는 표시. 얼굴만 있으면 눌러도 되는지 알 수 없다. */
function CaretIcon() {
  return (
    <svg {...ICON_PROPS} className="size-3 shrink-0" strokeWidth={2}>
      <path d="m6 9.5 6 5.5 6-5.5" />
    </svg>
  );
}

const THEMES: { value: ThemeChoice; label: string; Icon: () => React.ReactElement }[] = [
  { value: "system", label: "자동", Icon: SystemIcon },
  { value: "light", label: "라이트", Icon: SunIcon },
  { value: "dark", label: "다크", Icon: MoonIcon },
];

function Face({ label, avatarUrl }: { label: string; avatarUrl: string | null }) {
  if (!avatarUrl) {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] text-text-dim"
        aria-hidden
      >
        {label.slice(0, 1)}
      </span>
    );
  }

  return (
    <Image
      src={avatarUrl}
      alt=""
      width={24}
      height={24}
      className="size-6 shrink-0 rounded-full"
      unoptimized
    />
  );
}

/**
 * 내 계정.
 *
 * 이름·나가기·테마를 얼굴 하나로 접는다. 셋을 나란히 두면 머리줄에서 200px 가까이
 * 먹어, 좁은 화면에서는 로고와 탭이 한 줄에 못 들어가고 머리줄이 두 줄이 됐다.
 * 세 가지 모두 하루에 한 번 누를까 말까 한 것이라 그 자리를 계속 내줄 이유가 없다.
 *
 * 이름은 폼에서 받지 않고 세션에서 받는다. 받으면 아무 이름이나 적어 남의 이름으로
 * 기록을 남길 수 있다(CLAUDE.md 4장).
 *
 * 테마를 다시 접힌 목록으로 두지 않는다. 이미 접힌 것 안이라, 또 접으면 두 번 눌러야
 * 하고 목록 위에 목록이 겹친다. 세 칸을 그대로 펼쳐 지금 값까지 함께 보여준다.
 */
export function AccountMenu({
  label,
  avatarUrl,
  theme,
}: {
  label: string;
  avatarUrl: string | null;
  theme: ThemeChoice;
}) {
  const [choice, setChoice] = useState<ThemeChoice>(theme);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc를 치면 닫는다. 머리줄에 떠 있는 것이라 열린 채로 두면
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
    applyTheme(next);
    // 화면은 위에서 이미 바뀌었다. 이건 다음 로그인 때 따라오게 하려는 것뿐이라
    // 실패해도 알리지 않는다(settings.ts).
    void saveThemeAction(next).catch(() => {});
  }

  return (
    <div className="relative" ref={boxRef}>
      {/*
        얼굴이 둥그니 담는 것도 둥글게 한다. 각진 상자에 넣으면 안에서 한 번 더 잘린
        것처럼 보인다.

        평소에는 테두리를 두지 않는다. 머리줄에서 색이 있는 것은 얼굴 하나뿐이라 그것만으로
        이미 눈에 띄고, 선을 더하면 옆의 탭들보다 무겁게 선다. 대신 올리거나 열었을 때
        배경을 깔아 누를 수 있는 것임을 알린다. 탭이 자기 자리를 알리는 방식과 같다
        (globals.css의 .tab-link).
      */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={label}
        aria-label={`내 계정 ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-surface-2 hover:text-text focus-visible:bg-surface-2 focus-visible:text-text ${
          open ? "bg-surface-2 text-text" : "text-text-dim"
        }`}
      >
        <Face label={label} avatarUrl={avatarUrl} />
        {/*
          넓을 때는 이름도 같이 세운다. 접어둔 것이 무엇인지 눌러보지 않고 알 수 있다.
          좁아지면 얼굴만 남긴다 — 이름을 줄이려고 접은 것이라 여기서 다시 펴면 소용없다.
          탭이 아이콘만 남는 폭(54rem)과 같은 자리에서 갈린다.
        */}
        <span className="hidden max-w-28 truncate text-sm min-[54rem]:inline">{label}</span>
        <CaretIcon />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="내 계정"
          className="absolute right-0 top-full z-40 mt-1 min-w-max overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Face label={label} avatarUrl={avatarUrl} />
            <span className="max-w-44 truncate text-sm text-text">{label}</span>
          </div>

          <div className="my-1 border-t border-border" />

          <p className="px-3 pb-0.5 text-[11px] text-text-faint">테마</p>
          {THEMES.map((option) => {
            const active = option.value === choice;
            const Icon = option.Icon;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
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
            );
          })}

          <div className="my-1 border-t border-border" />

          {/* GET으로 두면 링크 미리보기만으로도 로그아웃된다. 폼으로 POST한다. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
            >
              <LogoutIcon />
              나가기
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
