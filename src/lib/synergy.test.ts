import { describe, expect, it } from "vitest";

import { getSynergies, missingSynergy, partySynergies, resolveRole } from "./synergy";

/**
 * 역할 판정 근거는 실제 캐릭터에서 확인했다.
 * 서폿 세팅은 진화 2티어 `축복의 여신`, 3티어 `정열의 춤사위`를 찍는다.
 */
const SUPPORT_NODES = [
  "특화",
  "신속",
  "축복의 여신",
  "정열의 춤사위",
  "선각자",
  "기원",
  "마나 용광로",
];
const DPS_NODES = [
  "치명",
  "신속",
  "끝없는 마나",
  "최적화 훈련",
  "무한한 마력",
  "회심",
  "달인",
];

describe("resolveRole", () => {
  it("서폿 각인이면 진화 세팅과 무관하게 서폿이다", () => {
    // 솔플하려고 진화만 딜로 바꿔둔 폿 도화가가 실제로 있다(동네콩).
    // 각인이 폿이면 레이드는 폿으로 간다.
    expect(resolveRole("도화가", DPS_NODES, "만개")).toBe("SUPPORT");
    expect(resolveRole("바드", DPS_NODES, "절실한 구원")).toBe("SUPPORT");
  });

  it("딜 각인이면 딜러다", () => {
    expect(resolveRole("도화가", SUPPORT_NODES, "회귀")).toBe("DPS");
    expect(resolveRole("바드", SUPPORT_NODES, "진실된 용맹")).toBe("DPS");
  });

  it("발키리·홀리나이트도 각인으로 판정한다", () => {
    expect(resolveRole("발키리", DPS_NODES, "해방자")).toBe("SUPPORT");
    expect(resolveRole("발키리", SUPPORT_NODES, "빛의 기사")).toBe("DPS");
    expect(resolveRole("홀리나이트", DPS_NODES, "축복의 오라")).toBe("SUPPORT");
    expect(resolveRole("홀리나이트", SUPPORT_NODES, "심판자")).toBe("DPS");
  });

  it("표에 없는 각인이면 진화 노드로 떨어진다", () => {
    expect(resolveRole("발키리", SUPPORT_NODES, "알 수 없는 각인")).toBe("SUPPORT");
    expect(resolveRole("발키리", DPS_NODES, "알 수 없는 각인")).toBe("DPS");
  });

  it("각인이 없으면 진화 노드로 떨어진다", () => {
    expect(resolveRole("도화가", SUPPORT_NODES)).toBe("SUPPORT");
    expect(resolveRole("도화가", DPS_NODES)).toBe("DPS");
  });

  it("역할이 갈리지 않는 직업은 노드·각인과 무관하게 클래스로 정한다", () => {
    expect(resolveRole("버서커", SUPPORT_NODES, "만개")).toBe("DPS");
    expect(resolveRole("소서리스", DPS_NODES)).toBe("DPS");
  });

  it("아무 정보도 없으면 클래스 기본값으로 떨어진다", () => {
    expect(resolveRole("바드", [])).toBe("SUPPORT");
    expect(resolveRole("버서커", [])).toBe("DPS");
    expect(resolveRole(null, [])).toBe("DPS");
  });
});

describe("역할에 따른 시너지", () => {
  it("딜 세팅 서폿 직업은 서폿 버프를 주지 않는다", () => {
    expect(getSynergies("바드", "DPS")).toHaveLength(0);
    expect(getSynergies("바드", "SUPPORT")).toHaveLength(1);
  });

  it("역할을 넘기지 않으면 클래스 기본값을 쓴다", () => {
    expect(getSynergies("바드")).toHaveLength(1);
  });
});

describe("partySynergies", () => {
  it("파티에 들어온 시너지를 종합하고 겹치면 센다", () => {
    const result = partySynergies([
      { className: "데빌헌터", role: "DPS" }, // 치적
      { className: "건슬링어", role: "DPS" }, // 치적
      { className: "버서커", role: "DPS" }, // 받피증
      { className: "바드", role: "SUPPORT" }, // 서폿
    ]);
    expect(result.map((s) => [s.kind, s.count])).toEqual([
      ["받피증", 1],
      ["치적", 2],
      ["서폿", 1],
    ]);
  });

  it("딜 바드가 낀 파티는 서폿 시너지가 없다", () => {
    const result = partySynergies([{ className: "바드", role: "DPS" }]);
    expect(result).toHaveLength(0);
  });

  it("워로드는 두 시너지를 함께 준다", () => {
    const result = partySynergies([{ className: "워로드", role: "DPS" }]);
    expect(result.map((s) => s.kind)).toEqual(["방깍", "백헤드"]);
  });
});

describe("트라이포드 시너지", () => {
  it("찍은 트라이포드가 클래스 표를 이긴다", () => {
    // 딜 발키리는 클래스 표에 딜 시너지가 없다. 트라이포드에서만 나온다.
    expect(getSynergies("발키리", "DPS", [{ kind: "치피증", value: "8%" }])).toEqual([
      { kind: "치피증", label: "치피증 8%", value: "8%" },
    ]);
  });

  it("스킬을 받아본 적 없으면(null) 클래스 표로 떨어진다", () => {
    // 옛 데이터가 갑자기 시너지 없음으로 보이면 안 된다.
    expect(getSynergies("건슬링어", "DPS", null).map((s) => s.kind)).toEqual(["치적"]);
    expect(getSynergies("건슬링어", "DPS").map((s) => s.kind)).toEqual(["치적"]);
  });

  it("받아봤는데 비었으면(빈 배열) 시너지가 없는 게 맞다", () => {
    expect(getSynergies("건슬링어", "DPS", [])).toEqual([]);
  });

  it("서폿 버프는 트라이포드가 아니라 직업에서 나온다", () => {
    expect(getSynergies("바드", "SUPPORT", []).map((s) => s.kind)).toEqual(["서폿"]);
    // 딜 세팅을 한 서폿 직업은 버프를 주지 않는다.
    expect(getSynergies("발키리", "DPS", []).map((s) => s.kind)).toEqual([]);
  });

  it("표에 없는 종류는 무시한다", () => {
    expect(getSynergies("건슬링어", "DPS", [{ kind: "이상한것", value: "1%" }])).toEqual([]);
  });
});

describe("시너지 트라이포드 누락 경고", () => {
  it("받아봤는데 비어 있는 딜러만 경고한다", () => {
    expect(missingSynergy("건슬링어", "DPS", [])).toBe(true);
  });

  it("받아본 적이 없으면 경고하지 않는다", () => {
    expect(missingSynergy("건슬링어", "DPS", null)).toBe(false);
    expect(missingSynergy("건슬링어", "DPS", undefined)).toBe(false);
  });

  it("찍었으면 경고하지 않는다", () => {
    expect(missingSynergy("건슬링어", "DPS", [{ kind: "치적", value: "10%" }])).toBe(false);
  });

  it("서폿은 딜 시너지가 없어도 경고하지 않는다", () => {
    expect(missingSynergy("바드", "SUPPORT", [])).toBe(false);
  });
});
