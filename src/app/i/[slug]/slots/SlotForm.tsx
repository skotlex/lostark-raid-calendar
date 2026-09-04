"use client";

import { useActionState, useState } from "react";

import { RAID_PRESETS } from "@/lib/raids";
import type { SlotView } from "@/lib/slots";
import { WEEK_DAYS, dayNameFull } from "@/lib/week";

import { type SlotState, createSlotAction, updateSlotAction } from "./actions";

const IDLE: SlotState = { status: "idle", message: "" };

/**
 * 슬롯 추가·수정 폼.
 *
 * `slot`이 있으면 수정, 없으면 추가다. 필드 구성이 같아 하나로 쓴다.
 */
export function SlotForm({
  slug,
  slot,
  defaultDay,
  onDone,
}: {
  slug: string;
  slot?: SlotView;
  defaultDay?: number;
  onDone?: () => void;
}) {
  const editing = Boolean(slot);
  const [state, submit, pending] = useActionState(
    editing ? updateSlotAction : createSlotAction,
    IDLE,
  );

  // 액션이 끝나면 폼이 통째로 초기화된다. 추가 폼은 연달아 입력하라고 열어두는 곳이라
  // 방금 고른 값이 매번 날아갔다. 네 칸 모두 직접 들고 있어 입력을 유지한다.
  const [dayOfWeek, setDayOfWeek] = useState(slot?.dayOfWeek ?? defaultDay ?? 3);
  const [startTime, setStartTime] = useState(slot?.startTime ?? "20:00");
  const [raidName, setRaidName] = useState(slot?.raidName ?? "");
  const [difficulty, setDifficulty] = useState(slot?.difficulty ?? "");

  return (
    <form
      action={(formData) => {
        submit(formData);
        // 수정은 저장 후 닫는다. 추가는 연달아 넣는 경우가 많아 열어둔다.
        if (editing) onDone?.();
      }}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="slug" value={slug} />
      {slot && <input type="hidden" name="slotId" value={slot.id} />}

      <Field label="요일">
        <select
          name="dayOfWeek"
          value={dayOfWeek}
          onChange={(e) => setDayOfWeek(Number(e.target.value))}
          className="rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        >
          {WEEK_DAYS.map((d) => (
            <option key={d} value={d}>
              {dayNameFull(d)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="시간">
        <input
          name="startTime"
          type="time"
          required
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>

      <Field label="레이드">
        <input
          name="raidName"
          required
          list="raid-presets"
          value={raidName}
          onChange={(e) => setRaidName(e.target.value)}
          placeholder="벨가르딘"
          className="w-32 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>

      <Field label="난이도">
        <input
          name="difficulty"
          list="difficulty-presets"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          placeholder="하드"
          className="w-24 rounded border border-border bg-bg px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="btn-inline rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "저장 중…" : editing ? "저장" : "추가"}
      </button>

      {editing && onDone && (
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-border px-3 py-1.5 text-sm text-text-dim hover:text-text"
        >
          취소
        </button>
      )}

      {/* 성공은 목록에 바로 나타나므로 알리지 않는다. 실패만 말한다. */}
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}

      <datalist id="raid-presets">
        {RAID_PRESETS.map((preset) => (
          <option key={preset.name} value={preset.name} />
        ))}
      </datalist>
      <datalist id="difficulty-presets">
        {[...new Set(RAID_PRESETS.flatMap((p) => p.difficulties))].map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-dim">
        {label}
        {hint && <span className="ml-1 text-text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
