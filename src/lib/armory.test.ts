import { describe, expect, it } from "vitest";

import {
  normalizeSkillSynergies,
  normalizeArkGrid,
  normalizeArkPassive,
  normalizeArkPassiveSynergies,
  normalizeEngravings,
  parseArkPassiveNode,
  stripTags,
  summarizeEngravings,
  toCharacterSpec,
} from "./armory";
import { summarizeArkGrid } from "./arkGridCores";
import { pickClassEngraving } from "./classEngravings";
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
        Tooltip: JSON.stringify({
          Element_005: {
            type: "ItemPartBox",
            value: { Element_000: "코어 옵션", Element_001: "[10P] 가 [14P] 나 [17P] 다" },
          },
          Element_006: {
            type: "ItemPartBox",
            value: {
              Element_000: "코어 옵션 발동 조건",
              Element_001: "수라의 길 전용아크 패시브 4티어 무아지경 활성화 필요",
            },
          },
        }),
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
    // 툴팁 원문이 저장 결과에 남으면 안 된다. 87KB가 1KB 미만으로 줄어드는 근거다.
    expect(JSON.stringify(result)).not.toContain("무아지경 활성화 필요");
    expect(JSON.stringify(result)).not.toContain("큰 문자열");
  });

  it("총 포인트를 계산한다", () => {
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.totalPoint).toBe(37);
  });

  it("효과의 색상 태그를 벗긴다", () => {
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.effects[0]).toEqual({ name: "공격력", level: 28, text: "공격력 +1.02%" });
  });

  it("표에 없는 코어뿐이면 등급 구성으로 떨어진다", () => {
    // 패치로 새 코어가 추가되면 이렇게 된다.
    const data = normalizeArkGrid({
      Slots: [
        { Index: 0, Icon: null, Name: "질서의 해 코어 : 새로 나온 코어", Point: 20, Grade: "고대", Gems: [] },
        { Index: 1, Icon: null, Name: "질서의 달 코어 : 또 다른 신규", Point: 18, Grade: "유물", Gems: [] },
      ],
      Effects: [],
    });
    expect(summarizeArkGrid(data)).toBe("고대1·유물1");
  });

  it("코어 이름으로 단계를 찾아 보여준다", () => {
    // 건슬링어 피스메이커 2단계 세트. loawa 통계 화면의 숫자와 같다.
    const data = normalizeArkGrid({
      Slots: [
        { Index: 0, Icon: null, Name: "질서의 해 코어 : 연회의 잔향", Point: 20, Grade: "고대", Gems: [] },
        { Index: 1, Icon: null, Name: "질서의 달 코어 : 체인지 암즈", Point: 18, Grade: "고대", Gems: [] },
        { Index: 2, Icon: null, Name: "질서의 별 코어 : 블로우 백", Point: 20, Grade: "고대", Gems: [] },
        { Index: 3, Icon: null, Name: "혼돈의 해 코어 : 현란한 공격", Point: 18, Grade: "고대", Gems: [] },
        { Index: 4, Icon: null, Name: "혼돈의 달 코어 : 불타는 일격", Point: 20, Grade: "고대", Gems: [] },
        { Index: 5, Icon: null, Name: "혼돈의 별 코어 : 공격", Point: 20, Grade: "고대", Gems: [] },
      ],
      Effects: [],
    });
    expect(summarizeArkGrid(data)).toBe("질서 222 · 혼돈 111");
  });

  it("아는 코어와 모르는 코어가 섞이면 모르는 쪽만 물음표다", () => {
    const data = normalizeArkGrid({
      Slots: [
        { Index: 0, Icon: null, Name: "질서의 해 코어 : 연회의 잔향", Point: 20, Grade: "고대", Gems: [] },
        { Index: 1, Icon: null, Name: "질서의 달 코어 : 아직 모르는 코어", Point: 18, Grade: "고대", Gems: [] },
        { Index: 2, Icon: null, Name: "질서의 별 코어 : 블로우 백", Point: 20, Grade: "고대", Gems: [] },
      ],
      Effects: [],
    });
    expect(summarizeArkGrid(data)).toBe("질서 2?2");
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

describe("normalizeArkPassive", () => {
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

  it("아크패시브가 없으면 null이다", () => {
    expect(normalizeArkPassive(null)).toBeNull();
  });
});

describe("아크그리드에서 직업 각인 읽기", () => {
  it("코어 발동 조건 맨 앞이 직업 각인 이름이다", () => {
    // API가 직업 각인을 알려주는 유일한 지점이다.
    const result = normalizeArkGrid(SAMPLE.ArkGrid);
    expect(result?.classEngraving).toBe("수라의 길");
  });

  it("조건 문구가 없으면 null이다", () => {
    const result = normalizeArkGrid({
      Slots: [{ Index: 0, Icon: null, Name: "질서의 해 코어", Point: 17, Grade: "유물", Gems: [] }],
      Effects: [],
    });
    expect(result?.classEngraving).toBeNull();
  });

  it("아크그리드에서 읽은 값이 이름표보다 우선한다", () => {
    // 브레이커는 이름표에도 있지만, 코어 조건이 있으면 그쪽을 쓴다.
    expect(toCharacterSpec(SAMPLE)?.classEngraving).toBe("수라의 길");
  });
});

describe("pickClassEngraving (아크그리드가 없을 때의 대비책)", () => {
  it("티어와 무관하게 이름으로 찾는다", () => {
    // 버서커는 깨달음 4티어에 있다.
    expect(
      pickClassEngraving("버서커", ["강인한 육체", "신체 활성", "폭주 강화", "광전사의 비기"]),
    ).toBe("광전사의 비기");
  });

  it("세부 갈래가 붙어도 앞부분만 쓴다", () => {
    expect(pickClassEngraving("건슬링어", ["피스메이커 - 핸드건", "평화주의자"])).toBe(
      "피스메이커",
    );
  });

  it("표에 없는 직업이면 null이다 (엉뚱한 이름을 붙이지 않는다)", () => {
    expect(pickClassEngraving("워로드", ["알 수 없는 노드"])).toBeNull();
  });
});

describe("트라이포드 시너지", () => {
  /** 실제 응답에서 그대로 가져온 문구다. 게임 개편으로 바뀌면 여기부터 깨진다. */
  const tripod = (name: string, tooltip: string, selected = true) => ({
    Name: name,
    Tier: 0,
    Slot: 3,
    IsSelected: selected,
    Tooltip: tooltip,
  });

  it("치적 — 지속시간이 수치 앞에 끼어들어도 읽는다", () => {
    const skills = [
      {
        Name: "AT02 유탄",
        Level: 4,
        Tripods: [
          tripod(
            "급소 노출",
            "공격 적중 시 대상이 자신 및 파티원에게 받는 치명타 저항률이 8.0초간 10.0% 감소한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "치적", value: "10%", source: "AT02 유탄 · 급소 노출" },
    ]);
  });

  it("치피증 — 받피증 문구를 품고 있어도 하나로만 잡는다", () => {
    const skills = [
      {
        Name: "전진 찌르기",
        Level: 14,
        Tripods: [
          tripod(
            "약점 공략",
            "공격에 적중된 적은 12.0 초 동안 자신 및 파티원의 치명타 공격에 받는 피해가 8.0% 증가한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "치피증", value: "8%", source: "전진 찌르기 · 약점 공략" },
    ]);
  });

  it("받피증 — 대상과 효과 사이에 '자신'이 껴도 읽는다", () => {
    // 브레이커. 피해 증폭 계열은 전부 이 말투다. "자신"으로 끊으면 통째로 빠진다.
    const skills = [
      {
        Name: "비뢰격",
        Level: 12,
        Tripods: [
          tripod(
            "피해 증폭",
            "공격 적중 시 대상이 자신 및 파티원에게 받는 피해가 8.0초 동안 6.0% 증가한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "받피증", value: "6%", source: "비뢰격 · 피해 증폭" },
    ]);
  });

  it("받피증 — 파티원이 '주는' 피해로 적어도 같은 시너지다", () => {
    // 바드 음표 낙인. 적이 받는 쪽이 아니라 파티가 주는 쪽에서 말한다.
    const skills = [
      {
        Name: "소나티네",
        Level: 10,
        Tripods: [
          tripod(
            "음표 낙인",
            "[성] 속성으로 변경되고, 소나티네에 적중된 적에게 10.0초간 음표 낙인이 생겨 자신 및 파티원이 주는 피해가 10.0% 증가한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "받피증", value: "10%", source: "소나티네 · 음표 낙인" },
    ]);
  });

  it("자기만 더 아프게 때리는 효과는 받피증이 아니다", () => {
    // 호크아이 최후의 표적. `적`만 물면 "적중된"에 걸려 시너지로 잘못 읽힌다.
    const skills = [
      {
        Name: "최후의 습격",
        Level: 10,
        Tripods: [
          tripod(
            "최후의 표적",
            "적중된 대상에게 '최후의 표적'을 부여한다. 최후의 표적 : 호크아이에게 받는 피해가 8.0초 동안 27.0% 증가한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([]);
  });

  it("방깍 — 적에게 거는 디버프라 파티원이 나오지 않는다", () => {
    // 서머너(특이점 돌파). 실제 응답 문구다.
    const skills = [
      {
        Name: "이끼 늪",
        Level: 10,
        Tripods: [
          tripod(
            "부식성 확산",
            "이끼늪이 즉시 생성되며, 이끼늪에 적중된 적의 모든 방어력을 16.0초간 12.0% 감소 시킨다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "방깍", value: "12%", source: "이끼 늪 · 부식성 확산" },
    ]);
  });

  it("방깍 — 적들/모든 방어력 같은 표현 차이를 넘긴다", () => {
    // 블래스터와 환수사. 같은 갑옷 파괴인데 문구가 조금씩 다르다.
    const 블래스터 = [
      {
        Name: "포탄 사격",
        Level: 10,
        Tripods: [
          tripod("갑옷 파괴", "적중된 적의 모든 방어력을 8.0초간 12.0% 감소시킨다."),
        ],
      },
    ];
    const 환수사 = [
      {
        Name: "여우비",
        Level: 10,
        Tripods: [
          tripod(
            "갑옷 파괴",
            "공격에 적중된 적들의 모든 방어력을 12.0초간 12.0% 감소시킨다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(블래스터)[0]?.value).toBe("12%");
    expect(normalizeSkillSynergies(환수사)[0]?.value).toBe("12%");
  });

  it("자기 방어력을 깎는 디메리트는 방깍이 아니다", () => {
    const skills = [
      {
        Name: "아무 스킬",
        Level: 10,
        Tripods: [
          tripod(
            "무모한 돌진",
            "적을 밀쳐내지만 자신의 방어력이 10.0초간 20.0% 감소한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([]);
  });

  it("마나 — 클래스 표에 없어도 찍고 왔으면 센다", () => {
    // 서머너 슈르디. 골라 찍는 트라이포드라 클래스 표로는 알 수 없다.
    const skills = [
      {
        Name: "슈르디 소환",
        Level: 10,
        Tripods: [
          tripod(
            "마나 회복",
            "슈르디 소환 중 자신 및 파티원의 마나 자연회복 속도가 40.0% 증가한다.",
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([
      { kind: "마나", value: "40%", source: "슈르디 소환 · 마나 회복" },
    ]);
  });

  it("안 찍은 트라이포드는 세지 않는다", () => {
    const skills = [
      {
        Name: "민첩한 사격",
        Level: 1,
        Tripods: [
          tripod(
            "급소 노출",
            "공격 적중 시 대상이 자신 및 파티원에게 받는 치명타 저항률이 8.0초간 10.0% 감소한다.",
            false,
          ),
        ],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([]);
  });

  it("자기만 받는 버프는 시너지가 아니다", () => {
    const skills = [
      {
        Name: "아무 스킬",
        Level: 10,
        Tripods: [tripod("자버프", "자신의 공격력이 20.0% 증가한다.")],
      },
    ];
    expect(normalizeSkillSynergies(skills)).toEqual([]);
  });

  it("같은 시너지가 여러 스킬에 걸려도 한 번만 센다", () => {
    const tip =
      "공격 적중 시 대상이 자신 및 파티원에게 받는 치명타 저항률이 8.0초간 10.0% 감소한다.";
    const skills = [
      { Name: "스킬A", Level: 4, Tripods: [tripod("급소 노출", tip)] },
      { Name: "스킬B", Level: 4, Tripods: [tripod("급소 노출", tip)] },
    ];
    expect(normalizeSkillSynergies(skills)).toHaveLength(1);
  });

  it("스킬이 없으면 빈 배열", () => {
    expect(normalizeSkillSynergies(null)).toEqual([]);
    expect(normalizeSkillSynergies(undefined)).toEqual([]);
  });
});

describe("아크패시브 노드 시너지", () => {
  /**
   * 실제 응답에서 줄인 것이다. 노드 툴팁은 코어 툴팁과 형식이 달라
   * 설명이 `MultiTextBox` 하나에 통째로 들어간다.
   */
  const node = (description: string, text: string) => ({
    Name: description.split(" ")[0]!,
    Description: description,
    Icon: null,
    ToolTip: JSON.stringify({
      Element_000: { type: "NameTagBox", value: description },
      Element_001: { type: "CommonSkillTitle", value: { leftText: "아크 패시브 레벨 1" } },
      Element_002: { type: "MultiTextBox", value: text },
    }),
  });

  it("깨달음 노드가 들고 있는 받피증을 읽는다", () => {
    // 도화가 낙인 강화. 서포터의 시너지는 트라이포드가 아니라 여기에 있다.
    const raw = {
      Title: null,
      IsArkPassive: true,
      Points: null,
      Effects: [
        node(
          "깨달음 4티어 낙인 강화 Lv.1",
          "저무는 달, 떠오르는 해, 떠오르는 달 스킬 사용 시 <FONT COLOR='#ffff99'>12m</FONT> 범위 내에 있는 적들에게 '먹물 낙인'을 찍어 <FONT COLOR='#ffff99'>6.0</FONT>초간 적이 받는 피해가 <FONT COLOR='#99ff99'>10.0%</FONT> 증가한다.||<BR>",
        ),
      ],
    };
    expect(normalizeArkPassiveSynergies(raw)).toEqual([
      { kind: "받피증", value: "10%", source: "깨달음 · 낙인 강화" },
    ]);
  });

  it("파티원이 '주는' 피해로 적은 노드도 같은 시너지다", () => {
    // 발키리 해방자의 흔적(빛의 흔적).
    const raw = {
      Title: null,
      IsArkPassive: true,
      Points: null,
      Effects: [
        node(
          "깨달음 4티어 해방자의 흔적 Lv.1",
          "빛의 해방 스킬 사용 시, 24.0m 범위 내에 있는 적들에게 7.0초간 ‘빛의 흔적’을 남기며,그 적들에게 자신과 파티원이 주는 피해가 10.0% 증가한다.||",
        ),
      ],
    };
    expect(normalizeArkPassiveSynergies(raw)).toEqual([
      { kind: "받피증", value: "10%", source: "깨달음 · 해방자의 흔적" },
    ]);
  });

  it("자기만 세지는 노드는 시너지가 아니다", () => {
    // 홀리나이트 심판자. 딜 각인이라 파티에 주는 것이 없다.
    const raw = {
      Title: null,
      IsArkPassive: true,
      Points: null,
      Effects: [
        node(
          "깨달음 3티어 심판자 Lv.3",
          "적에게 주는 피해가 18.5% 증가하고, 징벌 스킬의 무력화 피해가 8.0% 증가한다.||",
        ),
      ],
    };
    expect(normalizeArkPassiveSynergies(raw)).toEqual([]);
  });

  it("서폿 버프 노드는 시너지 종류로 세지 않는다", () => {
    // 진화 축복의 여신. 서폿 버프는 클래스 표가 따로 들고 있다(synergy.ts).
    const raw = {
      Title: null,
      IsArkPassive: true,
      Points: null,
      Effects: [
        node(
          "진화 2티어 축복의 여신 Lv.3",
          "전투 중 자신 및 주변 파티원에게 '전투 축복 III' 효과를 적용합니다.(20초 지속, 매 초마다 갱신) 전투 축복 III : 공격 및 이동 속도 9.0% 증가||",
        ),
      ],
    };
    expect(normalizeArkPassiveSynergies(raw)).toEqual([]);
  });

  it("설명이 없거나 툴팁이 깨져도 빈 배열", () => {
    expect(normalizeArkPassiveSynergies(null)).toEqual([]);
    expect(
      normalizeArkPassiveSynergies({
        Title: null,
        IsArkPassive: true,
        Points: null,
        Effects: [
          { Name: "깨달음", Description: "깨달음 1티어 신의 기사 Lv.1", Icon: null },
          { Name: "도약", Description: "도약 2티어 기적 Lv.3", Icon: null, ToolTip: "{{깨진 JSON" },
        ],
      }),
    ).toEqual([]);
  });
});
