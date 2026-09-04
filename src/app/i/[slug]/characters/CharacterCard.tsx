"use client";

import { useActionState } from "react";

import type { CharacterView } from "@/lib/characters";
import { synergyLabel } from "@/lib/synergy";

import { Portrait } from "../Portrait";
import { type RowState, deleteAction, syncAction } from "./actions";

const IDLE: RowState = { status: "idle", message: "" };

function formatLevel(value: number | null): string {
  return value === null ? "-" : value.toFixed(2);
}

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
    <li className="rounded border border-border bg-surface p-3">
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{character.name}</span>
            {/* 역할은 아크패시브 진화 노드로 판정한다. 손댈 일이 없어 표시만 한다. */}
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                isSupport ? "bg-support/20 text-support" : "bg-dps/20 text-dps"
              }`}
            >
              {isSupport ? "서폿" : "딜러"}
            </span>
          </div>

          <div className="mt-0.5 truncate text-sm text-text-dim">
            {character.className ?? "클래스 미상"}
            {character.classEngraving && (
              <span className="text-accent"> · {character.classEngraving}</span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm tabular">
            <span>
              <span className="text-text-faint">템</span>{" "}
              <strong>{formatLevel(character.itemLevel)}</strong>
            </span>
            <span>
              <span className="text-text-faint">전투력</span>{" "}
              <strong>{formatLevel(character.combatPower)}</strong>
            </span>
          </div>

          <div className="mt-1 space-y-0.5 text-xs text-text-dim">
            {character.arkGridSummary && <div>아크그리드 {character.arkGridSummary}</div>}
            <div>시너지 {synergyLabel(character.className, character.role)}</div>
          </div>
        </div>

        <Portrait src={character.imageUrl} className={character.className} size="md" />
      </div>

      {character.syncError && (
        <p className="mt-2 rounded bg-danger/15 px-2 py-1 text-xs text-danger">
          {character.syncError}
        </p>
      )}

      {!character.syncError && character.stale && (
        <p className="mt-2 text-xs text-text-faint">
          정보가 오래됐다. 갱신을 눌러 최신 스펙을 가져온다.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <form action={sync}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={character.id} />
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-border px-2 py-1 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
          >
            {syncing ? "갱신 중…" : "갱신"}
          </button>
        </form>

        <form
          action={remove}
          className="ml-auto"
          onSubmit={(e) => {
            if (!confirm(`${character.name} 캐릭터를 삭제한다. 편성 기록도 함께 사라진다.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={character.id} />
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-transparent px-2 py-1 text-xs text-text-faint transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            삭제
          </button>
        </form>
      </div>

      {feedback && (
        <p
          className={`mt-1.5 text-xs ${
            feedback.status === "error" ? "text-danger" : "text-ok"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </li>
  );
}
