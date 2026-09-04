"use client";

import { useActionState } from "react";

import type { BoardSlotView, PartyView } from "@/lib/board";
import { raidLabel } from "@/lib/raids";
import type { SynergyKind } from "@/lib/synergy";

import { Cell } from "./Cell";
import { type CellState, keepRosterAction } from "./actions";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 시너지 종류별 색.
 *
 * 파티마다 붙는 칩이 전부 같은 회색이면 무엇이 들어왔는지 세어봐야 안다. 색을 나눠
 * 두면 편성표를 훑는 것만으로 빠진 시너지가 눈에 걸린다. 색값은 globals.css에 있다.
 *
 * 모든 종류를 요구하는 Record라 시너지가 새로 생기면 여기서 컴파일이 막힌다.
 */
const SYNERGY_CLASS: Record<SynergyKind, string> = {
  공증: "syn-atk",
  받피증: "syn-taken",
  방깍: "syn-def",
  치적: "syn-crit",
  치피증: "syn-critdmg",
  백헤드: "syn-back",
  서폿: "syn-sup",
};

export function SlotCard({
  slug,
  week,
  slot,
  editable,
}: {
  slug: string;
  week: string;
  slot: BoardSlotView;
  editable: boolean;
}) {
  const [keepState, toggleKeep, togglingKeep] = useActionState(keepRosterAction, IDLE);

  return (
    <section className="rounded border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <h3 className="font-semibold">
          {raidLabel(slot.raidName, slot.difficulty)}
          <span className="ml-2 text-text-dim tabular">{slot.startTime}</span>
        </h3>

        <span className="text-xs text-text-faint tabular">{slot.filled}/8</span>

        {editable && (
          <form action={toggleKeep} className="ml-auto">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="slotId" value={slot.id} />
            <input type="hidden" name="keepRoster" value={slot.keepRoster ? "false" : "true"} />
            <button
              type="submit"
              disabled={togglingKeep}
              title={
                slot.keepRoster
                  ? "매주 초기화되도록 되돌립니다"
                  : "이 공대 전원을 매주 그대로 유지합니다"
              }
              className={`rounded border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
                slot.keepRoster
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border text-text-faint hover:text-text"
              }`}
            >
              {slot.keepRoster ? "전원 고정 켜짐" : "전원 고정"}
            </button>
          </form>
        )}
      </header>

      <div className="space-y-3 p-3">
        {slot.parties.map((party) => (
          <Party
            key={party.index}
            slug={slug}
            slotId={slot.id}
            week={week}
            party={party}
            editable={editable}
          />
        ))}

        {keepState.status === "error" && (
          <p className="text-xs text-danger">{keepState.message}</p>
        )}
      </div>
    </section>
  );
}

/**
 * 4인 파티 한 줄. 딜 3 + 폿 1이 한 파티다.
 * 시너지가 파티 단위로 적용되므로 요약도 파티마다 붙인다.
 */
function Party({
  slug,
  slotId,
  week,
  party,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  party: PartyView;
  editable: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-medium text-text-dim">{party.index + 1}파티</span>
        {party.synergies.length === 0 ? (
          <span className="text-[11px] text-text-faint">시너지 없음</span>
        ) : (
          party.synergies.map((synergy) => (
            <span
              key={synergy.kind}
              className={`syn ${SYNERGY_CLASS[synergy.kind]}`}
              title={synergy.label}
            >
              <span>
                {synergy.kind}
                {/* 수치는 종류마다 고정이라 함께 보여준다. 서폿은 딜러마다 달라 비어 있다. */}
                {synergy.value && ` ${synergy.value}`}
              </span>
              {synergy.count > 1 && <span className="syn-count">×{synergy.count}</span>}
            </span>
          ))
        )}
      </div>

{/*
        4인 파티가 늘 한 줄에 보여야 한다. 두 줄로 갈리면 어느 넷이 한 파티인지
        눈으로 다시 묶어야 하고, 시너지가 4인 단위라 그게 곧 오독으로 이어진다.
        좁아지면 카드가 함께 좁아진다(Cell.tsx의 세로 배치).
      */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {party.cells.map((cell) => (
          <Cell
            key={cell.position}
            slug={slug}
            slotId={slotId}
            week={week}
            cell={cell}
            editable={editable}
          />
        ))}
      </div>
    </div>
  );
}
