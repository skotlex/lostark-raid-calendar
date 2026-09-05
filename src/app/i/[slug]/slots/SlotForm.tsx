"use client";

import { useActionState, useState } from "react";

import { RAID_PRESETS, difficultiesFor, sizeFor } from "@/lib/raids";
import type { SlotView } from "@/lib/slots";
import { WEEK_DAYS, dayNameFull } from "@/lib/week";

import { type SlotState, createSlotAction, updateSlotAction } from "./actions";
import { PickInput } from "./PickInput";

const IDLE: SlotState = { status: "idle", message: "" };

/**
 * 한 줄에 늘어서는 입력 칸들.
 *
 * select와 input은 같은 padding을 줘도 브라우저 기본 높이가 달라 아래끝이 어긋난다.
 * 높이를 직접 못 박아 맞춘다.
 */
const CONTROL =
  "h-9 rounded border border-border bg-bg px-2 text-sm focus:border-accent focus:outline-none";

const RAID_NAMES = RAID_PRESETS.map((preset) => preset.name);

/**
 * 브라우저 기본 문구를 우리 문구로 갈아 끼운다.
 *
 * 그냥 두면 "Please match the requested format."처럼 영어가 먼저 나오고 title이
 * 그 아래 붙는다. setCustomValidity를 넣으면 이 문구만 뜬다.
 *
 * 값이 바뀔 때 반드시 빈 문자열로 지워야 한다. 남겨두면 브라우저가 계속 잘못된 값으로
 * 보고 다음 제출을 막는다.
 */
function invalidMessage(input: HTMLInputElement, missing: string, wrong: string) {
  input.setCustomValidity(input.validity.valueMissing ? missing : wrong);
}

/**
 * 24시간 표기로 고정한다.
 *
 * `type="time"`은 형식을 브라우저 로케일이 정해서 "08:00 PM"으로 나온다.
 * 페이지가 `lang="ko"`여도 바뀌지 않아 직접 받는다. 숫자만 남겨 콜론을 끼워 넣으므로
 * "2000"을 치면 "20:00"이 된다.
 */
function formatTime(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

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
  // 4인인지 8인인지는 레이드가 정하는 값이라 고르게 하지 않는다. 이름에서 끌어내
  // 보여주기만 하고, 저장할 때 서버가 같은 규칙으로 다시 정한다(slots.ts).
  const partySize = sizeFor(raidName);

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
          className={`w-24 ${CONTROL}`}
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
          required
          inputMode="numeric"
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          maxLength={5}
          value={startTime}
          onInvalid={(e) =>
            invalidMessage(
              e.currentTarget,
              "시간을 입력해 주세요",
              "시간은 20:00 형식으로 입력해 주세요",
            )
          }
          onChange={(e) => {
            e.target.setCustomValidity("");
            setStartTime(formatTime(e.target.value));
          }}
          placeholder="20:00"
          className={`w-24 tabular ${CONTROL}`}
        />
      </Field>

      <Field label="레이드">
        <PickInput
          name="raidName"
          required
          value={raidName}
          onChange={setRaidName}
          onInvalid={(e) => e.currentTarget.setCustomValidity("레이드 이름을 입력해 주세요")}
          options={RAID_NAMES}
          placeholder="벨가르딘"
          wrapClassName="w-32"
          className={`w-full ${CONTROL}`}
        />
      </Field>

      <Field label="난이도">
        <PickInput
          name="difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={difficultiesFor(raidName)}
          placeholder="하드"
          wrapClassName="w-24"
          className={`w-full ${CONTROL}`}
        />
      </Field>

      <Field label="인원">
        <span className="flex h-9 w-12 items-center text-sm text-text-dim tabular">{partySize}인</span>
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="btn-inline h-9 rounded bg-accent px-3 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "저장 중…" : editing ? "저장" : "추가"}
      </button>

      {editing && onDone && (
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded border border-border px-3 text-sm text-text-dim hover:text-text"
        >
          취소
        </button>
      )}

      {/* 성공은 목록에 바로 나타나므로 알리지 않는다. 실패만 말한다. */}
      {state.status === "error" && <span className="text-xs text-danger">{state.message}</span>}

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
