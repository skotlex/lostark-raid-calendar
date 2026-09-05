"use client";

import { useState } from "react";

import type { CharacterView } from "@/lib/characters";

import { CharacterCard } from "./CharacterCard";
import { DeleteGroupButton, DeleteRosterButton } from "./DeleteGroupButton";

export interface RosterGroup {
  /** Roster.id. 원정대가 아직 안 붙은 묶음은 빈 문자열이다 */
  id: string;
  label: string;
  characters: CharacterView[];
}

/**
 * 사람 하나의 캐릭터 묶음. 원정대가 여럿이면 탭으로 가른다.
 *
 * **골드 지정 화면과 같은 경계로 자른다**(GoldPanel). 위에서는 원정대별로 여섯을
 * 고르게 해놓고 아래 목록은 한 덩어리로 늘어놓으면, 어느 캐릭터가 어느 원정대의
 * 여섯에 드는지 눈으로 맞춰봐야 한다.
 *
 * 원정대가 하나뿐인 사람에게는 탭을 숨긴다. 고를 것이 없는 탭은 무엇을 고르는
 * 것인지 알 수 없다.
 */
export function CharacterGroup({
  slug,
  label,
  rosters,
}: {
  slug: string;
  /** 사람 이름. 빈 문자열이면 아직 주인이 없는 캐릭터 묶음이다 */
  label: string;
  rosters: RosterGroup[];
}) {
  const [active, setActive] = useState(0);

  const total = rosters.reduce((sum, roster) => sum + roster.characters.length, 0);
  const tabbed = rosters.length > 1;
  const group = rosters[active] ?? rosters[0];
  if (!group) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <span className={label ? "text-text" : "text-text-faint"}>
          {label || "소속 미지정"}
        </span>
        <span className="text-xs text-text-faint tabular">{total}</span>
        {/* 원정대를 골라 등록하면 부캐가 한 번에 여럿 들어온다. 무를 때도 한 번에. */}
        <DeleteGroupButton slug={slug} label={label} count={total} tabbed={tabbed} />
      </h2>

      {tabbed && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border">
          {rosters.map((roster, index) => (
            <button
              key={roster.id || "__none__"}
              type="button"
              onClick={() => setActive(index)}
              data-active={index === active}
              className="day-tab"
            >
              {roster.label}
              <span className="day-badge">{roster.characters.length}</span>
            </button>
          ))}
          {/* 지금 보고 있는 탭만 지운다. 전체 삭제는 제목 줄에 따로 서 있다. */}
          <div className="ml-auto pb-1">
            <DeleteRosterButton
              slug={slug}
              label={label}
              rosterId={group.id}
              rosterLabel={group.label}
              count={group.characters.length}
            />
          </div>
        </div>
      )}

      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {group.characters.map((character) => (
          <CharacterCard key={character.id} slug={slug} character={character} />
        ))}
      </ul>
    </section>
  );
}
