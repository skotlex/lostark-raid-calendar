import { describe, expect, it } from "vitest";

import {
  addWeeks,
  formatWeekLabel,
  getWeekStart,
  isCurrentWeek,
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

describe("주차 이동", () => {
  it("previousWeek은 정확히 7일 전이다", () => {
    expect(previousWeek(WEEK_2026_09_02)).toEqual(WEEK_2026_08_26);
  });

  it("addWeeks는 앞뒤로 움직인다", () => {
    expect(addWeeks(WEEK_2026_09_02, 1)).toEqual(new Date("2026-09-08T21:00:00.000Z"));
    expect(addWeeks(WEEK_2026_09_02, -1)).toEqual(WEEK_2026_08_26);
  });

  it("isCurrentWeek은 기준 시각의 주차와 비교한다", () => {
    const now = kst("2026-09-04T21:00:00");
    expect(isCurrentWeek(WEEK_2026_09_02, now)).toBe(true);
    expect(isCurrentWeek(WEEK_2026_08_26, now)).toBe(false);
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

  it("깨진 값이나 빈 값은 현재 주차로 떨어진다", () => {
    expect(parseWeekParam("아무말")).toEqual(getWeekStart());
    expect(parseWeekParam(null)).toEqual(getWeekStart());
    expect(parseWeekParam(undefined)).toEqual(getWeekStart());
  });
});

describe("formatWeekLabel", () => {
  it("수요일부터 화요일까지를 KST 날짜로 보여준다", () => {
    expect(formatWeekLabel(WEEK_2026_09_02)).toBe("2026-09-02(수) ~ 09-08(화)");
  });
});
