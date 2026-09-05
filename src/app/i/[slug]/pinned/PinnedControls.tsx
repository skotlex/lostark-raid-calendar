"use client";

import { useActionState } from "react";

import { positionLabel } from "@/lib/positions";

import { type CellState, keepRosterAction, pinAction } from "../actions";
import { PinIcon } from "../icons";

const IDLE: CellState = { status: "idle", message: "" };

/**
 * 자리 고정 하나를 푼다.
 *
 * 푸는 일이 이 화면의 전부다. 거는 것은 편성표에서 그 자리를 보며 하는 일이고,
 * 여기는 **걸어둔 것을 되짚어 보는 자리**다.
 */
export function UnpinButton({
  slug,
  week,
  slotId,
  position,
  characterName,
}: {
  slug: string;
  week: string;
  slotId: string;
  position: string;
  characterName: string | null;
}) {
  const [state, unpin, pending] = useActionState(pinAction, IDLE);

  return (
    <form action={unpin} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="position" value={position} />
      <input type="hidden" name="pinned" value="false" />
      <button
        type="submit"
        disabled={pending}
        title={`${positionLabel(position)}${characterName ? ` ${characterName}` : ""} 고정 해제`}
        className="rounded border border-border px-2 py-0.5 text-xs text-text-faint transition-colors hover:border-danger/40 hover:text-danger disabled:opacity-50"
      >
        {pending ? "푸는 중…" : "고정 해제"}
      </button>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}

/** 레이드 단위 고정을 끈다. 켜는 것은 편성표의 슬롯 머리글에서 한다. */
export function KeepRosterOffButton({
  slug,
  week,
  slotId,
}: {
  slug: string;
  week: string;
  slotId: string;
}) {
  const [state, toggle, pending] = useActionState(keepRosterAction, IDLE);

  return (
    <form action={toggle} className="flex items-center gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="keepRoster" value="false" />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1 rounded border border-accent/50 bg-accent/15 px-2 py-0.5 text-xs text-accent transition-colors hover:border-danger/40 hover:bg-transparent hover:text-danger disabled:opacity-50"
      >
        <PinIcon pinned />
        {pending ? "끄는 중…" : "전원 고정 끄기"}
      </button>
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}
    </form>
  );
}
