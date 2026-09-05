import { describe, expect, it } from "vitest";

import { RAID_GOLD_LIMIT } from "./goldEarners";
import {
  type OrderableRow,
  compareHomeworkRows,
  goldAt,
  isGoldCapped,
} from "./homeworkOrder";
import { UNDECIDED } from "./week";

/** 이름 붙은 줄. 정렬 결과를 이름으로 읽으면 무엇이 밀렸는지가 바로 보인다. */
interface Named extends OrderableRow {
  name: string;
}

function row(name: string, baseGold: number | null, over: Partial<Named> = {}): Named {
  return { name, baseGold, dayOfWeek: 3, startTime: "20:00", order: null, ...over };
}

function sorted(rows: Named[]): string[] {
  return [...rows].sort(compareHomeworkRows).map((r) => r.name);
}

describe("숙제 순서", () => {
  it("정한 것이 없으면 보상이 큰 순이다", () => {
    // 앞의 셋만 골드를 받으므로, 손대지 않아도 그 주의 최대가 되는 쪽이 기본이어야 한다.
    expect(
      sorted([row("세르카", 54000), row("벨가르딘", 75000), row("지평", 50000)]),
    ).toEqual(["벨가르딘", "세르카", "지평"]);
  });

  it("늦은 요일에 잡힌 큰 레이드가 밀리지 않는다", () => {
    // 요일 순으로 세우면 화요일의 75,000이 넷째가 되어 이유 없이 잘려 나간다.
    expect(
      sorted([
        row("수-작은거", 30000, { dayOfWeek: 3 }),
        row("목-작은거", 32000, { dayOfWeek: 4 }),
        row("금-작은거", 40000, { dayOfWeek: 5 }),
        row("화-큰거", 75000, { dayOfWeek: 2 }),
      ])[0],
    ).toBe("화-큰거");
  });

  it("보상이 같으면 요일 순이고 미정이 맨 뒤다", () => {
    expect(
      sorted([
        row("미정", 50000, { dayOfWeek: UNDECIDED }),
        row("화", 50000, { dayOfWeek: 2 }),
        row("수", 50000, { dayOfWeek: 3 }),
      ]),
    ).toEqual(["수", "화", "미정"]);
  });

  it("보상을 모르는 레이드는 아는 것들 뒤에 선다", () => {
    // 아는 값이 모르는 값에 밀려 0이 되면 안 된다.
    expect(sorted([row("모름", null), row("앎", 1)])).toEqual(["앎", "모름"]);
  });

  it("사람이 정한 순서가 보상보다 먼저다", () => {
    expect(
      sorted([
        row("큰거", 75000, { order: 2 }),
        row("작은거", 30000, { order: 0 }),
        row("중간", 50000, { order: 1 }),
      ]),
    ).toEqual(["작은거", "중간", "큰거"]);
  });

  it("옮긴 뒤에 새로 들어온 줄은 보상이 커도 맨 뒤다", () => {
    // 나중에 온 레이드가 이미 정해 둔 골드 자리를 조용히 뺏지 않게 한다.
    expect(
      sorted([
        row("새로온큰거", 99000, { order: null }),
        row("정해둔것", 30000, { order: 0 }),
      ]),
    ).toEqual(["정해둔것", "새로온큰거"]);
  });
});

describe("주 3개 골드 한도", () => {
  it("앞의 셋만 골드를 받는다", () => {
    expect(RAID_GOLD_LIMIT).toBe(3);
    expect(goldAt(75000, 0)).toBe(75000);
    expect(goldAt(50000, 2)).toBe(50000);
    expect(goldAt(48000, 3)).toBe(0);
    expect(goldAt(48000, 9)).toBe(0);
  });

  it("보상을 모르는 레이드도 한도를 넘기면 0이다", () => {
    // 앞자리면 값을 모르니 `-`(null)지만, 넘겼으면 몰라도 0인 것은 확실하다.
    expect(goldAt(null, 0)).toBeNull();
    expect(goldAt(null, 3)).toBe(0);
  });

  it("골드를 못 받는 캐릭터는 한도와 상관없이 0이다", () => {
    // baseGold가 이미 0으로 들어온다. 자리를 어떻게 옮겨도 0이라야 맞다.
    expect(goldAt(0, 0)).toBe(0);
    expect(goldAt(0, 5)).toBe(0);
  });

  it("0의 이유가 한도일 때만 한도라고 말한다", () => {
    expect(isGoldCapped(48000, 3)).toBe(true);
    expect(isGoldCapped(48000, 2)).toBe(false);
    // 첫 줄부터 0인 캐릭터에게 "3개까지"라고 말해봐야 답이 아니다.
    expect(isGoldCapped(0, 3)).toBe(false);
  });
});
