/**
 * 로아 API 응답 → DB에 넣을 형태로 정규화.
 *
 * 구조는 2026-09-04에 `npm run probe`로 실측해 확정했다. 게임 개편으로 바뀔 수 있으므로
 * 정규화 결과와 함께 **원본도 보관**한다. 다만 원본을 그대로 넣지는 않는다.
 * 아크그리드 응답은 툴팁이 87KB를 차지하는데, 툴팁을 빼면 4.3KB로 줄어든다.
 * 툴팁은 게임 내 표시용 마크업이라 이 앱이 쓸 일이 없다.
 */

// 타입만 가져온다. `import type`은 컴파일 시 사라지므로 node가 이 스크립트를
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

/** `<FONT COLOR='#99ff99'>24.00%</FONT>` 같은 태그를 벗긴다. */
export function stripTags(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
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

/**
 * 편성 칸에 한 줄로 넣을 요약. "원한 4 · 예리한 둔기 4 · …"
 * 이름을 임의로 줄이지 않는다. 길면 CSS가 자른다.
 */
export function summarizeEngravings(data: EngravingData | null | undefined): string | null {
  if (!data || data.list.length === 0) return null;
  return data.list
    .map((e) => (e.level !== null ? `${e.name} ${e.level}` : e.name))
    .join(" · ");
}

// --- 아크그리드 --------------------------------------------------------------

export interface ArkGridCore {
  index: number;
  name: string;
  grade: string | null;
  point: number;
  /** 젬 개수. 상세는 팝오버에서 보여준다 */
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
  /** 등급별 코어 개수. { 유물: 3, 고대: 3 } */
  gradeCounts: Record<string, number>;
}

export function normalizeArkGrid(raw: ArkGrid | null | undefined): ArkGridData | null {
  const slots = raw?.Slots;
  if (!slots || slots.length === 0) return null;

  const cores: ArkGridCore[] = slots.map((slot) => {
    const gems = slot.Gems ?? [];
    return {
      index: slot.Index,
      name: slot.Name,
      grade: slot.Grade ?? null,
      point: slot.Point ?? 0,
      gemCount: gems.length,
      inactiveGemCount: gems.filter((g) => !g.IsActive).length,
    };
  });

  const gradeCounts: Record<string, number> = {};
  for (const core of cores) {
    const key = core.grade ?? "미상";
    gradeCounts[key] = (gradeCounts[key] ?? 0) + 1;
  }

  return {
    cores,
    effects: (raw?.Effects ?? []).map((e) => ({
      name: e.Name,
      level: e.Level,
      text: stripTags(e.Tooltip),
    })),
    totalPoint: cores.reduce((sum, c) => sum + c.point, 0),
    gradeCounts,
  };
}

/**
 * 편성 칸에 넣을 짧은 뱃지. "112p 고대3·유물3"
 * 코어 이름까지 넣으면 칸이 터지므로 총 포인트와 등급 구성만 보여준다.
 */
export function summarizeArkGrid(data: ArkGridData | null | undefined): string | null {
  if (!data || data.cores.length === 0) return null;
  // 고대가 유물보다 상위라 앞에 오도록 개수 내림차순 대신 등급명으로 정렬한다.
  const order = ["고대", "유물", "영웅", "희귀", "미상"];
  const grades = Object.entries(data.gradeCounts)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([grade, count]) => `${grade}${count}`)
    .join("·");
  return `${data.totalPoint}p ${grades}`;
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
  /** 깨달음 1티어 = 직업 각인. 없을 수도 있다(아크패시브 미개방 캐릭터) */
  classEngraving: { name: string; level: number } | null;
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

  // 직업 각인은 깨달음 트리의 1티어 노드다.
  const classNode = nodes.find((n) => n.category === "깨달음" && n.tier === 1) ?? null;

  const points: Record<string, number> = {};
  for (const p of raw?.Points ?? []) {
    points[p.Name] = p.Value;
  }

  return {
    classEngraving: classNode ? { name: classNode.name, level: classNode.level } : null,
    nodes,
    points,
  };
}

/** 편성 칸에 클래스와 함께 붙일 문구. "수라의 길 Lv.1" */
export function summarizeClassEngraving(data: ArkPassiveData | null | undefined): string | null {
  const ce = data?.classEngraving;
  if (!ce) return null;
  return `${ce.name} Lv.${ce.level}`;
}

// --- 캐릭터 레코드 -----------------------------------------------------------

export interface CharacterSpec {
  className: string | null;
  itemLevel: number | null;
  combatPower: number | null;
  serverName: string | null;
  imageUrl: string | null;
  /** 직업 각인. "수라의 길 Lv.1" — 칸에 클래스와 나란히 보여줄 값 */
  classEngraving: string | null;
  arkPassive: ArkPassiveData | null;
  /** 전투 각인. 상세 팝오버에서 보여준다 */
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

  return {
    className: profile.CharacterClassName ?? null,
    itemLevel: parseNumeric(profile.ItemAvgLevel),
    combatPower: parseNumeric(profile.CombatPower),
    serverName: profile.ServerName ?? null,
    imageUrl: profile.CharacterImage ?? null,
    classEngraving: summarizeClassEngraving(arkPassive),
    arkPassive,
    engravings: normalizeEngravings(armory?.ArmoryEngraving),
    arkGrid: normalizeArkGrid(armory?.ArkGrid),
  };
}
