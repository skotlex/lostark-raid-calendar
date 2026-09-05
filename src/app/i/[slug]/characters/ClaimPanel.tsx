"use client";

import { useActionState } from "react";

import type { MyMember } from "@/lib/members";

import { type ClaimState, claimRosterAction } from "./actions";

const IDLE: ClaimState = { status: "idle", message: "" };

/**
 * 내 원정대 묶기.
 *
 * 로아 API에는 캐릭터의 주인이 없다. 그래서 **사람이 한 번 말해줘야** 한다.
 * 대표 캐릭터 하나를 대면 그 원정대 전체가 내 것으로 묶이고, 그 뒤로는 편성 칸에 남이
 * 대신 넣어줘도 소속이 붙는다. 사람당 평생 한 번이면 되는 일이다.
 *
 * 계정이 여럿인 사람은 계정마다 한 번씩 대면 된다. 로아 API가 부계정을 이어주지 않아
 * 이 방법밖에 없다.
 */
export function ClaimPanel({ slug, member }: { slug: string; member: MyMember | null }) {
  const [state, claim, pending] = useActionState(claimRosterAction, IDLE);

  return (
    <section className="rounded border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold">내 원정대</h2>
        {member ? (
          <span className="text-xs text-text-dim">
            <strong className="text-text">{member.label}</strong> · 캐릭터{" "}
            <span className="tabular">{member.characterCount}</span>명 묶임
            {member.claimedNames.length > member.characterCount && (
              <span className="text-text-faint">
                {" "}
                (원정대 <span className="tabular">{member.claimedNames.length}</span>명 중)
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-text-faint">아직 묶지 않았습니다</span>
        )}
      </div>

      <p className="mt-1 text-xs text-text-dim">
        대표 캐릭터를 한 번 알려주시면 그 원정대를 회원님 것으로 묶습니다. 그 뒤로는 다른
        분이 편성표에 대신 넣어도 회원님 소속으로 잡힙니다. 계정이 여러 개면 계정마다 한
        번씩 해 주세요.
      </p>

      <form action={claim} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="slug" value={slug} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-text-dim">대표 캐릭터</span>
          <input
            name="name"
            required
            placeholder="원정대의 아무 캐릭터"
            className="w-48 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-inline rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "묶는 중…" : "내 원정대로 묶기"}
        </button>

        {state.status !== "idle" && (
          <span className={`text-xs ${state.status === "error" ? "text-danger" : "text-ok"}`}>
            {state.message}
          </span>
        )}
      </form>
    </section>
  );
}
