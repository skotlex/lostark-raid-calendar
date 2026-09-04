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
}

export interface ClassInfo {
  role: Role;
  synergies: Synergy[];
}

const 공증: Synergy = { kind: "공증", label: "공증 6%" };
const 받피증: Synergy = { kind: "받피증", label: "받피증 6%" };
const 방깍: Synergy = { kind: "방깍", label: "방깍 12%" };
const 치적: Synergy = { kind: "치적", label: "치적 10%" };
const 치피증: Synergy = { kind: "치피증", label: "치피증 8%" };
const 백헤드: Synergy = { kind: "백헤드", label: "백/헤드 9%" };
const 서폿버프: Synergy = { kind: "서폿", label: "딜러공 + 서폿공15% × 6%" };

/**
 * 로스트아크 전 클래스. 시트에 있던 29개를 모두 담았다.
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

export function getSynergies(className: string | null | undefined): Synergy[] {
  return getClassInfo(className)?.synergies ?? [];
}

/** 편성 칸에 한 줄로 찍을 문구. 워로드처럼 둘이면 쉼표로 잇는다. */
export function synergyLabel(className: string | null | undefined): string {
  const list = getSynergies(className);
  return list.length > 0 ? list.map((s) => s.label).join(", ") : "-";
}

export interface CoverageEntry {
  kind: SynergyKind;
  covered: boolean;
}

/**
 * 파티에 배치된 클래스들로 시너지 커버리지를 계산한다.
 * 카드 하단에 "공증 없음" 같은 뱃지를 띄우는 근거다.
 */
export function synergyCoverage(classNames: (string | null | undefined)[]): CoverageEntry[] {
  const present = new Set<SynergyKind>();
  for (const name of classNames) {
    for (const synergy of getSynergies(name)) {
      present.add(synergy.kind);
    }
  }
  return TRACKED_KINDS.map((kind) => ({ kind, covered: present.has(kind) }));
}

/** 커버리지 중 비어 있는 것만. 요약 뱃지는 없는 것만 보여주는 편이 눈에 띈다. */
export function missingSynergies(classNames: (string | null | undefined)[]): SynergyKind[] {
  return synergyCoverage(classNames)
    .filter((entry) => !entry.covered)
    .map((entry) => entry.kind);
}
