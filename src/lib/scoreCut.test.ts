import { describe, expect, it } from "vitest";

import {
  MAX_SCORE_CUT,
  formatScoreCut,
  formatScoreCutInput,
  isScoreCut,
  parseScoreCut,
  scoreCutCaret,
  scoreCutDigitCount,
  scoreCutNumber,
} from "./scoreCut";

describe("점수컷 입력", () => {
  it("세 자리마다 끊는다", () => {
    expect(formatScoreCutInput("5000")).toBe("5,000");
    expect(formatScoreCutInput("500")).toBe("500");
    expect(formatScoreCutInput("999999")).toBe("999,999");
  });

  it("숫자가 아닌 글자를 버린다", () => {
    // 콤마가 이미 붙어 있는 값을 다시 넣어도 같은 결과다. 매 글자 이 함수를 거친다.
    expect(formatScoreCutInput("5,000")).toBe("5,000");
    expect(formatScoreCutInput("5000 이상")).toBe("5,000");
    expect(formatScoreCutInput("abc")).toBe("");
  });

  it("앞의 0을 버린다", () => {
    // 0으로 시작하는 컷은 없다. 남기면 자릿수 제한이 0에 먹혀 실제 숫자가 잘린다.
    expect(formatScoreCutInput("0005000")).toBe("5,000");
    expect(formatScoreCutInput("000")).toBe("");
  });

  it("자릿수를 넘기면 자른다", () => {
    expect(formatScoreCutInput("12345678")).toBe("123,456");
  });
});

describe("점수컷 캐럿", () => {
  /** 칸에 글자를 치는 흉내. `|`가 캐럿이다. */
  function type(raw: string): string {
    const at = raw.indexOf("|");
    const before = scoreCutDigitCount(raw.slice(0, at));
    const next = formatScoreCutInput(raw.replace("|", ""));
    const caret = scoreCutCaret(next, before);
    return `${next.slice(0, caret)}|${next.slice(caret)}`;
  }

  it("콤마가 붙어도 방금 친 숫자 뒤에 남는다", () => {
    // 글자 수로 되돌리면 콤마 한 칸만큼 밀려 "5,00|0"에 선다.
    expect(type("5000|")).toBe("5,000|");
    expect(type("50000|")).toBe("50,000|");
  });

  it("가운데를 고쳐도 그 자리에 남는다", () => {
    // "5,000"의 5 뒤에 1을 끼운 상태.
    expect(type("51|,000")).toBe("51|,000");
    // 한 자리 더 끼우면 콤마가 한 칸 오른쪽으로 옮겨간다.
    expect(type("512|,000")).toBe("512|,000");
  });

  it("맨 앞은 0이다", () => {
    expect(type("|5000")).toBe("|5,000");
  });
});

describe("점수컷 값", () => {
  it("콤마가 붙은 글자를 읽는다", () => {
    expect(parseScoreCut("5,000")).toBe(5000);
    expect(parseScoreCut("5000")).toBe(5000);
  });

  it("빈 값은 컷 없음이다", () => {
    // 0으로 떨어뜨리면 "컷 없음"과 "0을 친 것"이 같은 값이 된다.
    expect(parseScoreCut("")).toBeNull();
    expect(parseScoreCut(null)).toBeNull();
    expect(parseScoreCut("   ")).toBeNull();
  });

  it("숫자가 아니면 NaN이라 검증에 걸린다", () => {
    expect(isScoreCut(parseScoreCut("abc"))).toBe(false);
  });

  it("범위를 본다", () => {
    expect(isScoreCut(null)).toBe(true);
    expect(isScoreCut(1)).toBe(true);
    expect(isScoreCut(MAX_SCORE_CUT)).toBe(true);
    expect(isScoreCut(0)).toBe(false);
    expect(isScoreCut(-1)).toBe(false);
    expect(isScoreCut(MAX_SCORE_CUT + 1)).toBe(false);
    expect(isScoreCut(5000.5)).toBe(false);
  });

  it("뱃지에 부등호를 붙인다", () => {
    expect(scoreCutNumber(5000)).toBe("5,000");
    expect(formatScoreCut(5000)).toBe("≥ 5,000");
  });
});
