/**
 * 편성 자리.
 *
 * 8인 레이드는 **4인 파티 둘**로 구성된다. 시너지가 파티 단위로 적용되므로
 * 화면도 데이터도 이 구조를 그대로 따른다.
 *
 *   1파티: 딜1 딜2 딜3 폿1
 *   2파티: 딜4 딜5 딜6 폿2
 */

export type PositionKind = "DPS" | "SUP";

export const PARTY_1 = ["DPS1", "DPS2", "DPS3", "SUP1"] as const;
export const PARTY_2 = ["DPS4", "DPS5", "DPS6", "SUP2"] as const;

/** 파티 순서대로. 화면 배치와 저장 순서가 같다. */
export const PARTIES: readonly (readonly string[])[] = [PARTY_1, PARTY_2];

export const ALL_POSITIONS: string[] = [...PARTY_1, ...PARTY_2];

export function positionKind(position: string): PositionKind | null {
  if (position.startsWith("DPS")) return "DPS";
  if (position.startsWith("SUP")) return "SUP";
  return null;
}

/** "DPS1" → "딜 1", "SUP2" → "폿 2" */
export function positionLabel(position: string): string {
  const kind = positionKind(position);
  const index = position.replace(/\D/g, "");
  if (kind === "DPS") return `딜 ${index}`;
  if (kind === "SUP") return `폿 ${index}`;
  return position;
}

/** 이 자리가 몇 번째 파티인가. 0-based. */
export function partyIndexOf(position: string): number {
  return PARTY_2.includes(position as (typeof PARTY_2)[number]) ? 1 : 0;
}

/** 유효한 자리 이름인지. API 입력 검증에 쓴다. */
export function isValidPosition(position: string): boolean {
  return ALL_POSITIONS.includes(position);
}
