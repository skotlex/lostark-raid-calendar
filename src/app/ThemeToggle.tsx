"use client";

import { useState } from "react";

import { saveThemeAction } from "./settingsActions";
import { type ThemeChoice, applyTheme } from "./theme";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-4",
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

/**
 * 세 값을 한 버튼이 돌린다.
 *
 * 예전에는 자동·라이트·다크 세 칸을 나란히 뒀다. 셋 다 그려두면 지금 값을 한눈에
 * 알 수 있지만 머리띠에서 130px 가까이 먹는다. 좁은 화면에서는 그만큼이 탭을 아래로
 * 밀어낸다. 테마는 한 번 정하면 거의 안 건드리는 값이라 그 자리를 계속 내줄 이유가 없다.
 *
 * 대신 지금 값을 그림으로 남기고 누를 때마다 다음 값으로 넘어간다. 세 바퀴면 제자리로
 * 오므로 잘못 눌러도 되돌릴 길이 늘 있다. 어느 값인지는 그림과 툴팁이 말해준다.
 */
const ORDER: ThemeChoice[] = ["system", "light", "dark"];

const LABEL: Record<ThemeChoice, string> = {
  system: "자동",
  light: "라이트",
  dark: "다크",
};

const ICON: Record<ThemeChoice, () => React.ReactElement> = {
  system: SystemIcon,
  light: SunIcon,
  dark: MoonIcon,
};

export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  const Icon = ICON[choice];

  function cycle() {
    setChoice(next);
    applyTheme(next);
    // 화면은 위에서 이미 바뀌었다. 이건 다음 로그인 때 따라오게 하려는 것뿐이라
    // 실패해도 알리지 않는다(settings.ts).
    void saveThemeAction(next).catch(() => {});
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`테마: ${LABEL[choice]} — 누르면 ${LABEL[next]}로 바꿉니다`}
      aria-label={`테마 ${LABEL[choice]}, 누르면 ${LABEL[next]}`}
      className="flex items-center justify-center rounded border border-border p-1.5 text-text-faint transition-colors hover:text-text"
    >
      <Icon />
    </button>
  );
}
