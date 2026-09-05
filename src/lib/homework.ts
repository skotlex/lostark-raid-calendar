import "server-only";

import { NO_ROSTER, goldEarnerIds } from "./goldEarners";
import { compareHomeworkRows, goldAt } from "./homeworkOrder";
import { prisma } from "./prisma";
import { raidReward } from "./raidRewards";
import { raidLabel } from "./raids";
import {
  TUESDAY,
  dayOffsetInWeek,
  getPlanningWeekStart,
  isUndecided,
  tuesdayWeekFor,
  weekStartForDay,
} from "./week";

/**
 * 숙제 현황.
 *
 * **편성표에 넣은 것이 곧 숙제다.** 따로 체크하는 화면을 두지 않는다. 이미 요일·시간이
 * 정해진 슬롯에 캐릭터를 넣었으므로, 그 시각이 지나면 다녀온 것으로 본다.
 * 손으로 켜고 끄는 목록을 하나 더 만들면 편성표와 어긋나는 순간부터 아무도 믿지 않는다.
 *
 * 골드는 `raidRewards.ts`의 표에서 온다. 표에 없는 레이드는 `null`로 두고 화면이 `-`를
 * 찍는다. 모르는 값을 0으로 적으면 합계가 조용히 틀어진다.
 */
export interface HomeworkEntry {
  slotId: string;
  raidName: string;
  difficulty: string | null;
  /** "벨가르딘 하드" */
  label: string;
  dayOfWeek: number;
  startTime: string;
  /**
   * 다녀온 숙제인가.
   *
   * 요일이 있는 슬롯은 **레이드 시각이 지났는가**로 정한다. 미정 슬롯만 사람이
   * 직접 누른 표시(`Assignment.homeworkDone`)를 본다. 잴 시각이 없어 시각 판정이
   * 서지 않기 때문이다.
   */
  done: boolean;
  /**
   * 이 줄을 손으로 켜고 끌 수 있는가. 미정 슬롯만 true다.
   *
   * 요일이 있는 슬롯에 버튼을 달지 않는다. 손 체크와 시각 판정이 갈리는 순간
   * 어느 쪽이 맞는지 알 수 없어진다(CLAUDE.md 2-3).
   */
  claimable: boolean;
  /**
   * 이 캐릭터가 이 레이드에서 실제로 받는 골드. 표에 없으면 null.
   *
   * 한도(3개)를 넘긴 자리면 값을 알아도 0이다. `baseGold`와 비교하면 얼마를
   * 흘리고 있는지가 나온다.
   */
  clearGold: number | null;
  moreCost: number | null;
  /**
   * 한도를 따지기 전, 이 레이드가 원래 주는 골드. 표에 없으면 null.
   *
   * 순서를 끌어 옮기는 화면이 **서버를 기다리지 않고** 골드를 다시 계산하려면
   * 원래 값이 있어야 한다. 없으면 놓는 순간과 새로고침 사이에 숫자가 멎어 보인다.
   * 골드를 못 받는 캐릭터는 여기도 0이다. 순서를 어떻게 바꿔도 0이라야 맞다.
   */
  baseGold: number | null;
}

export interface HomeworkCharacter {
  id: string;
  name: string;
  className: string | null;
  itemLevel: number | null;
  combatPower: number | null;
  entries: HomeworkEntry[];
  /**
   * 주간 골드를 받는 캐릭터인가.
   *
   * 원정대 하나에서 여섯뿐이다(goldEarners.ts). 아닌 캐릭터도 레이드는 가므로 숙제
   * 목록에는 그대로 있고, 골드만 0으로 센다.
   */
  goldEarner: boolean;
  /** 원정대 이름. 불러오기로 등록하지 않았으면 null */
  rosterLabel: string | null;
  /** 아직 하지 않은 숙제 수 */
  remaining: number;
  /** 이번 주에 들어올 클리어 골드 합계. 표에 없는 레이드는 빠진다 */
  clearGold: number;
  /** 더보기를 모두 켰을 때 나가는 골드 합계 */
  moreCost: number;
}

export interface RaidSummary {
  raidName: string;
  /** 이 레이드에 편성된 내 캐릭터. 다녀온 사람은 done이 켜진다 */
  characters: { name: string; done: boolean }[];
  remaining: number;
  /** 남은 숙제에서 들어올 골드 */
  remainingGold: number;
  /** 다녀온 것까지 합쳐 이 레이드가 이번 주에 주는 골드 */
  totalGold: number;
}

