"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  AUCTION_PARTY_SIZES,
  GOLD_SEPARATOR,
  bidPrice,
  formatGold,
  formatGoldInput,
  goldCaret,
  goldDigitCount,
  parseGold,
} from "@/lib/auction";

/**
 * 경매 분배금 계산기.
 *
 * 시세 하나를 치면 세 인원의 적정가를 한꺼번에 보여준다. 인원을 고르는 칸을 두지
 * 않는다 — 고르는 한 번이 치는 한 번보다 길고, 경매는 몇 초 안에 끝난다. 세 줄이
 * 다 서 있으면 지금 공대 인원의 줄만 읽으면 된다. 공식은 auction.ts에 있다.
 */
export function AuctionCalculator() {
  const [text, setText] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  /** 다시 그린 뒤에 캐럿을 놓을 자리. null이면 건드리지 않는다. */
  const caret = useRef<number | null>(null);

  const price = parseGold(text);

  // 콤마가 붙고 빠져도 캐럿이 제자리에 남게 한다(SlotForm의 점수컷 칸과 같은 장치).
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || caret.current === null) return;
    input.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [text]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const before = goldDigitCount(raw.slice(0, e.target.selectionStart ?? raw.length));
    const next = formatGoldInput(raw);
    caret.current = goldCaret(next, before);
    setText(next);
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

      <div className="flex flex-col gap-1">
        <span className="text-xs text-text-dim">입찰 적정가</span>
        <ul className="overflow-hidden rounded border border-border">
          {AUCTION_PARTY_SIZES.map((size) => (
            <li
              key={size}
              className="flex items-center justify-between gap-3 border-t border-border px-2.5 py-2 first:border-t-0"
            >
              <span className="text-sm text-text-dim">{size}인</span>
              <span
                className={`tabular text-base font-semibold ${
                  price === null ? "text-text-faint" : "text-accent"
                }`}
              >
                {price === null ? "-" : formatGold(bidPrice(price, size))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] leading-relaxed text-text-faint">
        이 금액 이하로 낙찰받으면 분배금만 받는 것보다 이득입니다. 거래소 판매 수수료 5%를 뺀
        값입니다.
      </p>
    </div>
  );
}
