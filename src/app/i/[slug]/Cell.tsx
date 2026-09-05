"use client";

import { type DragEvent, startTransition, useActionState, useState } from "react";

import type { CellView } from "@/lib/board";
import { positionKind, positionLabel } from "@/lib/positions";

import { NameInput } from "./NameInput";
import { PortraitCard } from "./Portrait";
import {
  type CellState,
  assignAction,
  moveAction,
  pinAction,
  unassignAction,
} from "./actions";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 끌고 있는 것이 편성 칸이라는 표시.
 *
 * 전용 타입을 쓰면 dragover에서 "이건 받을 수 있는 것"인지 미리 가려낼 수 있다.
 * 브라우저 밖에서 끌어온 파일이나 글자에는 반응하지 않는다.
 */
const DRAG_TYPE = "application/x-loa-cell";

function format(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

/**
 * 소수점을 버린 표기. 좁은 칸에서 폭을 아끼려고 쓴다.
 *
 * 반올림이 아니라 버림이다. 템레벨은 구간 진입이 기준이라 1791.66을 1792로 올리면
 * 아직 닿지 않은 구간에 든 것처럼 읽힌다.
 */
function formatShort(value: number | null): string {
  return value === null ? "-" : String(Math.floor(value));
}

/**
 * 템렙·전투력 한 칸.
 *
 * 두 표기를 모두 넣고 CSS가 고른다. 숫자를 자르는 것은 CSS가 못 하는 일이라
 * 칸 폭에 따라 바꾸려면 둘 다 그려두는 수밖에 없다. 화면 낭독기가 같은 값을 두 번
 * 읽지 않도록 숨는 쪽은 display로 지운다(globals.css).
 */
function Stat({
  label,
  value,
  dim,
}: {
  label: string;
  value: number | null;
  dim?: boolean;
}) {
  return (
    <div className="char-stat">
      <span className="char-label">{label}</span>
      <span className={`char-value ${dim ? "char-dim" : ""}`}>
        <span className="char-num-full">{format(value)}</span>
        <span className="char-num-short">{formatShort(value)}</span>
      </span>
    </div>
  );
}

export function Cell({
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
  const [dragging, setDragging] = useState(false);

  const busy = assigning || removing || pinning || moving;
  const error = [assignState, removeState, pinState, moveState].find(
    (s) => s.status === "error",
  );
  const character = cell.character;

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={cell.position} />
    </>
  );

  // --- 드래그로 자리 옮기기 -------------------------------------------------
  //
  // 끌 수 있는 것은 채워진 칸이고, 받는 것은 빈 칸을 포함한 모든 칸이다.
  // 받는 칸이 차 있으면 서버에서 맞바꾼다.

  function onDragStart(e: DragEvent<HTMLElement>) {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ slotId, position: cell.position }));
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }

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
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();

    let from: { slotId: string; position: string };
    try {
      from = JSON.parse(raw);
    } catch {
      return;
    }
    if (from.slotId === slotId && from.position === cell.position) return;

    const formData = new FormData();
    formData.set("slug", slug);
    formData.set("week", week);
    formData.set("fromSlotId", from.slotId);
    formData.set("fromPosition", from.position);
    formData.set("toSlotId", slotId);
    formData.set("toPosition", cell.position);
    // form의 action이 아니라 drop 핸들러에서 부르는 것이라 전환을 직접 열어야 한다.
    // 그러지 않으면 moving(isPending)이 갱신되지 않아 이동 중에도 버튼이 열려 있다.
    startTransition(() => move(formData));
  }

  const dropProps = {
    onDragOver,
    onDrop,
    onDragLeave: () => setDropping(false),
  };

  // --- 빈 칸 ---------------------------------------------------------------
  if (!character) {
    return (
      <div
        {...dropProps}
        className={`char-card char-card--empty flex flex-col p-2 ${
          dropping ? "char-card--dropping" : ""
        }`}
      >
        {/* 빈 칸에는 자리 이름을 남긴다. 어느 자리를 채우는지 알 단서가 이것뿐이다. */}
        <div className="char-label">{positionLabel(cell.position)}</div>

        {/* 가운데는 자리 표식이 차지한다. 입력창은 아래에 붙는다. */}
        <PositionMark position={cell.position} />

        {/*
          입력창은 처음부터 보인다. 예전에는 "+ 닉네임 입력"을 눌러야 나타났는데,
          누르기 전과 후의 높이가 달라 칸이 들썩였고 채우려면 클릭이 한 번 더 들었다.
          시트에서 셀에 바로 치던 동작에 가깝게 둔다.
        */}
        {!editable ? (
          <div className="char-faint text-center text-xs">비어 있음</div>
        ) : (
          <form action={assign}>
            {hidden}
            <NameInput name="characterName" disabled={assigning} />
            {assigning && <div className="char-faint mt-1 text-[11px]">조회 중…</div>}
          </form>
        )}

        {error && <p className="char-danger mt-1 text-[11px]">{error.message}</p>}
      </div>
    );
  }

  // --- 채워진 칸 -----------------------------------------------------------
  //
  // **마크업 하나로 두 구도를 낸다.** 칸이 넓으면 인물이 오른쪽에 걸치고 글자가 왼쪽에
  // 쌓이고, 좁으면 인물이 가운데 서고 글자가 위아래에 얹힌다. 전환은 CSS가 한다
  // (globals.css의 컨테이너 쿼리). 두 벌을 만들면 한쪽만 고치는 실수가 난다.
  //
  // 초상 때문에 이 칸만은 라이트 모드에서도 어둡다(globals.css 참조).
  return (
    <div
      {...dropProps}
      draggable={editable}
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      className={`char-card char-card--filled ${dropping ? "char-card--dropping" : ""} ${
        dragging ? "char-card--dragging" : ""
      }`}
    >
      <PortraitCard src={character.imageUrl} className={character.className} />

      <div className="char-top">
        <div className="min-w-0 flex-1">
          {/* 직업 각인이 칸에서 가장 먼저 읽히는 정보다. 클래스는 그다음. */}
          <div className="char-chip-line">
            {character.classEngraving && (
              <span
                className={`char-chip ${
                  character.role === "SUPPORT"
                    ? "char-chip--engraving-sup"
                    : "char-chip--engraving"
                }`}
              >
                {character.classEngraving}
              </span>
            )}
            <span className="char-chip char-chip--class">{character.className ?? "?"}</span>
            {cell.pinned && (
              <span
                className="char-chip char-chip--pinned"
                title="이 자리는 수요일 리셋에 남습니다"
              >
                고정
              </span>
            )}
          </div>
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-0.5">
            <form action={pin}>
              {hidden}
              <input type="hidden" name="pinned" value={cell.pinned ? "false" : "true"} />
              <button
                type="submit"
                disabled={busy}
                title={cell.pinned ? "고정 해제" : "이 자리 고정 (리셋에서 제외)"}
                aria-label={cell.pinned ? "고정 해제" : "자리 고정"}
                className={`char-icon-btn ${cell.pinned ? "char-accent" : ""}`}
              >
                <PinIcon pinned={cell.pinned} />
              </button>
            </form>
            <form
              action={remove}
              onSubmit={(e) => {
                // 남이 넣은 신청을 지울 때만 한 번 확인한다.
                // 누구 것인지는 서버가 정한다(board.ts의 CellView.mine).
                if (cell.createdByLabel && !cell.mine) {
                  if (!confirm(`${cell.createdByLabel}님이 넣은 ${character.name}을(를) 빼시겠습니까?`)) {
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
                className="char-icon-btn hover:text-[color:var(--c-danger)]"
              >
                ✕
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 좁을 때만 벌어진다. 인물이 보이도록 가운데를 비운다. */}
      <div className="char-gap" />

      <div className="char-bottom">
        <div className="char-name truncate">{character.name}</div>

{/*
          좁은 칸에서는 아크그리드가 스탯과 같은 줄 오른쪽에 붙어 한 줄을 아낀다.
          넓어지면 아래로 내려가 제자리를 찾는다(globals.css).
        */}
        <div className="char-stat-line">
          <Stat label="레벨" value={character.itemLevel} />
          <Stat label="전투력" value={character.combatPower} dim />

          {character.arkGridSummary && (
            <div className="char-arkgrid char-faint tabular">{character.arkGridSummary}</div>
          )}
        </div>
      </div>

      {(cell.warnings.length > 0 || error) && (
        <ul className="char-notices">
          {cell.warnings.map((warning) => (
            <li key={warning} className="char-danger text-[10px] leading-4">
              {warning}
            </li>
          ))}
          {error && <li className="char-danger text-[10px] leading-4">{error.message}</li>}
        </ul>
      )}
    </div>
  );
}

/**
 * 자리 고정 압정.
 *
 * 이모지(📌)는 글꼴에 딸린 그림이라 OS마다 모양도 색도 다르고, 옆의 ✕과 크기·굵기가
 * 맞지 않는다. 직접 그리면 currentColor를 따라가므로 고정된 자리에서 금색으로 물든다.
 *
 * 11px 근처에서 읽혀야 해서 머리·몸통·바늘 세 획으로 줄였다. 꽂힌 상태는 몸통을 채워
 * 색만으로 구분하지 않게 한다. 색약이거나 화면이 밝을 때 색 하나로는 잘 안 보인다.
 */
function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3.5h6" />
      <path d="M10 3.5v5L7.3 12.5h9.4L14 8.5v-5z" fill={pinned ? "currentColor" : "none"} />
      <path d="M12 12.5v8" />
    </svg>
  );
}

