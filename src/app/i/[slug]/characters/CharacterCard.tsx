"use client";

import { useActionState } from "react";

import type { CharacterView } from "@/lib/characters";
import { classEmblem } from "@/lib/classEmblems";
import { getSynergies } from "@/lib/synergy";

import { ConfirmButton } from "../ConfirmButton";

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

  // 편성 칸(Cell)과 같은 판정을 쓴다. 여기서 다시 구현하면 두 화면이 다른 말을 한다.
  const synergies = getSynergies(
    character.className,
    character.role,
    character.skillSynergies,
  );

  // 표에 없는 직업이면 null이고, 그때는 글자만 남는다.
  const emblem = classEmblem(character.className);

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
              <span
                className={`char-chip ${
                  isSupport ? "char-chip--engraving-sup" : "char-chip--engraving"
                }`}
              >
                {character.classEngraving}
              </span>
            )}
            {/* 역할은 각인과 아크패시브로 판정한다. 손댈 일이 없어 표시만 한다. */}
            <span className={`char-chip ${isSupport ? "char-chip--support" : "char-chip--dps"}`}>
              {isSupport ? "서폿" : "딜러"}
            </span>
          </div>

          {/*
            직업 문장은 이름과 수치를 합한 높이만큼 선다. 편성 칸보다 크게 두는 것은
            이 화면이 캐릭터를 고르는 자리이기 때문이다. 여러 장을 훑을 때 이름을 읽기
            전에 직업으로 먼저 걸러진다.

            alt는 비운다. 같은 직업을 위의 칩이 글자로 말한다.
          */}
          <div className="mt-1 flex items-center gap-2.5">
            {emblem && (
              <span className="char-emblem-tall">
                {/* 게임 자산 SVG라 next/image를 거치지 않는다(숙제 화면과 같은 이유). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={emblem} alt="" loading="lazy" className="class-emblem" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="char-name truncate text-base">{character.name}</div>

              {/* 문장이 폭을 가져간 만큼 좁아진다. 넘치면 초상 위로 미끄러지지 않게 접는다. */}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <div>
                  <div className="char-label">레벨</div>
                  <div className="char-value">{formatLevel(character.itemLevel)}</div>
                </div>
                <div>
                  <div className="char-label">전투력</div>
                  <div className="char-value">{formatLevel(character.combatPower)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="char-faint mt-1.5 space-y-0.5 text-[12px]">
            {character.arkGridSummary && (
              <div className="truncate tabular">아크그리드 {character.arkGridSummary}</div>
            )}
            {/*
              시너지는 편성 칸과 같은 칩으로 보여준다. 같은 캐릭터가 두 화면에서 다르게
              보이면 대조하기 어렵고, 종류마다 붙는 색이 곧 구분이라 글로 이어 적으면
              "치적 10%, 서폿"이 한 덩어리 글자가 된다.

              칸과 달리 폭이 좁아진다고 지우지 않는다. 여기는 스펙을 확인하러 오는
              화면이라 시너지가 곁다리가 아니다.
            */}
            {synergies.length > 0 ? (
              <div className="char-syn-line char-syn-line--open">
                {synergies.map((synergy) => (
                  <span key={synergy.kind} className="char-syn" data-kind={synergy.kind}>
                    {synergy.kind}
                    {/* 수치는 종류마다 고정이다. 서폿은 딜러마다 달라 비어 있다. */}
                    {synergy.value && ` ${synergy.value}`}
                  </span>
                ))}
              </div>
            ) : (
              <div className="truncate">시너지 없음</div>
            )}
          </div>
        </div>

        {character.syncError && (
          <p className="char-notice char-notice--danger mt-2">{character.syncError}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <form action={sync}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={character.id} />
            <button type="submit" disabled={busy} className="char-btn">
              {syncing ? "갱신 중…" : "갱신"}
            </button>
          </form>

          <form action={remove}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={character.id} />
            <ConfirmButton
              message={`${character.name} 캐릭터를 삭제하시겠습니까?
편성 기록도 함께 사라집니다.`}
              confirmLabel="삭제"
              disabled={busy}
              className="char-btn char-btn--danger"
            >
              삭제
            </ConfirmButton>
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
