import { describe, expect, it } from "vitest";

import {
  TUESDAY,
  UNDECIDED,
  WEEK_DAYS,
  addDays,
  addWeeks,
  compareWeekDay,
  currentKstDay,
  dayName,
  dayNameFull,
  dayOffsetInWeek,
  isEditableWeek,
  isTuesdayCarryWindow,
  isUndecided,
  formatWeekLabel,
  getPlanningWeekStart,
  getWeekStart,
  kstDayStart,
  liveWeekForDay,
  parseDayParam,
  parseWeekParam,
  previousWeek,
  toWeekParam,
} from "./week";

/** KST 벽시계로 시각을 만든다. 테스트를 읽기 쉽게 하려는 도우미다. */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

// 2026-09-02는 수요일이다. 이 주차의 시작은 KST 09-02 06:00 = UTC 09-01 21:00.
const WEEK_2026_09_02 = new Date("2026-09-01T21:00:00.000Z");
const WEEK_2026_08_26 = new Date("2026-08-25T21:00:00.000Z");
const WEEK_2026_09_09 = new Date("2026-09-08T21:00:00.000Z");

describe("getWeekStart", () => {
  it("수요일 06:00 정각은 새 주차의 시작이다", () => {
    expect(getWeekStart(kst("2026-09-02T06:00:00"))).toEqual(WEEK_2026_09_02);
  });

  it("수요일 05:59는 아직 지난 주차다", () => {
    expect(getWeekStart(kst("2026-09-02T05:59:59"))).toEqual(WEEK_2026_08_26);
  });

  it("화요일 23:59는 지난 수요일에 시작한 주차다", () => {
    expect(getWeekStart(kst("2026-09-08T23:59:59"))).toEqual(WEEK_2026_09_02);
  });

  it("주 중간(금요일)도 같은 주차를 가리킨다", () => {
    expect(getWeekStart(kst("2026-09-04T21:00:00"))).toEqual(WEEK_2026_09_02);
  });

  it("연말 경계를 넘어도 직전 수요일을 찾는다", () => {
    // 2026-12-30이 수요일이므로 2027-01-01은 그 주차에 속한다.
    expect(getWeekStart(kst("2027-01-01T12:00:00"))).toEqual(
      new Date("2026-12-29T21:00:00.000Z"),
    );
  });

  it("서버 타임존과 무관하게 같은 순간이면 같은 주차다", () => {
    const utcNoon = new Date("2026-09-05T12:00:00.000Z");
    expect(getWeekStart(utcNoon)).toEqual(getWeekStart(new Date(utcNoon.getTime())));
  });

  it("이미 주차 시작인 값을 다시 넣어도 그대로다 (멱등)", () => {
    expect(getWeekStart(WEEK_2026_09_02)).toEqual(WEEK_2026_09_02);
  });
});

/*
 * 비워지는 시각이 요일에 따라 갈린다.
 *
 * 수~월은 화요일 00시에 다음 주차로 넘어가고(30시간 이르다), 화요일 슬롯은 주차 경계인
 * 수요일 06시까지 그대로 남는다. 화요일 저녁 공대가 몇 시간 전에 지워지지 않게 하려는
 * 것이다.
 *
 * **저장 키가 아니라 편집 권한이 갈린다.** 배정은 화면이 보고 있는 주차에 그대로
 * 들어가고, 창 안에서만 두 주차가 함께 열린다.
 */
describe("30시간 창", () => {
  const MONDAY_NIGHT = kst("2026-09-07T23:00:00");
  const IN_WINDOW = kst("2026-09-08T00:30:00");
  const AFTER_RESET = kst("2026-09-09T06:30:00");

  it("화 00시에 열리고 수 06시에 닫힌다", () => {
    expect(isTuesdayCarryWindow(MONDAY_NIGHT)).toBe(false);
    expect(isTuesdayCarryWindow(kst("2026-09-07T23:59:59"))).toBe(false);
    expect(isTuesdayCarryWindow(IN_WINDOW)).toBe(true);
    expect(isTuesdayCarryWindow(kst("2026-09-09T05:59:59"))).toBe(true);
    expect(isTuesdayCarryWindow(AFTER_RESET)).toBe(false);
  });

  it("창 밖에서는 모든 요일이 같은 주차를 산다", () => {
    expect(liveWeekForDay(3, MONDAY_NIGHT)).toEqual(WEEK_2026_09_02);
    expect(liveWeekForDay(TUESDAY, MONDAY_NIGHT)).toEqual(WEEK_2026_09_02);
    expect(liveWeekForDay(UNDECIDED, MONDAY_NIGHT)).toEqual(WEEK_2026_09_02);
  });

  it("창 안에서는 화요일만 지난 주차에 남는다", () => {
    // 수~월과 미정은 이미 다음 주 편성을 짜고 있다.
    expect(liveWeekForDay(3, IN_WINDOW)).toEqual(WEEK_2026_09_09);
    expect(liveWeekForDay(1, IN_WINDOW)).toEqual(WEEK_2026_09_09);
    expect(liveWeekForDay(UNDECIDED, IN_WINDOW)).toEqual(WEEK_2026_09_09);
    // 화요일 칸은 그날 저녁 공대라 아직 이번 주차다.
    expect(liveWeekForDay(TUESDAY, IN_WINDOW)).toEqual(WEEK_2026_09_02);
  });

  it("수요일 06시를 넘기면 화요일도 넘어간다", () => {
    expect(liveWeekForDay(TUESDAY, AFTER_RESET)).toEqual(WEEK_2026_09_09);
  });
});

