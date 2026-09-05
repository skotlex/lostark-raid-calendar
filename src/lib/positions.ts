/**
 * 편성 자리.
 *
 * 8인 레이드는 **4인 파티 둘**로 구성된다. 시너지가 파티 단위로 적용되므로
 * 화면도 데이터도 이 구조를 그대로 따른다.
 *
 *   1파티: 딜1 딜2 딜3 폿1
 *   2파티: 딜4 딜5 딜6 폿2
 *
 * 4인 레이드(세르카, 지평의 성당 …)는 **1파티만** 쓴다. 자리 이름을 따로 두지 않고
 * 8인의 1파티를 그대로 쓰므로, 8인으로 만들었던 슬롯을 4인으로 바꿔도 앞 넷은 남는다.
 */

export type PartySize = 4 | 8;

export const DEFAULT_PARTY_SIZE: PartySize = 8;

export type PositionKind = "DPS" | "SUP";

export const PARTY_1 = ["DPS1", "DPS2", "DPS3", "SUP1"] as const;
export const PARTY_2 = ["DPS4", "DPS5", "DPS6", "SUP2"] as const;

/** 파티 순서대로. 화면 배치와 저장 순서가 같다. */
export const PARTIES: readonly (readonly string[])[] = [PARTY_1, PARTY_2];

export const ALL_POSITIONS: string[] = [...PARTY_1, ...PARTY_2];

export function isPartySize(value: unknown): value is PartySize {
  return value === 4 || value === 8;
}

/** 인원에 맞는 파티 목록. 4인은 1파티만. */
export function partiesFor(size: PartySize): readonly (readonly string[])[] {
  return size === 4 ? [PARTY_1] : PARTIES;
}

/** 인원에 맞는 자리 목록. */
export function positionsFor(size: PartySize): string[] {
  return partiesFor(size).flat();
}

export function positionKind(position: string): PositionKind | null {
  if (position.startsWith("DPS")) return "DPS";
  if (position.startsWith("SUP")) return "SUP";
  return null;
}

/** "DPS1" → "딜러 1", "SUP2" → "서폿 2" */
export function positionLabel(position: string): string {
  const kind = positionKind(position);
  const index = position.replace(/\D/g, "");
  if (kind === "DPS") return `딜러 ${index}`;
  if (kind === "SUP") return `서폿 ${index}`;
  return position;
}

/** 이 자리가 몇 번째 파티인가. 0-based. */
export function partyIndexOf(position: string): number {
  return PARTY_2.includes(position as (typeof PARTY_2)[number]) ? 1 : 0;
}

/**
 * 유효한 자리 이름인지. API 입력 검증에 쓴다.
 *
 * 인원을 넘기면 그 슬롯에 있는 자리인지까지 본다. 4인 슬롯에 2파티 자리가 들어오면
 * 화면에 나오지 않는 유령 배정이 되므로 여기서 걸러야 한다.
 */
export function isValidPosition(position: string, size: PartySize = DEFAULT_PARTY_SIZE): boolean {
  return positionsFor(size).includes(position);
}
