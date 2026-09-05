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
  ArmorySkill,
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

// --- 캐릭터 레코드 -----------------------------------------------------------

export interface CharacterSpec {
  className: string | null;
  /** 칭호. 스펙은 아니지만 카드에서 이름 위에 얹는다 */
  title: string | null;
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
  /** 스킬 트라이포드에서 읽은 파티 시너지. 클래스 표보다 정확하다 */
  skillSynergies: SkillSynergy[];
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
    /*
     * 칭호에 게임 내 이모티콘이 섞여 온다.
     *
     *   <img src='emoticon_Kazeroth_firstevent_4' size='130' vspace='-7'></img>심연의 군주
     *
     * src가 URL이 아니라 게임 클라이언트의 리소스 이름이라 웹에서 띄울 수 없다.
     * 로아 CDN의 경로 후보를 모두 두드려봤지만 전부 404였고, 공식 전적 페이지도
     * `[src^=emoticon][vspace]{display:none}` 한 줄로 이 태그를 통째로 감춘다.
     * 즉 공식도 안 보여주는 그림이다. 태그를 벗기고 글자만 남긴다.
     */
    title: stripTags(profile.Title),
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
    skillSynergies: normalizeSkillSynergies(armory?.ArmorySkills),
  };
}

// --- 스킬 트라이포드에서 읽는 파티 시너지 -------------------------------------

/**
 * 트라이포드가 주는 파티 시너지.
 *
 * `synergy.ts`의 클래스 표는 "이 직업은 보통 이 시너지를 준다"까지만 안다. 실제로는
 * **그 트라이포드를 찍었을 때만** 나오고, 딜 발키리처럼 직업 표로는 답이 안 나오는
 * 경우도 있다. 트라이포드는 캐릭터가 실제로 무엇을 들고 가는지를 말해준다.
 */
export interface SkillSynergy {
  kind: string;
  /** 툴팁이 말하는 수치. "8%" */
  value: string;
  /** 어느 스킬의 어느 트라이포드인지. 화면에서 근거를 보여줄 때 쓴다 */
  source: string;
}

/**
 * 툴팁 문구 → 시너지 종류.
 *
 * **문구가 종류마다 다르다.** 실측으로 확인한 것들이다.
 *
 *   치적    "자신 및 파티원에게 받는 치명타 저항률이 6.0초간 10.0% 감소"  (건슬링어 / 급소 노출)
 *   치피증  "자신 및 파티원의 치명타 공격에 받는 피해가 8.0% 증가"        (발키리 / 약점 공략)
 *   방깍    "적중된 적의 모든 방어력을 16.0초간 12.0% 감소"               (서머너 / 부식성 확산)
 *
 * 세 가지를 조심한다.
 *
 * **시너지가 걸리는 대상이 둘로 갈린다.** 파티에 거는 버프는 "자신 및 파티원"이라고
 * 말하지만, **적에게 거는 디버프(방깍)에는 파티원이 나오지 않는다.** 적의 방어력이
 * 깎이면 때리는 사람 전원이 덕을 보므로 그렇게 쓸 이유가 없다. 그래서 "파티원" 하나로
 * 거르면 방깍 직업(서머너·블래스터·환수사 …)이 통째로 빠진다. 규칙마다 대상을 직접
 * 물고 있는 이유가 이것이다.
 *
 * 대신 적 디버프는 자기 깎아먹기와 갈라야 한다. "적을 넘어뜨리지만 자신의 방어력이
 * 감소한다" 같은 디메리트 트라이포드가 흔하다. `(?!자신)`이 대상과 효과 사이를 넘지
 * 못하게 막는다. **이 가드를 받피증에 붙이면 안 된다.** 받피증은 "대상이 자신 및
 * 파티원에게 받는 피해가 증가"라고 말해서 대상과 효과 사이에 "자신"이 늘 낀다.
 *
 * **지속시간이 중간에 끼어든다.** "저항률이 6.0초간 10.0% 감소"처럼 효과와 수치 사이에
 * 다른 숫자가 들어온다. 사이를 건너뛰되 옆 문장까지 삼키지 않도록 길이를 묶는다.
 * `[^.]`로는 못 건너뛴다. 지속시간 "6.0"에도 소수점이 있기 때문이다.
 *
 * **순서가 중요하다.** 치피증 문구에도 "받는 피해가 … 증가"가 들어 있어, 받피증을 먼저
 * 보면 같은 트라이포드가 둘로 잡힌다. 좁은 규칙을 앞에 둔다.
 *
 * 확인하지 못한 종류는 추정 문구로 두었다. 안 잡히면 클래스 표로 떨어지므로
 * 지금보다 나빠지지 않는다. 새 직업으로 확인되면 여기에 문구를 고쳐 넣는다.
 */
