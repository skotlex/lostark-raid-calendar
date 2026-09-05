/**
 * 주차 계산.
 *
 * **주차는 게임과 같이 KST 수요일 06시에 갈린다.** 앱 전체가 이 함수의 정의를 따른다.
 *
 * 다만 인원이 비워지는 시각은 요일에 따라 둘로 갈린다.
 *
 * | 슬롯 요일 | 비워지는 때 |
 * |---|---|
 * | 수 · 목 · 금 · 토 · 일 · 월 | **화요일 00시** (주차 경계보다 30시간 이르다) |
 * | 화 | 수요일 06시 (주차 경계 그대로) |
 * 
 * 화요일 밤 레이드는 주차가 갈리기 직전에 열린다. 수~월과 함께 화요일 00시에 비우면
 * 그날 저녁 공대가 몇 시간 전에 지워진다. 반대로 수~월을 주차 경계까지 들고 있으면
 * 다음 주 편성을 짤 시간이 없다. 그래서 앞의 여섯 요일만 30시간 먼저 비운다.
 *
 * KST는 서머타임이 없어 UTC+9 고정이다. 그래서 UTC 시각에 9시간을 더해
 * "KST 벽시계"를 만든 뒤 UTC 계산기로 다루는 방식이 안전하다.
 * 서버 타임존에 의존하지 않는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** 주차 경계 요일: 수요일 (0=일 … 6=토) */
const RESET_DAY = 3;
/** 주차 경계 시각: KST 06시 */
const RESET_HOUR = 6;

/** 화요일 슬롯. 혼자 다른 시각에 비워진다. */
export const TUESDAY = 2;

/**
 * 수~월 슬롯이 먼저 비워지는 만큼. 수요일 06시에서 30시간을 당기면 화요일 00시다.
 *
 * "현재 시각 + 30시간"의 주차를 구하면 화요일 00시부터 다음 주차를 가리키게 된다.
 * 경계를 하나 더 만들지 않고 같은 계산을 재사용하려는 것이다.
 */
const PLANNING_LEAD_MS = 30 * 60 * 60 * 1000;

/**
 * 주어진 시각이 속한 주차의 시작(직전 KST 수요일 06:00)을 UTC Date로 반환한다.
 *
 * 화요일 23:59 KST → 지난 수요일, 수요일 06:01 KST → 오늘.
 */
export function getWeekStart(now: Date = new Date()): Date {
  // UTC 게터로 KST 벽시계를 읽기 위해 오프셋만큼 밀어둔다.
  const kst = new Date(now.getTime() + KST_OFFSET_MS);

  let daysSinceReset = (kst.getUTCDay() - RESET_DAY + 7) % 7;
  // 리셋 요일이지만 아직 리셋 시각 전이면 이번 주차가 시작되지 않았다.
  if (daysSinceReset === 0 && kst.getUTCHours() < RESET_HOUR) {
    daysSinceReset = 7;
  }

  const start = new Date(kst.getTime() - daysSinceReset * DAY_MS);
  start.setUTCHours(RESET_HOUR, 0, 0, 0);

  // 다시 실제 UTC로 되돌린다.
  return new Date(start.getTime() - KST_OFFSET_MS);
}

/**
 * 지금 편성을 채우는 주차. **수~월 슬롯의 기준이다.**
 *
 * 화요일 00시가 지나면 다음 주차를 가리킨다. 그 순간부터 수~월 칸이 비어 보이고
 * 다음 주 편성을 짤 수 있다. 화요일 슬롯은 이 값을 쓰지 않는다(getWeekStart).
 */
export function getPlanningWeekStart(now: Date = new Date()): Date {
  return getWeekStart(new Date(now.getTime() + PLANNING_LEAD_MS));
}

/**
 * 화면이 보고 있는 주차(수~월 기준)에 대응하는 **화요일 슬롯의 주차**.
 *
 * 둘은 화요일 00시부터 수요일 06시까지 30시간 동안만 어긋난다. 그 사이에는 화요일
 * 저녁 공대가 아직 살아 있어야 하고, 수~월은 이미 다음 주를 짜고 있어야 한다.
 * 지난 주를 볼 때도 같은 간격을 유지해야 하므로 주차 수 차이만큼 함께 민다.
 */
export function tuesdayWeekFor(planningWeek: Date, now: Date = new Date()): Date {
  const shift = Math.round((planningWeek.getTime() - getPlanningWeekStart(now).getTime()) / WEEK_MS);
  return addWeeks(getWeekStart(now), shift);
}

/** 슬롯 요일에 맞는 배정 주차. 화요일만 따로 간다. */
export function weekStartForDay(
  planningWeek: Date,
  dayOfWeek: number,
  now: Date = new Date(),
): Date {
  return dayOfWeek === TUESDAY ? tuesdayWeekFor(planningWeek, now) : planningWeek;
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
 * 주차 라벨. "2026.09.02(수) ~ 09.08(화)" 형태로 KST 기준 날짜를 보여준다.
 *
 * 점으로 끊는다. `?week=`에 실리는 하이픈 형식(toWeekParam)과 눈으로 구분되고,
 * 하이픈이 기간의 "~"와 섞여 보이지 않는다.
 */
export function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + WEEK_MS - DAY_MS);
  return `${formatKstDate(weekStart, true)} ~ ${formatKstDate(end, false)}`;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 요일을 늘어놓는 순서. 수요일이 앞이다.
 *
 * 주차가 수요일 06시에 갈리므로 일요일부터 세면 한 주가 화면에서 두 동강 난다.
 * 리셋 직후가 왼쪽 끝, 리셋 직전이 오른쪽 끝이어야 남은 요일이 눈에 보인다.
 */
export const WEEK_DAYS: readonly number[] = [3, 4, 5, 6, 0, 1, 2];

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

/** 요일 한 글자. 주차 라벨의 `(수)`처럼 좁은 자리에 쓴다. */
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "?";
}

/** 요일 전체 이름. 요일 탭·제목처럼 읽는 자리에 쓴다. */
export function dayNameFull(dayOfWeek: number): string {
  const name = DAY_NAMES[dayOfWeek];
  return name ? `${name}요일` : "?";
}

/** 요일을 수요일 시작 순서로 줄 세운다. Array.sort의 비교 함수로 넘긴다. */
export function compareWeekDay(a: number, b: number): number {
  return WEEK_DAYS.indexOf(a) - WEEK_DAYS.indexOf(b);
}

function formatKstDate(utc: Date, withYear: boolean): string {
  const kst = new Date(utc.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  const w = DAY_NAMES[kst.getUTCDay()];
  return withYear ? `${y}.${m}.${d}(${w})` : `${m}.${d}(${w})`;
}

/**
 * URL 쿼리(`?week=2026-09-02`)를 주차 시작으로 되돌린다.
 * 잘못된 값이면 현재 주차로 떨어뜨린다. 링크를 공유하다 깨져도 화면은 뜬다.
 */
export function parseWeekParam(value: string | undefined | null): Date {
  // 값이 없거나 깨졌으면 지금 채우는 주차로 떨어뜨린다. 화요일 00시부터는 다음 주차다.
  if (!value) return getPlanningWeekStart();
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return getPlanningWeekStart();
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