/**
 * 빈 자리 표식.
 *
 * 채워진 칸은 초상이 있어 한눈에 알아보는데 빈 칸은 회색 상자뿐이라 나란히 놓이면
 * 격자가 허전하다. 남는 자리에 표식을 넣어 짝을 맞춘다.
 *
 * 딜과 폿을 다른 그림·다른 색으로 둔다. 시너지 요약을 읽지 않아도 어느 쪽이 비었는지
 * 훑는 것만으로 걸린다. 색은 칩에 쓰는 --dps/--support 그대로다.
 *
 * 흐리게 두는 것이 중요하다. 빈 자리가 채워진 자리보다 눈에 띄면 읽는 순서가 뒤집힌다.
 */
function PositionMark({ position }: { position: string }) {
  const kind = positionKind(position);

  return (
    <div className="empty-mark" data-kind={kind ?? ""} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        {kind === "SUP" ? (
          // 하트 + 십자. 서폿이 하는 일은 막아서는 것이 아니라 살리고 버프하는 것이라
          // 방패보다 힐 표시가 맞다. 십자만 두면 "+"로 읽혀 자리를 추가하는 버튼처럼
          // 보이므로 하트 안에 넣는다.
          <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21S2.75 15.5 2.75 9.25A5.25 5.25 0 0 1 12 6a5.25 5.25 0 0 1 9.25 3.25C21.25 15.5 12 21 12 21z" />
            <path d="M12 9.1v4.8" />
            <path d="M9.6 11.5h4.8" />
          </g>
        ) : (
          // 검. 곧게 세우면 날과 가드가 십자가로 읽힌다. 비스듬히 눕히고 날에 두께를
          // 줘야 이 크기에서도 검으로 보인다.
          <g strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 17.5 21 6V3h-3L6.5 14.5" />
            <path d="M11 19 5 13" />
            <path d="M8 16 4 20" />
            <path d="M5 21 3 19" />
          </g>
        )}
      </svg>
    </div>
  );
}