const SYNERGY_RULES: { kind: string; re: RegExp }[] = [
  // 파티에 거는 버프 — "자신 및 파티원의 …"
  { kind: "치적", re: /파티원[^,]{0,20}?치명타 저항률이.{0,40}?([\d.]+)%\s*감소/ },
  { kind: "치피증", re: /파티원[^,]{0,20}?치명타 공격에 받는 피해가.{0,40}?([\d.]+)%\s*증가/ },

  // 백/헤드는 아직 실측하지 못했다. 자버프 "백어택 시 피해가 20% 증가"와 갈라야 해서
  // "받는 피해"를 요구한다. 어순이 둘이라 규칙도 둘이다.
  {
    kind: "백헤드",
    re: /(?:적|파티원)(?:(?!자신)[^,]){0,30}?(?:백어택|헤드어택)(?:(?!자신)[^,]){0,30}?받는 피해가.{0,40}?([\d.]+)%\s*증가/,
  },
  {
    kind: "백헤드",
    re: /(?:적|파티원)(?:(?!자신)[^,]){0,30}?받는 (?:백어택|헤드어택) 피해가.{0,40}?([\d.]+)%\s*증가/,
  },

  // 적에게 거는 디버프 — "파티원"이 나오지 않는다
  { kind: "방깍", re: /적(?:(?!자신)[^,]){0,20}?방어력[을이].{0,40}?([\d.]+)%\s*감소/ },

  /*
   * 받피증은 같은 효과를 세 가지 말투로 적는다. 어느 쪽에서 보느냐의 차이뿐이다.
   *
   *   "공격 적중 시 대상이 자신 및 파티원에게 받는 피해가 6.0% 증가"  (브레이커 피해 증폭)
   *   "6.0초간 적이 받는 피해가 10.0% 증가"                          (도화가 낙인 강화)
   *   "자신 및 파티원이 주는 피해가 10.0% 증가"                      (바드 음표 낙인)
   *
   * 적을 무는 규칙은 조사까지 요구한다. `적`만 물면 `적중`에 걸려서
   * "적중된 대상에게 … 호크아이에게 받는 피해가 증가"처럼 **자기만 받는 버프**를
   * 시너지로 잘못 읽는다.
   */
  { kind: "받피증", re: /파티원[^,]{0,15}?받는 피해가.{0,40}?([\d.]+)%\s*증가/ },
  { kind: "받피증", re: /파티원[^,]{0,15}?주는 피해가.{0,40}?([\d.]+)%\s*증가/ },
  { kind: "받피증", re: /적(?:들)?(?:이|은|에게)[^,]{0,15}?받는 피해가.{0,40}?([\d.]+)%\s*증가/ },

  { kind: "공증", re: /파티원[^,]{0,20}?공격력이.{0,40}?([\d.]+)%\s*증가/ },
  // 마나는 딜 시너지가 아니라 유틸이다. 골라 찍는 트라이포드라 클래스 표에 답이 없고,
  // 찍고 온 사람만 여기서 잡힌다(서머너 슈르디 소환 / 마나 회복).
  { kind: "마나", re: /파티원[^,]{0,20}?마나[^,]{0,20}?([\d.]+)%\s*증가/ },
];

/** "8.0" → "8%". 소수점 0은 떼어 표에 적힌 값과 같은 모양으로 만든다. */
function formatPercent(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? `${Number(n.toFixed(2))}%` : `${raw}%`;
}

/**
 * 찍은 트라이포드에서 파티 시너지를 뽑는다.
 *
 * **거르는 일은 규칙이 직접 한다.** 예전에는 "파티원"이 없는 툴팁을 통째로 버렸는데,
 * 적에게 거는 디버프에는 그 말이 나오지 않아 방깍 직업이 전부 빠졌다. 자버프를 걸러내는
 * 일은 `SYNERGY_RULES`가 대상까지 물고 있는 것으로 대신한다.
 *
 * 툴팁 자체는 저장하지 않는다. 스킬까지 받으면 응답이 두 배가 되는데 대부분이 툴팁이고,
 * 이 앱이 쓰는 것은 여기서 뽑은 결과뿐이다.
 */
export function normalizeSkillSynergies(
  skills: ArmorySkill[] | null | undefined,
): SkillSynergy[] {
  if (!Array.isArray(skills)) return [];

  const found = new Map<string, SkillSynergy>();
  for (const skill of skills) {
    for (const tripod of skill.Tripods ?? []) {
      if (!tripod.IsSelected) continue;
      const text = stripTags(tripod.Tooltip) ?? "";

      for (const rule of SYNERGY_RULES) {
        const match = text.match(rule.re);
        if (!match) continue;
        // 같은 종류가 여러 스킬에 걸리면 하나만 센다. 시너지는 중첩되지 않는다.
        if (!found.has(rule.kind)) {
          found.set(rule.kind, {
            kind: rule.kind,
            value: formatPercent(match[1]!),
            source: `${skill.Name ?? "?"} · ${tripod.Name ?? "?"}`,
          });
        }
        // 한 트라이포드는 한 종류만 준다. 좁은 규칙이 먼저 걸렸으면 거기서 끝낸다.
        break;
      }
    }
  }
  return [...found.values()];
}
