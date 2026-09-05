"use client";

import { useActionState, useState } from "react";

import { raidLabel } from "@/lib/raids";
import { formatScoreCut } from "@/lib/scoreCut";
import type { SlotView } from "@/lib/slots";
import { dayName, isUndecided } from "@/lib/week";

import { type SlotState, archiveSlotAction } from "./actions";
import { ConfirmButton } from "../ConfirmButton";
import { SlotForm } from "./SlotForm";

const IDLE: SlotState = { status: "idle", message: "" };

/** 정해진 것이 없는 칸. 폼의 잠긴 시간 칸과 같은 표시다. */
const NO_VALUE = "-";

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
      {/*
        미정 줄은 두 칸 모두 "-"다. 요일도 시각도 정해진 것이 없고, 어느 무리인지는
        바로 위의 "미정" 제목이 이미 말한다. 칸을 없애지는 않는다. 없애면 그 줄만
        레이드 이름이 왼쪽으로 밀려 목록이 어긋나 보인다.
      */}
      <span className="w-8 shrink-0 text-sm text-text-dim">
        {isUndecided(slot.dayOfWeek) ? NO_VALUE : dayName(slot.dayOfWeek)}
      </span>
      <span className="w-14 shrink-0 text-sm tabular">
        {isUndecided(slot.dayOfWeek) ? NO_VALUE : slot.startTime}
      </span>
      <span className="font-medium">{raidLabel(slot.raidName, slot.difficulty)}</span>
      {slot.partySize === 4 && (
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-text-dim">4인</span>
      )}
      {slot.keepRoster && (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs text-accent">
          전원 고정
        </span>
      )}
      {/* 편성표에 걸리는 뱃지와 같은 모양이다. 저장한 값을 확인하러 편성표로 가지 않는다. */}
      {slot.dpsScoreCut !== null && (
        <span className="slot-badge tabular" data-cut="dps">
          딜러 {formatScoreCut(slot.dpsScoreCut)}
        </span>
      )}
      {slot.supScoreCut !== null && (
        <span className="slot-badge tabular" data-cut="sup">
          서폿 {formatScoreCut(slot.supScoreCut)}
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
        <form action={archive}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="slotId" value={slot.id} />
          <ConfirmButton
            message={`${raidLabel(slot.raidName, slot.difficulty)}을(를) 요일표에서 내리시겠습니까?
과거 편성 기록은 남습니다.`}
            confirmLabel="내리기"
            disabled={archiving}
            className="rounded border border-transparent px-2 py-1 text-xs text-text-faint hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            내리기
          </ConfirmButton>
        </form>
      </div>

      {archiveState.status === "error" && (
        <p className="w-full text-xs text-danger">{archiveState.message}</p>
      )}
    </li>
  );
}
