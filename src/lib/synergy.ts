/**
 * 클래스 → 시너지 / 역할 매핑.
 *
 * 기존 Google 시트의 `시너지 표` 탭을 그대로 옮겼다. DB에 두지 않는 이유는
 * 게임 패치로 바뀌는 상수일 뿐 사용자가 편집할 값이 아니기 때문이다.
 *
 * 이 파일은 두 가지로 쓰인다.
 *   1. 편성 칸에 붙는 시너지 표시와 카드 하단의 커버리지 요약
 *   2. 캐릭터 등록 시 딜/서폿 역할 자동 판정
 */

export type SynergyKind =
  | "공증"
  | "받피증"
  | "방깍"
  | "치적"
  | "치피증"
  | "백헤드"
  | "서폿";

export type Role = "DPS" | "SUPPORT";

export interface Synergy {
  kind: SynergyKind;
  /** 칸에 그대로 찍는 짧은 문구 */
  label: string;
  /**
   * 파티 요약 칩에 종류와 나란히 붙는 수치.
   *
   * `label`은 서폿처럼 계산식이 되기도 해서 칩에 넣으면 한 줄을 다 먹는다.
   * 칩은 "무엇이 몇 %"만 보이면 되므로 수치만 따로 둔다. 서폿은 딜러마다 값이
   * 달라 하나로 못 적으니 비워두고 종류만 보여준다.
   */
  value: string;
}

export interface ClassInfo {
  role: Role;
  synergies: Synergy[];
}

const 공증: Synergy = { kind: "공증", label: "공증 6%", value: "6%" };
const 받피증: Synergy = { kind: "받피증", label: "받피증 6%", value: "6%" };
const 방깍: Synergy = { kind: "방깍", label: "방깍 12%", value: "12%" };
const 치적: Synergy = { kind: "치적", label: "치적 10%", value: "10%" };
const 치피증: Synergy = { kind: "치피증", label: "치피증 8%", value: "8%" };
const 백헤드: Synergy = { kind: "백헤드", label: "백/헤드 9%", value: "9%" };
const 서폿버프: Synergy = { kind: "서폿", label: "딜러공 + 서폿공15% × 6%", value: "" };

/**
 * 로스트아크 전 클래스 30개.
 *
 * 시트의 `시너지 표`에 있던 29개에 차원술사를 더했다. 목록은 인벤 직업별 아크그리드
 * 글 30개(`arkGridCores.ts` 참조)와 일치한다.
 *
 * 클래스명은 로아 OpenAPI의 `CharacterClassName`과 정확히 일치해야 한다.
 */
export const CLASS_TABLE: Record<string, ClassInfo> = {
  // 공격력 증가
  기공사: { role: "DPS", synergies: [공증] },
  스카우터: { role: "DPS", synergies: [공증] },

  // 받는 피해 증가
  버서커: { role: "DPS", synergies: [받피증] },
  인파이터: { role: "DPS", synergies: [받피증] },
  호크아이: { role: "DPS", synergies: [받피증] },
  소서리스: { role: "DPS", synergies: [받피증] },
  데모닉: { role: "DPS", synergies: [받피증] },
  슬레이어: { role: "DPS", synergies: [받피증] },
  소울이터: { role: "DPS", synergies: [받피증] },
  브레이커: { role: "DPS", synergies: [받피증] },
  가디언나이트: { role: "DPS", synergies: [받피증] },

  // 방어력 감소
  디스트로이어: { role: "DPS", synergies: [방깍] },
  블래스터: { role: "DPS", synergies: [방깍] },
  서머너: { role: "DPS", synergies: [방깍] },
  리퍼: { role: "DPS", synergies: [방깍] },
  환수사: { role: "DPS", synergies: [방깍] },
  차원술사: { role: "DPS", synergies: [방깍] },

  // 백어택 / 헤드어택 피해 증가
  블레이드: { role: "DPS", synergies: [백헤드] },
  // 워로드만 두 종류를 함께 준다.
  워로드: { role: "DPS", synergies: [백헤드, 방깍] },

  // 치명타 적중률
  배틀마스터: { role: "DPS", synergies: [치적] },
  스트라이커: { role: "DPS", synergies: [치적] },
  데빌헌터: { role: "DPS", synergies: [치적] },
  건슬링어: { role: "DPS", synergies: [치적] },
  아르카나: { role: "DPS", synergies: [치적] },
  기상술사: { role: "DPS", synergies: [치적] },

  // 치명타 피해 증가
  창술사: { role: "DPS", synergies: [치피증] },

  // 서포터
  바드: { role: "SUPPORT", synergies: [서폿버프] },
  홀리나이트: { role: "SUPPORT", synergies: [서폿버프] },
  도화가: { role: "SUPPORT", synergies: [서폿버프] },
  // 발키리는 딜로도 쓴다. 기본값만 서폿이고 캐릭터별로 override할 수 있다.
  발키리: { role: "SUPPORT", synergies: [서폿버프] },
};

