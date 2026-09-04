import { describe, expect, it } from "vitest";

import {
  normalizeArkGrid,
  normalizeArkPassive,
  normalizeEngravings,
  parseArkPassiveNode,
  stripTags,
  summarizeArkGrid,
  summarizeClassEngraving,
  summarizeEngravings,
  toCharacterSpec,
} from "./armory";
import type { ArmoryResponse } from "./lostark";

/**
 * 픽스처는 2026-09-04에 `npm run probe -- 캔캠브레이커`로 받은 실제 응답을 줄인 것이다.
 * 필드명과 형태는 손대지 않았다.
 */
const SAMPLE: ArmoryResponse = {
  ArmoryProfile: {
    CharacterImage: "https://cdn-lostark.game.onstove.com/armory/0/abc.jpg",
    CharacterName: "캔캠브레이커",
    CharacterClassName: "브레이커",
    ServerName: "루페온",
    CharacterLevel: 70,
    ItemAvgLevel: "1,770.83",
    CombatPower: "5,043.42",
    GuildName: "길드명",
  },
  ArmoryEngraving: {
    Engravings: null,
    Effects: null,
    ArkPassiveEffects: [
      {
        AbilityStoneLevel: 1,
        Grade: "유물",
        Level: 4,
        Name: "원한",
        Description:
          "보스 및 레이드 몬스터에게 주는 피해가 <FONT COLOR='#99ff99'>24.00%</FONT> 증가한다.",
      },
      {
        AbilityStoneLevel: null,
        Grade: "유물",
        Level: 4,
        Name: "예리한 둔기",
        Description: "치명타 피해량이 증가한다.",
      },
    ],
  },
  ArkPassive: {
    Title: null,
    IsArkPassive: true,
    Points: [
      { Name: "진화", Value: 140, Description: "6랭크 28레벨" },
      { Name: "깨달음", Value: 101, Description: "6랭크 30레벨" },
      { Name: "도약", Value: 70, Description: "6랭크 27레벨" },
    ],
    Effects: [
      {
        // 깨달음 1티어 = 직업 각인
        Name: "깨달음",
        Description:
          "<FONT color='#83E9FF'>깨달음</FONT> 1티어 <FONT color='#83E9FF'>수라의 길 Lv.1</FONT>",
        Icon: null,
        ToolTip: "{거대한 JSON 문자열}",
      },
      {
        Name: "깨달음",
        Description:
          "<FONT color='#83E9FF'>깨달음</FONT> 2티어 <FONT color='#83E9FF'>치명적인 주먹 Lv.3</FONT>",
        Icon: null,
      },
      {
        Name: "진화",
        Description: "<FONT>진화</FONT> 1티어 <FONT>치명 Lv.30</FONT>",
        Icon: null,
      },
    ],
  },
  ArkGrid: {
    Slots: [
      {
        Index: 0,
        Icon: "https://cdn-lostark.game.onstove.com/i/a.png",
        Name: "질서의 해 코어 : 그림자 주먹",
        Point: 17,
        Grade: "유물",
        Tooltip: "{거대한 JSON 문자열}",
        Gems: [
          { Index: 0, Icon: null, IsActive: true, Grade: "유물", Tooltip: "{큰 문자열}" },
          { Index: 1, Icon: null, IsActive: false, Grade: "영웅" },
        ],
      },
      {
        Index: 3,
        Icon: null,
        Name: "혼돈의 해 코어 : 재빠른 공격",
        Point: 20,
        Grade: "고대",
        Gems: [{ Index: 0, Icon: null, IsActive: true, Grade: "고대" }],
      },
    ],
    Effects: [
      { Name: "공격력", Level: 28, Tooltip: "공격력 <font color='#ffd200'>+1.02%</font>" },
    ],
  },
};

describe("stripTags", () => {
  it("색상 태그를 벗기고 내용만 남긴다", () => {
    expect(stripTags("공격력 <font color='#ffd200'>+1.02%</font>")).toBe("공격력 +1.02%");
  });

  it("빈 값과 null을 견딘다", () => {
    expect(stripTags(null)).toBeNull();
    expect(stripTags("")).toBeNull();
    expect(stripTags("<b></b>")).toBeNull();
  });
});

describe("normalizeEngravings", () => {
  it("ArkPassiveEffects에서 각인을 뽑는다", () => {
    const result = normalizeEngravings(SAMPLE.ArmoryEngraving);
    expect(result?.list).toHaveLength(2);
    expect(result?.list[0]).toEqual({
      name: "원한",
      grade: "유물",
      level: 4,
      stoneLevel: 1,
      description: "보스 및 레이드 몬스터에게 주는 피해가 24.00% 증가한다.",
    });
  });

  it("각인이 없으면 null이다", () => {
    expect(normalizeEngravings(null)).toBeNull();
    expect(
      normalizeEngravings({ Engravings: null, Effects: null, ArkPassiveEffects: [] }),
    ).toBeNull();
  });

  it("요약은 이름과 레벨을 잇는다", () => {
    const data = normalizeEngravings(SAMPLE.ArmoryEngraving);
    expect(summarizeEngravings(data)).toBe("원한 4 · 예리한 둔기 4");
    expect(summarizeEngravings(null)).toBeNull();
  });
});

