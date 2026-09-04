/**
 * 직업 각인 이름표 — **보조 수단**이다.
 *
 * 직업 각인은 2024-12 패치로 별도 시스템이 사라지고 아크패시브 깨달음 트리에 흡수됐다.
 * 깨달음 노드만 봐서는 무엇이 직업 각인인지 알 수 없다(티어·툴팁 구조·아이콘 번호 모두
 * 규칙이 없다).
 *
 * **정답은 아크그리드에 있다.** 코어는 직업 각인 전용으로 나오고, 발동 조건 문구가
 * `"수라의 길 전용아크 패시브 4티어 무아지경 활성화 필요"`처럼 그 이름으로 시작한다.
 * `armory.ts`의 `readCoreClassEngraving`이 이걸 읽는다.
 *
 * 이 표는 **아크그리드를 아직 끼지 않은 캐릭터**를 위한 대비책이다. 표에 없으면
 * 비워둔다. 엉뚱한 노드 이름을 직업 각인인 양 붙이는 것보다 낫다.
 */

/** 직업별 직업 각인 후보. 하나만 맞아도 그것을 쓴다. */
export const CLASS_ENGRAVINGS: Record<string, string[]> = {
  // --- 실제 API 응답으로 확인함 ---
  버서커: ["광전사의 비기", "광기"],
  소울이터: ["만월의 집행자", "그믐의 경계"],
  건슬링어: ["피스메이커", "사냥의 시간"],
  브레이커: ["수라의 길", "일격필살"],
  도화가: ["만개", "회귀"],
  소서리스: ["환류", "점화"],
  스카우터: ["아르데타인의 기술", "진화의 유산"],
};

/**
 * 깨달음 노드 이름에서 직업 각인을 골라낸다.
 *
 * 건슬링어처럼 `피스메이커 - 핸드건`으로 세부 갈래가 붙는 경우가 있어 앞부분만 본다.
 * 화면에는 갈래를 뗀 이름("피스메이커")을 쓴다. 사용자가 부르는 이름이 그쪽이다.
 */
function baseName(nodeName: string): string {
  const index = nodeName.indexOf(" - ");
  return index === -1 ? nodeName.trim() : nodeName.slice(0, index).trim();
}

export function pickClassEngraving(
  className: string | null | undefined,
  nodeNames: string[],
): string | null {
  if (!className) return null;
  const candidates = CLASS_ENGRAVINGS[className];
  if (!candidates) return null;

  for (const raw of nodeNames) {
    const base = baseName(raw);
    if (candidates.includes(base)) return base;
  }
  return null;
}

/** 표에 아직 없는 직업인지. 화면에서 안내할 때 쓴다. */
export function isKnownClass(className: string | null | undefined): boolean {
  return Boolean(className && CLASS_ENGRAVINGS[className]);
}