export interface Homework {
  characters: HomeworkCharacter[];
  raids: RaidSummary[];
  /** 남은 숙제에서 들어올 골드 합계 */
  remainingGold: number;
  /** 이번 주 편성 전체의 클리어 골드 합계 */
  totalGold: number;
  /**
   * 더보기를 모두 켰을 때 나가는 골드 합계. 양수다.
   *
   * 뺀 값을 미리 담지 않는다. 화면이 `totalGold - totalMoreCost`로 쓰는데,
   * 캐릭터 카드도 같은 식으로 계산하고 있어 두 곳이 같은 모양이라야 어긋나지 않는다.
   */
  totalMoreCost: number;
  /** 이번 주에 잡아 둔 숙제 수 */
  totalCount: number;
  /** 그중 아직 안 한 것 */
  remainingCount: number;
}

/**
 * 정렬하기 전의 한 줄. 한도를 매기려면 순서가 먼저 정해져야 한다.
 *
 * `HomeworkEntry`와 달리 `clearGold`가 없다. 그 값이 이 목록에서 몇 번째냐에
 * 달려 있어서, 줄을 세우기 전에는 아직 답이 없다.
 */
interface Row extends Omit<HomeworkEntry, "clearGold"> {
  /** `Assignment.homeworkOrder`. 사람이 끌어 옮긴 자리. 안 옮겼으면 null */
  order: number | null;
}

/**
 * KST 기준으로 그 슬롯의 레이드 시각이 이미 지났는지.
 *
 * 주차 시작(수요일 06시)에서 해당 요일까지의 거리를 재고 시작 시각을 더한다.
 * 요일 순서는 `WEEK_DAYS`(수 → 화)와 같아야 하므로 거리는 week.ts에서 받는다.
 * 일요일부터 세면 주말 레이드가 지난 주 것으로 계산된다.
 *
 * 미정 슬롯은 여기까지 오지 않는다. 부르는 쪽이 먼저 갈라 사람이 누른 표시를 본다.
 * 거리가 -1로 오는 경우를 그래도 막아 둔다. 그 값을 날짜에 더하면 지난 주 시각이
 * 되어 "이미 다녀온 것"으로 조용히 뒤집힌다.
 */
function raidPassed(weekStart: Date, dayOfWeek: number, startTime: string): boolean {
  const offset = dayOffsetInWeek(dayOfWeek);
  if (offset < 0) return false;

  const [hour, minute] = startTime.split(":").map(Number);
  const at = new Date(weekStart.getTime());
  at.setUTCDate(at.getUTCDate() + offset);
  // weekStart는 KST 06:00을 가리키는 UTC 시각이다. 거기서 06시를 빼고 슬롯 시각을 더한다.
  at.setUTCHours(at.getUTCHours() - 6 + (hour || 0), minute || 0, 0, 0);

  return Date.now() >= at.getTime();
}

/**
 * 내 캐릭터의 이번 주 숙제.
 *
 * 내 것만 본다. 길드 전체를 늘어놓으면 무엇이 내 일인지 찾는 화면이 되고, 골드 합계도
 * 남의 것과 섞여 의미가 없어진다.
 */
