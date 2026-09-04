/**
 * 편성 자리 정의.
 *
 * 8인 레이드 기준으로 딜러 6 + 서폿 2이고, 그 아래에 대기 자리를 둔다.
 * Assignment.position에 문자열로 저장하므로 여기가 유일한 정답지다.
 */

export type PositionKind = "DPS" | "SUP" | "WAIT";

export const DPS_POSITIONS = ["DPS1", "DPS2", "DPS3", "DPS4", "DPS5", "DPS6"] as const;
export const SUP_POSITIONS = ["SUP1", "SUP2"] as const;

/** 파티 본진 8자리. 대기는 슬롯마다 개수가 달라 따로 만든다. */
export const PARTY_POSITIONS = [...DPS_POSITIONS, ...SUP_POSITIONS];

export function waitPositions(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => `WAIT${i + 1}`);
}

/** 슬롯이 가지는 전체 자리. 대기 개수는 슬롯 설정을 따른다. */
export function allPositions(waitSlots: number): string[] {
  return [...PARTY_POSITIONS, ...waitPositions(waitSlots)];
}

export function positionKind(position: string): PositionKind | null {
  if (position.startsWith("DPS")) return "DPS";
  if (position.startsWith("SUP")) return "SUP";
  if (position.startsWith("WAIT")) return "WAIT";
  return null;
}

/** "DPS1" → "딜러 1". 화면 라벨. */
export function positionLabel(position: string): string {
  const kind = positionKind(position);
  const index = position.replace(/\D/g, "");
  switch (kind) {
    case "DPS":
      return `딜러 ${index}`;
    case "SUP":
      return `서폿 ${index}`;
    case "WAIT":
      return `대기 ${index}`;
    default:
      return position;
  }
}

/** 유효한 자리 이름인지. API 입력 검증에 쓴다. */
export function isValidPosition(position: string, waitSlots: number): boolean {
  return allPositions(waitSlots).includes(position);
}
