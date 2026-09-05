"use client";

import type { BoardSlotView, PartyView } from "@/lib/board";
import type { SynergyKind } from "@/lib/synergy";

import { Cell } from "./Cell";
import { SlotHeader } from "./SlotHeader";

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
  return (
    <section className="rounded border border-border bg-surface">
      <SlotHeader slug={slug} slot={slot} editable={editable} />

      <div className="space-y-3 p-3">
        {slot.parties.map((party) => (
          <Party
            key={party.index}
            slug={slug}
            slotId={slot.id}
            week={week}
            party={party}
            // 파티가 하나뿐인 4인 레이드에 "1파티"는 알려주는 것이 없다.
            showLabel={slot.parties.length > 1}
            editable={editable}
          />
        ))}

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
  showLabel,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  party: PartyView;
  showLabel: boolean;
  editable: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {showLabel && (
          <span className="text-xs font-medium text-text-dim">{party.index + 1}파티</span>
        )}
        {party.synergies.length === 0 ? (
          // 칩과 같은 모양이라야 첫 사람이 들어올 때 줄 높이가 그대로다.
          <span className="syn syn-none">시너지 없음</span>
        ) : (
          party.synergies.map((synergy) => (
            <span
              key={synergy.kind}
              className={`syn ${SYNERGY_CLASS[synergy.kind]}`}
              title={`${synergy.label} — ${synergy.sources.join(", ")}`}
            >
              <span>
                {synergy.kind}
                {/* 수치는 종류마다 고정이라 함께 보여준다. 서폿은 딜러마다 달라 비어 있다. */}
                {synergy.value && ` ${synergy.value}`}
              </span>
              {/* 어느 직업이 주는지. 자리를 옮길 때 무엇이 따라 빠지는지 알아야 한다. */}
              <span className="syn-from">{synergy.sources.join("·")}</span>
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
