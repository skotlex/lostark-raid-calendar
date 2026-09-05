/**
 * 레이드 보상 표 — 클리어 골드와 더보기 비용.
 *
 * **로아 OpenAPI에는 없다.** 레이드 목록도 난이도도 안 주는 곳이라(CLAUDE.md 3.3-1)
 * 보상은 더더욱 없다. 그래서 손으로 들고 있는다.
 *
 * 출처는 gcalc.kr의 레이드 보상 표(`/content-rewards/raid-rewards`)다. 화면은
 * 자바스크립트로 그리지만 값이 페이지 안 JSON에 실려 오므로 거기서 읽었다.
 * 관문별로도 나와 있지만 **레이드 단위 합계만** 둔다. 편성표가 슬롯(레이드) 단위라
 * 관문을 따로 셀 근거가 화면 어디에도 없다.
 *
 * 벨가르딘은 그 표에 아직 없다. 사용자의 숙제 관리 화면에 찍힌 값을 옮겼고, 더보기는
 * 최근 레이드가 모두 클리어 골드의 32%인 규칙을 그대로 적용했다(세르카·지평의 성당·
 * 종막 모두 정확히 0.32다). 표에 올라오면 실제 값으로 바꾼다.
 *
 * 패치로 골드가 바뀌면 같은 페이지를 다시 보고 고친다.
 */

export interface RaidReward {
  /** 레이드를 다 밀었을 때 받는 골드 합계 */
  clearGold: number;
  /** 더보기(추가 보상)를 다 켰을 때 나가는 골드 합계. 양수로 둔다 */
  moreCost: number;
  /** 입장 템레벨. 표에 그대로 있어 함께 옮겼다 */
  minLevel: number;
}

const REWARDS: Record<string, Record<string, RaidReward>> = {
  벨가르딘: {
    노말: { clearGold: 50000, moreCost: 16000, minLevel: 1720 },
    하드: { clearGold: 62000, moreCost: 19840, minLevel: 1740 },
    나이트메어: { clearGold: 75000, moreCost: 24000, minLevel: 1760 },
  },
  "지평의 성당": {
    "1단계": { clearGold: 30000, moreCost: 9600, minLevel: 1700 },
    "2단계": { clearGold: 40000, moreCost: 12800, minLevel: 1720 },
    "3단계": { clearGold: 50000, moreCost: 16000, minLevel: 1750 },
  },
  세르카: {
    노말: { clearGold: 35000, moreCost: 11200, minLevel: 1710 },
    하드: { clearGold: 44000, moreCost: 14080, minLevel: 1730 },
    나이트메어: { clearGold: 54000, moreCost: 17280, minLevel: 1740 },
  },
  "종막:최후의 날": {
    노말: { clearGold: 40000, moreCost: 12800, minLevel: 1710 },
    하드: { clearGold: 52000, moreCost: 16640, minLevel: 1730 },
  },
};

/**
 * 레이드 이름은 자유 입력이라 표에 없는 것이 정상이다.
 *
 * 없으면 null이고, 화면은 골드 자리를 `-`로 둔다. 모르는 값을 0으로 적으면 합계가
 * 조용히 틀어져 "이번 주에 얼마 벌었나"를 잘못 알려준다.
 */
export function raidReward(
  raidName: string,
  difficulty: string | null | undefined,
): RaidReward | null {
  const byDifficulty = REWARDS[raidName.trim()];
  if (!byDifficulty) return null;

  const key = difficulty?.trim();
  if (!key) return null;
  return byDifficulty[key] ?? null;
}

/** 표에 값이 있는 레이드인지. 요일표에서 이름을 고를 때 참고용으로 쓴다. */
export function hasReward(raidName: string): boolean {
  return Boolean(REWARDS[raidName.trim()]);
}
