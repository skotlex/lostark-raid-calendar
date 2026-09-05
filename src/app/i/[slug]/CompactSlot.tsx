"use client";

import { type DragEvent, startTransition, useActionState, useState } from "react";

import type { BoardSlotView, CellView } from "@/lib/board";
import { positionLabel } from "@/lib/positions";
import { raidLabel } from "@/lib/raids";
import { getSynergies } from "@/lib/synergy";

import { NameInput } from "./NameInput";
import {
  type CellState,
  assignAction,
  keepRosterAction,
  moveAction,
  pinAction,
  unassignAction,
} from "./actions";
import { DRAG_TYPE, moveForm, readDragSource, writeDragSource } from "./dragCell";
import { CloseIcon, PinIcon } from "./icons";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 간략 보기 — 8인이 한 줄에 들어가는 표.
 *
 * 카드는 초상·각인·아크그리드까지 보여주는 대신 8인이 두 줄로 갈린다. 편성을 짤 때는
 * 여덟을 한눈에 놓고 시너지를 맞추는 편이 빠르다. 시트에서 쓰던 모양이기도 하다.
 *
 * 세로가 항목, 가로가 자리다. 같은 항목이 한 줄에 늘어서므로 템레벨이 낮은 사람이나
 * 시너지가 겹치는 자리가 눈으로 잡힌다. 카드로는 칸마다 위치가 달라 그게 안 된다.
 *
 * **4인 레이드는 이 보기를 쓰지 않는다.** 넷은 카드로도 한 줄에 들어가고, 초상까지
 * 보이는 편이 낫다(page.tsx에서 가른다).
 */
