"use client";

import { useActionState } from "react";

import type { BoardSlotView } from "@/lib/board";
import { raidLabel } from "@/lib/raids";
import { formatScoreCut } from "@/lib/scoreCut";
import { isUndecided } from "@/lib/week";

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
  week,
  slot,
  editable,
}: {
  slug: string;
  /** 전원 고정이 그 주차의 자리 핀까지 움직이므로 함께 보낸다. */
  week: string;
  slot: BoardSlotView;
  editable: boolean;
}) {
  const [state, toggleKeep, toggling] = useActionState(keepRosterAction, IDLE);

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-2">
        <h3 className="font-semibold">{raidLabel(slot.raidName, slot.difficulty)}</h3>

        {/* 미정 칸에는 시각이 없다. 채워 넣은 값을 보여주면 약속처럼 읽힌다. */}
        {!isUndecided(slot.dayOfWeek) && (
          <span className="slot-badge tabular">{slot.startTime}</span>
        )}
        {/* 자리가 다 차면 색이 바뀐다. 더 넣을 곳이 없다는 뜻이라 훑을 때 걸려야 한다. */}
        <span
          className="slot-badge tabular"
          data-full={slot.filled >= slot.partySize ? "" : undefined}
          title={
            slot.filled >= slot.partySize
              ? "자리가 모두 찼습니다"
              : `${slot.partySize}자리 중 ${slot.filled}명`
          }
        >
          {slot.filled}/{slot.partySize}
        </span>

        {/*
          점수컷 — 걸어 둔 공대만 내건다.
          자리 수 바로 뒤에 서는 이유는 "몇 자리 남았나" 다음에 "내가 들어갈 수 있나"가
          오기 때문이다. 이름·시각과 섞이지 않게 색으로 갈라 둔다.
        */}
        <ScoreCut kind="dps" value={slot.dpsScoreCut} />
        <ScoreCut kind="sup" value={slot.supScoreCut} />

        {editable && (
          <form action={toggleKeep} className="ml-auto">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="slotId" value={slot.id} />
            <input type="hidden" name="week" value={week} />
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

const CUT_LABEL = { dps: "딜러", sup: "서폿" } as const;

/**
 * 점수컷 뱃지.
 *
 * **안내일 뿐이다.** 캐릭터 스펙과 견주지 않으므로 미달인 사람이 들어와도 이 뱃지는
 * 그대로다. 막지 않는다는 규칙(CLAUDE.md 3.4)에 맞고, 애초에 이 숫자가 전투력인지
 * 템레벨인지도 앱은 모른다(scoreCut.ts).
 */
function ScoreCut({ kind, value }: { kind: "dps" | "sup"; value: number | null }) {
  if (value === null) return null;

  const label = CUT_LABEL[kind];
  return (
    <span
      className="slot-badge tabular"
      data-cut={kind}
      title={`${label} 점수컷 ${value.toLocaleString("ko-KR")} 이상 (안내입니다. 배치를 막지 않습니다)`}
    >
      {label} {formatScoreCut(value)}
    </span>
  );
}
