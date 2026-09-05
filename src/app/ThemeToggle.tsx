"use client";

import { useState } from "react";

import { type ThemeChoice, applyTheme } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string; title: string }[] = [
  { value: "system", label: "자동", title: "시스템 설정을 따릅니다" },
  { value: "light", label: "라이트", title: "밝은 테마로 고정합니다" },
  { value: "dark", label: "다크", title: "어두운 테마로 고정합니다" },
];

/**
 * 라이트·다크·자동 3단 토글.
 *
 * 지금 값은 서버가 쿠키에서 읽어 넘긴다. 예전에는 첫 렌더 뒤 localStorage를 읽느라
 * 켜진 버튼이 한 박자 늦게 표시됐다.
 */
export function ThemeToggle({ initial }: { initial: ThemeChoice }) {
  const [choice, setChoice] = useState<ThemeChoice>(initial);

  function pick(next: ThemeChoice) {
    setChoice(next);
    applyTheme(next);
  }

  return (
    <div
      className="flex rounded border border-border p-0.5"
      role="group"
      aria-label="테마"
    >
      {OPTIONS.map((option) => {
        const active = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => pick(option.value)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              active
                ? "bg-accent/15 text-accent"
                : "text-text-faint hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