export function CompactSlot({
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
  const cells = slot.parties.flatMap((party) => party.cells);

  return (
    <section className="rounded border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2">
        <h3 className="font-semibold">
          {raidLabel(slot.raidName, slot.difficulty)}
          <span className="ml-2 text-text-dim tabular">{slot.startTime}</span>
        </h3>
        <span className="text-xs text-text-faint tabular">
          {slot.filled}/{slot.partySize}
        </span>

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
                  ? "다음 주에 인원이 비워집니다"
                  : "이 공대 전원을 매주 그대로 유지합니다"
              }
              className={`rounded border px-2 py-0.5 text-xs transition-colors ${
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

      {/* 좁은 화면에서는 표가 가로로 스크롤된다. 칸을 더 줄여 뭉개는 것보다 낫다. */}
      <div className="overflow-x-auto">
        <table className="board-table">
          <thead>
            <tr>
              <th className="board-head">구분</th>
              {cells.map((cell) => (
                <th
                  key={cell.position}
                  className="board-head"
                  data-sup={cell.position.startsWith("SUP") ? "" : undefined}
                >
                  {positionLabel(cell.position)}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <th className="board-label">닉네임</th>
              {cells.map((cell) => (
                <NameCell
                  key={cell.position}
                  slug={slug}
                  slotId={slot.id}
                  week={week}
                  cell={cell}
                  editable={editable}
                />
              ))}
            </tr>

            <Row label="클래스" cells={cells} render={(c) => c.character?.className ?? ""} />
            <Row
              label="템레벨"
              cells={cells}
              render={(c) => format(c.character?.itemLevel)}
              tabular
            />
            <Row
              label="전투력"
              cells={cells}
              render={(c) => format(c.character?.combatPower)}
              tabular
            />
            <Row label="시너지" cells={cells} render={synergyText} />
          </tbody>
        </table>
      </div>

      {keepState.status === "error" && (
        <p className="px-3 pb-2 text-xs text-danger">{keepState.message}</p>
      )}
    </section>
  );
}

function format(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toFixed(2);
}

/** "치적 10%, 받피증 6%". 카드의 칩과 같은 값을 글자로만 적는다. */
function synergyText(cell: CellView): string {
  const character = cell.character;
  if (!character) return "";

  return getSynergies(character.className, character.role, character.skillSynergies)
    .map((s) => (s.value ? `${s.kind} ${s.value}` : s.kind))
    .join(", ");
}

function Row({
  label,
  cells,
  render,
  tabular,
}: {
  label: string;
  cells: CellView[];
  render: (cell: CellView) => string;
  tabular?: boolean;
}) {
  return (
    <tr>
      <th className="board-label">{label}</th>
      {cells.map((cell) => (
        <td key={cell.position} className={`board-cell ${tabular ? "tabular" : ""}`}>
          {render(cell)}
        </td>
      ))}
    </tr>
  );
}

/**
 * 닉네임 칸.
 *
 * 표에서도 칸에 이름을 쳐서 넣는다. 이게 이 앱의 주 입력 경로라 보기를 바꿨다고
 * 카드로 돌아가 넣게 하지 않는다(CLAUDE.md 2-2).
 *
 * 자리 고정과 드래그 이동도 카드와 똑같이 된다. 보기를 바꿨다고 할 수 있는 일이
 * 줄면, 짜는 동안에는 결국 카드로 돌아가게 된다.
 */
function NameCell({
  slug,
  slotId,
  week,
  cell,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  cell: CellView;
  editable: boolean;
}) {
  const [assignState, assign, assigning] = useActionState(assignAction, IDLE);
  const [removeState, remove, removing] = useActionState(unassignAction, IDLE);
  const [pinState, pin, pinning] = useActionState(pinAction, IDLE);
  const [moveState, move, moving] = useActionState(moveAction, IDLE);
  const [dropping, setDropping] = useState(false);

  const busy = assigning || removing || pinning || moving;
  const error = [assignState, removeState, pinState, moveState].find(
    (s) => s.status === "error",
  );
  const character = cell.character;

  // 빈 칸도 드롭을 받는다. 받는 칸이 차 있으면 서버에서 맞바꾼다.
  function onDragOver(e: DragEvent<HTMLElement>) {
    if (!editable || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
    // preventDefault를 해야 이 칸이 드롭을 받는다.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropping(true);
  }

  function onDrop(e: DragEvent<HTMLElement>) {
    setDropping(false);
    if (!editable) return;

    const from = readDragSource(e);
    if (!from) return;
    e.preventDefault();
    if (from.slotId === slotId && from.position === cell.position) return;

    // drop 핸들러에서 부르는 것이라 전환을 직접 연다(Cell.tsx와 같은 이유).
    startTransition(() =>
      move(moveForm({ slug, week, from, to: { slotId, position: cell.position } })),
    );
  }

  const dropProps = {
    onDragOver,
    onDrop,
    onDragLeave: () => setDropping(false),
    "data-dropping": dropping ? "" : undefined,
  };

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={cell.position} />
    </>
  );

  if (!character) {
    return (
      <td {...dropProps} className="board-cell board-cell--name">
        {editable ? (
          <form action={assign}>
            {hidden}
            <NameInput
              name="characterName"
              pending={assigning}
              resetOn={assignState.status === "ok" ? assignState : null}
              error={error?.message}
            />
          </form>
        ) : (
          <span className="text-text-faint">-</span>
        )}
      </td>
    );
  }

  return (
    <td
      {...dropProps}
      draggable={editable}
      onDragStart={(e) => writeDragSource(e, { slotId, position: cell.position })}
      className="board-cell board-cell--name"
    >
      <div className="flex items-center justify-center gap-1">
        <span className="truncate font-semibold" title={character.name}>
          {character.name}
        </span>

        {editable && (
          <form action={pin}>
            {hidden}
            <input type="hidden" name="pinned" value={cell.pinned ? "false" : "true"} />
            <button
              type="submit"
              disabled={busy}
              title={cell.pinned ? "고정 해제" : "이 자리 고정 (리셋에서 제외)"}
              aria-label={cell.pinned ? "고정 해제" : "자리 고정"}
              className={`transition-colors ${
                cell.pinned ? "text-accent" : "text-text-faint hover:text-text"
              }`}
            >
              <PinIcon pinned={cell.pinned} />
            </button>
          </form>
        )}

        {editable && (
          <form
            action={remove}
            onSubmit={(e) => {
              // 남이 넣은 신청을 지울 때만 한 번 확인한다. 카드 쪽과 같은 규칙이다.
              if (cell.createdByLabel && !cell.mine) {
                if (
                  !confirm(`${cell.createdByLabel}님이 넣은 ${character.name}을(를) 빼시겠습니까?`)
                ) {
                  e.preventDefault();
                }
              }
            }}
          >
            {hidden}
            <button
              type="submit"
              disabled={busy}
              title="자리 비우기"
              aria-label="자리 비우기"
              className="text-text-faint transition-colors hover:text-danger disabled:opacity-50"
            >
              <CloseIcon />
            </button>
          </form>
        )}
      </div>

      {cell.warnings.map((warning) => (
        <div key={warning} className="board-warn">
          {warning}
        </div>
      ))}
      {error && <div className="board-warn">{error.message}</div>}
    </td>
  );
}