export async function getHomework(
  instanceId: string,
  memberId: string | null,
): Promise<Homework> {
  if (!memberId) {
    return {
      characters: [],
      raids: [],
      remainingGold: 0,
      totalGold: 0,
      totalMoreCost: 0,
      totalCount: 0,
      remainingCount: 0,
    };
  }

  const planningWeek = getPlanningWeekStart();
  const tuesdayWeek = tuesdayWeekFor(planningWeek);

  const characters = await prisma.character.findMany({
    where: { instanceId, memberId },
    select: {
      id: true,
      name: true,
      className: true,
      itemLevel: true,
      combatPower: true,
      goldEarner: true,
      rosterId: true,
      roster: { select: { label: true } },
      assignments: {
        where: { weekStart: { in: [planningWeek, tuesdayWeek] } },
        select: {
          slot: {
            select: {
              id: true,
              raidName: true,
              difficulty: true,
              dayOfWeek: true,
              startTime: true,
              archivedAt: true,
            },
          },
          weekStart: true,
          homeworkOrder: true,
          homeworkDone: true,
        },
      },
    },
    /*
     * 템레벨이 먼저, 같으면 전투력.
     *
     * 템레벨은 소수 둘째 자리까지라 같은 값이 흔하다(같은 재련 단계면 같다).
     * 거기서 갈리는 것이 전투력이라 둘을 이어 붙여야 순서가 매번 같게 나온다.
     *
     * 아직 조회되지 않은 캐릭터는 뒤로 보낸다. desc는 Postgres 기본이 NULL을 앞에
     * 두는데, 스펙을 모르는 캐릭터가 만렙 위에 서면 목록을 잘못 읽게 된다.
     */
    orderBy: [
      { itemLevel: { sort: "desc", nulls: "last" } },
      { combatPower: { sort: "desc", nulls: "last" } },
    ],
  });

  /*
   * 골드를 받는 캐릭터를 원정대마다 가린다.
   *
   * **편성표에 있는 캐릭터만 보고 정하면 안 된다.** 이번 주에 안 넣은 만렙 부캐도
   * 골드 여섯 자리를 하나 차지한다. 그래서 `withWork`로 걸러내기 전, 내 캐릭터
   * 전체를 놓고 센다.
   *
   * 원정대가 없는 캐릭터(편성 칸으로 만들어진 것들)는 한 묶음으로 본다. 정확하지는
   * 않지만 다 골드 획득으로 두는 것보다 낫고, 원정대를 불러오면 바로잡힌다.
   */
  const byRoster = new Map<string, typeof characters>();
  for (const character of characters) {
    const key = character.rosterId ?? NO_ROSTER;
    const list = byRoster.get(key) ?? [];
    list.push(character);
    byRoster.set(key, list);
  }

  const earners = new Set<string>();
  for (const list of byRoster.values()) {
    for (const id of goldEarnerIds(
      list.map((c) => ({
        id: c.id,
        itemLevel: c.itemLevel === null ? null : Number(c.itemLevel),
        goldEarner: c.goldEarner,
      })),
    )) {
      earners.add(id);
    }
  }

  const raids = new Map<string, RaidSummary>();

  const result: HomeworkCharacter[] = characters.map((character) => {
    const goldEarner = earners.has(character.id);
    const rows: Row[] = [];

    for (const assignment of character.assignments) {
      const slot = assignment.slot;
      // 요일표에서 내린 슬롯은 숙제가 아니다. 과거 기록으로만 남는다.
      if (slot.archivedAt) continue;

      // 화요일 슬롯은 주차가 다르다. 자기 주차의 배정만 이번 주 숙제다(week.ts).
      const mine = weekStartForDay(planningWeek, slot.dayOfWeek);
      if (assignment.weekStart.getTime() !== mine.getTime()) continue;

      const reward = raidReward(slot.raidName, slot.difficulty);
      const base = slot.dayOfWeek === TUESDAY ? tuesdayWeek : planningWeek;
      const claimable = isUndecided(slot.dayOfWeek);

      rows.push({
        slotId: slot.id,
        raidName: slot.raidName,
        difficulty: slot.difficulty,
        label: raidLabel(slot.raidName, slot.difficulty),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        /*
         * 미정만 사람이 누른 표시를 본다. 나머지는 시각이 정한다.
         *
         * 둘을 섞어 `지났거나 눌렀거나`로 두지 않는다. 요일 슬롯에 손 체크가 붙으면
         * 편성표와 어긋나는 목록이 하나 더 생기고, 그러면 아무도 믿지 않는다.
         */
        done: claimable ? assignment.homeworkDone : raidPassed(base, slot.dayOfWeek, slot.startTime),
        claimable,
        /*
         * 골드를 못 받는 캐릭터는 0이다. `null`이 아니다.
         *
         * null은 "보상 표에 없는 레이드"라는 뜻이고 화면이 `-`를 찍는다. 여기는 값을
         * 아는데 이 캐릭터에게 안 들어오는 것이라 0이 맞다.
         *
         * 더보기도 공짜다. 골드를 못 받는 대신 더보기 비용이 붙지 않는다.
         * 한도를 넘긴 자리는 이와 다르다. 골드를 받는 캐릭터라 더보기 값은 치른다.
         */
        baseGold: goldEarner ? (reward?.clearGold ?? null) : 0,
        moreCost: goldEarner ? (reward?.moreCost ?? null) : 0,
        order: assignment.homeworkOrder,
      });
    }

    rows.sort(compareHomeworkRows);

    /*
     * 앞의 셋만 골드를 받는다(goldEarners.ts).
     *
     * 순서가 곧 답이라 여기서는 자르기만 한다. 어느 셋인지는 위의 정렬이 정했고,
     * 사람이 끌어 옮겼으면 그 순서가 그대로 온다.
     */
    const entries: HomeworkEntry[] = rows.map((row, index) => ({
      slotId: row.slotId,
      raidName: row.raidName,
      difficulty: row.difficulty,
      label: row.label,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      done: row.done,
      claimable: row.claimable,
      clearGold: goldAt(row.baseGold, index),
      moreCost: row.moreCost,
      baseGold: row.baseGold,
    }));

    for (const entry of entries) {
      const summary = raids.get(entry.raidName) ?? {
        raidName: entry.raidName,
        characters: [],
        remaining: 0,
        remainingGold: 0,
        totalGold: 0,
      };
      summary.characters.push({ name: character.name, done: entry.done });
      summary.totalGold += entry.clearGold ?? 0;
      if (!entry.done) {
        summary.remaining += 1;
        summary.remainingGold += entry.clearGold ?? 0;
      }
      raids.set(entry.raidName, summary);
    }

    return {
      id: character.id,
      name: character.name,
      className: character.className,
      itemLevel: character.itemLevel === null ? null : Number(character.itemLevel),
      combatPower: character.combatPower === null ? null : Number(character.combatPower),
      entries,
      goldEarner,
      rosterLabel: character.roster?.label ?? null,
      remaining: entries.filter((e) => !e.done).length,
      clearGold: entries.reduce((sum, e) => sum + (e.clearGold ?? 0), 0),
      moreCost: entries.reduce((sum, e) => sum + (e.moreCost ?? 0), 0),
    };
  });

  const withWork = result.filter((c) => c.entries.length > 0);

  return {
    characters: withWork,
    raids: [...raids.values()],
    remainingGold: [...raids.values()].reduce((sum, r) => sum + r.remainingGold, 0),
    totalGold: withWork.reduce((sum, c) => sum + c.clearGold, 0),
    totalMoreCost: withWork.reduce((sum, c) => sum + c.moreCost, 0),
    totalCount: withWork.reduce((sum, c) => sum + c.entries.length, 0),
    remainingCount: withWork.reduce((sum, c) => sum + c.remaining, 0),
  };
}

