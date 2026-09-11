"use client";

import { useEffect, useRef, useState } from "react";

import { AuctionCalculator } from "./AuctionCalculator";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** 닫힌 버튼. 네 칸 — 여러 도구를 담는 자리라는 뜻. */
function ToolsIcon() {
  return (
    <svg {...ICON_PROPS} className="size-5">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...ICON_PROPS} className="size-5" strokeWidth={2}>
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg {...ICON_PROPS} className="size-4" strokeWidth={2}>
      <path d="m14.5 6-6 6 6 6" />
    </svg>
  );
}

/** 경매 계산기. 망치 — 낙찰을 두드리는 그것. */
function AuctionIcon() {
  return (
    <svg {...ICON_PROPS} className="size-4 shrink-0" strokeWidth={1.6}>
      {/* 머리와 자루를 세워 그리고 통째로 기울인다. 자루 끝이 왼쪽 아래 받침으로 향한다 */}
      <g transform="rotate(45 14 9)">
        <rect x="10" y="6.5" width="8" height="5" rx="1" />
        <path d="M14 11.5v9" />
      </g>
      <path d="M3.5 20.5h9" />
    </svg>
  );
}

type Tool = { id: "auction"; label: string; hint: string; Icon: () => React.ReactElement };

/**
 * 도구 목록. 편성과 상관없이 레이드 중에 꺼내 쓰는 것을 여기에 모은다.
 *
 * 머리줄 탭에 넣지 않는 이유는 둘이다. 탭은 화면을 옮기는데, 경매는 편성표를 보던
 * 중에 몇 초 안에 끝나는 일이라 보던 화면을 떠나면 안 된다. 그리고 탭 줄은 이미 좁은
 * 화면에서 옆으로 흐를 만큼 차 있다.
 */
const TOOLS: Tool[] = [
  {
    id: "auction",
    label: "경매 분배금 계산기",
    hint: "시세로 입찰 적정가를 구합니다",
    Icon: AuctionIcon,
  },
];

type View = "menu" | Tool["id"];

/**
 * 우측 하단 공통 메뉴.
 *
 * 레이아웃에 붙어 있어 어느 화면에서든 같은 자리에 선다. App Router는 메뉴를 옮겨도
 * 레이아웃을 다시 만들지 않으므로, 마지막으로 연 도구가 그대로 남는다 — 다시 열면 목록을
 * 거치지 않고 곧장 그 도구다. 경매는 한 레이드에 여러 번 붙는다.
 */
export function QuickMenu() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const boxRef = useRef<HTMLDivElement>(null);

  /*
    Esc는 언제나 닫는다. 바깥을 눌러 닫는 것은 목록일 때만이다.

    도구를 펴 둔 채로 뒤의 편성표를 누르는 일이 흔하다 — 공대 인원을 확인하거나 칸을
    고치거나. 그때마다 닫히면 친 시세가 날아가 다시 쳐야 한다. 목록은 고르기 전이라
    잃을 것이 없어 계정 메뉴처럼 닫는다.
  */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (view === "menu" && !boxRef.current?.contains(event.target as Node)) setOpen(false);
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
  }, [open, view]);

  const tool = TOOLS.find((t) => t.id === view);

  return (
    <div ref={boxRef} className="fixed bottom-5 right-5 z-30">
      {open && (
        <div
          role="dialog"
          aria-label={tool?.label ?? "도구"}
          className="absolute bottom-full right-0 mb-2 w-72 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
        >
          {tool ? (
            <>
              <div className="flex items-center gap-1 border-b border-border px-1.5 py-1.5">
                <button
                  type="button"
                  onClick={() => setView("menu")}
                  aria-label="도구 목록"
                  title="도구 목록"
                  className="flex size-7 items-center justify-center rounded text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <BackIcon />
                </button>
                <span className="text-sm font-semibold text-text">{tool.label}</span>
              </div>
              {tool.id === "auction" && <AuctionCalculator />}
            </>
          ) : (
            <div className="py-1">
              <p className="px-3 pb-0.5 pt-1 text-[11px] text-text-faint">도구</p>
              {TOOLS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-text-dim">
                    <item.Icon />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm text-text">{item.label}</span>
                    <span className="text-[11px] text-text-faint">{item.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/*
        둥근 버튼 하나. 본문 위에 떠 있어 무엇이든 가릴 수 있으므로 작게 두고, 가리는
        만큼 본문 아래에 여백을 비워 둔다(MainScroll).
      */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "도구 닫기" : "도구 열기"}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={open ? "닫기" : "도구"}
        className={`flex size-11 items-center justify-center rounded-full border shadow-lg transition-colors ${
          open
            ? "border-border-strong bg-surface-2 text-text"
            : "border-border bg-surface text-text-dim hover:border-border-strong hover:text-text"
        }`}
      >
        {open ? <CloseIcon /> : <ToolsIcon />}
      </button>
    </div>
  );
}
