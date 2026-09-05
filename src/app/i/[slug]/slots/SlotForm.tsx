"use client";

import { startTransition, useActionState, useState } from "react";

import { RAID_PRESETS, difficultiesFor } from "@/lib/raids";
import { scoreCutDigits } from "@/lib/scoreCut";
import type { SlotView } from "@/lib/slots";
import { WEEK_DAYS, dayNameFull, isUndecided } from "@/lib/week";

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
 * 시각이 없는 칸에 적는 표시.
 *
 * 잠긴 칸을 비워 두면 아직 안 친 것처럼 보인다. 자리표시자로 "20:00"이 흐리게 떠서
 * 더 그랬다. 한 글자를 박아 두면 "여기는 값이 없는 칸"이라고 읽힌다.
 */
const NO_TIME = "-";

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

  // 네 칸 모두 상태로 들고 있는다. 추가 폼은 연달아 입력하라고 열어두는 곳이라
  // 방금 고른 값이 살아 있어야 한다.
  const [dayOfWeek, setDayOfWeek] = useState(slot?.dayOfWeek ?? defaultDay ?? 3);
  const [startTime, setStartTime] = useState(slot?.startTime ?? "20:00");
  const [raidName, setRaidName] = useState(slot?.raidName ?? "");
  const [difficulty, setDifficulty] = useState(slot?.difficulty ?? "");
  // 점수컷은 비워 두는 것이 기본이다. 컷을 거는 공대만 채운다.
  const [dpsScoreCut, setDpsScoreCut] = useState(cutText(slot?.dpsScoreCut));
  const [supScoreCut, setSupScoreCut] = useState(cutText(slot?.supScoreCut));

  const difficulties = difficultiesFor(raidName);

  /*
   * 미정 칸은 시각을 받지 않는다.
   *
   * 요일을 못 정한 칸에 시각만 정해 둘 수는 없다. 칸을 숨기지 않고 잠그는 것은,
   * 사라지면 옆 칸들이 밀려 폼이 요일마다 다른 모양이 되기 때문이다. 잠긴 칸은
   * 제출에서도 빠지므로(disabled) 브라우저의 형식 검사에 걸리지도 않는다.
   */
  const noTime = isUndecided(dayOfWeek);

  /**
   * 레이드를 바꾸면 난이도를 손본다.
   *
   * 벨가르딘 하드에서 지평의 성당으로 옮기면 "하드"라는 난이도가 없다. 그대로 두면
   * 없는 난이도가 저장되고, 후보 목록도 "하드"에 걸리는 것이 없어 비어 보인다.
   * 새 레이드에 있는 난이도면 그대로 두고, 없으면 비운다.
   */
  function pickRaid(name: string) {
    setRaidName(name);
    if (difficulty && !difficultiesFor(name).includes(difficulty)) setDifficulty("");
  }

  /**
   * 보낼 값은 DOM이 아니라 상태에서 모은다.
   *
   * `<form action={...}>`을 쓰면 액션이 끝난 뒤 React가 폼을 초기화한다. 칸이 전부
   * 제어 컴포넌트라 상태는 그대로인데 DOM만 기본값으로 돌아가고, 둘이 어긋난 채 남는다.
   * 요일이 수요일로 보였다가 다른 칸을 건드리는 순간(=다시 그릴 때) 되돌아오던 이유다.
   *
   * onSubmit으로 직접 보내면 그 초기화가 아예 일어나지 않는다. required·pattern 검사는
   * 브라우저가 submit 전에 하므로 그대로 걸린다.
   *
   * 디스패치는 트랜지션 안에서 부른다. `action` prop으로 넘길 때는 React가 알아서
   * 감싸주지만, 직접 부를 때는 우리가 감싸야 pending이 제대로 켜진다.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = new FormData();
    data.set("slug", slug);
    if (slot) data.set("slotId", slot.id);
    data.set("dayOfWeek", String(dayOfWeek));
    data.set("startTime", startTime);
    data.set("raidName", raidName);
    data.set("difficulty", difficulty);
    data.set("dpsScoreCut", dpsScoreCut);
    data.set("supScoreCut", supScoreCut);

    startTransition(() => submit(data));
    // 수정은 저장 후 닫는다. 추가는 연달아 넣는 경우가 많아 열어둔다.
    if (editing) onDone?.();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">

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
          disabled={noTime}
          inputMode="numeric"
          pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
          maxLength={5}
          value={noTime ? NO_TIME : startTime}
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
          className={`w-24 tabular ${CONTROL} disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-faint`}
        />
      </Field>

      <Field label="레이드">
        <PickInput
          name="raidName"
          required
          value={raidName}
          onChange={pickRaid}
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
          options={difficulties}
          placeholder="하드"
          wrapClassName="w-24"
          className={`w-full ${CONTROL}`}
        />
      </Field>

      {/*
        점수컷은 숫자만 받는다. 부등호는 편성표가 붙이므로(scoreCut.ts) "5000 이상"처럼
        치면 오히려 "이상 이상"이 된다. 라벨의 "이상"이 그 약속을 미리 말해 준다.
      */}
      <Field label="딜러컷" hint="이상">
        <ScoreCutInput
          name="dpsScoreCut"
          value={dpsScoreCut}
          onChange={setDpsScoreCut}
          tone="dps"
        />
      </Field>

      <Field label="서폿컷" hint="이상">
        <ScoreCutInput
          name="supScoreCut"
          value={supScoreCut}
          onChange={setSupScoreCut}
          tone="sup"
        />
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

/** 저장된 값을 칸에 넣을 글자로. 컷이 없으면 빈 칸이다. */
function cutText(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * 점수컷 한 칸.
 *
 * 뱃지 색과 같은 테두리를 둘러 어느 칸이 어느 뱃지가 되는지 눈으로 잇는다. 두 칸이
 * 나란히 서고 라벨도 두 글자 차이뿐이라, 색이 없으면 딜러 칸에 서폿 값을 넣어도
 * 저장하기 전까지 알 수 없다.
 *
 * `type="number"`를 쓰지 않는다. 스피너가 붙어 폭이 흔들리고 휠에 값이 바뀐다.
 * 시간 칸과 같이 글자를 직접 걸러낸다.
 */
function ScoreCutInput({
  name,
  value,
  onChange,
  tone,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  tone: "dps" | "sup";
}) {
  return (
    <input
      name={name}
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(scoreCutDigits(e.target.value))}
      placeholder="없음"
      data-cut={tone}
      className={`w-20 tabular ${CONTROL} score-cut-input`}
    />
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
