"use client";

import { type DragEvent, startTransition, useActionState, useState } from "react";

import { MISSING_SYNERGY_WARNING, type BoardSlotView, type CellView } from "@/lib/board";
import { positionLabel } from "@/lib/positions";
import { getSynergies } from "@/lib/synergy";

import { NameInput } from "./NameInput";
import { SlotHeader } from "./SlotHeader";
import {
  type CellState,
  assignAction,
  moveAction,
  pinAction,
  unassignAction,
} from "./actions";
import { DRAG_TYPE, moveForm, readDragSource, writeDragSource } from "./dragCell";
import { ConfirmButton } from "./ConfirmButton";
import { CloseIcon, GripIcon, PinIcon } from "./icons";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 좁은 칸에 맞춰 경고를 줄인다.
 *
 * 표는 한 칸이 이름 너비뿐이라 문장이 들어가면 서너 줄로 접힌다. 카드 보기는 자리가
 * 넉넉하므로 원문 그대로 둔다.
 */
function shortWarning(warning: string) {
  return warning === MISSING_SYNERGY_WARNING ? "시너지 트라이포드 없음" : warning;
}

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
  const cells = slot.parties.flatMap((party) => party.cells);

  return (
    <section className="rounded border border-border bg-surface">
      <SlotHeader slug={slug} week={week} slot={slot} editable={editable} />

      {/* 좁은 화면에서는 표가 가로로 스크롤된다. 칸을 더 줄여 뭉개는 것보다 낫다. */}
      <div className="overflow-x-auto">
        <table className="board-table">
          <thead>
            <tr>
              <th className="board-head">구분</th>
              {cells.map((cell) => (
                <HeadCell
                  key={cell.position}
                  slug={slug}
                  slotId={slot.id}
                  week={week}
                  cell={cell}
                  editable={editable}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            <tr>
              <th className="board-label">캐릭터</th>
              {cells.map((cell) => (
                <NameCell
                  key={cell.position}
                  slug={slug}
                  slotId={slot.id}
                  week={week}
                  cell={cell}
                  taken={slot.takenNames}
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
 * 머리글 칸 — 자리 이름과 그 자리에 대한 조작.
 *
 * 옮기기·고정·비우기를 여기 모은다. 닉네임 칸에 두면 이름 옆이 버튼으로 붐벼서
 * 정작 먼저 읽어야 할 이름이 뒤로 밀린다. 자리에 대한 일이니 자리 이름 옆이 맞다.
 *
 * **끄는 손잡이도 여기다.** 이름을 끌게 하면 이름을 고르려다 끌리고, 빈 자리는
 * 끌 손잡이가 아예 없다.
 */
function HeadCell({
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
  const [pinState, pin, pinning] = useActionState(pinAction, IDLE);
  const [removeState, remove, removing] = useActionState(unassignAction, IDLE);
  const [moveState, move, moving] = useActionState(moveAction, IDLE);
  const [dropping, setDropping] = useState(false);

  const busy = pinning || removing || moving;
  const error = [pinState, removeState, moveState].find((s) => s.status === "error");
  const character = cell.character;
  const filled = Boolean(character);

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

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={cell.position} />
    </>
  );

  return (
    <th
      className="board-head"
      data-sup={cell.position.startsWith("SUP") ? "" : undefined}
      data-dropping={dropping ? "" : undefined}
      draggable={editable && filled}
      onDragStart={(e) => writeDragSource(e, { slotId, position: cell.position })}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={() => setDropping(false)}
      title={error?.message}
    >
      <div className="board-head-row">
        {/* 끌 수 있다는 표시. 사람이 없으면 끌 것도 없어 자리만 지킨다. */}
        <span className="board-grip" data-on={editable && filled ? "" : undefined} aria-hidden>
          <GripIcon />
        </span>

        <span className="truncate">{positionLabel(cell.position)}</span>

        {editable && filled && (
          <span className="board-actions">
            <form action={pin}>
              {hidden}
              <input type="hidden" name="pinned" value={cell.pinned ? "false" : "true"} />
              <button
                type="submit"
                disabled={busy}
                title={cell.pinned ? "고정 해제" : "이 자리 고정 (리셋에서 제외)"}
                aria-label={cell.pinned ? "고정 해제" : "자리 고정"}
                className={`flex transition-colors ${
                  cell.pinned ? "text-accent" : "text-text-faint hover:text-text"
                }`}
              >
                <PinIcon pinned={cell.pinned} />
              </button>
            </form>

            <form action={remove}>
              {hidden}
              {/* 남이 넣은 신청을 지울 때만 묻는다. 카드 쪽과 같은 규칙이다. */}
              <ConfirmButton
                when={Boolean(cell.createdByLabel) && !cell.mine}
                message={`${cell.createdByLabel}님이 넣은 ${character?.name}을(를) 빼시겠습니까?`}
                confirmLabel="빼기"
                disabled={busy}
                title="자리 비우기"
                aria-label="자리 비우기"
                className="flex text-text-faint transition-colors hover:text-danger disabled:opacity-50"
              >
                <CloseIcon />
              </ConfirmButton>
            </form>
          </span>
        )}
      </div>
    </th>
  );
}

/**
 * 닉네임 칸.
 *
 * 표에서도 칸에 이름을 쳐서 넣는다. 이게 이 앱의 주 입력 경로라 보기를 바꿨다고
 * 카드로 돌아가 넣게 하지 않는다(CLAUDE.md 2-2).
 *
 * 빈 칸의 입력창은 테두리 없이 둔다. 상자를 그리면 그 줄만 키가 커져 표가 어긋나고,
 * 여덟 칸이 모두 비어 있을 때는 상자 여덟 개가 늘어서 표가 입력 폼처럼 보인다.
 */
function NameCell({
  slug,
  slotId,
  week,
  cell,
  taken,
  editable,
}: {
  slug: string;
  slotId: string;
  week: string;
  cell: CellView;
  /** 이 레이드에 이미 들어간 캐릭터. 자동완성에서 뺀다 */
  taken: string[];
  editable: boolean;
}) {
  const [assignState, assign, assigning] = useActionState(assignAction, IDLE);
  const error = assignState.status === "error" ? assignState : null;
  const character = cell.character;

  if (!character) {
    return (
      <td className="board-cell board-cell--name">
        {editable ? (
          <form action={assign}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="slotId" value={slotId} />
            <input type="hidden" name="week" value={week} />
            <input type="hidden" name="position" value={cell.position} />
            <NameInput
              name="characterName"
              pending={assigning}
              resetOn={assignState.status === "ok" ? assignState : null}
              error={error?.message}
              taken={taken}
              placeholder="캐릭터 입력"
              className="board-input"
            />
          </form>
        ) : (
          <span className="text-text-faint">-</span>
        )}
      </td>
    );
  }

  return (
    <td className="board-cell board-cell--name">
      <div className="truncate font-semibold" title={character.name}>
        {character.name}
      </div>

      {cell.warnings.map((warning) => (
        <div key={warning} className="board-warn">
          {shortWarning(warning)}
        </div>
      ))}
    </td>
  );
}
