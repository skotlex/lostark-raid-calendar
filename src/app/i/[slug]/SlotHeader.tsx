"use client";

import { useActionState } from "react";

import type { BoardSlotView } from "@/lib/board";
import { raidLabel } from "@/lib/raids";

import { type CellState, keepRosterAction } from "./actions";
import { PinIcon } from "./icons";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 슬롯 머리글. 카드 보기와 간략 보기가 함께 쓴다.
 *
 * 시간과 인원 수는 뱃지로 둘러 레이드 이름과 갈라 놓는다. 글자만 나란히 두면
 * "벨가르딘 나이트메어 20:00 1/8"이 한 덩어리로 읽혀 어디까지가 이름인지 흐려진다.
 */
export function SlotHeader({
  slug,
  slot,
  editable,
}: {
  slug: string;
  slot: BoardSlotView;
  editable: boolean;
}) {
  const [state, toggleKeep, toggling] = useActionState(keepRosterAction, IDLE);

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2">
        <h3 className="font-semibold">{raidLabel(slot.raidName, slot.difficulty)}</h3>

        <span className="slot-badge tabular">{slot.startTime}</span>
        <span className="slot-badge tabular" title={`${slot.partySize}자리 중 ${slot.filled}명`}>
          {slot.filled}/{slot.partySize}
        </span>

        {editable && (
          <form action={toggleKeep} className="ml-auto">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="slotId" value={slot.id} />
            <input type="hidden" name="keepRoster" value={slot.keepRoster ? "false" : "true"} />
            <button
              type="submit"
              disabled={toggling}
              title={
                slot.keepRoster
                  ? "다음 주에 인원이 비워집니다"
                  : "이 공대 전원을 매주 그대로 유지합니다"
              }
              className={`flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors ${
                slot.keepRoster
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border text-text-faint hover:text-text"
              }`}
            >
              {/* 자리 고정과 같은 그림이다. 하나는 자리, 하나는 공대 전체라는 차이뿐이다. */}
              <PinIcon pinned={slot.keepRoster} />
              {slot.keepRoster ? "전원 고정 켜짐" : "전원 고정"}
            </button>
          </form>
        )}
      </header>

      {state.status === "error" && (
        <p className="px-3 pt-2 text-xs text-danger">{state.message}</p>
      )}
    </>
  );
}
