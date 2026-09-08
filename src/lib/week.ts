/**
 * 주차 계산.
 *
 * **주차는 게임과 같이 KST 수요일 06시에 갈린다.** 앱 전체가 이 함수의 정의를 따른다.
 *
 * 다만 인원이 비워지는 시각은 요일에 따라 둘로 갈린다.
 *
 * | 슬롯 요일 | 비워지는 때 |
 * |---|---|
 * | 수 · 목 · 금 · 토 · 일 · 월 · 미정 | **화요일 00시** (주차 경계보다 30시간 이르다) |
 * | 화 | 수요일 06시 (주차 경계 그대로) |
 * 
 * 화요일 밤 레이드는 주차가 갈리기 직전에 열린다. 수~월과 함께 화요일 00시에 비우면
 * 그날 저녁 공대가 몇 시간 전에 지워진다. 반대로 수~월을 주차 경계까지 들고 있으면
 * 다음 주 편성을 짤 시간이 없다. 그래서 앞의 여섯 요일만 30시간 먼저 비운다.
 *
 * **갈리는 것은 저장 키가 아니라 편집 권한이다.** 배정은 언제나 화면이 보고 있는
 * 주차에 그대로 저장되고, 한 주차 화면은 수요일부터 화요일까지 한 게임 주차를 통째로
 * 담는다. 화 00시부터 수 06시까지 30시간 동안만 **두 주차가 함께 열린다** — 다음 주차의
 * 수~월과 지난 주차의 화요일이다. `isEditableWeek`가 그 판정이다.
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
 * 요일이 정해지지 않은 슬롯. **요일 번호가 아니라 요일 자리에 놓는 표식이다.**
 *
 * 같이 갈 사람을 모으지 않고 혼자 도는 레이드를 위한 칸이다. 시각을 잡을 이유가 없어
 * 요일도 못 정하는데, 편성표에 넣지 않으면 숙제 화면에도 뜨지 않는다(숙제는 편성표에서
 * 나온다 — homework.ts). 그래서 요일 자리에 미정을 하나 더 둔다.
 *
 * 0~6 다음인 7이라 DB의 `dayOfWeek`(Int)에 그대로 들어가고, 화요일이 아니므로
 * `liveWeekForDay`가 수~월과 같은 주차를 준다. 화요일 00시에 함께 비워진다.
 */
export const UNDECIDED = 7;

/** 요일이 정해지지 않은 슬롯인가. 시각 표시와 지난 판정을 건너뛰는 기준이다. */
export function isUndecided(dayOfWeek: number): boolean {
  return dayOfWeek === UNDECIDED;
}

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
 * 화요일 칸이 두 주차에 걸쳐 열려 있는 **30시간 창** 안인가. 화 00시 ~ 수 06시.
 *
 * 이 동안에는 화면이 이미 다음 주차를 펴고 있는데 그날 저녁 화요일 공대는 아직
 * 지난 주차에 살아 있다. 창 밖에서는 두 값이 같아 이 함수가 거짓이다.
 */
export function isTuesdayCarryWindow(now: Date = new Date()): boolean {
  return getPlanningWeekStart(now).getTime() !== getWeekStart(now).getTime();
}

/**
 * 그 요일의 편성이 **지금 진행 중인 주차**. 화요일만 30시간 늦게 넘어간다(위 표).
 *
 * **저장 키가 아니다.** 배정은 화면이 보고 있는 주차에 그대로 저장된다. 이 값은
 * "지금 살아 있는 편성이 어느 주차에 있는가"를 묻는 자리에서만 쓴다 — 숙제(homework.ts),
 * 고정 현황과 승계 대상(board.ts), 새 슬롯의 승계 표시(slots.ts).
 *
 * 화면 주차를 써야 할 자리에 이 값을 쓰면 창 안에서 엉뚱한 주차를 건드리고, 반대로
 * 이 값을 써야 할 자리에 화면 주차를 쓰면 오늘 밤 화요일이 통째로 빠진다.
 */
export function liveWeekForDay(dayOfWeek: number, now: Date = new Date()): Date {
  return dayOfWeek === TUESDAY ? getWeekStart(now) : getPlanningWeekStart(now);
}

