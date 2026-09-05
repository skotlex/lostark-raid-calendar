/**
 * 레이드 보상 표 — 클리어 골드와 더보기 비용.
 *
 * **로아 OpenAPI에는 없다.** 레이드 목록도 난이도도 안 주는 곳이라(CLAUDE.md 3.3-1)
 * 보상은 더더욱 없다. 그래서 손으로 들고 있는다.
 *
 * 값은 **사용자가 쓰는 골드 계산기 화면에서 관문별로 확인한 것만** 넣는다. 주석의
 * `20,000(6,400)`은 그 화면의 1관문 클리어(더보기)다. 확인하지 못한 난이도는 아예 두지
 * 않는다. 다른 사이트의 표를 옮겨 두면 어느 값이 실제로 확인된 것인지 알 수 없고,
 * 실제로 두 군데가 어긋났다(종막 하드, 세르카 노말).
 *
 * 표에 없으면 화면이 `-`를 찍는다. **모르는 값을 채워 넣지 않는다.** 합계가 조용히
 * 틀어져 "이번 주에 얼마 벌었나"를 잘못 알려주는 편이 빈칸보다 나쁘다.
 *
 * 낮은 난이도는 골드의 절반쯤이 **귀속**으로 들어온다(세르카 노말은 관문마다
 * 6,500 + 6,500처럼 둘로 나뉘어 보인다). 표에는 합계만 둔다. 거래가능만 따로 세야 할
 * 일이 생기면 그때 칸을 나눈다.
 *
 * 관문별로 나눠 두지 않고 **레이드 단위 합계만** 둔다. 편성표가 슬롯(레이드) 단위라
 * 관문을 따로 셀 근거가 화면 어디에도 없다.
 *
 * PC방 더보기는 다루지 않는다. 자리에 따라 달라지는 값이라 편성표가 알 수 없다.
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
    // 20,000(6,400) + 30,000(9,600)
    노말: { clearGold: 50000, moreCost: 16000, minLevel: 1750 },
    // 25,000(8,000) + 37,000(11,840)
    하드: { clearGold: 62000, moreCost: 19840, minLevel: 1770 },
    // 30,000(9,600) + 45,000(14,400)
    나이트메어: { clearGold: 75000, moreCost: 24000, minLevel: 1780 },
  },
  "지평의 성당": {
    // 13,500(4,320) + 16,500(5,280)
    "1단계": { clearGold: 30000, moreCost: 9600, minLevel: 1700 },
    // 16,000(5,120) + 24,000(7,680)
    "2단계": { clearGold: 40000, moreCost: 12800, minLevel: 1720 },
    // 20,000(6,400) + 30,000(9,600)
    "3단계": { clearGold: 50000, moreCost: 16000, minLevel: 1750 },
  },
  세르카: {
    // 13,000(4,160) + 19,000(6,080). 절반이 귀속이라 화면에는 6,500/6,500으로 나뉜다.
    노말: { clearGold: 32000, moreCost: 10240, minLevel: 1710 },
    // 17,500(5,600) + 26,500(8,480)
    하드: { clearGold: 44000, moreCost: 14080, minLevel: 1730 },
    // 21,000(6,720) + 33,000(10,560)
    나이트메어: { clearGold: 54000, moreCost: 17280, minLevel: 1740 },
  },
  "종막:최후의 날": {
    // 노말은 아직 확인하지 못했다. 계산기에서 노말을 눌러 관문 값을 보면 여기에 넣는다.
    // 16,000(5,120) + 32,000(10,240)
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
