"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { RAID_GOLD_LIMIT } from "@/lib/goldEarners";
import type { HomeworkEntry } from "@/lib/homework";
import { goldAt, isGoldCapped } from "@/lib/homeworkOrder";
import { dayName, isUndecided } from "@/lib/week";

import { GripIcon } from "../icons";
import { type HomeworkState, claimHomeworkAction, reorderHomeworkAction } from "./actions";

const IDLE: HomeworkState = { status: "idle", message: "" };

const gold = new Intl.NumberFormat("ko-KR");

/**
 * 손가락으로 끌기 시작하기까지 눌러야 하는 시간.
 *
 * 마우스는 누른 즉시 시작한다. 손가락은 그럴 수 없다. 이 목록은 세로로 긴 화면
 * 한가운데 있어서, 바로 잡히게 두면 카드 위를 훑어 내릴 때마다 순서가 흐트러진다.
 * 잠깐 멈춰 있으면 "옮기려는 것", 곧바로 움직이면 "내리려는 것"으로 가른다.
 */
const HOLD_MS = 250;

/** 그 사이에 손가락이 이만큼(px) 넘게 움직이면 훑어 내리는 것으로 본다. */
const HOLD_SLOP = 8;

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

  /*
   * 미정 줄의 "보상 수령".
   *
   * **낙관적으로 그리지 않는다.** 이 값은 카드의 남은 숙제 수뿐 아니라 화면 위쪽의
   * 주간 진행률과 레이드별 현황까지 움직이는데, 그쪽은 서버가 다시 그린다. 줄만
   * 먼저 바꿔 두면 같은 화면의 두 곳이 한 박자 어긋난 채 보인다. 순서 바꾸기와
   * 다른 점이다 — 그건 이 카드 안에서만 끝나고, 끄는 동안 손이 결과를 기다린다.
   *
   * 대신 누른 줄에만 표시를 남긴다. `claiming`은 카드 하나에 하나뿐이라
   * 어느 줄을 눌렀는지는 따로 기억해야 한다.
   */
  const [claimState, claim, claiming] = useActionState(claimHomeworkAction, IDLE);
  const [claimingSlot, setClaimingSlot] = useState<string | null>(null);

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

  /* 손가락을 누르고 있는 동안의 상태. 끌기가 시작되면 비운다. */
  const holdTimer = useRef<number | null>(null);
  const holdFrom = useRef<{ x: number; y: number } | null>(null);

  /*
   * 끄는 동안 화면이 따라 내려가지 않게 막는다.
   *
   * 줄에 `touch-action: none`을 박으면 간단하지만, 그러면 카드 위를 훑어 내릴 수
   * 없게 된다. 이 목록이 화면의 대부분이라 훑기를 못 쓰면 화면 자체를 못 쓴다.
   * 그래서 **끌기가 실제로 시작된 뒤에만** touchmove를 막는다. React가 붙이는
   * 핸들러는 passive라 preventDefault가 듣지 않으므로 직접 붙인다.
   */
  const scrollLock = useRef<((e: TouchEvent) => void) | null>(null);

  function lockScroll() {
    if (scrollLock.current) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener("touchmove", block, { passive: false });
    scrollLock.current = block;
  }

  function unlockScroll() {
    if (!scrollLock.current) return;
    document.removeEventListener("touchmove", scrollLock.current);
    scrollLock.current = null;
  }

  function cancelHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    holdFrom.current = null;
  }

  /*
   * 끌던 도중에 이 카드가 사라지면 막아둔 스크롤이 그대로 남는다. 화면 전체가
   * 굳어버리므로 반드시 푼다. ref만 건드리니 다시 그릴 일이 없어 의존성이 없다.
   */
  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      if (scrollLock.current) {
        document.removeEventListener("touchmove", scrollLock.current);
        scrollLock.current = null;
      }
    };
  }, []);

  /** 지금 포인터가 몇 번째 줄 위에 있나. 줄 높이가 제각각이라 매번 잰다. */
  function rowAt(clientY: number): number | null {
    const kids = listRef.current?.querySelectorAll("[data-row]");
    if (!kids || kids.length === 0) return null;
    for (let i = 0; i < kids.length; i += 1) {
      if (clientY < kids[i].getBoundingClientRect().bottom) return i;
    }
    return kids.length - 1;
  }

  /**
   * 끌기 시작. **줄 어디를 잡아도 된다.**
   *
   * 마우스는 누른 즉시다. 손가락은 잠깐 눌러야 한다(HOLD_MS). 그 사이에 손가락이
   * 움직이면 훑어 내리려는 것이라 접는다.
   */
  function onPointerDown(index: number, e: React.PointerEvent<HTMLElement>) {
    if (!movable) return;

    if (e.pointerType === "mouse") {
      // 포인터를 줄에 묶는다. 이게 없으면 빠르게 끌 때 줄 밖으로 새어 멈춘다.
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragIndex(index);
      return;
    }

    const el = e.currentTarget;
    const pointerId = e.pointerId;
    holdFrom.current = { x: e.clientX, y: e.clientY };
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      // 그새 손을 뗐거나 줄이 사라졌으면 붙잡을 것이 없다.
      if (!el.isConnected) return;
      try {
        el.setPointerCapture(pointerId);
      } catch {
        return;
      }
      lockScroll();
      setDragIndex(index);
    }, HOLD_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragIndex === null) {
      // 아직 누르고 있는 중이다. 움직였으면 훑어 내리려는 것이다.
      const from = holdFrom.current;
      if (
        holdTimer.current !== null &&
        from &&
        Math.hypot(e.clientX - from.x, e.clientY - from.y) > HOLD_SLOP
      ) {
        cancelHold();
      }
      return;
    }

    const to = rowAt(e.clientY);
    if (to === null || to === dragIndex) return;
    // 지나가는 자리마다 바로 자리를 바꾼다. 놓을 곳을 따로 그리지 않아도 결과가 보인다.
    setOrder((prev) => move(prev, dragIndex, to));
    setDragIndex(to);
  }

  function onPointerUp() {
    cancelHold();
    unlockScroll();
    if (dragIndex === null) return;
    setDragIndex(null);
    commit(order);
  }

  /** 바뀐 순서를 서버에 굳힌다. 제자리로 돌아왔으면 아무 일도 없었던 것이다. */
  function commit(next: readonly string[]) {
    const joined = next.join(",");
    if (joined === serverOrder) return;

    const data = new FormData();
    data.set("slug", slug);
    data.set("characterId", characterId);
    data.set("slotIds", joined);
    startTransition(() => save(data));
  }

  /** 미정 줄의 보상 수령을 켜고 끈다. 지금 상태의 반대를 보낸다. */
  function toggleClaim(entry: HomeworkEntry) {
    const data = new FormData();
    data.set("slug", slug);
    data.set("characterId", characterId);
    data.set("slotId", entry.slotId);
    data.set("done", entry.done ? "" : "1");
    setClaimingSlot(entry.slotId);
    startTransition(() => claim(data));
  }

  /**
   * 위·아래 화살표로도 옮긴다.
   *
   * 끌기는 마우스나 손가락이 있어야 한다. 손잡이가 버튼이라 탭으로 닿을 수 있으니
   * 거기서 끝내지 않는다. 줄을 slotId로 키를 잡아 두어 자리가 바뀌어도 같은 버튼이
   * 그대로 남고, 초점이 따라가 연달아 누를 수 있다.
   */
  function onKeyDown(index: number, e: React.KeyboardEvent) {
    if (!movable) return;
    const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
    if (to === null || to < 0 || to >= rows.length) return;
    e.preventDefault();

    const next = move(order, index, to);
    setOrder(next);
    commit(next);
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
              onPointerDown={(e) => onPointerDown(index, e)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`group flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-sm ${
                entry.done ? "text-text-faint" : ""
              } ${index === dragIndex ? "bg-accent/10" : ""} ${capped ? "opacity-70" : ""} ${
                movable ? "cursor-grab select-none active:cursor-grabbing" : ""
              }`}
            >
              {/*
                끌 수 있다는 표시. 점 여섯 개는 "여기를 잡으면 끌린다"는 오래된 약속이라
                설명이 필요 없다. 편성표 간략 보기가 쓰는 것과 같은 그림이다(icons.tsx).

                **잡는 곳은 줄 전체다.** 이 그림은 알려주는 역할이지 유일한 손잡이가
                아니다. 처음에는 번호 뱃지만 잡히게 두었는데, 끌 수 있다는 것을 아무도
                알아채지 못했고 알아챈 뒤에도 좁은 뱃지를 정확히 짚어야 했다.

                버튼으로 두는 것은 키보드 때문이다. 탭으로 닿아 화살표로 옮긴다.
                옮길 줄이 하나뿐이면 그리지 않는다. 잡아도 갈 곳이 없다.
              */}
              {movable && (
                <button
                  type="button"
                  onKeyDown={(e) => onKeyDown(index, e)}
                  title={`끌어서 순서를 바꿉니다. 앞의 ${RAID_GOLD_LIMIT}개만 골드를 받습니다`}
                  aria-label={`${entry.label} 순서 바꾸기. 위아래 화살표로 옮깁니다`}
                  className="flex shrink-0 cursor-grab text-text-faint transition-colors group-hover:text-text-dim active:cursor-grabbing"
                >
                  <GripIcon />
                </button>
              )}

              {/* 이번 주 몇 번째로 가는 레이드인가. 앞의 셋만 골드를 받는다. */}
              <span
                className={`inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded px-1 text-[11px] font-semibold tabular ${badgeTone(
                  entry.done,
                )}`}
              >
                {index + 1}
              </span>

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

              {/*
                미정 줄만 갖는 손 체크. 요일 뱃지 바로 오른쪽이라 "미정이라서 여기에
                이게 있다"가 나란히 읽힌다.

                아직 안 받았으면 파란색으로 띄운다. 이 카드에서 악센트(금색)는
                "안 간 숙제"의 색이라(badgeTone) 같은 색을 쓰면 눌러야 할 것과 그냥
                남은 줄이 구분되지 않는다. 받고 나면 나머지 뱃지와 같이 회색으로
                가라앉아 줄 전체가 한 번에 다녀온 것으로 읽힌다.

                **pointerdown을 여기서 끊는다.** 줄 전체가 끌기 손잡이라(위) 그냥 두면
                누르는 순간 이 줄을 집어 든 상태가 된다.
              */}
              {entry.claimable && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => toggleClaim(entry)}
                  disabled={claiming && claimingSlot === entry.slotId}
                  title={
                    entry.done
                      ? "보상을 받은 것으로 표시했습니다. 다시 누르면 취소합니다"
                      : "요일이 없어 시각으로 알 수 없습니다. 다녀왔으면 눌러 주세요"
                  }
                  className={`cursor-pointer rounded px-1.5 py-0.5 text-[11px] transition-colors disabled:opacity-50 ${
                    entry.done
                      ? "bg-surface-2/60 text-text-faint hover:bg-surface-2"
                      : "bg-support/15 text-support hover:bg-support/25"
                  }`}
                >
                  보상 수령
                </button>
              )}

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
              title={`골드는 앞의 ${RAID_GOLD_LIMIT}개에서만 들어옵니다. 줄을 끌어 바꿀 수 있습니다`}
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
        {claimState.status === "error" && <p className="text-danger">{claimState.message}</p>}
        {saving && <p className="sr-only">순서를 저장하는 중입니다</p>}
        {claiming && <p className="sr-only">보상 수령을 저장하는 중입니다</p>}
      </div>
    </>
  );
}
