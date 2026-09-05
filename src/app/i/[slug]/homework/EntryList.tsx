"use client";

import { startTransition, useActionState, useRef, useState } from "react";

import { RAID_GOLD_LIMIT } from "@/lib/goldEarners";
import type { HomeworkEntry } from "@/lib/homework";
import { goldAt, isGoldCapped } from "@/lib/homeworkOrder";
import { dayName, isUndecided } from "@/lib/week";

import { type HomeworkState, reorderHomeworkAction } from "./actions";

const IDLE: HomeworkState = { status: "idle", message: "" };

const gold = new Intl.NumberFormat("ko-KR");

/**
 * 줄 앞뒤에 서는 두 뱃지(순번·요일)의 색.
 *
 * 아직 안 간 숙제는 악센트로 띄우고 다녀온 숙제는 가라앉힌다. 이 카드에서 눈이 찾는
 * 것은 "어디까지 갔나"뿐이라, 남은 줄만 떠오르면 이름을 읽지 않아도 답이 나온다.
 */
function badgeTone(done: boolean) {
  return done ? "bg-surface-2/60 text-text-faint" : "bg-accent/15 text-accent";
}

/** 배열에서 하나를 뽑아 다른 자리에 꽂는다. 원본은 그대로 둔다. */
function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}

/**
 * 캐릭터 하나의 숙제 줄과 골드 합계.
 *
 * **순서를 끌어 옮길 수 있어야 해서 클라이언트다.** 앞의 셋만 골드를 받으므로
 * (goldEarners.ts) 순서가 곧 "어느 레이드에서 골드를 받을 것인가"이고, 그건 게임에서
 * 사람이 고르는 값이라 앱이 대신 정할 수 없다.
 *
 * **골드는 여기서 다시 센다.** 서버가 보내준 값을 그대로 그리면 놓는 순간과 새로고침
 * 사이에 숫자가 멎어 보인다. 순서를 바꾸는 화면인데 바꾼 결과가 한 박자 늦게 오면
 * 무엇이 달라졌는지 알 수 없다. 그래서 원래 보상(`baseGold`)과 자리 번호로 계산하고,
 * 서버는 같은 답을 굳히는 쪽만 맡는다.
 *
 * 합계도 같은 이유로 여기서 더한다. 줄은 바뀌었는데 아래 합계만 옛 값이면 어느 쪽이
 * 맞는지 화면이 스스로 어긋난다. 화면 위쪽의 주간 진행률은 서버가 다시 그린다.
 */
