"use client";

import { useActionState, useState } from "react";

import { classEmblem } from "@/lib/classEmblems";
import { GOLD_LIMIT, goldEarnerIds, isManual } from "@/lib/goldEarners";

import { type GoldState, setGoldEarnersAction } from "./actions";

const IDLE: GoldState = { status: "idle", message: "" };

export interface GoldCharacter {
  id: string;
  name: string;
  className: string | null;
  itemLevel: number | null;
  goldEarner: boolean | null;
}

export interface GoldRoster {
  /** Roster.id. 아직 원정대가 안 붙은 묶음은 빈 문자열이다 */
  id: string;
  label: string;
  characters: GoldCharacter[];
}

/**
 * 원정대별 골드 획득 캐릭터 지정.
 *
 * 로아는 **원정대 하나에서 여섯 캐릭터만** 주간 레이드 골드를 받는다. 나머지는 골드를
 * 못 받는 대신 더보기가 무료다. 숙제 화면의 골드 합계가 이 여섯에서 나온다.
 *
 * 기본은 템레벨 상위 여섯 자동이다(goldEarners.ts). 여기는 그 자동이 실제와 다를 때만
 * 들어오는 자리다. 대부분의 사람은 한 번도 열어보지 않아도 맞는 값을 본다.
 *
 * **탭이 원정대다.** 계정이 여럿인 사람은 원정대마다 따로 여섯을 받으므로 한 목록에
 * 늘어놓으면 어느 여섯인지 셀 수 없다.
 */
export function GoldPanel({ slug, rosters }: { slug: string; rosters: GoldRoster[] }) {
  const [active, setActive] = useState(0);
  const [state, submit, saving] = useActionState(setGoldEarnersAction, IDLE);

  const roster = rosters[active] ?? rosters[0];
  if (!roster) return null;

  return (
    <section className="space-y-2 rounded border border-border bg-surface p-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 className="text-sm font-semibold">골드 획득 캐릭터</h2>
        <span className="text-xs text-text-faint">
          원정대마다 {GOLD_LIMIT}명까지 주간 레이드 골드를 받습니다
        </span>
      </div>

      {/* 원정대가 하나뿐이면 탭이 무엇을 고르는 것인지 알 수 없어 숨긴다. */}
      {rosters.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-border">
          {rosters.map((item, index) => (
            <button
              key={item.id || "__none__"}
              type="button"
              onClick={() => setActive(index)}
              data-active={index === active}
              className="day-tab"
            >
              {item.label}
              <span className="day-badge">{item.characters.length}</span>
            </button>
          ))}
        </div>
      )}

      <GoldForm
        key={roster.id}
        slug={slug}
        roster={roster}
        submit={submit}
        saving={saving}
        state={state}
      />
    </section>
  );
}

function GoldForm({
  slug,
  roster,
  submit,
  saving,
  state,
}: {
  slug: string;
  roster: GoldRoster;
  submit: (formData: FormData) => void;
  saving: boolean;
  state: GoldState;
}) {
  /*
   * 지금 골드를 받는 캐릭터로 켜 둔다.
   *
   * 자동이면 자동이 고른 여섯이 켜져 있다. 화면을 열자마자 "지금 누가 받는지"가 보여야
   * 하고, 고치려는 사람은 거기서 한둘만 바꾸면 된다. 빈 채로 두면 여섯을 처음부터
   * 다시 골라야 한다.
   */
  const initial = goldEarnerIds(roster.characters);
  const [picked, setPicked] = useState<Set<string>>(initial);
  const manual = isManual(roster.characters);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const over = picked.size > GOLD_LIMIT;

  return (
    <form action={submit} className="space-y-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roster" value={roster.id} />

      <ul className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {roster.characters.map((character) => {
          const on = picked.has(character.id);
          return (
            <li key={character.id}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm transition-colors ${
                  on
                    ? "border-accent/50 bg-accent/10"
                    : "border-border text-text-dim hover:border-border-strong"
                }`}
              >
                <input
                  type="checkbox"
                  name="earner"
                  value={character.id}
                  checked={on}
                  onChange={() => toggle(character.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1 truncate">{character.name}</span>
                {/*
                  직업 문장. 여섯 줄이 이름만으로 늘어서 있으면 어느 줄이 무엇인지
                  글자를 읽어야 한다. 편성표 간략 보기와 같은 그림·같은 자리다.
                */}
                <span className="flex shrink-0 items-center gap-1 text-xs text-text-faint">
                  {classEmblem(character.className) && (
                    // 게임 자산 SVG라 next/image를 거치지 않는다(숙제 화면과 같은 이유).
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={classEmblem(character.className)!}
                      alt=""
                      width={16}
                      height={16}
                      loading="lazy"
                      className="board-emblem"
                    />
                  )}
                  {character.className ?? "?"}
                </span>
                <span className="shrink-0 text-xs tabular text-text-faint">
                  {character.itemLevel?.toFixed(2) ?? "-"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className={over ? "text-danger" : "text-text-faint"}>
          {picked.size} / {GOLD_LIMIT}
        </span>
        <span className="text-text-faint">
          {manual ? "직접 지정한 상태입니다" : "지금은 템레벨 상위 6명 자동입니다"}
        </span>

        {/*
          전부 해제하면 자동으로 돌아간다. 되돌리기 버튼을 따로 두지 않는 이유는,
          "아무도 골드를 안 받는다"는 상태가 게임에 없어서 그 뜻으로 읽힐 일이 없기
          때문이다. 버튼을 하나 덜 두는 편이 낫다.
        */}
        {picked.size > 0 && (
          <button
            type="button"
            onClick={() => setPicked(new Set())}
            className="text-text-faint underline hover:text-text"
          >
            자동으로 되돌리기
          </button>
        )}

        <button
          type="submit"
          disabled={saving || over}
          className="btn-inline ml-auto rounded bg-accent px-3 py-1 font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>

        {state.status !== "idle" && (
          <span className={state.status === "error" ? "text-danger" : "text-ok"}>
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
