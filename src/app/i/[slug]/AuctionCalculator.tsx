"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  AUCTION_PARTY_SIZES,
  GOLD_SEPARATOR,
  bidPrice,
  breakEvenPrice,
  formatGold,
  formatGoldInput,
  goldCaret,
  goldDigitCount,
  parseGold,
} from "@/lib/auction";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  className: "size-3.5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function CopyIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON_PROPS} strokeWidth={2.2}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** 복사 표시가 남아 있는 시간. 눌렀다는 것만 알리면 된다. */
const COPIED_MS = 1500;

type CopyResult = { key: string; ok: boolean };

/**
 * 경매 분배금 계산기.
 *
 * 시세 하나를 치면 세 인원의 손익분기점과 적정가를 한꺼번에 보여준다. 인원을 고르는
 * 칸을 두지 않는다 — 고르는 한 번이 치는 한 번보다 길고, 경매는 몇 초 안에 끝난다.
 * 세 줄이 다 서 있으면 지금 공대 인원의 줄만 읽으면 된다. 공식은 auction.ts에 있다.
 *
 * **숫자를 누르면 복사된다.** 입찰은 게임 칸에 숫자를 쳐서 하는데, 여섯 자리를 눈으로
 * 옮겨 적다가 한 자리를 틀리면 그대로 낙찰된다. 두 열 모두 누를 수 있다 — 한쪽만
 * 눌리면 나란히 선 같은 모양의 숫자가 왜 안 눌리는지 알 수 없다.
 */
export function AuctionCalculator() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState<CopyResult | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  /** 다시 그린 뒤에 캐럿을 놓을 자리. null이면 건드리지 않는다. */
  const caret = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const price = parseGold(text);

  // 콤마가 붙고 빠져도 캐럿이 제자리에 남게 한다(SlotForm의 점수컷 칸과 같은 장치).
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || caret.current === null) return;
    input.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const before = goldDigitCount(raw.slice(0, e.target.selectionStart ?? raw.length));
    const next = formatGoldInput(raw);
    caret.current = goldCaret(next, before);
    setText(next);
    // 시세가 바뀌면 방금 복사한 값이 더는 칸에 없다. 체크가 남아 있으면 새 값을 복사한 것으로 읽힌다.
    setCopied(null);
  }

  // 콤마 위에서 지우면 옆의 숫자를 지운다. 콤마만 지우면 곧바로 다시 붙어 키가 안 먹은 것처럼 보인다.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const at = input.selectionStart;
    if (at === null || at !== input.selectionEnd) return;

    if (e.key === "Backspace" && input.value[at - 1] === GOLD_SEPARATOR) {
      input.setSelectionRange(at - 1, at - 1);
    } else if (e.key === "Delete" && input.value[at] === GOLD_SEPARATOR) {
      input.setSelectionRange(at + 1, at + 1);
    }
  }

  /*
    콤마 없이 복사한다. 붙여 넣을 곳이 게임의 숫자 칸이라 콤마가 섞이면 거기서 잘리거나
    통째로 거절될 수 있다.

    클립보드 API는 https에서만 있다. 없거나 권한이 막히면 던지므로 한데 잡아 실패로 알린다.
  */
  async function copyGold(key: string, value: number) {
    let ok = true;
    try {
      await navigator.clipboard.writeText(String(value));
    } catch {
      ok = false;
    }
    setCopied({ key, ok });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }

  function cell(key: string, value: number | null, tone: string) {
    if (value === null) {
      return <span className="pr-1.5 text-right text-sm text-text-faint">-</span>;
    }

    const state = copied?.key === key ? copied : null;
    const gold = formatGold(value);
    return (
      <button
        type="button"
        onClick={() => void copyGold(key, value)}
        title="눌러서 복사"
        aria-label={`${gold} 골드 복사`}
        className="flex items-center justify-end gap-1 rounded px-1.5 py-1 transition-colors hover:bg-surface-2"
      >
        <span className={`tabular text-sm font-semibold ${tone}`}>{gold}</span>
        {/* 자리는 늘 비워 둔다. 체크로 바뀔 때 숫자가 옆으로 밀리지 않는다. */}
        <span
          className={
            state === null ? "text-text-faint" : state.ok ? "text-ok" : "text-danger"
          }
        >
          {state?.ok ? <CheckIcon /> : <CopyIcon />}
        </span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-text-dim">거래소 시세</span>
        <span className="flex h-10 items-center gap-2 rounded border border-border bg-bg px-2.5 focus-within:border-accent">
          {/*
            `type="number"`를 쓰지 않는다. 콤마가 들어가는 순간 브라우저가 값을 버리고,
            휠에 값이 바뀐다. 점수컷 칸과 같은 이유다.

            열자마자 친다. 이 창을 여는 이유가 그것 하나뿐이다.
          */}
          <input
            ref={ref}
            autoFocus
            inputMode="numeric"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="108,000"
            aria-label="거래소 시세"
            className="tabular min-w-0 flex-1 bg-transparent text-right text-base font-semibold text-text placeholder:font-normal placeholder:text-text-faint focus:outline-none"
          />
          <span className="shrink-0 text-xs text-text-faint">골드</span>
        </span>
      </label>

      <div className="overflow-hidden rounded border border-border">
        <div className="grid grid-cols-[2.5rem_1fr_1fr] items-center border-b border-border bg-surface-2 px-1.5 py-1 text-[11px] text-text-dim">
          <span className="pl-1">인원</span>
          {/* 숫자 뒤의 복사 아이콘 폭만큼 들여 머리글 끝을 숫자 끝에 맞춘다. */}
          <span className="pr-6 text-right">손익분기점</span>
          <span className="pr-6 text-right">입찰 적정가</span>
        </div>
        <ul>
          {AUCTION_PARTY_SIZES.map((size) => (
            <li
              key={size}
              className="grid grid-cols-[2.5rem_1fr_1fr] items-center border-t border-border px-1.5 py-0.5 first:border-t-0"
            >
              <span className="pl-1 text-sm text-text-dim">{size}인</span>
              {cell(`${size}-break`, price === null ? null : breakEvenPrice(price, size), "text-text")}
              {cell(`${size}-bid`, price === null ? null : bidPrice(price, size), "text-accent")}
            </li>
          ))}
        </ul>
      </div>

      {/*
        복사 결과를 알리는 자리. 실패만 글로 보인다 — 성공은 아이콘이 이미 체크로 바뀌었다.
        화면 낭독기는 아이콘을 못 보므로 성공도 읽어 준다.
      */}
      <p aria-live="polite" className="text-[11px] leading-relaxed text-text-faint">
        {copied && !copied.ok ? (
          <span className="text-danger">복사하지 못했습니다. 숫자를 직접 입력해 주세요.</span>
        ) : (
          <>
            {copied?.ok && <span className="sr-only">복사했습니다. </span>}
            손익분기점에 낙찰받으면 분배금만 받는 것과 같고, 적정가 이하면 이득입니다. 거래소 판매
            수수료 5%를 뺀 값이며, 숫자를 누르면 복사됩니다.
          </>
        )}
      </p>
    </div>
  );
}
