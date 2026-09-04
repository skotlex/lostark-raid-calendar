"use client";

import { useActionState } from "react";

import type { BoardSlotView, PartyView } from "@/lib/board";
import { raidLabel } from "@/lib/raids";

import { Cell } from "./Cell";
import { type CellState, keepRosterAction } from "./actions";

const IDLE: CellState = { status: "idle", message: "" };

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

        {slot.partyLabel && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-dim">
            {slot.partyLabel}
          </span>
        )}

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
                  ? "매주 초기화되도록 되돌린다"
                  : "이 공대 전원을 매주 그대로 유지한다"
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
              className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-dim"
              title={synergy.label}
            >
              {synergy.kind}
              {synergy.count > 1 && (
                <span className="ml-0.5 text-text-faint">×{synergy.count}</span>
              )}
            </span>
          ))
        )}
      </div>

      {/*
        카드가 초상까지 안고 있어 좁으면 숫자가 인물 위로 넘친다.
        4열은 화면이 충분히 넓을 때(lg)만 쓰고, 그 아래는 2열·1열로 카드를 넓힌다.
      */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