describe("normalizeArkGrid", () => {
  it("코어와 효과를 정규화하고 툴팁을 버린다", () => {
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.cores).toHaveLength(2);
    expect(result?.cores[0]).toEqual({
      index: 0,
      name: "질서의 해 코어 : 그림자 주먹",
      grade: "유물",
      point: 17,
      gemCount: 2,
      inactiveGemCount: 1,
    });
    // 툴팁이 어디에도 남지 않아야 한다. 87KB가 4KB로 줄어드는 근거다.
    expect(JSON.stringify(result)).not.toContain("거대한 JSON");
    expect(JSON.stringify(result)).not.toContain("큰 문자열");
  });

  it("총 포인트와 등급 구성을 계산한다", () => {
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.totalPoint).toBe(37);
    expect(result?.gradeCounts).toEqual({ 유물: 1, 고대: 1 });
  });

  it("효과의 색상 태그를 벗긴다", () => {
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.effects[0]).toEqual({ name: "공격력", level: 28, text: "공격력 +1.02%" });
  });

  it("요약은 고대를 앞에 놓는다", () => {
    const data = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(summarizeArkGrid(data)).toBe("37p 고대1·유물1");
  });

  it("아크그리드를 안 낀 캐릭터는 null이다", () => {
    expect(normalizeArkGrid(null)).toBeNull();
    expect(normalizeArkGrid({ Slots: [], Effects: [] })).toBeNull();
  });
});

describe("toCharacterSpec", () => {
  it("쉼표가 붙은 수치를 숫자로 바꾼다", () => {
    const spec = toCharacterSpec(SAMPLE);
    expect(spec?.itemLevel).toBe(1770.83);
    expect(spec?.combatPower).toBe(5043.42);
  });

  it("템레벨은 ItemAvgLevel에서 온다 (ItemMaxLevel은 응답에 없다)", () => {
    const spec = toCharacterSpec(SAMPLE);
    expect(spec?.className).toBe("브레이커");
    expect(spec?.serverName).toBe("루페온");
    expect(spec?.imageUrl).toContain("cdn-lostark");
  });

  it("프로필이 없으면 null이다", () => {
    expect(toCharacterSpec(null)).toBeNull();
    expect(
      toCharacterSpec({
        ArmoryProfile: null,
        ArmoryEngraving: null,
        ArkPassive: null,
        ArkGrid: null,
      }),
    ).toBeNull();
  });

  it("전투력이 비어 있어도 나머지는 살린다", () => {
    const spec = toCharacterSpec({
      ...SAMPLE,
      ArmoryProfile: { ...SAMPLE.ArmoryProfile!, CombatPower: null },
    });
    expect(spec?.combatPower).toBeNull();
    expect(spec?.itemLevel).toBe(1770.83);
  });
});

describe("normalizeArkPassive — 직업 각인", () => {
  it("깨달음 1티어를 직업 각인으로 뽑는다", () => {
    const result = normalizeArkPassive(SAMPLE.ArkPassive);
    expect(result?.classEngraving).toEqual({ name: "수라의 길", level: 1 });
  });

  it("칸에 붙일 요약을 만든다", () => {
    const data = normalizeArkPassive(SAMPLE.ArkPassive);
    expect(summarizeClassEngraving(data)).toBe("수라의 길 Lv.1");
    expect(summarizeClassEngraving(null)).toBeNull();
  });

  it("모든 노드를 카테고리·티어·레벨로 쪼갠다", () => {
    const result = normalizeArkPassive(SAMPLE.ArkPassive);
    expect(result?.nodes).toHaveLength(3);
    expect(result?.nodes[1]).toEqual({
      category: "깨달음",
      tier: 2,
      name: "치명적인 주먹",
      level: 3,
    });
  });

  it("진화/깨달음/도약 포인트를 담는다", () => {
    const result = normalizeArkPassive(SAMPLE.ArkPassive);
    expect(result?.points).toEqual({ 진화: 140, 깨달음: 101, 도약: 70 });
  });

  it("이름에 공백이 있어도 레벨을 정확히 자른다", () => {
    const node = parseArkPassiveNode("<b>진화</b> 2티어 <b>한계 돌파 Lv.2</b>");
    expect(node).toEqual({ category: "진화", tier: 2, name: "한계 돌파", level: 2 });
  });

  it("형식이 다르면 그 노드만 버린다", () => {
    expect(parseArkPassiveNode("알 수 없는 형식")).toBeNull();
    expect(parseArkPassiveNode(null)).toBeNull();
  });

  it("깨달음 1티어가 없으면 직업 각인은 null이다", () => {
    const result = normalizeArkPassive({
      Title: null,
      IsArkPassive: true,
      Points: [],
      Effects: [{ Name: "진화", Description: "진화 1티어 치명 Lv.30", Icon: null }],
    });
    expect(result?.classEngraving).toBeNull();
    expect(result?.nodes).toHaveLength(1);
  });

  it("아크패시브가 없으면 null이다", () => {
    expect(normalizeArkPassive(null)).toBeNull();
  });
});

describe("toCharacterSpec — 직업 각인 포함", () => {
  it("직업 각인을 문자열로 담는다", () => {
    expect(toCharacterSpec(SAMPLE)?.classEngraving).toBe("수라의 길 Lv.1");
  });
});
