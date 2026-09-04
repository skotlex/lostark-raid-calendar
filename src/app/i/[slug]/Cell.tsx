"use client";

import { type DragEvent, useActionState, useEffect, useRef, useState } from "react";

import type { CellView } from "@/lib/board";
import { positionLabel } from "@/lib/positions";

import { readMyName } from "./MyNameField";
import { PortraitBleed } from "./Portrait";
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
  const [editing, setEditing] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 배치에 성공하면 입력창을 닫는다. 실패하면 열어둔 채 메시지를 보여준다.
  useEffect(() => {
    if (assignState.status === "ok") setEditing(false);
  }, [assignState]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

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
    formData.set("actorLabel", readMyName());
    move(formData);
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
        className={`char-card char-card--empty flex min-h-[6.5rem] flex-col p-2 ${
          dropping ? "char-card--dropping" : ""
        }`}
      >
        {/* 빈 칸에는 자리 이름을 남긴다. 어느 자리를 채우는지 알 단서가 이것뿐이다. */}
        <div className="char-label">{positionLabel(cell.position)}</div>

        {!editable ? (
          <div className="char-faint mt-1 text-xs">비어 있음</div>
        ) : editing ? (
          <form
            action={(formData) => {
              formData.set("actorLabel", readMyName());
              assign(formData);
            }}
            className="mt-2"
          >
            {hidden}
            <input
              ref={inputRef}
              name="characterName"
              list={`chars-${slug}`}
              placeholder="닉네임"
              required
              disabled={assigning}
              onBlur={(e) => {
                // 값 없이 벗어나면 그냥 닫는다. 빈 입력창이 남지 않게.
                if (!e.currentTarget.value) setEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className="char-input"
            />
            {assigning && <div className="char-faint mt-1 text-[11px]">조회 중…</div>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="char-faint mt-1 flex-1 rounded text-xs transition-colors hover:bg-white/5 hover:text-[color:var(--c-text)]"
          >
            + 닉네임 입력
          </button>
        )}

        {error && <p className="char-danger mt-1 text-[11px]">{error.message}</p>}
      </div>
    );
  }

  // --- 채워진 칸 -----------------------------------------------------------
  //
  // 전적 사이트의 캐릭터 카드 형태다. 초상이 오른쪽 끝에 걸쳐 배경으로 깔리고,
  // 글자는 그 위 왼쪽에 쌓인다. 카드는 라이트/다크 어느 쪽에서도 어둡다(globals.css 참조).
  return (
    <div
      {...dropProps}
      draggable={editable}
      onDragStart={onDragStart}
      onDragEnd={() => setDragging(false)}
      className={`char-card min-h-[6.5rem] p-2 ${dropping ? "char-card--dropping" : ""} ${
        dragging ? "char-card--dragging" : ""
      }`}
    >
      <PortraitBleed src={character.imageUrl} className={character.className} />

      {/* 초상 위에 얹으려면 쌓임 맥락이 필요하다. */}
      <div className="relative">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            {/* 클래스·직업 각인·고정 여부. 칸에서 가장 자주 찾는 것들이다. */}
            <div className="flex flex-wrap gap-1">
              <span className="char-chip">{character.className ?? "?"}</span>
              {character.classEngraving && (
                <span className="char-chip char-chip--engraving">
                  {character.classEngraving}
                </span>
              )}
              {cell.pinned && (
                <span
                  className="char-chip char-chip--pinned"
                  title="이 자리는 수요일 리셋에 남는다"
                >
                  고정
                </span>
              )}
            </div>

            <div className="char-name mt-1 truncate pr-1">{character.name}</div>
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
                  📌
                </button>
              </form>
              <form
                action={(formData) => {
                  formData.set("actorLabel", readMyName());
                  remove(formData);
                }}
                onSubmit={(e) => {
                  const mine = readMyName();
                  // 남이 넣은 신청을 지울 때만 한 번 확인한다.
                  if (cell.createdByLabel && cell.createdByLabel !== mine) {
                    if (!confirm(`${cell.createdByLabel}님이 넣은 ${character.name}을(를) 뺀다.`)) {
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

        {/* 템레벨과 전투력. 숫자가 커서 초상과 겹치지 않게 왼쪽에만 둔다. */}
        <div className="mt-1.5 flex gap-3 pr-[42%]">
          <div>
            <div className="char-label">템렙</div>
            <div className="char-value">{format(character.itemLevel)}</div>
          </div>
          <div>
            <div className="char-label">전투력</div>
            <div className="char-value char-dim">{format(character.combatPower)}</div>
          </div>
        </div>

        {character.arkGridSummary && (
          <div className="char-faint mt-1 truncate pr-[42%] text-[11px] tabular">
            {character.arkGridSummary}
          </div>
        )}

        {/* 경고와 오류는 카드 폭을 다 쓴다. 초상 위로 지나가므로 바탕을 깐다. */}
        {(cell.warnings.length > 0 || error) && (
          <ul className="mt-1 space-y-0.5">
            {cell.warnings.map((warning) => (
              <li
                key={warning}
                className="char-danger rounded bg-black/55 px-1 text-[10px] leading-4"
              >
                {warning}
              </li>
            ))}
            {error && (
              <li className="char-danger rounded bg-black/55 px-1 text-[10px] leading-4">
                {error.message}
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
