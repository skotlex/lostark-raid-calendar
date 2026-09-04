"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { CellView } from "@/lib/board";
import { positionLabel } from "@/lib/positions";

import { readMyName } from "./MyNameField";
import { Portrait } from "./Portrait";
import { type CellState, assignAction, pinAction, unassignAction } from "./actions";

const IDLE: CellState = { status: "idle", message: "" };

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
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 배치에 성공하면 입력창을 닫는다. 실패하면 열어둔 채 메시지를 보여준다.
  useEffect(() => {
    if (assignState.status === "ok") setEditing(false);
  }, [assignState]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const busy = assigning || removing || pinning;
  const error = [assignState, removeState, pinState].find((s) => s.status === "error");
  const character = cell.character;

  const hidden = (
    <>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={cell.position} />
    </>
  );

  // --- 빈 칸 ---------------------------------------------------------------
  if (!character) {
    return (
      <div className="flex min-h-24 flex-col rounded border border-dashed border-border p-2">
        <div className="text-[11px] text-text-faint">{positionLabel(cell.position)}</div>

        {!editable ? (
          <div className="mt-1 text-xs text-text-faint">비어 있음</div>
        ) : editing ? (
          <form
            action={(formData) => {
              formData.set("actorLabel", readMyName());
              assign(formData);
            }}
            className="mt-1"
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
              className="w-full rounded border border-border bg-bg px-1.5 py-1 text-xs focus:border-accent focus:outline-none"
            />
            {assigning && <div className="mt-1 text-[11px] text-text-faint">조회 중…</div>}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-1 flex-1 rounded text-xs text-text-faint transition-colors hover:bg-surface-2 hover:text-text"
          >
            + 닉네임 입력
          </button>
        )}

        {error && <p className="mt-1 text-[11px] text-danger">{error.message}</p>}
      </div>
    );
  }

  // --- 채워진 칸 -----------------------------------------------------------
  return (
    <div className="min-h-24 rounded border border-border bg-surface p-2">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-faint">{positionLabel(cell.position)}</span>
        {cell.pinned && (
          <span className="text-[11px] text-accent" title="이 자리는 수요일 리셋에 남는다">
            고정
          </span>
        )}
        {editable && (
          <div className="ml-auto flex items-center gap-0.5">
            <form action={pin}>
              {hidden}
              <input type="hidden" name="pinned" value={cell.pinned ? "false" : "true"} />
              <button
                type="submit"
                disabled={busy}
                title={cell.pinned ? "고정 해제" : "이 자리 고정 (리셋에서 제외)"}
                aria-label={cell.pinned ? "고정 해제" : "자리 고정"}
                className={`rounded px-1 text-xs transition-colors disabled:opacity-50 ${
                  cell.pinned ? "text-accent" : "text-text-faint hover:text-text"
                }`}
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
                className="rounded px-1 text-xs text-text-faint transition-colors hover:text-danger disabled:opacity-50"
              >
                ✕
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="mt-1 flex gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{character.name}</div>
          <div className="truncate text-xs text-text-dim">{character.className ?? "?"}</div>
          {character.classEngraving && (
            <div className="truncate text-xs text-accent">{character.classEngraving}</div>
          )}
          <div className="mt-1 flex flex-wrap gap-x-2 text-xs tabular">
            <span>{format(character.itemLevel)}</span>
            <span className="text-text-dim">{format(character.combatPower)}</span>
          </div>
          {character.arkGridSummary && (
            <div className="truncate text-[11px] text-text-faint">
              {character.arkGridSummary}
            </div>
          )}
        </div>

        <Portrait src={character.imageUrl} className={character.className} size="sm" />
      </div>

      {cell.warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {cell.warnings.map((warning) => (
            <li key={warning} className="text-[11px] text-danger">
              {warning}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-[11px] text-danger">{error.message}</p>}
    </div>
  );
}
