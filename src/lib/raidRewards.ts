/**
 * 레이드 보상 표 — 클리어 골드와 더보기 비용.
 *
 * **로아 OpenAPI에는 없다.** 레이드 목록도 난이도도 안 주는 곳이라(CLAUDE.md 3.3-1)
 * 보상은 더더욱 없다. 그래서 손으로 들고 있는다.
 *
 * 값은 **사용자가 쓰는 골드 계산기 화면에서 관문별로 옮겼다.** 관문 값이 있는 것은
 * 그대로 더했고, 화면에 없던 난이도는 gcalc.kr의 표를 썼다. 어느 쪽에서 왔는지는
 * 아래 각 줄에 적어 둔다. **둘이 어긋나면 계산기 쪽이 맞다** — 골드는 패치로 자주
 * 바뀌고 그 화면이 실시간이다.
 *
 * 관문별로 나눠 두지 않고 **레이드 단위 합계만** 둔다. 편성표가 슬롯(레이드) 단위라
 * 관문을 따로 셀 근거가 화면 어디에도 없다.
 *
 * PC방 더보기는 다루지 않는다. 자리에 따라 달라지는 값이라 편성표가 알 수 없다.
 *
 * 더보기 비용은 확인된 모든 레이드에서 **클리어 골드의 정확히 32%**다
 * (벨가르딘 나메 24,000/75,000 · 세르카 나메 17,280/54,000 · 종막 하드 15,360/48,000).
 * 확인하지 못한 난이도는 이 비율로 채웠고 그 자리에 표시해 두었다.
 */

export interface RaidReward {
  /** 레이드를 다 밀었을 때 받는 골드 합계 */
  clearGold: number;
  /** 더보기를 다 켰을 때 나가는 골드 합계. 양수로 둔다 */
  moreCost: number;
  /** 입장 템레벨 */
  minLevel: number;
}

const REWARDS: Record<string, Record<string, RaidReward>> = {
  벨가르딘: {
    // 노말·하드는 관문 값을 못 봤다. 숙제 화면에 찍힌 합계와 32% 규칙으로 채웠다.
    노말: { clearGold: 50000, moreCost: 16000, minLevel: 1750 },
    하드: { clearGold: 62000, moreCost: 19840, minLevel: 1770 },
    // 확인: 1관문 30,000(더보기 9,600) + 2관문 45,000(더보기 14,400)
    나이트메어: { clearGold: 75000, moreCost: 24000, minLevel: 1780 },
  },
  "지평의 성당": {
    "1단계": { clearGold: 30000, moreCost: 9600, minLevel: 1700 },
    "2단계": { clearGold: 40000, moreCost: 12800, minLevel: 1720 },
    // 확인: 1관문 20,000(6,400) + 2관문 30,000(9,600)
    "3단계": { clearGold: 50000, moreCost: 16000, minLevel: 1750 },
  },
  세르카: {
    노말: { clearGold: 35000, moreCost: 11200, minLevel: 1710 },
    하드: { clearGold: 44000, moreCost: 14080, minLevel: 1730 },
    // 확인: 1관문 21,000(6,720) + 2관문 33,000(10,560)
    나이트메어: { clearGold: 54000, moreCost: 17280, minLevel: 1740 },
  },
  "종막:최후의 날": {
    // gcalc의 40,000은 하드가 너프되기 전 값으로 보인다. 확인되면 고친다.
    노말: { clearGold: 40000, moreCost: 12800, minLevel: 1710 },
    // 확인: 1관문 16,000(5,120) + 2관문 32,000(10,240). gcalc의 52,000은 옛 값이다.
    하드: { clearGold: 48000, moreCost: 15360, minLevel: 1730 },
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
