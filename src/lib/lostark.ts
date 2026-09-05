/**
 * 로스트아크 공식 OpenAPI 클라이언트. **서버 전용이다.**
 *
 * API 키는 이 파일을 통해서만 읽는다. 클라이언트 번들에 절대 들어가면 안 되므로
 * `NEXT_PUBLIC_` 접두사를 쓰지 않고, 아래 가드로 브라우저 실행을 막는다.
 *
 * 공식 제한: **클라이언트(키)당** 분당 100회. 초과하면 429와 함께 X-RateLimit-* 헤더가 온다.
 * 키를 여러 개 넣으면 그만큼 늘어난다(LOSTARK_API_KEYS).
 */

const BASE_URL = "https://developer-lostark.game.onstove.com";

/** 공식 제한은 키마다 분당 100회다. 여유를 두고 95로 잡는다. */
const MAX_REQUESTS_PER_MINUTE = 95;
const WINDOW_MS = 60_000;

export class LostArkError extends Error {
  // 파라미터 프로퍼티(constructor(readonly x))를 쓰지 않는다. node가 타입만 벗겨
  // 실행하는 모드에서는 변환이 필요한 문법이라 scripts/*.mts가 깨진다.
  readonly status: number;
  readonly characterName?: string;

  constructor(message: string, status: number, characterName?: string) {
    super(message);
    this.name = "LostArkError";
    this.status = status;
    this.characterName = characterName;
  }

  /** 존재하지 않는 캐릭터. 오타이거나 삭제된 캐릭터다. */
  get isNotFound() {
    return this.status === 404;
  }
}

function requireServer() {
  if (typeof window !== "undefined") {
    throw new Error("lostark 클라이언트는 서버에서만 호출할 수 있다");
  }
}

/**
 * 쓸 수 있는 키 목록.
 *
 * 개발자 포털에서 클라이언트를 여러 개 만들 수 있고 한도는 키마다 따로 센다.
 * `LOSTARK_API_KEYS`에 쉼표로 나열하면 그만큼 한도가 늘어난다.
 * 하나만 쓰던 기존 설정(`LOSTARK_API_KEY`)도 그대로 읽는다.
 */
function apiKeys(): string[] {
  requireServer();
  const raw = process.env.LOSTARK_API_KEYS ?? process.env.LOSTARK_API_KEY ?? "";
  const keys = raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);

  if (keys.length === 0) {
    throw new Error(
      "LOSTARK_API_KEY가 없다. .env.local에 로아 OpenAPI JWT를 넣어야 한다",
    );
  }
  return keys;
}

/**
 * 키를 나눠 주는 큐.
 *
 * 키마다 최근 1분의 요청 시각을 들고 있다가 여유 있는 키를 내준다. 전부 찼으면
 * 가장 먼저 풀리는 키까지 기다린다. 동시에 나가는 요청 수는 키 수와 같다.
 * 키가 하나면 예전처럼 한 번에 하나씩 나간다.
 *
 * 서버리스에서는 인스턴스마다 별도로 존재하므로 완벽한 보장은 아니다.
 * 429가 오면 백오프로 다시 처리하는 것이 실제 방어선이고, 이 큐는 그 빈도를 줄인다.
 */
class KeyQueue {
  private windows = new Map<string, number[]>();
  /** 429를 받은 키. 이 시각까지는 건너뛴다. */
  private blockedUntil = new Map<string, number>();
  private waiting: (() => void)[] = [];
  private busy = new Set<string>();

  /** 요청 하나를 키 하나로 실행한다. 어떤 키를 썼는지 함께 돌려준다. */
  async run<T>(task: (key: string) => Promise<T>): Promise<{ key: string; value: T }> {
    const key = await this.take();
    try {
      return { key, value: await task(key) };
    } finally {
      this.release(key);
    }
  }

  /** 429를 받은 키를 한동안 쓰지 않는다. 남은 키로 계속 돈다. */
  block(key: string, ms: number) {
    this.blockedUntil.set(key, Date.now() + ms);
  }