/** 커버리지 요약에서 확인하는 딜 시너지. 서폿 버프는 별도로 다룬다. */
export const TRACKED_KINDS: SynergyKind[] = [
  "공증",
  "받피증",
  "방깍",
  "치적",
  "치피증",
  "백헤드",
];

/**
 * 딜/서폿을 모두 할 수 있는 직업.
 *
 * 나머지 직업은 클래스만 보면 역할이 정해진다.
 */
export const ROLE_VARIABLE_CLASSES = ["바드", "도화가", "발키리", "홀리나이트"];

/**
 * 직업 각인 → 역할.
 *
 * **각인이 가장 안정적인 신호다.** 진화 세팅은 솔플하려고 잠시 딜로 바꿔두는 일이
 * 흔한데(각인은 폿인 채로), 각인은 그 캐릭터가 무엇으로 레이드를 가는지를 나타낸다.
 *
 * 역할이 갈리는 네 직업을 모두 담았다. 표에 없는 각인이면 진화 노드로 떨어진다.
 */
const ENGRAVING_ROLE: Record<string, Role> = {
  // 도화가
  만개: "SUPPORT",
  회귀: "DPS",
  // 바드
  "절실한 구원": "SUPPORT",
  "진실된 용맹": "DPS",
  // 발키리
  해방자: "SUPPORT",
  "빛의 기사": "DPS",
  // 홀리나이트
  "축복의 오라": "SUPPORT",
  심판자: "DPS",
};

/**
 * 서폿 세팅을 가리키는 아크패시브 진화 노드.
 *
 * 서폿은 진화 2티어 `축복의 여신`, 3티어 `정열의 춤사위`를 찍는다.
 * 딜 세팅은 같은 자리에 `끝없는 마나`, `무한한 마력` 같은 딜 노드를 찍는다.
 *
 * **각인보다 약한 근거다.** 솔플용으로 바꿔둔 캐릭터를 딜로 잘못 읽는다.
 * 각인을 모르는 직업에서만 쓴다.
 */
const SUPPORT_NODES = ["축복의 여신", "정열의 춤사위"];

/**
 * 딜/서폿을 판정한다.
 *
 * 판정 순서:
 *   1. 역할이 갈리지 않는 직업이면 클래스로 끝
 *   2. 직업 각인이 표에 있으면 그것으로 (가장 안정적)
 *   3. 아크패시브 진화 노드로 (솔플 세팅에 속을 수 있다)
 *   4. 아무 정보도 없으면 클래스 기본값
 */
export function resolveRole(
  className: string | null | undefined,
  arkPassiveNodeNames: string[],
  classEngraving?: string | null,
): Role {
  if (!className || !ROLE_VARIABLE_CLASSES.includes(className)) return inferRole(className);

  const byEngraving = classEngraving ? ENGRAVING_ROLE[classEngraving] : undefined;
  if (byEngraving) return byEngraving;

  if (arkPassiveNodeNames.length > 0) {
    return arkPassiveNodeNames.some((n) => SUPPORT_NODES.includes(n)) ? "SUPPORT" : "DPS";
  }
  return inferRole(className);
}

export function getClassInfo(className: string | null | undefined): ClassInfo | null {
  if (!className) return null;
  return CLASS_TABLE[className] ?? null;
}

/**
 * 클래스명으로 역할을 추정한다. 표에 없는 클래스(신규 직업 등)는 딜러로 본다.
 * 잘못 잡히면 캐릭터 화면에서 수동으로 고칠 수 있다.
 */
export function inferRole(className: string | null | undefined): Role {
  return getClassInfo(className)?.role ?? "DPS";
}

