import "server-only";

import { NO_ROSTER, RAID_GOLD_LIMIT, goldEarnerIds } from "./goldEarners";
import { compareHomeworkRows, goldAt } from "./homeworkOrder";
import { prisma } from "./prisma";
import { raidMinLevel, raidReward } from "./raidRewards";
import { raidLabel } from "./raids";
import { compareWeekDay, dayOffsetInWeek, getWeekStart, isUndecided } from "./week";

/**
 * 숙제 현황.
 *
 * **편성표에 넣은 것이 곧 숙제다.** 따로 체크하는 화면을 두지 않는다. 이미 요일·시간이
 * 정해진 슬롯에 캐릭터를 넣었으므로, 그 시각이 지나면 다녀온 것으로 본다.
 * 손으로 켜고 끄는 목록을 하나 더 만들면 편성표와 어긋나는 순간부터 아무도 믿지 않는다.
 *
 * 골드는 `raidRewards.ts`의 표에서 온다. 표에 없는 레이드는 `null`로 두고 화면이 `-`를
 * 찍는다. 모르는 값을 0으로 적으면 합계가 조용히 틀어진다.
 *
 * **여기서 주차는 게임 주차 하나다**(week.ts의 `getWeekStart`). 편성표가 화 00시에
 * 다음 주차를 펴는 것은 다음 주를 미리 짜라고 30시간 앞당긴 것일 뿐이고, 숙제와 골드
 * 한도가 풀리는 시각은 여전히 수요일 06시다. 그래서 이 파일은 `liveWeekForDay`를
 * 쓰지 않는다 — 요일마다 주차를 갈라 놓으면 그 30시간 동안 오늘 밤 화요일 공대와
 * 아직 돌 수 있는 미정 레이드가 목록에서 빠지고, 진행률과 골드 합계가 시작도 안 한
 * 주차의 값으로 바뀐다.
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

/**
 * 채우지 못한 골드 자리에 넣을 만한 레이드.
 *
 * 골드는 캐릭터마다 **레이드 셋까지**다(goldEarners.ts). 셋을 못 채운 캐릭터는 남은
 * 자리만큼 골드를 그냥 흘리는데, 카드에는 잡아 둔 줄만 서 있어 **비어 있다는 사실
 * 자체가 화면에 없다.** 그래서 빈 자리에 후보를 세운다.
 *
 * **앱이 "가야 할 레이드"를 아는 것은 아니다.** 요일표에 슬롯이 있고, 이 캐릭터가
 * 아직 안 들어갔고, 지금 들어갈 수 있는 것까지가 앱이 말할 수 있는 전부다. 요일표에
 * 없는 레이드는 여기 뜨지 않는다 — 숙제는 편성표에서 나온다(CLAUDE.md 2-3).
 *
 * **요일도 시각도 담지 않는다.** 같은 레이드가 여러 요일에 동시에 서 있을 수 있어서,
 * 하나를 골라 적으면 나머지 공대는 없는 것이 된다. 실제 줄에서 요일 뱃지가 서던
 * 자리에는 `비어 있음`이 들어간다 — 이 줄이 말하려는 것은 어느 날이 아니라 자리가
 * 비었다는 사실이고, 어느 날 갈지는 편성표에서 고른다.
 */