  private async take(): Promise<string> {
    for (;;) {
      const now = Date.now();
      let soonest = Infinity;

      for (const key of apiKeys()) {
        if (this.busy.has(key)) continue;

        const until = this.blockedUntil.get(key) ?? 0;
        if (until > now) {
          soonest = Math.min(soonest, until - now);
          continue;
        }

        const recent = (this.windows.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
        if (recent.length < MAX_REQUESTS_PER_MINUTE) {
          recent.push(now);
          this.windows.set(key, recent);
          this.busy.add(key);
          return key;
        }
        this.windows.set(key, recent);
        soonest = Math.min(soonest, WINDOW_MS - (now - recent[0]!));
      }

      // 모든 키가 쓰이는 중이면 하나가 끝날 때까지, 한도가 찼으면 창이 열릴 때까지 기다린다.
      if (soonest === Infinity) await new Promise<void>((r) => this.waiting.push(r));
      else await sleep(soonest + 50);
    }
  }

  private release(key: string) {
    this.busy.delete(key);
    this.waiting.shift()?.();
  }
}

const queue = new KeyQueue();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429가 준 힌트로 얼마나 기다릴지 정한다. 힌트가 없으면 5초. */
function retryDelayMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000 + 250;
  }

  const reset = response.headers.get("x-ratelimit-reset");
  if (reset) {
    const epochSeconds = Number(reset);
    if (Number.isFinite(epochSeconds)) {
      const delta = epochSeconds * 1000 - Date.now();
      if (delta > 0) return delta + 250;
    }
  }

  return 5_000;
}

async function request<T>(path: string, characterName?: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { key, value: response } = await queue.run((usedKey) =>
      fetch(`${BASE_URL}${path}`, {
        headers: {
          accept: "application/json",
          authorization: `bearer ${usedKey}`,
        },
        cache: "no-store",
      }),
    );

    if (response.status === 429) {
      // 이 키만 쉬게 하고 다시 시도한다. 키가 여럿이면 다른 키로 이어진다.
      const delay = retryDelayMs(response);
      queue.block(key, delay);
      continue;
    }

    if (response.status === 404) {
      throw new LostArkError("캐릭터를 찾을 수 없습니다", 404, characterName);
    }

    if (!response.ok) {
      throw new LostArkError(
        `로아 API 오류 (${response.status})`,
        response.status,
        characterName,
      );
    }

    // 존재하지 않는 캐릭터에 200 + "null"을 주는 경우가 있다.
    const text = await response.text();
    if (!text || text === "null") return null;
    return JSON.parse(text) as T;
  }

  throw new LostArkError("요청 한도 초과로 조회하지 못했습니다", 429, characterName);
}

// --- 응답 타입 ---------------------------------------------------------------
//
// 2026-09-04에 실제 응답(npm run probe)으로 확인한 구조다. 추측이 아니다.
// 주의: 예전에 있던 `ItemMaxLevel`은 더 이상 오지 않는다. 템레벨은 `ItemAvgLevel`뿐이다.

export interface ArmoryProfile {
  CharacterImage: string | null;
  CharacterName: string;
  CharacterClassName: string;
  ServerName: string;
  CharacterLevel: number;
  /** 템레벨. "1,770.83"처럼 천 단위 쉼표가 붙은 문자열로 온다 */
  ItemAvgLevel: string;
  /** 전투력. "5,043.42" 형태의 문자열. 존재를 실측으로 확인했다 */
  CombatPower?: string | null;
  GuildName: string | null;
  [key: string]: unknown;
}

/**
 * **전투 각인** (원한, 예리한 둔기 …). 직업 각인이 아니다.
 * 직업 각인은 `ArkPassive.Effects`의 깨달음 1티어에 있다.
 *
 * 현재 로아는 아크패시브 각인 체계라 `Engravings`와 `Effects`는 null로 오고
 * 실제 내용은 `ArkPassiveEffects`에 담긴다. 이름이 헷갈리지만 API가 그렇다.
 */
export interface ArkPassiveEffect {
  Name: string;
  /** "유물" | "고대" 등 */
  Grade: string | null;
  /** 각인 레벨 1~4 */
  Level: number | null;
  /** 어빌리티 스톤으로 올린 레벨. 스톤 각인이 아니면 null */
  AbilityStoneLevel: number | null;
  /** 색상 태그가 섞인 HTML 문자열 */
  Description: string | null;
}

export interface ArmoryEngraving {
  Engravings: unknown;
  Effects: unknown;
  ArkPassiveEffects: ArkPassiveEffect[] | null;
}

