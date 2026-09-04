/**
 * 아크그리드 코어 이름 → 단계.
 *
 * 길드에서 `질서 222 · 혼돈 111`처럼 부르는 그 숫자다. 각인마다 해/달/별 코어가
 * 단계별로 세 벌씩 있고, **단계는 코어 이름에 붙어 있다.**
 *
 * ## API로는 알 수 없다
 *
 * 실측으로 확인한 것들. 같은 길을 다시 파지 않는다.
 *
 *   - 젬 포인트: 어떤 캐릭터의 질서(20·18·20)와 혼돈(18·20·20)이 거의 같은데
 *     실제 표기는 222와 111로 갈렸다
 *   - 등급: 여섯 코어가 모두 `고대`인데도 질서와 혼돈이 다르다
 *   - 코어 공급 의지력: 등급만 따라간다(유물 15, 고대 17). 단계와 무관
 *   - 아이콘: 해/달/별 위치만 나타낸다(96~101 고정)
 *   - 코어 옵션 수치: 같은 단계라도 각인마다 달라 기준이 되지 못한다
 *
 * ## 표를 채우는 법
 *
 * loawa의 아크그리드 통계(`/stat/equiparkgrid?class=<직업>`)에 각인별로
 * 단계가 붙은 코어 이름이 나온다. 그 화면을 보고 아래에 옮겨 적으면 된다.
 * 페이지가 브라우저에서 그려져 자동으로 긁어올 수는 없다.
 *
 * **표에 없는 코어는 `?`로 보여준다.** 틀린 숫자를 보여주지 않는다.
 */

// 타입만 가져온다. 런타임 import를 만들면 node로 직접 돌리는 스크립트가 깨진다(CLAUDE.md 8절).
import type { ArkGridData } from "./armory";

/** 코어 이름 → 단계(1~3). 키는 `:` 뒤의 고유 이름이다. */
export const CORE_TIERS: Record<string, number> = {
  // --- 혼돈 (직업 공용) ---
  "현란한 공격": 1,
  "불타는 일격": 1,
  공격: 1,

  // --- 건슬링어 / 사냥의 시간 ---
  "미드나잇 로즈": 1,
  철갑파쇄탄: 1,
  "정밀 타격": 1,
  무법지대: 2,
  "불릿 무빙": 2,
  "풀 매거진": 2,
  유단자: 3,
  건법: 3,
  "힐 스트라이크": 3,

  // --- 건슬링어 / 피스메이커 ---
  "티거 미스트리스": 1,
  제너럴리스트: 1,
  올라운더: 1,
  "연회의 잔향": 2,
  "체인지 암즈": 2,
  "블로우 백": 2,
  "트루 에임": 3,
  "방패 조준": 3,
  핀포인트: 3,
};

/**
 * `"질서의 해 코어 : 연회의 잔향"` → `"연회의 잔향"`
 * 코어 이름은 항상 `<계열>의 <위치> 코어 : <고유 이름>` 형태다.
 */
export function coreShortName(fullName: string): string {
  const index = fullName.indexOf(":");
  return index === -1 ? fullName.trim() : fullName.slice(index + 1).trim();
}

/** 표에 없으면 null. 화면에서 `?`로 보여준다. */
export function coreTier(fullName: string): number | null {
  return CORE_TIERS[coreShortName(fullName)] ?? null;
}

/**
 * 편성 칸에 넣을 짧은 뱃지. `"질서 222 · 혼돈 111"`
 *
 * 단계는 저장된 값이 아니라 **표시할 때 코어 이름으로 찾는다.** 그래야 위 표에 이름을
 * 추가했을 때 캐릭터를 다시 조회하지 않아도 바로 반영된다.
 *
 * 표에 없는 코어는 `?`로 둔다. 여섯 개 모두 모르면 숫자 대신 등급 구성을 보여준다.
 */
export function summarizeArkGrid(data: ArkGridData | null | undefined): string | null {
  if (!data || data.cores.length === 0) return null;

  const groups = new Map<string, (number | null)[]>();
  for (const core of data.cores) {
    // "질서의 해 코어 : 그림자 주먹" → "질서"
    const set = core.name.startsWith("혼돈") ? "혼돈" : "질서";
    const list = groups.get(set) ?? [];
    list.push(coreTier(core.name));
    groups.set(set, list);
  }

  const anyKnown = data.cores.some((core) => coreTier(core.name) !== null);
  if (!anyKnown) return summarizeGrades(data);

  return ["질서", "혼돈"]
    .filter((set) => groups.has(set))
    .map((set) => `${set} ${groups.get(set)!.map((t) => t ?? "?").join("")}`)
    .join(" · ");
}

/** 단계를 하나도 모를 때 대신 보여주는 등급 구성. `"고대6"` */
function summarizeGrades(data: ArkGridData): string {
  const counts = new Map<string, number>();
  for (const core of data.cores) {
    const grade = core.grade ?? "미상";
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }
  const order = ["고대", "유물", "영웅", "희귀", "미상"];
  return [...counts.entries()]
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([grade, count]) => `${grade}${count}`)
    .join("·");
}
