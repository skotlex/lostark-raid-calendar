"use client";

import { useActionState } from "react";

import { type ImportState, syncAllAction } from "./actions";

const IDLE: ImportState = { status: "idle", message: "", result: null };

/**
 * 등록된 캐릭터를 한 번에 다시 조회한다.
 *
 * 스펙 갱신도 되지만 본래 목적은 **표시 형식이 바뀌었을 때 옛 데이터를 되살리는 것**이다.
 * 저장된 값은 조회 시점의 형식으로 굳어 있어 코드만 고쳐서는 바뀌지 않는다.
 */
export function SyncAllButton({ slug, count }: { slug: string; count: number }) {
  const [state, submit, pending] = useActionState(syncAllAction, IDLE);
  if (count === 0) return null;

  return (
    <form action={submit} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        title="캐릭터마다 API를 한 번씩 부릅니다. 많으면 시간이 걸립니다"
        className="rounded border border-border px-2 py-1 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text disabled:opacity-50"
      >
        {pending ? `갱신 중… (${count}개)` : "전체 갱신"}
      </button>
      {state.status !== "idle" && (
        <span className={`text-xs ${state.status === "error" ? "text-danger" : "text-ok"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