describe("isEditableWeek", () => {
  const MONDAY_NIGHT = kst("2026-09-07T23:00:00");
  const IN_WINDOW = kst("2026-09-08T00:30:00");

  it("창 밖에서는 지금 채우는 주차 하나만 열린다", () => {
    expect(isEditableWeek(WEEK_2026_09_02, 3, MONDAY_NIGHT)).toBe(true);
    expect(isEditableWeek(WEEK_2026_09_02, TUESDAY, MONDAY_NIGHT)).toBe(true);
    expect(isEditableWeek(WEEK_2026_08_26, 3, MONDAY_NIGHT)).toBe(false);
    expect(isEditableWeek(WEEK_2026_08_26, TUESDAY, MONDAY_NIGHT)).toBe(false);
  });

  it("창 안에서는 화요일만 두 주차에서 열린다", () => {
    // 다음 주차: 수~월도 화요일도 모두 열린다. 화요일은 엿새 뒤 공대라 비어 있다.
    expect(isEditableWeek(WEEK_2026_09_09, 3, IN_WINDOW)).toBe(true);
    expect(isEditableWeek(WEEK_2026_09_09, TUESDAY, IN_WINDOW)).toBe(true);
    // 지난 주차: 수~월은 굳었고 화요일만 오늘 밤 공대라 아직 열려 있다.
    expect(isEditableWeek(WEEK_2026_09_02, 3, IN_WINDOW)).toBe(false);
    expect(isEditableWeek(WEEK_2026_09_02, UNDECIDED, IN_WINDOW)).toBe(false);
    expect(isEditableWeek(WEEK_2026_09_02, TUESDAY, IN_WINDOW)).toBe(true);
  });

  it("두 주차보다 더 지난 화요일은 열리지 않는다", () => {
    expect(isEditableWeek(WEEK_2026_08_26, TUESDAY, IN_WINDOW)).toBe(false);
  });

  it("아직 열리지 않은 다음 주차는 어느 요일도 열리지 않는다", () => {
    const beyond = addWeeks(WEEK_2026_09_09, 1);
    expect(isEditableWeek(beyond, 3, IN_WINDOW)).toBe(false);
    expect(isEditableWeek(beyond, TUESDAY, IN_WINDOW)).toBe(false);
  });
});

describe("주차 이동", () => {
  it("previousWeek은 정확히 7일 전이다", () => {
    expect(previousWeek(WEEK_2026_09_02)).toEqual(WEEK_2026_08_26);
  });

  it("addWeeks는 앞뒤로 움직인다", () => {
    expect(addWeeks(WEEK_2026_09_02, 1)).toEqual(WEEK_2026_09_09);
    expect(addWeeks(WEEK_2026_09_02, -1)).toEqual(WEEK_2026_08_26);
  });

  it("previousWeek은 화면이 보는 지난 주차를 준다", () => {
    expect(previousWeek(WEEK_2026_09_09)).toEqual(WEEK_2026_09_02);
  });
});

describe("URL 파라미터", () => {
  it("직렬화 후 되읽으면 같은 주차다", () => {
    const param = toWeekParam(WEEK_2026_09_02);
    expect(param).toBe("2026-09-02");
    expect(parseWeekParam(param)).toEqual(WEEK_2026_09_02);
  });

  it("주 중간 날짜를 넣어도 그 주차의 시작으로 정규화된다", () => {
    expect(parseWeekParam("2026-09-05")).toEqual(WEEK_2026_09_02);
  });

  it("깨진 값이나 빈 값은 지금 채우는 주차로 떨어진다", () => {
    expect(parseWeekParam("아무말")).toEqual(getPlanningWeekStart());
    expect(parseWeekParam(null)).toEqual(getPlanningWeekStart());
    expect(parseWeekParam(undefined)).toEqual(getPlanningWeekStart());
  });
});

