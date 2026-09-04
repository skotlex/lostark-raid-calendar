"use client";

import { useEffect, useState } from "react";

import { type ThemeChoice, applyTheme, readTheme } from "./theme";

const OPTIONS: { value: ThemeChoice; label: string; title: string }[] = [
  { value: "system", label: "자동", title: "시스템 설정을 따릅니다" },
  { value: "light", label: "라이트", title: "밝은 테마로 고정합니다" },
  { value: "dark", label: "다크", title: "어두운 테마로 고정합니다" },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  // 서버 렌더 결과에는 저장된 값이 없다. 첫 렌더 이후에 읽어 불일치를 피한다.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setChoice(readTheme());
    setReady(true);
  }, []);

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
        const active = ready && choice === option.value;
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
