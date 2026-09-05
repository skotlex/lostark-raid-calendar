"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveBoardViewAction } from "../../settingsActions";
import { type BoardView, applyBoardView } from "./view";

const OPTIONS: { value: BoardView; label: string; title: string }[] = [
  { value: "full", label: "전체", title: "카드로 봅니다. 초상과 각인까지 보여줍니다" },
  { value: "compact", label: "간략", title: "표로 봅니다. 8인이 한 줄에 들어옵니다" },
];

/**
 * 보기 전환.
 *
 * 서버가 쿠키를 읽어 그리므로 누른 뒤 새로 그려야 반영된다. 값은 즉시 켜 두고
 * 화면만 뒤따라오게 한다. 기다리는 동안 버튼이 원래 자리로 튀지 않는다.
 */
export function ViewToggle({ initial }: { initial: BoardView }) {
  const router = useRouter();
  const [view, setView] = useState<BoardView>(initial);

  function pick(next: BoardView) {
    if (next === view) return;
    setView(next);
    applyBoardView(next);
    router.refresh();
    // 기기가 바뀌어도 따라오도록 사람에게 붙여 둔다. 실패해도 알리지 않는다.
    void saveBoardViewAction(next).catch(() => {});
  }

  return (
    <div className="flex rounded border border-border p-0.5" role="group" aria-label="보기">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={view === option.value}
          onClick={() => pick(option.value)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            view === option.value
              ? "bg-accent/15 text-accent"
              : "text-text-faint hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