describe("formatWeekLabel", () => {
  it("수요일부터 화요일까지를 KST 날짜로 보여준다", () => {
    expect(formatWeekLabel(WEEK_2026_09_02)).toBe("2026.09.02(수) ~ 09.08(화)");
  });
});

describe("요일 파라미터", () => {
  it("KST 기준 요일을 돌려준다", () => {
    // 2026-09-04 금요일 21:00 KST
    expect(currentKstDay(kst("2026-09-04T21:00:00"))).toBe(5);
    // UTC로는 아직 목요일인 시각도 KST에서는 금요일이다.
    expect(currentKstDay(new Date("2026-09-04T02:00:00.000Z"))).toBe(5);
  });

  it("잘못된 값은 오늘로 떨어진다", () => {
    expect(parseDayParam("3")).toBe(3);
    expect(parseDayParam("9")).toBe(currentKstDay());
    expect(parseDayParam("아무말")).toBe(currentKstDay());
    expect(parseDayParam(null)).toBe(currentKstDay());
  });
});

describe("요일 순서", () => {
  it("수요일에서 시작해 화요일로 끝나고 미정이 뒤에 붙는다", () => {
    // 주차가 수요일 06시에 갈리므로 화면의 요일 순서도 같은 경계를 따라야 한다.
    // 미정은 한 주의 어디에도 놓이지 않아 요일이 끝난 뒤다.
    expect([...WEEK_DAYS]).toEqual([3, 4, 5, 6, 0, 1, 2, UNDECIDED]);
  });

  it("정렬하면 수요일이 앞, 미정이 맨 뒤로 간다", () => {
    expect([0, 2, 3, 6].sort(compareWeekDay)).toEqual([3, 6, 0, 2]);
    expect([UNDECIDED, 2, 3].sort(compareWeekDay)).toEqual([3, 2, UNDECIDED]);
  });

  it("전체 이름을 돌려준다", () => {
    expect(dayNameFull(3)).toBe("수요일");
    expect(dayNameFull(0)).toBe("일요일");
    expect(dayNameFull(9)).toBe("?");
  });
});

describe("미정 요일", () => {
  it("요일 이름은 짧게도 길게도 미정이다", () => {
    expect(dayName(UNDECIDED)).toBe("미정");
    expect(dayNameFull(UNDECIDED)).toBe("미정");
    expect(isUndecided(UNDECIDED)).toBe(true);
    expect(isUndecided(TUESDAY)).toBe(false);
  });

  it("주차는 수~월과 같이 간다", () => {
    // 화요일 00시부터 수요일 06시 사이. 화요일 슬롯만 지난 주차에 남는 구간이다.
    const now = new Date("2026-09-01T15:30:00.000Z");
    const planning = getPlanningWeekStart(now);

    expect(liveWeekForDay(UNDECIDED, now).getTime()).toBe(planning.getTime());
    expect(liveWeekForDay(TUESDAY, now).getTime()).not.toBe(planning.getTime());
  });

  it("주 안에 놓일 자리가 없어 거리가 -1이다", () => {
    // 이 값이 음수라 숙제가 "지났다"고 판정하지 않는다(homework.ts).
    expect(dayOffsetInWeek(UNDECIDED)).toBe(-1);
    expect(dayOffsetInWeek(3)).toBe(0);
    expect(dayOffsetInWeek(TUESDAY)).toBe(6);
  });

  it("주소의 day로도 돌아올 수 있다", () => {
    expect(parseDayParam(String(UNDECIDED))).toBe(UNDECIDED);
  });
});

describe("KST 하루 경계", () => {
  it("주차 경계가 아니라 자정으로 자른다", () => {
    // KST 2026-09-05 08:30 = UTC 2026-09-04 23:30. 그날 00시(KST)는 UTC 전날 15시다.
    const start = kstDayStart(new Date("2026-09-04T23:30:00.000Z"));
    expect(start.toISOString()).toBe("2026-09-04T15:00:00.000Z");
  });

  it("KST 자정 직전과 직후는 다른 날이다", () => {
    const before = kstDayStart(new Date("2026-09-04T14:59:59.999Z"));
    const after = kstDayStart(new Date("2026-09-04T15:00:00.000Z"));
    expect(before.toISOString()).toBe("2026-09-03T15:00:00.000Z");
    expect(after.toISOString()).toBe("2026-09-04T15:00:00.000Z");
  });

  it("하루씩 물러난다", () => {
    const today = kstDayStart(new Date("2026-09-04T23:30:00.000Z"));
    expect(addDays(today, -1).toISOString()).toBe("2026-09-03T15:00:00.000Z");
    // "최근 7일"은 오늘을 포함해 일곱 날이므로 여섯 칸만 물러난다.
    expect(addDays(today, -6).toISOString()).toBe("2026-08-29T15:00:00.000Z");
  });
});
