import "server-only";

import { NO_ROSTER, goldEarnerIds } from "./goldEarners";
import { prisma } from "./prisma";
import { raidReward } from "./raidRewards";
import { raidLabel } from "./raids";
import {
  TUESDAY,
  getPlanningWeekStart,
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
  /** 레이드 시각이 지났는가. 지나면 다녀온 것으로 본다 */
  done: boolean;
  /** 표에 없으면 null */
  clearGold: number | null;
  moreCost: number | null;
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
 * KST 기준으로 그 슬롯의 레이드 시각이 이미 지났는지.
 *
 * 주차 시작(수요일 06시)에서 해당 요일까지의 거리를 재고 시작 시각을 더한다.
 * 요일 순서는 `WEEK_DAYS`(수 → 화)와 같아야 한다. 일요일부터 세면 주말 레이드가
 * 지난 주 것으로 계산된다.
 */
function raidPassed(weekStart: Date, dayOfWeek: number, startTime: string): boolean {
  const WEEK_ORDER = [3, 4, 5, 6, 0, 1, 2];
  const offset = WEEK_ORDER.indexOf(dayOfWeek);
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
    const entries: HomeworkEntry[] = [];

    for (const assignment of character.assignments) {
      const slot = assignment.slot;
      // 요일표에서 내린 슬롯은 숙제가 아니다. 과거 기록으로만 남는다.
      if (slot.archivedAt) continue;

      // 화요일 슬롯은 주차가 다르다. 자기 주차의 배정만 이번 주 숙제다(week.ts).
      const mine = weekStartForDay(planningWeek, slot.dayOfWeek);
      if (assignment.weekStart.getTime() !== mine.getTime()) continue;

      const reward = raidReward(slot.raidName, slot.difficulty);
      const base = slot.dayOfWeek === TUESDAY ? tuesdayWeek : planningWeek;

      entries.push({
        slotId: slot.id,
        raidName: slot.raidName,
        difficulty: slot.difficulty,
        label: raidLabel(slot.raidName, slot.difficulty),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        done: raidPassed(base, slot.dayOfWeek, slot.startTime),
        /*
         * 골드를 못 받는 캐릭터는 0이다. `null`이 아니다.
         *
         * null은 "보상 표에 없는 레이드"라는 뜻이고 화면이 `-`를 찍는다. 여기는 값을
         * 아는데 이 캐릭터에게 안 들어오는 것이라 0이 맞다.
         *
         * 더보기도 공짜다. 골드를 못 받는 대신 더보기 비용이 붙지 않는다.
         */
        clearGold: goldEarner ? (reward?.clearGold ?? null) : 0,
        moreCost: goldEarner ? (reward?.moreCost ?? null) : 0,
      });
    }

    // 요일 순서대로 세운다. 화면을 위에서 아래로 읽으면 주간 일정이 된다.
    const WEEK_ORDER = [3, 4, 5, 6, 0, 1, 2];
    entries.sort((a, b) => {
      const day = WEEK_ORDER.indexOf(a.dayOfWeek) - WEEK_ORDER.indexOf(b.dayOfWeek);
      return day !== 0 ? day : a.startTime.localeCompare(b.startTime);
    });

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
