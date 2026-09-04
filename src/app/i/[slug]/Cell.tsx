"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import type { CellView } from "@/lib/board";
import { positionLabel } from "@/lib/positions";

import { readMyName } from "./MyNameField";
import { PortraitBleed } from "./Portrait";
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
      <div className="char-card char-card--empty flex min-h-[6.5rem] flex-col p-2">
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
    <div className="char-card min-h-[6.5rem] p-2">
      <PortraitBleed src={character.imageUrl} className={character.className} />

      {/* 초상 위에 얹으려면 쌓임 맥락이 필요하다. */}
      <div className="relative">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="char-label">{positionLabel(cell.position)}</span>
              {cell.pinned && (
                <span
                  className="char-accent text-[10px]"
                  title="이 자리는 수요일 리셋에 남는다"
                >
                  고정
                </span>
              )}
            </div>

            {/* 클래스와 직업 각인을 이름 위에 칩으로 둔다. 칸에서 가장 자주 찾는 두 가지다. */}
            <div className="mt-0.5 flex flex-wrap gap-1">
              <span className="char-chip">{character.className ?? "?"}</span>
              {character.classEngraving && (
                <span className="char-chip char-chip--engraving">
                  {character.classEngraving}
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
          <div className="char-faint mt-1 truncate pr-[42%] text-[10px] tabular">
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