/** 아크그리드 코어에 박힌 젬 */
export interface ArkGridGem {
  Index: number;
  Icon: string | null;
  IsActive: boolean;
  Grade: string | null;
  /** 거대한 JSON 문자열. 저장하지 않는다 */
  Tooltip?: string;
}

/** 아크그리드 코어. 질서/혼돈 × 해/달/별 6개가 온다 */
export interface ArkGridSlot {
  Index: number;
  Icon: string | null;
  Name: string;
  /** 코어 포인트 */
  Point: number;
  Grade: string | null;
  Gems: ArkGridGem[] | null;
  Tooltip?: string;
}

/** 아크그리드가 최종적으로 주는 효과 */
export interface ArkGridEffect {
  Name: string;
  Level: number;
  /** 색상 태그가 섞인 짧은 HTML 문자열 */
  Tooltip?: string;
}

export interface ArkGrid {
  Slots: ArkGridSlot[] | null;
  Effects: ArkGridEffect[] | null;
}

/**
 * 아크패시브 노드 하나.
 *
 * **직업 각인이 여기 있다.** `깨달음` 1티어 항목이 직업 각인이다.
 * (브레이커라면 "수라의 길" 또는 "일격필살")
 *
 * `Description`은 태그가 섞인 고정 형식이다:
 *   `<FONT ...>깨달음</FONT> 1티어 <FONT ...>수라의 길 Lv.1</FONT>`
 * 태그를 벗기면 "깨달음 1티어 수라의 길 Lv.1"이 되어 파싱할 수 있다.
 */
export interface ArkPassiveNode {
  /** "진화" | "깨달음" | "도약" */
  Name: string;
  Description: string | null;
  Icon: string | null;
  /** 거대한 JSON 문자열. 저장하지 않는다 */
  ToolTip?: string;
}

/** 진화/깨달음/도약 각각의 누적 포인트 */
export interface ArkPassivePoint {
  Name: string;
  Value: number;
  /** "6랭크 28레벨" */
  Description: string | null;
  Tooltip?: string;
}

export interface ArkPassive {
  Title: string | null;
  IsArkPassive: boolean;
  Points: ArkPassivePoint[] | null;
  Effects: ArkPassiveNode[] | null;
}

/**
 * 스킬 하나. 트라이포드에서 파티 시너지를 읽는다(armory.ts).
 *
 * Tooltip은 게임 내 표시용 마크업이라 저장하지 않는다. 시너지를 뽑고 버린다.
 */
export interface ArmorySkill {
  Name: string | null;
  Level: number | null;
  Tripods: ArmoryTripod[] | null;
  [key: string]: unknown;
}

export interface ArmoryTripod {
  Name: string | null;
  Tier: number | null;
  Slot: number | null;
  IsSelected: boolean | null;
  Tooltip: string | null;
}

export interface ArmoryResponse {
  ArmoryProfile: ArmoryProfile | null;
  ArmoryEngraving: ArmoryEngraving | null;
  /** 필터에 combat-skills를 넣었을 때만 온다. 없을 수 있다 */
  ArmorySkills?: ArmorySkill[] | null;
  ArkPassive: ArkPassive | null;
  ArkGrid: ArkGrid | null;
  [key: string]: unknown;
}

export interface Sibling {
  ServerName: string;
  CharacterName: string;
  CharacterLevel: number;
  CharacterClassName: string;
  ItemAvgLevel: string;
}

/**
 * 캐릭터 하나의 프로필·각인·아크그리드·아크패시브를 **요청 한 번**으로 가져온다.
 * 분당 100회 제한이 있으므로 네 엔드포인트를 따로 부르지 않는다.
 */
export async function fetchArmory(characterName: string): Promise<ArmoryResponse | null> {
  const encoded = encodeURIComponent(characterName);
  return request<ArmoryResponse>(
    // combat-skills를 합쳐도 요청은 1회다. 따로 부르면 분당 한도가 절반으로 준다.
    `/armories/characters/${encoded}?filters=profiles+engravings+arkgrid+arkpassive+combat-skills`,
    characterName,
  );
}

/** 같은 계정의 원정대 캐릭터 목록. 부캐 일괄 등록에 쓴다. */
export async function fetchSiblings(characterName: string): Promise<Sibling[]> {
  const encoded = encodeURIComponent(characterName);
  const result = await request<Sibling[]>(`/characters/${encoded}/siblings`, characterName);
  return result ?? [];
}
