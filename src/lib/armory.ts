/**
 * 로아 API 응답 → DB에 넣을 형태로 정규화.
 *
 * 구조는 실제 응답(`npm run probe`)으로 확인해 확정했다. 게임 개편으로 바뀔 수 있으므로
 * 정규화 결과를 저장하되 **툴팁은 버린다.** 아크그리드 응답은 툴팁이 87KB를 차지하는데
 * 툴팁을 빼면 1KB 미만으로 줄고, 그 안의 내용은 게임 내 표시용 마크업이라 쓸 일이 없다.
 * 단 코어 단계 계산에 필요한 임계값만 툴팁에서 미리 뽑아 둔다.
 */

// 타입만 가져온다. `import type`은 컴파일 시 사라지므로 node가 이 파일을
// 직접 실행할 때(scripts/*.mts) 확장자 없는 경로를 해석하려 들지 않는다.
import type {
  ArkGrid,
  ArkPassive,
  ArkPassiveEffect,
  ArmoryEngraving,
  ArmoryProfile,
  ArmoryResponse,
} from "./lostark";

/**
 * "1,770.83" 같은 문자열을 숫자로 바꾼다.
 * 쉼표를 지우지 않으면 Number()가 NaN을 뱉으므로 반드시 이 함수를 거친다.
 */
export function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `"피스메이커 - 핸드건"` → `"피스메이커"`
 * 건슬링어처럼 세부 갈래가 붙는 직업이 있다. 사용자가 부르는 이름은 앞부분이다.
 */
export function baseName(nodeName: string): string {
  const index = nodeName.indexOf(" - ");
  return index === -1 ? nodeName.trim() : nodeName.slice(0, index).trim();
}

