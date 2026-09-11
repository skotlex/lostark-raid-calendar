"use client";

import { useEffect, useState } from "react";

import { AuctionCalculator } from "./AuctionCalculator";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-5",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function CloseIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={2}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

/**
 * 계산기. 몸통 · 표시창 · 버튼 여섯.
 *
 * 망치(낙찰)로 먼저 그렸는데 20px에서는 무엇인지 읽히지 않았다. 계산기는 누구나 아는
 * 모양이라 누르면 무엇이 뜨는지 설명이 필요 없다.
 *
 * 버튼은 길이 0에 가까운 선을 둥근 끝으로 찍어 점으로 만든다. 원을 그리면 테두리
 * 굵기가 더해져 몸통 선보다 무겁게 선다.
 */
function CalculatorIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="5" y="2.5" width="14" height="19" rx="2.2" />
      <rect x="8" y="5.5" width="8" height="3.5" rx="0.8" />
      <path
        d="M8.8 13h.01M12 13h.01M15.2 13h.01M8.8 17h.01M12 17h.01M15.2 17h.01"
        strokeWidth={2.4}
      />
    </svg>
  );
}

/**
 * 우측 하단 버튼 — 경매 분배금 계산기.
 *
 * 레이아웃에 붙어 있어 어느 화면에서든 같은 자리에 선다. 머리줄 탭에 넣지 않는 이유는
 * 탭이 화면을 옮기기 때문이다. 경매는 편성표를 보던 중에 몇 초 안에 끝나는 일이라 보던
 * 화면을 떠나면 안 된다. 그리고 탭 줄은 이미 좁은 화면에서 옆으로 흐를 만큼 차 있다.
 *
 * **목록을 거치지 않고 곧장 연다.** 도구 목록을 먼저 띄웠었는데 담긴 것이 계산기 하나라
 * 매번 한 번을 더 누르는 것뿐이었다. 도구가 늘면 그때 목록을 되살린다.
 */
export function QuickMenu() {
  const [open, setOpen] = useState(false);

  /*
    Esc로 닫는다. **바깥을 눌러서는 닫지 않는다.**

    계산기를 펴 둔 채로 뒤의 편성표를 누르는 일이 흔하다 — 공대 인원을 확인하거나 칸을
    고치거나. 그때마다 닫히면 친 시세가 날아가 다시 쳐야 한다.
  */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open && (
        <div
          role="dialog"
          aria-label="경매 분배금 계산기"
          className="absolute bottom-full right-0 mb-2 w-80 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-3 py-2 text-sm font-semibold text-text">
            경매 분배금 계산기
          </div>
          <AuctionCalculator />
        </div>
      )}

      {/*
        둥근 버튼 하나. 본문 위에 떠 있어 무엇이든 가릴 수 있으므로 작게 두고, 가리는
        만큼 본문 아래에 여백을 비워 둔다(MainScroll).

        닫힌 버튼에는 계산기를 그린다. 누르면 무엇이 뜨는지 그림이 말한다.
      */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "경매 분배금 계산기 닫기" : "경매 분배금 계산기 열기"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={open ? "닫기" : "경매 분배금 계산기"}
        className={`flex size-11 items-center justify-center rounded-full border shadow-lg transition-colors ${
          open
            ? "border-border-strong bg-surface-2 text-text"
            : "border-border bg-surface text-text-dim hover:border-border-strong hover:text-text"
        }`}
      >
        {open ? <CloseIcon /> : <CalculatorIcon />}
      </button>
    </div>
  );
}
