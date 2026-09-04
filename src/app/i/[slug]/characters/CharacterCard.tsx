"use client";

import Image from "next/image";
import { useActionState, useState } from "react";

import type { CharacterView } from "@/lib/characters";
import { classColor } from "@/lib/classColors";
import { synergyLabel } from "@/lib/synergy";

import { type RowState, deleteAction, setRoleAction, syncAction } from "./actions";

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
  const [roleState, changeRole, changingRole] = useActionState(setRoleAction, IDLE);
  const [deleteState, remove, deleting] = useActionState(deleteAction, IDLE);
  const [expanded, setExpanded] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  const busy = syncing || changingRole || deleting;
  const isSupport = character.role === "SUPPORT";
  const showImage = character.imageUrl && !imageBroken;

  // 카드의 마지막 동작 결과만 보여준다. 셋을 동시에 누를 일이 없다.
  const feedback = [deleteState, roleState, syncState].find((s) => s.status !== "idle");

  return (
    <li className="relative overflow-hidden rounded border border-border bg-surface">
      {/*
        캐릭터 초상을 오른쪽에 깔고 왼쪽에서 오는 그라디언트로 덮는다.
        글자가 놓이는 왼쪽은 사실상 단색이 되므로 이미지 밝기와 무관하게 대비가 유지된다.
        text-shadow로 때우지 않는 이유다.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: classColor(character.className) }}
        aria-hidden
      />
      {showImage && (
        <Image
          src={character.imageUrl!}
          alt=""
          fill
          sizes="360px"
          className="pointer-events-none object-cover object-[70%_18%] opacity-70"
          onError={() => setImageBroken(true)}
          aria-hidden
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface via-surface/95 to-surface/40"
        aria-hidden
      />

      <div className="relative p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{character.name}</span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  isSupport ? "bg-support/20 text-support" : "bg-dps/20 text-dps"
                }`}
              >
                {isSupport ? "서폿" : "딜러"}
              </span>
              {character.roleLocked && (
                <span className="shrink-0 text-[11px] text-text-faint" title="역할을 수동으로 지정함">
                  고정
                </span>
              )}
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
              <div>시너지 {synergyLabel(character.className)}</div>
            </div>
          </div>
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

          <form action={changeRole}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={character.id} />
            <input type="hidden" name="role" value={isSupport ? "DPS" : "SUPPORT"} />
            <button
              type="submit"
              disabled={busy}
              className="rounded border border-border px-2 py-1 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
              title="발키리처럼 딜로도 쓰는 클래스를 바로잡을 때 쓴다"
            >
              {isSupport ? "딜러로" : "서폿으로"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded border border-border px-2 py-1 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text"
            aria-expanded={expanded}
          >
            {expanded ? "상세 닫기" : "상세"}
          </button>

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

        {expanded && (
          <div className="mt-2 space-y-2 border-t border-border pt-2 text-xs">
            {character.arkPassive && (
              <div>
                <div className="mb-1 font-semibold text-text-dim">아크패시브</div>
                <div className="mb-1 text-text-faint tabular">
                  {Object.entries(character.arkPassive.points)
                    .map(([k, v]) => `${k} ${v}`)
                    .join(" · ")}
                </div>
                <ul className="space-y-0.5 text-text-dim">
                  {character.arkPassive.nodes.map((node, i) => (
                    <li key={`${node.name}-${i}`}>
                      <span className="text-text-faint">
                        {node.category} {node.tier}티어
                      </span>{" "}
                      {node.name} Lv.{node.level}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {character.engravings && (
              <div>
                <div className="mb-1 font-semibold text-text-dim">전투 각인</div>
                <ul className="space-y-0.5 text-text-dim">
                  {character.engravings.list.map((e, i) => (
                    <li key={`${e.name}-${i}`}>
                      {e.name} {e.level ?? "?"}
                      {e.stoneLevel !== null && (
                        <span className="text-text-faint"> (스톤 {e.stoneLevel})</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {character.arkGrid && (
              <div>
                <div className="mb-1 font-semibold text-text-dim">아크그리드</div>
                <ul className="space-y-0.5 text-text-dim">
                  {character.arkGrid.cores.map((core) => (
                    <li key={core.index}>
                      {core.name}{" "}
                      <span className="text-text-faint tabular">
                        {core.grade} {core.point}p
                      </span>
                      {core.inactiveGemCount > 0 && (
                        <span className="text-danger"> 비활성 {core.inactiveGemCount}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-text-faint">
              {character.serverName && <>서버 {character.serverName} · </>}
              최근 갱신{" "}
              {character.syncedAt
                ? new Date(character.syncedAt).toLocaleString("ko-KR")
                : "없음"}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