/**
 * 그 주차의 그 요일 칸을 지금 고칠 수 있는가.
 *
 * **주차 하나가 통째로 열리거나 닫히지 않는다.** 화 00시가 지나면 화면은 다음 주차를
 * 펴고(수~월을 미리 짜라고 30시간 먼저 넘긴다), 그 순간 지난 주차의 수~월은 굳는다.
 * 그런데 그날 저녁 화요일 공대는 아직 남아 있어야 하므로 화요일만 두 주차에서 열린다.
 *
 * | 요일 | 열리는 주차 |
 * |---|---|
 * | 수~월·미정 | 지금 채우는 주차 하나 |
 * | 화 | 지금 채우는 주차 + 진행 중인 주차 (창 밖에서는 같은 값이다) |
 *
 * 창 안에 지난 주 화면으로 가면 화요일 탭만 열려 있고, 이번 주 화면의 화요일 탭은
 * 엿새 뒤 공대라 비어 있다. 둘 다 고칠 수 있어야 한다 — 오늘 밤 인원을 마저 채우는
 * 것과 다음 주 화요일을 미리 잡아 두는 것은 서로 다른 일이다.
 */
export function isEditableWeek(
  weekStart: Date,
  dayOfWeek: number,
  now: Date = new Date(),
): boolean {
  const at = weekStart.getTime();
  if (at === getPlanningWeekStart(now).getTime()) return true;
  return dayOfWeek === TUESDAY && at === getWeekStart(now).getTime();
}

/**
 * KST 기준 오늘 00:00을 UTC Date로.
 *
 * **주차 경계(수 06시)와는 다른 자다.** 사람이 "오늘"이나 "어제"라고 말할 때의
 * 그냥 하루이고, 편집 이력의 기간 고르기가 이걸 쓴다. 주차와 섞이지 않게 이름을
 * 달리 두되, KST를 다루는 규칙은 이 파일 하나에 모아 둔다.
 */
export function kstDayStart(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - KST_OFFSET_MS);
}

/** 하루를 n칸 이동한다. 음수면 과거로 간다. KST는 서머타임이 없어 단순 덧셈이다. */
export function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * DAY_MS);
}

/** 주차를 n칸 이동한다. 음수면 과거로 간다. */
export function addWeeks(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() + n * WEEK_MS);
}

/** 직전 주차의 시작. 인원 승계에서 복사 원본을 찾을 때 쓴다. */
export function previousWeek(weekStart: Date): Date {
  return addWeeks(weekStart, -1);
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

/** 미정 칸의 이름. 짧은 표기와 긴 표기가 같다. */
const UNDECIDED_LABEL = "미정";

/**
 * 요일을 늘어놓는 순서. 수요일이 앞이고 미정이 맨 뒤다.
 *
 * 주차가 수요일 06시에 갈리므로 일요일부터 세면 한 주가 화면에서 두 동강 난다.
 * 리셋 직후가 왼쪽 끝, 리셋 직전이 오른쪽 끝이어야 남은 요일이 눈에 보인다.
 *
 * 미정은 한 주의 어디에도 놓이지 않으므로 요일이 다 끝난 뒤에 붙인다.
 */
export const WEEK_DAYS: readonly number[] = [3, 4, 5, 6, 0, 1, 2, UNDECIDED];

/**
 * 주차 시작(수요일)에서 그 요일까지의 날짜 수. 미정이면 -1이다.
 *
 * 요일에 시각을 붙여 실제 레이드 시각을 만들 때 쓴다(homework.ts). 미정은 놓일
 * 자리가 없어 시각을 만들 수 없고, -1을 받은 쪽이 계산을 접는다.
 */
export function dayOffsetInWeek(dayOfWeek: number): number {
  return isUndecided(dayOfWeek) ? -1 : WEEK_DAYS.indexOf(dayOfWeek);
}

/** 지금 KST 기준 요일(0=일 … 6=토). 편성표를 열면 오늘 탭이 먼저 보이게 한다. */
export function currentKstDay(now: Date = new Date()): number {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
}

/** `?day=` 파라미터를 요일 번호로. 잘못된 값이면 오늘로 떨어뜨린다. */
export function parseDayParam(value: string | undefined | null): number {
  if (value === null || value === undefined || value === "") return currentKstDay();
  const n = Number(value);
  // 미정(7)까지 받는다. 편성표에 미정 탭이 서므로 주소로도 돌아올 수 있어야 한다.
  return Number.isInteger(n) && n >= 0 && n <= UNDECIDED ? n : currentKstDay();
}

/**
 * 요일 한 글자. 주차 라벨의 `(수)`처럼 좁은 자리에 쓴다.
 *
 * 미정만 두 글자다. 줄일 만한 한 글자가 없고, 억지로 줄이면 무슨 뜻인지 읽히지 않는다.
 */
export function dayName(dayOfWeek: number): string {
  if (isUndecided(dayOfWeek)) return UNDECIDED_LABEL;
  return DAY_NAMES[dayOfWeek] ?? "?";
}

/** 요일 전체 이름. 요일 탭·제목처럼 읽는 자리에 쓴다. */
export function dayNameFull(dayOfWeek: number): string {
  if (isUndecided(dayOfWeek)) return UNDECIDED_LABEL;
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