/** 트라이포드에서 읽어온 시너지. armory.ts의 SkillSynergy와 같은 모양이다. */
export interface DetectedSynergy {
  kind: string;
  value: string;
}

const KINDS = new Set<string>(TRACKED_KINDS);

/**
 * 시너지 목록.
 *
 * **트라이포드가 클래스 표를 이긴다.** 클래스 표는 "이 직업은 보통 이걸 준다"까지만
 * 알고, 실제로는 그 트라이포드를 찍었을 때만 나온다. 딜 발키리처럼 직업만으로는
 * 답이 안 나오는 경우도 있다.
 *
 * `detected`가 null이면 스킬을 아직 받아본 적이 없다는 뜻이라 클래스 표로 떨어진다.
 * 빈 배열이면 받아봤는데 안 찍은 것이므로 딜 시너지가 없는 게 맞다.
 *
 * 서폿 버프는 트라이포드가 아니라 직업에서 나오므로 언제나 클래스 표를 따른다.
 * 딜 세팅을 한 서폿 직업(딜 발키리 등)은 버프를 주지 않으므로 제외한다.
 */
export function getSynergies(
  className: string | null | undefined,
  role?: Role,
  detected?: DetectedSynergy[] | null,
): Synergy[] {
  const info = getClassInfo(className);
  const table = info?.synergies ?? [];

  const dealer =
    detected === null || detected === undefined
      ? table.filter((s) => s.kind !== "서폿")
      : detected
          .filter((d) => KINDS.has(d.kind))
          .map((d) => ({
            kind: d.kind as SynergyKind,
            label: `${d.kind} ${d.value}`,
            value: d.value,
          }));

  const givesSupportBuff =
    table.some((s) => s.kind === "서폿") &&
    !(role === "DPS" && className && ROLE_VARIABLE_CLASSES.includes(className));

  return givesSupportBuff ? [...dealer, 서폿버프] : dealer;
}

/**
 * 클래스 표가 기대하는데 실제로는 안 찍은 시너지.
 *
 * 막지 않고 경고만 띄운다(CLAUDE.md 3.4). 편성 직전에 "트포 빠졌다"를 알아채는 것이
 * 이 앱이 시트보다 나은 점이다.
 */
export function missingSynergy(
  className: string | null | undefined,
  role: Role | undefined,
  detected: DetectedSynergy[] | null | undefined,
): boolean {
  if (!detected || detected.length > 0) return false;
  if (role === "SUPPORT") return false;
  const table = getClassInfo(className)?.synergies ?? [];
  return table.some((s) => s.kind !== "서폿");
}

/** 한 줄로 찍을 문구. 워로드처럼 둘이면 쉼표로 잇는다. */
export function synergyLabel(
  className: string | null | undefined,
  role?: Role,
  detected?: DetectedSynergy[] | null,
): string {
  const list = getSynergies(className, role, detected);
  return list.length > 0 ? list.map((s) => s.label).join(", ") : "-";
}

export interface PartySynergy {
  kind: SynergyKind;
  label: string;
  value: string;
  /** 이 시너지를 주는 인원 수. 2 이상이면 겹친다 */
  count: number;
}

/**
 * 파티에 실제로 들어온 시너지를 종합한다.
 *
 * **시너지는 4인 파티 단위로 적용된다.** 8인 전체로 묶어 계산하면 실제 게임과 어긋난다.
 * 없는 것을 나열하기보다 있는 것을 보여주는 편이 편성을 확인할 때 읽기 쉽다.
 *
 * 서폿 버프는 종류가 하나뿐이라 따로 세지 않고 같은 목록에 담는다.
 */
export function partySynergies(
  members: {
    className: string | null | undefined;
    role?: Role;
    detected?: DetectedSynergy[] | null;
  }[],
): PartySynergy[] {
  const found = new Map<SynergyKind, PartySynergy>();

  for (const member of members) {
    for (const synergy of getSynergies(member.className, member.role, member.detected)) {
      const existing = found.get(synergy.kind);
      if (existing) existing.count += 1;
      else found.set(synergy.kind, { ...synergy, count: 1 });
    }
  }

  // 표시 순서를 고정한다. 파티마다 순서가 달라지면 비교가 어렵다.
  const order: SynergyKind[] = [...TRACKED_KINDS, "서폿"];
  return [...found.values()].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );
}
