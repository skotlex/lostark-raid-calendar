import { addDays, kstDayStart } from "./week";

/**
 * 편집 이력의 기간 고르기.
 *
 * **날짜 하나를 찍는 대신 몇 개를 늘어놓는다.** 이력을 뒤지는 이유는 대개 "요즘 뭐가
 * 바뀌었나"라서 특정 날짜보다 최근 며칠을 보는 쪽이 잦고, 목록 길이가 기록이 쌓여도
 * 그대로다.
 *
 * 하루의 경계는 주차 경계(수 06시)가 아니라 **KST 자정**이다. 사람이 "어제"라고
 * 말할 때의 그 하루라, 편성 주차와 같은 자를 쓰면 어제를 골랐는데 그저께 밤 기록이
 * 딸려 온다.
 *
 * **`server-only`가 아니다.** 목록을 거르는 곳(history.ts)과 드롭다운을 그리는
 * 곳(PeriodSelect)이 같은 값을 써야 고른 것과 걸러진 것이 갈리지 않는다.
 * scoreCut.ts·homeworkOrder.ts와 같은 이유다.
 */
export const HISTORY_PERIODS = [
  { value: "all", label: "전체" },
  { value: "today", label: "오늘" },
  { value: "yesterday", label: "어제" },
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "최근 30일" },
] as const;

export type HistoryPeriod = (typeof HISTORY_PERIODS)[number]["value"];

/** 주소에 실려 온 값을 기간으로 읽는다. 모르는 값은 전체로 둔다. */
export function toHistoryPeriod(value: string | undefined | null): HistoryPeriod {
  return HISTORY_PERIODS.some((p) => p.value === value)
    ? (value as HistoryPeriod)
    : "all";
}

/** 기간의 [시작, 끝). 끝이 null이면 지금까지다. 전체는 범위가 없다. */
export function periodRange(
  period: HistoryPeriod,
  now: Date = new Date(),
): { from: Date; to: Date | null } | null {
  const today = kstDayStart(now);
  switch (period) {
    case "today":
      return { from: today, to: null };
    case "yesterday":
      return { from: addDays(today, -1), to: today };
    // 오늘을 포함해 세는 날수다. 여섯 칸만 물러나야 일곱 날이 된다.
    case "7d":
      return { from: addDays(today, -6), to: null };
    case "30d":
      return { from: addDays(today, -29), to: null };
    default:
      return null;
  }
}
