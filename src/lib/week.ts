/**
 * 주차 계산.
 *
 * 로스트아크 주간 리셋은 KST 수요일 오전 6시다. 편성 인원은 이 시각을 기준으로
 * 초기화되므로 앱 전체가 이 함수의 정의를 따른다.
 *
 * KST는 서머타임이 없어 UTC+9 고정이다. 그래서 UTC 시각에 9시간을 더해
 * "KST 벽시계"를 만든 뒤 UTC 계산기로 다루는 방식이 안전하다.
 * 서버 타임존에 의존하지 않는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** 리셋 요일: 수요일 (0=일 … 6=토) */
const RESET_DAY = 3;
/** 리셋 시각: KST 06시 */
const RESET_HOUR = 6;

/**
 * 주어진 시각이 속한 주차의 시작(직전 KST 수요일 06:00)을 UTC Date로 반환한다.
 *
 * 화요일 23:59 KST → 지난 수요일, 수요일 06:01 KST → 오늘.
 */
export function getWeekStart(now: Date = new Date()): Date {
  // UTC 게터로 KST 벽시계를 읽기 위해 오프셋만큼 밀어둔다.
  const kst = new Date(now.getTime() + KST_OFFSET_MS);

  let daysSinceReset = (kst.getUTCDay() - RESET_DAY + 7) % 7;
  // 수요일이지만 아직 06시 전이면 이번 주차가 시작되지 않았다.
  if (daysSinceReset === 0 && kst.getUTCHours() < RESET_HOUR) {
    daysSinceReset = 7;
  }

  const start = new Date(kst.getTime() - daysSinceReset * DAY_MS);
  start.setUTCHours(RESET_HOUR, 0, 0, 0);

  // 다시 실제 UTC로 되돌린다.
  return new Date(start.getTime() - KST_OFFSET_MS);
}

/** 주차를 n칸 이동한다. 음수면 과거로 간다. */
export function addWeeks(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() + n * WEEK_MS);
}

/** 직전 주차의 시작. 인원 승계에서 복사 원본을 찾을 때 쓴다. */
export function previousWeek(weekStart: Date): Date {
  return addWeeks(weekStart, -1);
}

/** 해당 주차가 지금 진행 중인 주차인가. 과거 주차는 읽기 전용으로 다룬다. */
export function isCurrentWeek(weekStart: Date, now: Date = new Date()): boolean {
  return weekStart.getTime() === getWeekStart(now).getTime();
}

/**
 * 주차 라벨. "2026-09-02(수) ~ 09-08(화)" 형태로 KST 기준 날짜를 보여준다.
 */
export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + WEEK_MS - DAY_MS);
  return `${formatKstDate(weekStart, true)} ~ ${formatKstDate(end, false)}`;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 지금 KST 기준 요일(0=일 … 6=토). 편성표를 열면 오늘 탭이 먼저 보이게 한다. */
export function currentKstDay(now: Date = new Date()): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** `?day=` 파라미터를 요일 번호로. 잘못된 값이면 오늘로 떨어뜨린다. */
export function parseDayParam(value: string | undefined | null): number {
  if (value === null || value === undefined || value === "") return currentKstDay();
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : currentKstDay();
}

/** 요일 이름. RaidSlot.dayOfWeek 표시에 쓴다. */
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "?";
}

function formatKstDate(utc: Date, withYear: boolean): string {
  const kst = new Date(utc.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const w = DAY_NAMES[kst.getUTCDay()];
  return withYear ? `${y}-${m}-${d}(${w})` : `${m}-${d}(${w})`;
}

/**
 * URL 쿼리(`?week=2026-09-02`)를 주차 시작으로 되돌린다.
 * 잘못된 값이면 현재 주차로 떨어뜨린다. 링크를 공유하다 깨져도 화면은 뜬다.
 */
export function parseWeekParam(value: string | undefined | null): Date {
  if (!value) return getWeekStart();
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return getWeekStart();
  return getWeekStart(parsed);
}

/** parseWeekParam이 되받을 수 있는 형태로 직렬화한다. */
export function toWeekParam(weekStart: Date): string {
  const kst = new Date(weekStart.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
