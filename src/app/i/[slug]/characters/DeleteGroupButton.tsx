"use client";

import { useActionState } from "react";

import { ConfirmButton } from "../ConfirmButton";
import { type RowState, deleteMemberAction } from "./actions";

const IDLE: RowState = { status: "idle", message: "" };

/**
 * 한 사람의 캐릭터를 통째로 지운다.
 *
 * 원정대를 골라 등록하면 부캐가 한 번에 여럿 들어오므로, 잘못 등록했을 때 카드를
 * 하나씩 지우는 것은 품이 많이 든다.
 *
 * 되돌릴 수 없고 편성 기록까지 사라지니 반드시 한 번 묻는다. 캐릭터 삭제와 같은 규칙이다.
 */
export function DeleteGroupButton({
  slug,
  label,
  count,
}: {
  slug: string;
  label: string;
  count: number;
}) {
  const [state, remove, pending] = useActionState(deleteMemberAction, IDLE);
  const who = label || "소속 미지정";

  return (
    <form action={remove} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="label" value={label} />
      <ConfirmButton
        message={`${who} 캐릭터 ${count}개를 모두 삭제하시겠습니까?
편성 기록도 함께 사라집니다.`}
        confirmLabel="모두 삭제"
        disabled={pending}
        className="rounded border border-border px-2 py-0.5 text-xs font-normal text-text-faint transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "일괄 삭제"}
      </ConfirmButton>
      {state.status === "error" && (
        <span className="text-xs font-normal text-danger">{state.message}</span>
      )}
    </form>
  );
}
