"use client";

import { useActionState } from "react";

import { ConfirmButton } from "../ConfirmButton";
import { type RowState, deleteMemberAction, deleteRosterAction } from "./actions";

const IDLE: RowState = { status: "idle", message: "" };

const BUTTON =
  "rounded border border-border px-2 py-0.5 text-xs font-normal text-text-faint transition-colors hover:border-danger hover:text-danger disabled:opacity-50";

/**
 * 한 사람의 캐릭터를 통째로 지운다.
 *
 * 원정대를 골라 등록하면 부캐가 한 번에 여럿 들어오므로, 잘못 등록했을 때 카드를
 * 하나씩 지우는 것은 품이 많이 든다.
 *
 * 되돌릴 수 없고 편성 기록까지 사라지니 반드시 한 번 묻는다. 캐릭터 삭제와 같은 규칙이다.
 *
 * 원정대가 여럿인 사람은 이 버튼이 **모든 원정대**를 지운다. 탭 하나만 지우는 버튼이
 * 따로 서 있으므로(`DeleteRosterButton`) 무엇을 지우는 버튼인지 이름으로 가른다.
 */
export function DeleteGroupButton({
  slug,
  label,
  count,
  tabbed = false,
}: {
  slug: string;
  label: string;
  count: number;
  /** 원정대 탭이 서 있는 묶음인가. 버튼 이름을 가르는 데만 쓴다 */
  tabbed?: boolean;
}) {
  const [state, remove, pending] = useActionState(deleteMemberAction, IDLE);
  const who = label || "소속 미지정";

  return (
    <form action={remove} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="label" value={label} />
      <ConfirmButton
        message={`${who} 캐릭터 ${count}개를 ${tabbed ? "원정대 구분 없이 " : ""}모두 삭제하시겠습니까?
편성 기록도 함께 사라집니다.`}
        confirmLabel="모두 삭제"
        disabled={pending}
        className={BUTTON}
      >
        {pending ? "삭제 중…" : tabbed ? "전체 삭제" : "일괄 삭제"}
      </ConfirmButton>
      {state.status === "error" && (
        <span className="text-xs font-normal text-danger">{state.message}</span>
      )}
    </form>
  );
}

/**
 * 지금 보고 있는 원정대 탭만 지운다.
 *
 * 계정이 여럿인 사람은 한 묶음에 원정대가 여럿이라, 하나를 잘못 불러왔을 때 전체
 * 삭제로 되돌리면 멀쩡한 나머지 계정까지 날아간다.
 */
export function DeleteRosterButton({
  slug,
  label,
  rosterId,
  rosterLabel,
  count,
}: {
  slug: string;
  /** 사람 이름. 서버가 이 사람의 원정대가 맞는지 다시 확인한다 */
  label: string;
  /** Roster.id. 원정대 미지정 묶음은 빈 문자열이다 */
  rosterId: string;
  rosterLabel: string;
  count: number;
}) {
  const [state, remove, pending] = useActionState(deleteRosterAction, IDLE);

  return (
    <form action={remove} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="label" value={label} />
      <input type="hidden" name="roster" value={rosterId} />
      <input type="hidden" name="rosterLabel" value={rosterLabel} />
      <ConfirmButton
        message={`${rosterLabel} 캐릭터 ${count}개를 삭제하시겠습니까?
편성 기록도 함께 사라집니다.`}
        confirmLabel="삭제"
        disabled={pending}
        className={BUTTON}
      >
        {pending ? "삭제 중…" : "이 원정대 삭제"}
      </ConfirmButton>
      {state.status === "error" && (
        <span className="text-xs font-normal text-danger">{state.message}</span>
      )}
    </form>
  );
}