/** 순서 저장이 막힌 이유. 화면이 그대로 보여준다. */
export class HomeworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HomeworkError";
  }
}

/**
 * 이 캐릭터의 이번 주 숙제 순서를 박는다.
 *
 * **앞의 셋만 골드를 받으므로**(goldEarners.ts) 이건 순서를 바꾸는 일이 아니라
 * "어느 레이드에서 골드를 받을 것인가"를 고르는 일이다. 게임에서 사람이 고르는
 * 값이라 앱이 대신 정하지 않는다.
 *
 * **내 캐릭터만 바꿀 수 있다.** 편성은 누구나 손대지만(CLAUDE.md 4장) 이건 편성이
 * 아니라 남의 골드 계산이다. 남이 바꿔 봐야 그 사람 화면에는 보이지도 않는다.
 *
 * 넘어온 목록에 없는 배정은 null로 되돌린다. 그 사이 새로 들어온 레이드가 여기
 * 섞이면 사람이 보지도 않은 줄에 번호를 박게 된다. null이면 맨 뒤로 가므로
 * 골드 자리를 뺏지도 않는다.
 */
export async function setHomeworkOrder(
  instanceId: string,
  memberId: string | null,
  characterId: string,
  slotIds: readonly string[],
): Promise<void> {
  if (!memberId) throw new HomeworkError("내 원정대를 먼저 불러와 주세요");

  const character = await prisma.character.findFirst({
    where: { id: characterId, instanceId, memberId },
    select: { id: true },
  });
  if (!character) throw new HomeworkError("내 캐릭터가 아닙니다");

  const planningWeek = getPlanningWeekStart();
  const tuesdayWeek = tuesdayWeekFor(planningWeek);

  const rows = await prisma.assignment.findMany({
    where: { characterId, weekStart: { in: [planningWeek, tuesdayWeek] } },
    select: {
      id: true,
      slotId: true,
      weekStart: true,
      homeworkOrder: true,
      slot: { select: { dayOfWeek: true, archivedAt: true } },
    },
  });

  // 화요일 슬롯은 주차가 다르다. 두 주차를 함께 읽었으니 제 것만 고른다(week.ts).
  const mine = rows.filter(
    (row) =>
      !row.slot.archivedAt &&
      row.weekStart.getTime() ===
        weekStartForDay(planningWeek, row.slot.dayOfWeek).getTime(),
  );

  const rank = new Map(slotIds.map((slotId, index) => [slotId, index]));
  const changed = mine
    .map((row) => ({ id: row.id, order: rank.get(row.slotId) ?? null, was: row.homeworkOrder }))
    .filter((row) => row.order !== row.was);
  if (changed.length === 0) return;

  // 한 번에 넣는다. 반만 박히면 두 레이드가 같은 자리를 갖거나 비어 순서가 어긋난다.
  await prisma.$transaction(
    changed.map((row) =>
      prisma.assignment.update({
        where: { id: row.id },
        data: { homeworkOrder: row.order },
      }),
    ),
  );
}

