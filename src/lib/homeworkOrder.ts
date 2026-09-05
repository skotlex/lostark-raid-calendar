import { RAID_GOLD_LIMIT } from "./goldEarners";
import { compareWeekDay } from "./week";

/**
 * 숙제 줄의 순서와, 그 순서가 정하는 골드.
 *
 * **앞의 셋만 골드를 받는다**(goldEarners.ts). 그래서 순서는 보기 좋으라고 있는 것이
 * 아니라 "어느 레이드에서 골드를 받을 것인가"를 정하는 값이다.
 *
 * 서버(homework.ts)와 화면(homework/EntryList.tsx)이 **둘 다 이 계산을 한다.** 화면은
 * 끌어 놓는 순간 서버를 기다리지 않고 숫자를 다시 그려야 하고, 서버는 합계와 저장을
 * 맡는다. 둘이 어긋나면 같은 줄에 다른 골드가 찍히므로 규칙을 여기 한곳에 둔다.
 * 그래서 이 파일은 `server-only`가 아니다.
 */

/** 순서를 매길 수 있는 한 줄. 골드를 정하기 전의 상태다. */
export interface OrderableRow {
  dayOfWeek: number;
  startTime: string;
  /** 한도를 따지기 전 이 레이드가 주는 골드. 보상 표에 없으면 null */
  baseGold: number | null;
  /** `Assignment.homeworkOrder`. 사람이 끌어 옮긴 자리. 안 옮겼으면 null */
  order: number | null;
}

/**
 * 숙제 줄의 순서.
 *
 * **사람이 정한 순서가 먼저다.** 앞의 셋만 골드를 받으므로 이 순서가 곧 어느 레이드에서
 * 골드를 받을지이고, 그건 게임에서 사람이 고르는 값이라 앱이 대신 정할 수 없다.
 *
 * 정하지 않았으면 **보상이 큰 순**이다. 손대지 않아도 그 주에 받을 수 있는 최대가 되는
 * 쪽이 기본이어야 한다. 요일 순으로 두면 늦은 요일에 잡힌 큰 레이드가 이유 없이
 * 잘려 나간다.
 *
 * 옮긴 뒤에 새로 들어온 줄은 order가 없어 맨 뒤다. 나중에 온 레이드가 이미 정해 둔
 * 골드 자리를 조용히 뺏지 않게 하려는 것이다.
 *
 * 보상을 모르는 레이드(표에 없음)는 `-1`로 떨어져 값을 아는 것들 뒤에 선다. 그래서
 * 아는 값이 모르는 값에 밀려 0이 되는 일은 없다.
 */
export function compareHomeworkRows(a: OrderableRow, b: OrderableRow): number {
  if (a.order !== b.order) {
    if (a.order === null) return 1;
    if (b.order === null) return -1;
    return a.order - b.order;
  }

  const gold = (b.baseGold ?? -1) - (a.baseGold ?? -1);
  if (gold !== 0) return gold;

  // 보상이 같으면 요일 순이다. 미정은 일정에 자리가 없으므로 맨 뒤다(WEEK_DAYS).
  const day = compareWeekDay(a.dayOfWeek, b.dayOfWeek);
  return day !== 0 ? day : a.startTime.localeCompare(b.startTime);
}

/**
 * 이 자리에서 실제로 들어오는 골드.
 *
 * 한도를 넘긴 자리는 값을 알아도 0이다. 보상 표에 없는 레이드는 `null`이라 화면이
 * `-`를 찍는데, 한도를 넘겼다면 값을 몰라도 0인 것은 확실하다.
 *
 * 골드를 못 받는 캐릭터는 `baseGold`가 이미 0으로 들어온다(homework.ts). 자리를 어떻게
 * 옮겨도 0이라야 맞고, 그 0은 한도가 아니라 다른 이유다.
 */
export function goldAt(baseGold: number | null, index: number): number | null {
  return index >= RAID_GOLD_LIMIT ? 0 : baseGold;
}

/**
 * 한도에 걸려 0이 된 자리인가. 0의 이유를 화면이 말해야 한다.
 *
 * 골드를 아예 못 받는 캐릭터(`baseGold`가 0)는 여기서 빠진다. 그 캐릭터는 첫 줄부터
 * 0이라 한도를 설명해 봐야 답이 아니다. 화면에는 이미 다른 표시가 있다.
 */
export function isGoldCapped(baseGold: number | null, index: number): boolean {
  return index >= RAID_GOLD_LIMIT && baseGold !== 0;
}
