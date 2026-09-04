"use client";

import { useActionState, useState } from "react";

import { raidLabel } from "@/lib/raids";
import type { SlotView } from "@/lib/slots";
import { dayName } from "@/lib/week";

import { type SlotState, archiveSlotAction } from "./actions";
import { SlotForm } from "./SlotForm";

const IDLE: SlotState = { status: "idle", message: "" };

export function SlotRow({ slug, slot }: { slug: string; slot: SlotView }) {
  const [editing, setEditing] = useState(false);
  const [archiveState, archive, archiving] = useActionState(archiveSlotAction, IDLE);

  if (editing) {
    return (
      <li className="rounded border border-accent/40 bg-surface p-3">
        <SlotForm slug={slug} slot={slot} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-border bg-surface px-3 py-2">
      <span className="w-8 shrink-0 text-sm text-text-dim">{dayName(slot.dayOfWeek)}</span>
      <span className="w-14 shrink-0 text-sm tabular">{slot.startTime}</span>
      <span className="font-medium">{raidLabel(slot.raidName, slot.difficulty)}</span>
      {slot.keepRoster && (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
          전원 고정
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded border border-border px-2 py-1 text-xs text-text-dim hover:text-text"
        >
          수정
        </button>
        <form
          action={archive}
          onSubmit={(e) => {
            if (
              !confirm(
                `${raidLabel(slot.raidName, slot.difficulty)}을(를) 요일표에서 내리시겠습니까?\n` +
                  "과거 편성 기록은 남습니다.",
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="slotId" value={slot.id} />
          <button
            type="submit"
            disabled={archiving}
            className="rounded border border-transparent px-2 py-1 text-xs text-text-faint hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            내리기
          </button>
        </form>
      </div>

      {archiveState.status === "error" && (
        <p className="w-full text-xs text-danger">{archiveState.message}</p>
      )}
    </li>
  );
}