export interface MissingRaid {
  raidName: string;
  /** 난이도가 여럿이면 골드가 가장 큰 쪽이다. 화면이 뱃지로 두른다 */
  difficulty: string | null;
  /** "카멘 하드". 이름과 난이도를 붙인 값이라 읽어주는 글에만 쓴다 */
  label: string;
  /**
   * 여기 들어가면 이 캐릭터가 받을 골드. 보상 표에 없으면 null.
   *
   * 골드를 못 받는 캐릭터는 0이다. 자리를 채워도 골드는 안 들어오지만 레이드는
   * 가므로 후보에서 빼지는 않는다. 화면이 0을 보고 숫자를 감춘다.
   */
  clearGold: number | null;
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
  /**
   * 못 채운 골드 자리에 넣을 만한 레이드. 셋을 채웠으면 비어 있다.
   *
   * 빈 자리 수보다 많이 담지 않는다. 후보를 다 늘어놓으면 "아직 갈 수 있는 레이드
   * 목록"이 되어, 이 카드가 말하려던 "여기 한 자리가 비었다"가 묻힌다.
   */
  missing: MissingRaid[];
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
 * 고르는 동안의 후보. 요일·시각은 **줄 세우기에만** 쓰고 화면에는 넘기지 않는다.
 *
 * 같은 레이드가 여러 요일에 서 있을 수 있어 하나를 골라 적을 수 없다(`MissingRaid`).
 * 그래도 보상이 같은 둘 중 어느 것을 먼저 세울지는 정해야 해서 여기까지만 들고 있는다.
 */
interface Candidate extends MissingRaid {
  dayOfWeek: number;
  startTime: string;
}

/** 후보를 고르기 전의 요일표 한 줄. 자리가 몇 개 찼는지까지 들고 온다. */
interface CandidateSlot {
  raidName: string;
  difficulty: string | null;
  dayOfWeek: number;
  startTime: string;
  partySize: number;
  filled: number;
}

/**
 * 못 채운 골드 자리에 넣을 만한 레이드를 고른다(`MissingRaid`).
 *
 * 걸러내는 것이 셋이다. 셋 다 **권해봐야 못 가는 자리**를 빼는 것이지 경고가 아니다.
 *
 * | 거르는 것 | 이유 |
 * |---|---|
 * | 자리가 다 찬 공대 | 8/8이면 들어갈 칸이 없다 |
 * | 시각이 이미 지난 슬롯 | 금요일에 수요일 공대를 권해봐야 소용없다 |
 * | 레벨컷 미달 | 게임이 입장에서 막는다. 칸의 자동완성과 같은 규칙이다 |
 *
 * **컷을 모르는 레이드와 스펙을 못 받아온 캐릭터는 지나간다.** 모르는 값으로 후보를
 * 지우면 멀쩡한 레이드가 조용히 사라져, 자리가 비었는데 아무것도 안 뜨는 화면이 된다.
 * 여기서도 3.4다 — 모르는 컷을 지어내지 않는다.
 *
 * **미정은 시각으로 거르지 않는다.** 잴 시각이 없어 판정 자체가 서지 않고(`raidPassed`),
 * 그 주 내내 갈 수 있는 레이드다. 혼자 도는 자리라 오히려 빈 골드 자리를 메우기 좋다.
 *
 * **같은 레이드는 한 번만 담는다.** 한 캐릭터는 같은 레이드를 난이도가 달라도 한 주에
 * 한 번만 가므로(CLAUDE.md 3.4-1), 노말과 하드를 나란히 세우면 둘 다 갈 수 있는 것처럼
 * 읽힌다. 골드가 큰 쪽을 남긴다 — 어차피 하나만 갈 것이면 그쪽이 답이다.
 */
function missingRaids(
  slots: readonly CandidateSlot[],
  weekStart: Date,
  itemLevel: number | null,
  goldEarner: boolean,
  taken: ReadonlySet<string>,
  open: number,
): MissingRaid[] {
  if (open <= 0) return [];

  const best = new Map<string, Candidate>();

  for (const slot of slots) {
    const raid = slot.raidName.trim();
    if (taken.has(raid)) continue;
    if (slot.filled >= slot.partySize) continue;
    if (!isUndecided(slot.dayOfWeek) && raidPassed(weekStart, slot.dayOfWeek, slot.startTime)) {
      continue;
    }

    const min = raidMinLevel(slot.raidName, slot.difficulty);
    if (min !== null && itemLevel !== null && itemLevel < min) continue;

    // 골드를 못 받는 캐릭터는 0이다. 줄에 찍히는 값과 같은 규칙이라야 어긋나지 않는다.
    const clearGold = goldEarner ? (raidReward(slot.raidName, slot.difficulty)?.clearGold ?? null) : 0;

    const found = best.get(raid);
    if (!found) {
      best.set(raid, {
        raidName: raid,
        difficulty: slot.difficulty,
        label: raidLabel(slot.raidName, slot.difficulty),
        clearGold,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
      });
      continue;
    }

    // 보상을 모르는 난이도(-1)에 밀려 아는 값이 가려지지 않게 한다.
    if ((clearGold ?? -1) > (found.clearGold ?? -1)) {
      found.difficulty = slot.difficulty;
      found.label = raidLabel(slot.raidName, slot.difficulty);
      found.clearGold = clearGold;
      found.dayOfWeek = slot.dayOfWeek;
      found.startTime = slot.startTime;
    }
  }

  return [...best.values()]
    .sort((a, b) => {
      // 큰 것부터. 빈 자리가 하나뿐일 때 가장 많이 벌 수 있는 쪽을 보여줘야 한다.
      const gold = (b.clearGold ?? -1) - (a.clearGold ?? -1);
      if (gold !== 0) return gold;
      const day = compareWeekDay(a.dayOfWeek, b.dayOfWeek);
      return day !== 0 ? day : a.startTime.localeCompare(b.startTime);
    })
    .slice(0, open)
    // 요일·시각은 여기서 떨군다. 화면이 쓸 수 없는 값이라 실어 보낼 이유가 없다.
    .map(({ raidName, difficulty, label, clearGold }) => ({
      raidName,
      difficulty,
      label,
      clearGold,
    }));
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

  // 편성표의 화면 주차가 아니라 게임 주차다. 이유는 파일 첫머리에 적어 뒀다.
  const weekStart = getWeekStart();

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
        where: { weekStart },
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
   * 못 채운 골드 자리에 세울 후보(`missingRaids`).
   *
   * 요일표 전체를 한 번만 읽고 캐릭터마다 걸러 쓴다. 캐릭터별로 조회하면 원정대
   * 크기만큼 쿼리가 늘어나는데, 슬롯은 길드 하나에 수십 줄이라 통째로 들고 오는 편이
   * 훨씬 싸다.
   *
   * 자리 수는 관계 카운트로 함께 받는다. 배정 행을 다시 읽어 세면 이 화면에서 가장
   * 큰 조회가 하나 더 붙는다.
   */
  const boardSlots = await prisma.raidSlot.findMany({
    where: { instanceId, archivedAt: null },
    select: {
      raidName: true,
      difficulty: true,
      dayOfWeek: true,
      startTime: true,
      partySize: true,
      _count: { select: { assignments: { where: { weekStart } } } },
    },
  });

  const candidates: CandidateSlot[] = boardSlots.map((slot) => ({
    raidName: slot.raidName,
    difficulty: slot.difficulty,
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    partySize: slot.partySize,
    filled: slot._count.assignments,
  }));

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

      const reward = raidReward(slot.raidName, slot.difficulty);
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
        done: claimable
          ? assignment.homeworkDone
          : raidPassed(weekStart, slot.dayOfWeek, slot.startTime),
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
      /*
       * 남은 골드 자리에 후보를 세운다.
       *
       * 이미 간 레이드는 난이도를 빼고 이름으로 센다. 한 캐릭터는 같은 레이드를
       * 난이도가 달라도 한 주에 한 번만 가므로(3.4-1), 벨가르딘 노말을 갔으면
       * 하드도 후보가 아니다.
       */
      missing: missingRaids(
        candidates,
        weekStart,
        character.itemLevel === null ? null : Number(character.itemLevel),
        goldEarner,
        new Set(entries.map((e) => e.raidName.trim())),
        RAID_GOLD_LIMIT - entries.length,
      ),
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

  // 편성표의 화면 주차가 아니라 게임 주차다. 이유는 파일 첫머리에 적어 뒀다.
  const weekStart = getWeekStart();

  const rows = await prisma.assignment.findMany({
    where: { characterId, weekStart },
    select: {
      id: true,
      slotId: true,
      homeworkOrder: true,
      slot: { select: { archivedAt: true } },
    },
  });

  // 요일표에서 내린 슬롯은 숙제가 아니다. 과거 기록으로만 남는다.
  const mine = rows.filter((row) => !row.slot.archivedAt);

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

  // 편성표의 화면 주차가 아니라 게임 주차다. 이유는 파일 첫머리에 적어 뒀다.
  const weekStart = getWeekStart();

  const assignment = await prisma.assignment.findFirst({
    where: {
      characterId,
      slotId,
      weekStart,
      slot: { instanceId, archivedAt: null },
    },
    select: {
      id: true,
      homeworkDone: true,
      slot: { select: { dayOfWeek: true } },
    },
  });
  // 지난 주차이거나 요일표에서 내린 슬롯이면 여기서 걸린다. 과거는 읽기 전용이다.
  if (!assignment) {
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