/**
 * 미정 레이드를 다녀온 것으로 켜고 끈다.
 *
 * **미정에만 있는 버튼이다.** 요일이 있는 슬롯은 시각이 지났는지로 정해지고
 * (`raidPassed`), 거기에 손 체크를 겹치면 편성표와 어긋나는 목록이 하나 더 생긴다.
 * 미정은 잴 시각이 없어 그 판정 자체가 서지 않으므로 사람이 대신 말해 준다.
 *
 * **내 캐릭터만 바꿀 수 있다.** `setHomeworkOrder`와 같은 이유다. 편성이 아니라
 * 내 숙제 기록이고, 남이 바꿔 봐야 그 사람 화면에는 보이지도 않는다.
 */
export async function setHomeworkDone(
  instanceId: string,
  memberId: string | null,
  characterId: string,
  slotId: string,
  done: boolean,
): Promise<void> {
  if (!memberId) throw new HomeworkError("내 원정대를 먼저 불러와 주세요");

  const character = await prisma.character.findFirst({
    where: { id: characterId, instanceId, memberId },
    select: { id: true },
  });
  if (!character) throw new HomeworkError("내 캐릭터가 아닙니다");

  const planningWeek = getPlanningWeekStart();
  const tuesdayWeek = tuesdayWeekFor(planningWeek);

  /*
   * 두 주차를 함께 읽고 제 것만 고른다. `setHomeworkOrder`와 같은 모양이다.
   *
   * 미정은 수~월 무리라 `planningWeek`가 답이지만 그것을 여기서 단정하지 않는다.
   * 요일에서 주차를 구하는 길은 `weekStartForDay` 하나로 모아 둔다(week.ts).
   */
  const assignment = await prisma.assignment.findFirst({
    where: {
      characterId,
      slotId,
      weekStart: { in: [planningWeek, tuesdayWeek] },
      slot: { instanceId, archivedAt: null },
    },
    select: {
      id: true,
      weekStart: true,
      homeworkDone: true,
      slot: { select: { dayOfWeek: true } },
    },
  });
  // 지난 주차이거나 요일표에서 내린 슬롯이면 여기서 걸린다. 과거는 읽기 전용이다.
  if (
    !assignment ||
    assignment.weekStart.getTime() !==
      weekStartForDay(planningWeek, assignment.slot.dayOfWeek).getTime()
  ) {
    throw new HomeworkError("이번 주 편성이 아닙니다");
  }

  // 미정에만 있는 버튼이다. 다른 요일이 오면 화면이 아니라 요청이 잘못된 것이다.
  if (!isUndecided(assignment.slot.dayOfWeek)) {
    throw new HomeworkError("요일이 정해진 레이드는 시각이 지나면 자동으로 처리됩니다");
  }

  if (assignment.homeworkDone === done) return;

  await prisma.assignment.update({
    where: { id: assignment.id },
    data: { homeworkDone: done },
  });
}
