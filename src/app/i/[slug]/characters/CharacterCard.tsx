"use client";

import { useActionState } from "react";

import type { CharacterView } from "@/lib/characters";
import { synergyLabel } from "@/lib/synergy";

import { PortraitBleed } from "../Portrait";
import { type RowState, deleteAction, syncAction } from "./actions";

const IDLE: RowState = { status: "idle", message: "" };

function formatLevel(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

/**
 * 캐릭터 한 장. 편성 칸(`Cell`)과 같은 카드 형태를 쓴다.
 *
 * 같은 캐릭터가 두 화면에서 다르게 보이면 같은 대상인지 알아보기 어렵다. 그래서
 * 초상·칩·숫자 배치를 맞추고, 이 화면에만 있는 것(역할, 시너지, 갱신·삭제)을 덧붙인다.
 * 카드가 라이트/다크 어느 쪽에서도 어두운 이유는 globals.css의 `.char-card`에 적어뒀다.
 */
export function CharacterCard({
  slug,
  character,
}: {
  slug: string;
  character: CharacterView;
}) {
  const [syncState, sync, syncing] = useActionState(syncAction, IDLE);
  const [deleteState, remove, deleting] = useActionState(deleteAction, IDLE);

  const busy = syncing || deleting;
  const isSupport = character.role === "SUPPORT";

  const feedback = [deleteState, syncState].find((s) => s.status !== "idle");

  return (
    <li className="char-card min-h-[9.5rem] p-3">
      <PortraitBleed src={character.imageUrl} className={character.className} />

      {/* 초상 위에 얹으려면 쌓임 맥락이 필요하다. */}
      <div className="relative">
        {/* 글자는 초상과 겹치지 않게 왼쪽에만 둔다. */}
        <div className="pr-[40%]">
          <div className="flex flex-wrap gap-1">
            <span className="char-chip">{character.className ?? "클래스 미상"}</span>
            {character.classEngraving && (
              <span className="char-chip char-chip--engraving">
                {character.classEngraving}
              </span>
            )}
            {/* 역할은 각인과 아크패시브로 판정한다. 손댈 일이 없어 표시만 한다. */}
            <span className={`char-chip ${isSupport ? "char-chip--support" : "char-chip--dps"}`}>
              {isSupport ? "서폿" : "딜러"}
            </span>
          </div>

          <div className="char-name mt-1 truncate text-base">{character.name}</div>

          <div className="mt-1.5 flex gap-3">
            <div>
              <div className="char-label">템렙</div>
              <div className="char-value">{formatLevel(character.itemLevel)}</div>
            </div>
            <div>
              <div className="char-label">전투력</div>
              <div className="char-value char-dim">{formatLevel(character.combatPower)}</div>
            </div>
          </div>

          <div className="char-faint mt-1.5 space-y-0.5 text-[12px]">
            {character.arkGridSummary && (
              <div className="truncate tabular">아크그리드 {character.arkGridSummary}</div>
            )}
            <div className="truncate">
              시너지 {synergyLabel(character.className, character.role)}
            </div>
          </div>
        </div>

        {character.syncError && (
          <p className="char-notice char-notice--danger mt-2">{character.syncError}</p>
        )}

        {!character.syncError && character.stale && (
          <p className="char-notice mt-2">정보가 오래됐습니다. 갱신을 눌러 최신 스펙을 가져옵니다.</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <form action={sync}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={character.id} />
            <button type="submit" disabled={busy} className="char-btn">
              {syncing ? "갱신 중…" : "갱신"}
            </button>
          </form>

          <form
            action={remove}
            onSubmit={(e) => {
              if (!confirm(`${character.name} 캐릭터를 삭제하시겠습니까? 편성 기록도 함께 사라집니다.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={character.id} />
            <button type="submit" disabled={busy} className="char-btn char-btn--danger">
              삭제
            </button>
          </form>
        </div>

        {feedback && (
          <p
            className={`mt-1.5 text-[11px] ${
              feedback.status === "error" ? "char-danger" : "char-ok"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </li>
  );
}