export function EntryList({
  slug,
  characterId,
  entries,
}: {
  slug: string;
  characterId: string;
  entries: readonly HomeworkEntry[];
}) {
  const [state, save, saving] = useActionState(reorderHomeworkAction, IDLE);

  const serverOrder = entries.map((e) => e.slotId).join(",");
  /*
   * 서버가 준 순서를 그대로 들고 시작한다.
   *
   * 서버 순서가 바뀌면(편성이 늘었거나 다른 기기에서 옮겼거나) 그쪽을 따른다.
   * 렌더 중에 맞추는 것이 effect보다 낫다. effect로 하면 옛 순서가 한 번 그려진 뒤에
   * 바뀌어 줄이 눈에 띄게 튄다.
   */
  const [order, setOrder] = useState<string[]>(() => entries.map((e) => e.slotId));
  const [seed, setSeed] = useState(serverOrder);
  if (seed !== serverOrder) {
    setSeed(serverOrder);
    setOrder(entries.map((e) => e.slotId));
  }

  const listRef = useRef<HTMLUListElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const byId = new Map(entries.map((e) => [e.slotId, e]));
  // 저장이 오가는 사이에 편성이 사라졌을 수 있다. 없는 줄은 조용히 뺀다.
  const rows = order.map((id) => byId.get(id)).filter((e) => e !== undefined);
  const movable = rows.length > 1;

  /** 지금 포인터가 몇 번째 줄 위에 있나. 줄 높이가 제각각이라 매번 잰다. */
  function rowAt(clientY: number): number | null {
    const kids = listRef.current?.querySelectorAll("[data-row]");
    if (!kids || kids.length === 0) return null;
    for (let i = 0; i < kids.length; i += 1) {
      if (clientY < kids[i].getBoundingClientRect().bottom) return i;
    }
    return kids.length - 1;
  }

  function onPointerDown(index: number, e: React.PointerEvent<HTMLElement>) {
    if (!movable) return;
    // 포인터를 손잡이에 묶는다. 이게 없으면 빠르게 끌 때 줄 밖으로 새어 멈춘다.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragIndex === null) return;
    const to = rowAt(e.clientY);
    if (to === null || to === dragIndex) return;
    // 지나가는 자리마다 바로 자리를 바꾼다. 놓을 곳을 따로 그리지 않아도 결과가 보인다.
    setOrder((prev) => move(prev, dragIndex, to));
    setDragIndex(to);
  }

  function onPointerUp() {
    if (dragIndex === null) return;
    setDragIndex(null);

    const next = order.join(",");
    // 집었다가 제자리에 놓았으면 아무 일도 없었던 것이다.
    if (next === serverOrder) return;

    const data = new FormData();
    data.set("slug", slug);
    data.set("characterId", characterId);
    data.set("slotIds", next);
    startTransition(() => save(data));
  }

  let earned = 0;
  let cost = 0;
  rows.forEach((entry, index) => {
    earned += goldAt(entry.baseGold, index) ?? 0;
    cost += entry.moreCost ?? 0;
  });
  const remaining = rows.filter((e) => !e.done).length;

  return (
    <>
      <ul ref={listRef} className="divide-y divide-border">
        {rows.map((entry, index) => {
          // 골드를 아예 못 받는 캐릭터는 한도와 상관이 없다. 이유가 따로 있다.
          const capped = isGoldCapped(entry.baseGold, index);
          const earning = goldAt(entry.baseGold, index);
          return (
            <li
              key={entry.slotId}
              data-row
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-sm ${
                entry.done ? "text-text-faint" : ""
              } ${index === dragIndex ? "bg-accent/10" : ""} ${capped ? "opacity-70" : ""}`}
            >
              {/*
                이번 주 몇 번째로 가는 레이드인가. **그리고 끌어 옮기는 손잡이다.**

                번호 자체가 끌면 바뀌는 값이라 손잡이로 삼기에 맞다. 줄 전체를
                손잡이로 두면 폰에서 카드 위를 훑어 내릴 때마다 순서가 흐트러진다.
              */}
              <button
                type="button"
                onPointerDown={(e) => onPointerDown(index, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                title={
                  movable
                    ? "끌어서 순서를 바꿉니다. 앞의 세 개만 골드를 받습니다"
                    : undefined
                }
                className={`inline-flex h-4.5 min-w-4.5 shrink-0 touch-none select-none items-center justify-center rounded px-1 text-[11px] font-semibold tabular ${badgeTone(
                  entry.done,
                )} ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
              >
                {index + 1}
              </button>

              <span className={entry.done ? "line-through" : "font-medium"}>
                {entry.label}
              </span>

              {/*
                요일·시각도 뱃지로 두른다. 흐린 글자로만 두었더니 레이드 이름의
                꼬리처럼 붙어 "벨가르딘 나이트메어 수"까지가 한 이름으로 읽혔다.
                난이도가 이름 뒤에 붙는 표기라 더 그렇다.
              */}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] tabular ${badgeTone(entry.done)}`}
              >
                {dayName(entry.dayOfWeek)}
                {!isUndecided(entry.dayOfWeek) && ` ${entry.startTime}`}
              </span>

              <span
                className={`ml-auto text-xs tabular ${capped ? "text-text-faint" : ""}`}
                title={
                  capped
                    ? `주 ${RAID_GOLD_LIMIT}개까지만 골드를 받습니다. 위로 끌어 올리면 이 레이드가 골드를 받습니다`
                    : undefined
                }
              >
                {earning === null ? "-" : `${gold.format(earning)} G`}
              </span>
            </li>
          );
        })}
      </ul>

      {/*
        더보기는 골드를 주는 것이 아니라 **쓰는** 것이다. 그래서 두 줄로 나눈다.
        위는 그냥 클리어만 했을 때, 아래는 더보기를 다 켰을 때 손에 남는 골드다.
        한 줄에 "75,000 G 더보기 -24,000"으로만 두면 결국 얼마가 남는지는
        머리로 빼야 한다.
      */}
      <div className="space-y-0.5 border-t border-border px-3 py-2 text-xs">
        <div className="flex items-baseline gap-x-2">
          <span className="text-text-dim">
            남은 숙제 <span className="tabular">{remaining}</span>개
          </span>
          {/*
            한도에 걸린 캐릭터에만 붙인다. 셋 이하면 잘려 나가는 것이 없어서 알릴
            일도 없고, 모든 카드에 같은 문구가 붙으면 걸린 카드가 눈에 안 띈다.
          */}
          {rows.length > RAID_GOLD_LIMIT && (
            <span
              className="ml-auto text-text-faint"
              title={`골드는 앞의 ${RAID_GOLD_LIMIT}개에서만 들어옵니다. 번호를 끌어 바꿀 수 있습니다`}
            >
              골드 {RAID_GOLD_LIMIT}개까지
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-x-2">
          <span className="text-text-faint">더보기 안 함</span>
          <span className="ml-auto tabular text-text-dim">{gold.format(earned)} G</span>
        </div>

        {cost > 0 && (
          <div className="flex items-baseline gap-x-2">
            <span className="text-text-faint">더보기 함</span>
            {/*
              빠지는 값은 결과 바로 왼쪽에 붙인다. 라벨 뒤에 두었더니 줄 양 끝에
              숫자가 하나씩 떨어져 있어, 위 줄의 179,000에서 얼마가 빠져 이 줄의
              121,720이 되었는지를 눈이 한 번 건너뛰어야 했다. 붙여 두면
              `-57,280  121,720 G`가 한 덩어리로 읽힌다.
            */}
            <span className="ml-auto tabular text-danger">-{gold.format(cost)} G</span>
            <span className="tabular text-text-dim">{gold.format(earned - cost)} G</span>
          </div>
        )}

        {/* 저장은 조용히 끝난다. 실패만 말한다. 순서가 서버와 어긋난 채 남기 때문이다. */}
        {state.status === "error" && <p className="text-danger">{state.message}</p>}
        {saving && <p className="sr-only">순서를 저장하는 중입니다</p>}
      </div>
    </>
  );
}