/** `<FONT COLOR='#99ff99'>24.00%</FONT>` 같은 태그를 벗긴다. */
export function stripTags(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

// --- 전투 각인 (원한, 예리한 둔기 …) -----------------------------------------
// 직업 각인이 아니다. 직업 각인은 아래 아크패시브 섹션에서 뽑는다.

export interface EngravingEntry {
  name: string;
  grade: string | null;
  level: number | null;
  /** 어빌리티 스톤으로 올린 레벨. 스톤 각인이 아니면 null */
  stoneLevel: number | null;
  /** 색상 태그를 벗긴 설명 */
  description: string | null;
}

export interface EngravingData {
  list: EngravingEntry[];
}

export function normalizeEngravings(
  raw: ArmoryEngraving | null | undefined,
): EngravingData | null {
  const effects: ArkPassiveEffect[] | null | undefined = raw?.ArkPassiveEffects;
  if (!effects || effects.length === 0) return null;

  return {
    list: effects.map((e) => ({
      name: e.Name,
      grade: e.Grade ?? null,
      level: e.Level ?? null,
      stoneLevel: e.AbilityStoneLevel ?? null,
      description: stripTags(e.Description),
    })),
  };
}

/** 상세 화면용 한 줄. "원한 4 · 예리한 둔기 4 · …" */
export function summarizeEngravings(data: EngravingData | null | undefined): string | null {
  if (!data || data.list.length === 0) return null;
  return data.list
    .map((e) => (e.level !== null ? `${e.name} ${e.level}` : e.name))
    .join(" · ");
}

// --- 아크패시브 (직업 각인이 여기 있다) --------------------------------------

export interface ArkPassiveNodeEntry {
  /** "진화" | "깨달음" | "도약" */
  category: string;
  tier: number;
  name: string;
  level: number;
}

export interface ArkPassiveData {
  nodes: ArkPassiveNodeEntry[];
  /** 진화/깨달음/도약 누적 포인트 */
  points: Record<string, number>;
}

/**
 * "깨달음 1티어 수라의 길 Lv.1" 형태의 문자열을 쪼갠다.
 * 노드 이름에 공백이 들어갈 수 있어 뒤쪽 `Lv.N`을 기준으로 자른다.
 */
const NODE_PATTERN = /^(\S+)\s+(\d+)티어\s+(.+?)\s+Lv\.(\d+)$/;

export function parseArkPassiveNode(description: string | null): ArkPassiveNodeEntry | null {
  const text = stripTags(description);
  if (!text) return null;
  const m = NODE_PATTERN.exec(text);
  if (!m) return null;
  return { category: m[1], tier: Number(m[2]), name: m[3], level: Number(m[4]) };
}

export function normalizeArkPassive(raw: ArkPassive | null | undefined): ArkPassiveData | null {
  const effects = raw?.Effects;
  if (!effects || effects.length === 0) return null;

  const nodes = effects
    .map((e) => parseArkPassiveNode(e.Description))
    .filter((n): n is ArkPassiveNodeEntry => n !== null);

  const points: Record<string, number> = {};
  for (const p of raw?.Points ?? []) {
    points[p.Name] = p.Value;
  }

  return { nodes, points };
}

/** 깨달음 노드 이름들. 직업 각인은 이 중 하나다. */
export function enlightenmentNames(data: ArkPassiveData | null | undefined): string[] {
  return (data?.nodes ?? [])
    .filter((n) => n.category === "깨달음")
    .map((n) => baseName(n.name));
}

// --- 아크그리드 --------------------------------------------------------------

export interface ArkGridCore {
  index: number;
  name: string;
  grade: string | null;
  point: number;
  /**
   * 코어 단계 0~3.
   *
   * 코어 옵션은 젬 포인트 합계가 임계값을 넘을 때마다 열린다. 실측한 임계값은
   * `[10, 14, 17, 18, 19, 20]`인데 뒤의 셋은 피해량 소폭 증가라 **앞의 세 단계만**
   * 의미가 있다. 길드에서 "333", "222"라고 부르는 그 숫자다.
   *
   * 예전 버전이 저장한 데이터에는 없을 수 있어 optional이다.
   */
  stage?: number;
  gemCount: number;
  /** 비활성 젬이 있으면 세팅이 덜 끝난 것이다 */
  inactiveGemCount: number;
}

export interface ArkGridEffectEntry {
  name: string;
  level: number;
  text: string | null;
}

export interface ArkGridData {
  cores: ArkGridCore[];
  effects: ArkGridEffectEntry[];
  totalPoint: number;
  /**
   * 코어가 요구하는 직업 각인 이름.
   *
   * 아크그리드 코어는 직업 각인 전용이라 발동 조건 문구가
   * `"수라의 길 전용아크 패시브 4티어 무아지경 활성화 필요"`처럼 시작한다.
   * **API가 직업 각인을 알려주는 유일한 지점이다.**
   */
  classEngraving: string | null;
}

/** 임계값을 못 읽었을 때 쓰는 값. 실측 결과와 같다. */
const DEFAULT_THRESHOLDS = [10, 14, 17];

/**
 * 코어 툴팁에서 옵션 임계값을 뽑는다.
 *
 * 툴팁은 `{"Element_005":{"type":"ItemPartBox","value":{"Element_000":"코어 옵션",
 * "Element_001":"[10P] … [14P] … [17P] …"}}}` 형태의 JSON 문자열이다.
 * 게임이 임계값을 바꾸면 여기서 자동으로 따라간다.
 */
/**
 * 코어 툴팁의 `ItemPartBox` 항목들을 `제목 → 내용`으로 펼친다.
 *
 * 툴팁은 `{"Element_005":{"type":"ItemPartBox","value":{"Element_000":"코어 옵션",
 * "Element_001":"[10P] …"}}}` 형태의 JSON 문자열이다.
 */
function readTooltipParts(tooltip: string | undefined): Map<string, string> {
  const parts = new Map<string, string>();
  if (!tooltip) return parts;
  try {
    const parsed = JSON.parse(tooltip) as Record<string, unknown>;
    for (const element of Object.values(parsed)) {
      if (!element || typeof element !== "object") continue;
      const value = (element as { value?: unknown }).value;
      if (!value || typeof value !== "object") continue;

      const head = String((value as Record<string, unknown>).Element_000 ?? "");
      const body = String((value as Record<string, unknown>).Element_001 ?? "");
      if (head) parts.set(head, body);
    }
  } catch {
    // 툴팁 형식이 바뀌면 빈 map으로 떨어진다. 화면이 깨지지는 않는다.
  }
  return parts;
}

function readThresholds(parts: Map<string, string>): number[] {
  for (const [head, body] of parts) {
    // "코어 옵션 발동 조건"이 아니라 "코어 옵션"이어야 한다.
    if (!head.includes("코어 옵션") || head.includes("조건")) continue;
    const found = [...body.matchAll(/\[(\d+)P\]/g)].map((m) => Number(m[1]));
    if (found.length > 0) return found.slice(0, 3);
  }
  return DEFAULT_THRESHOLDS;
}

/**
 * 코어 발동 조건에서 직업 각인 이름을 뽑는다.
 *
 * `"수라의 길 전용아크 패시브 4티어 무아지경 활성화 필요"` → `"수라의 길"`
 *
 * 아크그리드 코어는 직업 각인 전용으로 나오므로 조건 문구 맨 앞이 그 이름이다.
 * 브레이커·버서커·소울이터·건슬링어·도화가·소서리스·스카우터로 확인했다.
 */
export function readCoreClassEngraving(parts: Map<string, string>): string | null {
  for (const [head, body] of parts) {
    if (!head.includes("발동 조건")) continue;
    const text = stripTags(body);
    if (!text) continue;
    const m = /^(.+?)\s*전용/.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

export function normalizeArkGrid(raw: ArkGrid | null | undefined): ArkGridData | null {
  const slots = raw?.Slots;
  if (!slots || slots.length === 0) return null;

  let classEngraving: string | null = null;

  const cores: ArkGridCore[] = slots.map((slot) => {
    const gems = slot.Gems ?? [];
    const point = slot.Point ?? 0;
    const parts = readTooltipParts(slot.Tooltip);
    const thresholds = readThresholds(parts);
    classEngraving ??= readCoreClassEngraving(parts);
    return {
      index: slot.Index,
      name: slot.Name,
      grade: slot.Grade ?? null,
      point,
      stage: thresholds.filter((t) => point >= t).length,
      gemCount: gems.length,
      inactiveGemCount: gems.filter((g) => !g.IsActive).length,
    };
  });

  return {
    cores,
    effects: (raw?.Effects ?? []).map((e) => ({
      name: e.Name,
      level: e.Level,
      text: stripTags(e.Tooltip),
    })),
    totalPoint: cores.reduce((sum, c) => sum + c.point, 0),
    classEngraving,
  };
}

/**
 * 편성 칸에 넣을 짧은 뱃지. `"질서 333 · 혼돈 332"`
 *
 * 포인트 합계가 아니라 **코어 단계**를 보여준다. 편성을 볼 때 실제로 궁금한 건
 * 코어가 몇 단계까지 열렸는지다.
 */
export function summarizeArkGrid(data: ArkGridData | null | undefined): string | null {
  if (!data || data.cores.length === 0) return null;

  const groups = new Map<string, number[]>();
  for (const core of data.cores) {
    // stage가 없는 예전 데이터도 포인트로 되살린다. 갱신 전까지 빈칸으로 보이지 않게.
    const stage = core.stage ?? DEFAULT_THRESHOLDS.filter((t) => core.point >= t).length;
    // "질서의 해 코어 : 그림자 주먹" → "질서"
    const set = core.name.startsWith("혼돈") ? "혼돈" : "질서";
    const list = groups.get(set);
    if (list) list.push(stage);
    else groups.set(set, [stage]);
  }

  return ["질서", "혼돈"]
    .filter((set) => groups.has(set))
    .map((set) => `${set} ${groups.get(set)!.join("")}`)
    .join(" · ");
}

// --- 캐릭터 레코드 -----------------------------------------------------------

export interface CharacterSpec {
  className: string | null;
  itemLevel: number | null;
  combatPower: number | null;
  serverName: string | null;
  imageUrl: string | null;
  /** 직업 각인. "광전사의 비기". 표에 없는 직업이면 null */
  classEngraving: string | null;
  arkPassive: ArkPassiveData | null;
  /** 전투 각인. 상세에서 보여준다 */
  engravings: EngravingData | null;
  arkGrid: ArkGridData | null;
}

/**
 * armory 응답에서 Character 레코드에 넣을 값만 뽑는다.
 *
 * 템레벨은 `ItemAvgLevel`이다. 예전의 `ItemMaxLevel`은 응답에 없다.
 */
export function toCharacterSpec(armory: ArmoryResponse | null | undefined): CharacterSpec | null {
  const profile: ArmoryProfile | null | undefined = armory?.ArmoryProfile;
  if (!profile) return null;

  const arkPassive = normalizeArkPassive(armory?.ArkPassive);
  const arkGrid = normalizeArkGrid(armory?.ArkGrid);
  const className = profile.CharacterClassName ?? null;

  return {
    className,
    itemLevel: parseNumeric(profile.ItemAvgLevel),
    combatPower: parseNumeric(profile.CombatPower),
    serverName: profile.ServerName ?? null,
    imageUrl: profile.CharacterImage ?? null,
    // 아크그리드 코어의 발동 조건이 직업 각인을 그대로 알려준다.
    // 아크그리드를 아직 안 낀 캐릭터는 null이고, characters.ts가 이름표로 보완한다.
    classEngraving: arkGrid?.classEngraving ?? null,
    arkPassive,
    engravings: normalizeEngravings(armory?.ArmoryEngraving),
    arkGrid,
  };
}
