import { describe, expect, it } from "vitest";

import {
  bidPrice,
  breakEvenPrice,
  formatGold,
  formatGoldInput,
  goldCaret,
  goldDigitCount,
  parseGold,
} from "./auction";

describe("손익분기점", () => {
  it("수수료를 떼고 나머지 인원 몫을 뺀다", () => {
    expect(breakEvenPrice(108_000, 4)).toBe(76_950);
    expect(breakEvenPrice(108_000, 8)).toBe(89_775);
  });

  it("반올림하지 않고 내린다", () => {
    // 16인은 96,187.5다. 올리면 분기점에 사서 1골드를 잃는다.
    expect(breakEvenPrice(108_000, 16)).toBe(96_187);
  });

  it("적정가는 분기점보다 낮다", () => {
    for (const size of [4, 8, 16] as const) {
      expect(bidPrice(108_000, size)).toBeLessThan(breakEvenPrice(108_000, size));
    }
  });
});

describe("입찰 적정가", () => {
  it("기준으로 삼은 계산기와 골드 단위까지 같다", () => {
    // 공식을 역산한 원본 값이다. 이게 어긋나면 공식이 틀린 것이다.
    expect(bidPrice(108_000, 4)).toBe(70_024);
    expect(bidPrice(108_000, 8)).toBe(81_695);
    expect(bidPrice(108_000, 16)).toBe(87_530);
  });

  it("반올림하지 않고 내린다", () => {
    // 4인은 정확히 70,024.5다. 소수를 곱하면 이 경계가 흔들린다.
    expect(bidPrice(108_000, 4)).not.toBe(70_025);
  });

  it("내린 분기점에 다시 곱하지 않는다", () => {
    // 분기점 7,125.71…을 먼저 내리고 곱하면 6,483이 된다.
    expect(bidPrice(10_001, 4)).toBe(6_484);
  });

  it("인원이 많을수록 높게 부른다", () => {
    expect(bidPrice(50_000, 4)).toBeLessThan(bidPrice(50_000, 8));
    expect(bidPrice(50_000, 8)).toBeLessThan(bidPrice(50_000, 16));
  });

  it("0골드는 0이다", () => {
    expect(bidPrice(0, 8)).toBe(0);
  });

  it("아홉 자리에서도 정수로 떨어진다", () => {
    expect(Number.isInteger(bidPrice(999_999_999, 16))).toBe(true);
  });
});

describe("골드 입력", () => {
  it("세 자리마다 끊는다", () => {
    expect(formatGold(108_000)).toBe("108,000");
    expect(formatGoldInput("108000")).toBe("108,000");
    expect(formatGoldInput("108,000")).toBe("108,000");
  });

  it("숫자가 아닌 글자와 앞의 0을 버린다", () => {
    expect(formatGoldInput("abc")).toBe("");
    expect(formatGoldInput("00500")).toBe("500");
    expect(formatGoldInput("000")).toBe("");
  });

  it("자릿수를 넘기면 자른다", () => {
    expect(formatGoldInput("12345678901")).toBe("123,456,789");
  });

  it("빈 칸은 값이 없다", () => {
    expect(parseGold("")).toBeNull();
    expect(parseGold("108,000")).toBe(108_000);
  });

  it("콤마가 붙어도 캐럿이 방금 친 숫자 뒤에 남는다", () => {
    const next = formatGoldInput("1080");
    expect(next.slice(0, goldCaret(next, goldDigitCount("1080")))).toBe("1,080");
    expect(goldCaret("1,080", 0)).toBe(0);
  });
});
