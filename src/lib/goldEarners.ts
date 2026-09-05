/**
 * 골드를 어디까지 받는가.
 *
 * 게임 규칙이라 추측하지 않는다. 사용자가 확인해 준 값이다. 한도가 둘이고 서로
 * 다른 것을 센다.
 *
 *   **원정대 하나에서 주간 레이드 골드를 받는 캐릭터는 6명이다.**
 *   그 밖의 캐릭터는 골드를 못 받는 대신 더보기가 무료다.
 *
 *   **그 6명도 한 캐릭터당 주 3개 레이드까지만 골드를 받는다.**
 *   네 번째부터는 0이다. 더보기 비용은 그대로 나간다.
 *
 * 세는 단위가 사람(Member)이 아니라 **원정대(Roster)**다. 계정이 여럿인 사람은 한
 * 사람 아래 원정대가 여럿이고, 원정대마다 따로 6명을 받는다. 사람 단위로 세면
 * 부계정이 통째로 골드를 못 받는 것으로 나온다.
 */

/** 원정대 하나가 주간 골드를 받을 수 있는 캐릭터 수. */
export const GOLD_LIMIT = 6;

/**
 * 캐릭터 하나가 주간 골드를 받을 수 있는 레이드 수.
 *
 * **어느 셋인지는 순서가 정한다.** 게임에서 사람이 고르는 값이라 앱이 대신 정할 수
 * 없다. 기본은 보상이 큰 셋이고(손대지 않아도 최대가 된다), 숙제 화면에서 끌어
 * 옮기면 그 순서를 따른다(homework.ts).
 *
 * 넘긴 레이드는 골드가 0이지만 **더보기 비용은 그대로 센다.** 골드를 못 받는
 * 캐릭터가 더보기까지 공짜인 것과 다르다. 이쪽은 골드를 받는 캐릭터라 값을 치른다.
 */
export const RAID_GOLD_LIMIT = 3;

export interface GoldCandidate {
  id: string;
  itemLevel: number | null;
  /** null이면 자동. 사람이 지정했으면 true/false가 박혀 있다 */
  goldEarner: boolean | null;
}

/**
 * 이 원정대에서 골드를 받는 캐릭터의 id.
 *
 * **손으로 지정한 것이 있으면 그것만 따른다.** 없으면 템레벨 상위 여섯이다.
 * 자동을 기본으로 두는 이유는, 캐릭터를 하나 키울 때마다 사람이 다시 지정하러
 * 들어와야 한다면 대부분 그냥 틀린 채로 둘 것이기 때문이다.
 *
 * 섞어 쓰지 않는다. 일부만 지정된 상태를 허용하면 "지정한 둘 + 자동 넷"이 되는데,
 * 그 넷이 왜 그 넷인지 화면에서 설명할 방법이 없다. 지정하는 순간 원정대 전체에
 * true/false를 박는다(characters/actions.ts).
 *
 * 템레벨이 없는 캐릭터는 맨 뒤로 보낸다. 아직 조회되지 않았다는 뜻이라 상위로
 * 올릴 근거가 없다.
 */
export function goldEarnerIds(characters: readonly GoldCandidate[]): Set<string> {
  const picked = characters.filter((c) => c.goldEarner === true);
  if (picked.length > 0) {
    return new Set(picked.slice(0, GOLD_LIMIT).map((c) => c.id));
  }

  const auto = [...characters]
    .sort((a, b) => (b.itemLevel ?? -1) - (a.itemLevel ?? -1))
    .slice(0, GOLD_LIMIT);
  return new Set(auto.map((c) => c.id));
}

/** 이 원정대를 사람이 지정해 두었는가. 화면에서 "자동"과 구분해 알린다. */
export function isManual(characters: readonly GoldCandidate[]): boolean {
  return characters.some((c) => c.goldEarner !== null);
}

/**
 * 원정대가 없는 캐릭터를 묶는 열쇠.
 *
 * 편성 칸에 남이 대신 쳐 넣어 만들어진 캐릭터는 원정대가 비어 있다. 주인이 한 번
 * 불러오면 붙지만, 그 전까지도 골드 계산은 돌아야 한다. 그래서 원정대 없는 것들을
 * 한 묶음으로 보고 같은 6명 규칙을 적용한다.
 *
 * 이것이 정답은 아니다. 계정이 여럿인 사람의 미지정 캐릭터가 한 묶음에 섞이면 6명이
 * 실제와 어긋난다. 그래서 화면이 "원정대를 불러오면 정확해진다"고 알린다.
 */
export const NO_ROSTER = "";
