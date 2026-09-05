import { describe, expect, it } from "vitest";

import {
  WEEK_DAYS,
  addWeeks,
  compareWeekDay,
  currentKstDay,
  dayNameFull,
  formatWeekLabel,
  getWeekStart,
  isCurrentWeek,
  parseDayParam,
  parseWeekParam,
  previousWeek,
  toWeekParam,
} from "./week";

/** KST 벽시계로 시각을 만든다. 테스트를 읽기 쉽게 하려는 도우미다. */
function kst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

// 2026-09-01은 화요일이다. 이 주차의 시작은 KST 09-01 00:00 = UTC 08-31 15:00.
const WEEK_2026_09_01 = new Date("2026-08-31T15:00:00.000Z");
const WEEK_2026_08_25 = new Date("2026-08-24T15:00:00.000Z");

describe("getWeekStart", () => {
  it("화요일 00:00 정각은 새 주차의 시작이다", () => {
    expect(getWeekStart(kst("2026-09-01T00:00:00"))).toEqual(WEEK_2026_09_01);
  });

  it("화요일 00:00 직전은 아직 지난 주차다", () => {
    expect(getWeekStart(kst("2026-08-31T23:59:59"))).toEqual(WEEK_2026_08_25);
  });

  it("월요일 23:59는 지난 화요일에 시작한 주차다", () => {
    expect(getWeekStart(kst("2026-09-07T23:59:59"))).toEqual(WEEK_2026_09_01);
  });

  it("주 중간(금요일)도 같은 주차를 가리킨다", () => {
    expect(getWeekStart(kst("2026-09-04T21:00:00"))).toEqual(WEEK_2026_09_01);
  });

  it("연말 경계를 넘어도 직전 화요일을 찾는다", () => {
    // 2026-12-29가 화요일이므로 2027-01-01은 그 주차에 속한다.
    expect(getWeekStart(kst("2027-01-01T12:00:00"))).toEqual(
      new Date("2026-12-28T15:00:00.000Z"),
    );
  });

  it("서버 타임존과 무관하게 같은 순간이면 같은 주차다", () => {
    const utcNoon = new Date("2026-09-05T12:00:00.000Z");
    expect(getWeekStart(utcNoon)).toEqual(getWeekStart(new Date(utcNoon.getTime())));
  });

  it("이미 주차 시작인 값을 다시 넣어도 그대로다 (멱등)", () => {
    expect(getWeekStart(WEEK_2026_09_01)).toEqual(WEEK_2026_09_01);
  });
});

describe("주차 이동", () => {
  it("previousWeek은 정확히 7일 전이다", () => {
    expect(previousWeek(WEEK_2026_09_01)).toEqual(WEEK_2026_08_25);
  });

  it("addWeeks는 앞뒤로 움직인다", () => {
    expect(addWeeks(WEEK_2026_09_01, 1)).toEqual(new Date("2026-09-07T15:00:00.000Z"));
    expect(addWeeks(WEEK_2026_09_01, -1)).toEqual(WEEK_2026_08_25);
  });

  it("isCurrentWeek은 기준 시각의 주차와 비교한다", () => {
    const now = kst("2026-09-04T21:00:00");
    expect(isCurrentWeek(WEEK_2026_09_01, now)).toBe(true);
    expect(isCurrentWeek(WEEK_2026_08_25, now)).toBe(false);
  });
});

describe("URL 파라미터", () => {
  it("직렬화 후 되읽으면 같은 주차다", () => {
    const param = toWeekParam(WEEK_2026_09_01);
    expect(param).toBe("2026-09-01");
    expect(parseWeekParam(param)).toEqual(WEEK_2026_09_01);
  });

  it("주 중간 날짜를 넣어도 그 주차의 시작으로 정규화된다", () => {
    expect(parseWeekParam("2026-09-05")).toEqual(WEEK_2026_09_01);
  });

  it("깨진 값이나 빈 값은 현재 주차로 떨어진다", () => {
    expect(parseWeekParam("아무말")).toEqual(getWeekStart());
    expect(parseWeekParam(null)).toEqual(getWeekStart());
    expect(parseWeekParam(undefined)).toEqual(getWeekStart());
  });
});

describe("formatWeekLabel", () => {
  it("화요일부터 월요일까지를 KST 날짜로 보여준다", () => {
    expect(formatWeekLabel(WEEK_2026_09_01)).toBe("2026.09.01(화) ~ 09.07(월)");
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
  it("화요일에서 시작해 월요일로 끝난다", () => {
    // 주차가 화요일 00시에 갈리므로 화면의 요일 순서도 같은 경계를 따라야 한다.
    expect([...WEEK_DAYS]).toEqual([2, 3, 4, 5, 6, 0, 1]);
  });

  it("정렬하면 화요일이 앞, 월요일이 뒤로 간다", () => {
    expect([0, 1, 2, 6].sort(compareWeekDay)).toEqual([2, 6, 0, 1]);
  });

  it("전체 이름을 돌려준다", () => {
    expect(dayNameFull(3)).toBe("수요일");
    expect(dayNameFull(0)).toBe("일요일");
    expect(dayNameFull(9)).toBe("?");
  });
});
