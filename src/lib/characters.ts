import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { ArkGridData, ArkPassiveData, EngravingData, SkillSynergy } from "./armory";
import { type CharacterSpec, enlightenmentNames, stripTags, toCharacterSpec } from "./armory";
import { summarizeArkGrid } from "./arkGridCores";
import { pickClassEngraving } from "./classEngravings";
import { LostArkError, fetchArmory, fetchSiblings } from "./lostark";
import { findOwnerByCharacterName } from "./members";
import { prisma } from "./prisma";
import { type Role, resolveRole } from "./synergy";

/** 이 시간이 지난 캐릭터만 다시 조회한다. 분당 100회 한도를 아끼기 위한 캐시다. */
export const SYNC_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * 화면에 넘기는 캐릭터 형태.
 *
 * Prisma의 Decimal과 JsonValue는 클라이언트 컴포넌트로 그대로 넘길 수 없다.
 * 여기서 평범한 숫자와 객체로 바꾼다.
 */
export interface CharacterView {
  id: string;
  name: string;
  className: string | null;
  /** 칭호. 없는 캐릭터도 있다 */
  title: string | null;
  itemLevel: number | null;
  combatPower: number | null;
  serverName: string | null;
  imageUrl: string | null;
  classEngraving: string | null;
  arkGridSummary: string | null;
  arkPassive: ArkPassiveData | null;
  engravings: EngravingData | null;
  arkGrid: ArkGridData | null;
  /**
   * 스킬 트라이포드에서 읽은 시너지.
   *
   * null이면 스킬을 아직 받아본 적이 없다는 뜻이고 클래스 표로 떨어진다.
   * 빈 배열이면 받아봤는데 시너지 트라이포드를 안 찍은 것이다.
   */
  skillSynergies: SkillSynergy[] | null;
  role: "DPS" | "SUPPORT";
  roleLocked: boolean;
  memberId: string | null;
  memberLabel: string | null;
  rosterId: string | null;
  rosterLabel: string | null;
  /** 주간 골드를 받는 캐릭터인가. null이면 자동 판정(goldEarners.ts) */
  goldEarner: boolean | null;
  syncedAt: string | null;
  syncError: string | null;
  /** 다시 조회할 때가 됐는지. 화면이 열릴 때 자동 갱신 대상을 세는 데 쓴다 */
  stale: boolean;
}

type CharacterRow = {
  id: string;
  name: string;
  className: string | null;
  title: string | null;
  itemLevel: unknown;
  combatPower: unknown;
  serverName: string | null;
  imageUrl: string | null;
  classEngraving: string | null;
  arkPassive: unknown;
  engravings: unknown;
  arkGrid: unknown;
  skillSynergies: unknown;
  role: string;
  roleLocked: boolean;
  memberId: string | null;
  member: { label: string } | null;
  rosterId: string | null;
  roster: { label: string } | null;
  goldEarner: boolean | null;
  syncedAt: Date | null;
  syncError: string | null;
};

/**
 * 정규화 결과를 Prisma의 Json 컬럼에 넣을 형태로 바꾼다.
 * 값이 없으면 `DbNull`로 명시해 이전 값이 남지 않게 한다. `undefined`를 넘기면
 * "이 필드는 건드리지 않는다"는 뜻이 되어 낡은 데이터가 살아남는다.
 */
function toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

/** Prisma Decimal은 객체다. toString을 거쳐야 정밀도가 유지된다. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function toCharacterView(row: CharacterRow, now = Date.now()): CharacterView {
  const arkGrid = (row.arkGrid as ArkGridData | null) ?? null;
  return {
    id: row.id,
    name: row.name,
    className: row.className,
    /*
     * 태그를 한 번 더 벗긴다.
     *
     * 정규화(armory.ts)에서 이미 벗기지만 저장된 값은 조회 시점 형식으로 굳어 있어
     * 전체 갱신 전까지는 `<img src='emoticon_…'>심연의 군주`가 그대로 남는다.
     * 읽는 쪽에서 받아내지 않으면 그 사이 칸에 태그가 글자로 찍힌다(CLAUDE.md 8).
     */
    title: stripTags(row.title),
    itemLevel: toNumber(row.itemLevel),
    combatPower: toNumber(row.combatPower),
    serverName: row.serverName,
    imageUrl: row.imageUrl,
    classEngraving: row.classEngraving,
    arkGridSummary: summarizeArkGrid(arkGrid),
    arkPassive: (row.arkPassive as ArkPassiveData | null) ?? null,
    engravings: (row.engravings as EngravingData | null) ?? null,
    arkGrid,
    skillSynergies: (row.skillSynergies as SkillSynergy[] | null) ?? null,
    role: row.role === "SUPPORT" ? "SUPPORT" : "DPS",
    roleLocked: row.roleLocked,
    memberId: row.memberId,
    memberLabel: row.member?.label ?? null,
    rosterId: row.rosterId,
    rosterLabel: row.roster?.label ?? null,
    goldEarner: row.goldEarner,
    syncedAt: row.syncedAt?.toISOString() ?? null,
    syncError: row.syncError,
    stale: !row.syncedAt || now - row.syncedAt.getTime() > SYNC_TTL_MS,
  };
}

const characterSelect = {
  id: true,
  name: true,
  className: true,
  title: true,
  itemLevel: true,
  combatPower: true,
  serverName: true,
  imageUrl: true,
  classEngraving: true,
  arkPassive: true,
  engravings: true,
  arkGrid: true,
  skillSynergies: true,
  role: true,
  roleLocked: true,
  memberId: true,
  member: { select: { label: true } },
  rosterId: true,
  roster: { select: { label: true } },
  goldEarner: true,
  syncedAt: true,
  syncError: true,
} as const;

export async function listCharacters(instanceId: string): Promise<CharacterView[]> {
  const rows = await prisma.character.findMany({
    where: { instanceId },
    select: characterSelect,
    orderBy: [{ itemLevel: "desc" }, { name: "asc" }],
  });
  const now = Date.now();
  return rows.map((row) => toCharacterView(row, now));
}

/** 사람 단위 묶음. 중복 참여 경고와 화면 그룹핑에 쓴다. */
async function resolveMemberId(
  instanceId: string,
  memberLabel: string | null | undefined,
): Promise<string | null> {
  const label = memberLabel?.trim();
  if (!label) return null;
  const member = await prisma.member.upsert({
    where: { instanceId_label: { instanceId, label } },
    update: {},
    create: { instanceId, label },
  });
  return member.id;
}

/**
 * 직업 각인은 아크그리드 코어의 발동 조건에서 나온다.
 * 아크그리드를 아직 끼지 않은 캐릭터만 이름표로 보완한다.
 */
function specRole(spec: CharacterSpec) {
  // 딜 발키리·딜 바드는 클래스만으로 가릴 수 없다.
  // 직업 각인이 가장 안정적이고, 모르면 진화 노드로 떨어진다.
  return resolveRole(
    spec.className,
    (spec.arkPassive?.nodes ?? []).map((n) => n.name),
    resolveClassEngraving(spec),
  );
}

/**
 * 저장할 시너지 목록.
 *
 * **서포터만 아크패시브 노드를 함께 읽는다.** 서포터의 시너지는 트라이포드가 아니라
 * 직업 각인 노드가 통째로 들고 있어(도화가 먹물 낙인, 발키리 빛의 흔적), 트라이포드만
 * 보면 늘 빈손으로 나온다. 딜러는 트라이포드가 답이라 노드를 섞지 않는다 — 깨달음
 * 노드에는 자버프 문장이 길게 섞여 있어 잘못 읽을 여지만 늘어난다.
 *
 * 같은 종류가 양쪽에 다 있으면 트라이포드가 이긴다. 실제로 찍은 것이기 때문이다.
 */
function specSynergies(spec: CharacterSpec, role: Role): SkillSynergy[] {
  if (role !== "SUPPORT") return spec.skillSynergies;

  const fromTripod = new Set(spec.skillSynergies.map((s) => s.kind));
  return [
    ...spec.skillSynergies,
    ...spec.arkPassiveSynergies.filter((s) => !fromTripod.has(s.kind)),
  ];
}

function resolveClassEngraving(spec: CharacterSpec): string | null {
  return (
    spec.classEngraving ??
    pickClassEngraving(spec.className, enlightenmentNames(spec.arkPassive))
  );
}

export class CharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CharacterError";
  }
}

/**
 * 닉네임으로 캐릭터를 등록한다.
 *
 * 조회에 실패하면 **행을 만들지 않고** 에러를 던진다. 오타로 만든 빈 캐릭터가
 * 목록에 쌓이는 것을 막는다. 이미 있는 캐릭터면 최신 정보로 갱신한다.
 */
export async function registerCharacter(
  instanceId: string,
  rawName: string,
  memberLabel?: string | null,
): Promise<CharacterView> {
  const name = rawName.trim();
  if (!name) throw new CharacterError("캐릭터 닉네임을 입력해 주세요");

  let armory;
  try {
    armory = await fetchArmory(name);
  } catch (error) {
    if (error instanceof LostArkError && error.isNotFound) {
      throw new CharacterError(`'${name}' 캐릭터를 찾을 수 없습니다. 닉네임을 확인해 주세요`);
    }
    throw error;
  }

  const spec = toCharacterSpec(armory);
  if (!spec) {
    throw new CharacterError(`'${name}' 캐릭터를 찾을 수 없습니다. 닉네임을 확인해 주세요`);
  }

  // 로아가 돌려준 정식 표기를 쓴다. 사용자가 대소문자를 다르게 쳐도 한 행으로 모인다.
  const canonicalName = armory?.ArmoryProfile?.CharacterName ?? name;

  /*
   * 소속은 **클레임한 사람**이 먼저다.
   *
   * 칸에 이름을 치는 사람이 그 캐릭터 주인인 경우가 오히려 드물다. 공대장이 남의
   * 캐릭터를 대신 넣는 일이 흔해서, 친 사람 기준으로 묶으면 남의 부캐가 전부 공대장
   * 소속이 된다. 주인이 자기 원정대를 클레임해 두었으면 그쪽으로 붙인다(members.ts).
   */
  const memberId =
    (await findOwnerByCharacterName(instanceId, canonicalName)) ??
    (await resolveMemberId(instanceId, memberLabel));
  const role = specRole(spec);

  const spec_data = {
    className: spec.className,
    title: spec.title,
    itemLevel: spec.itemLevel,
    combatPower: spec.combatPower,
    serverName: spec.serverName,
    imageUrl: spec.imageUrl,
    classEngraving: resolveClassEngraving(spec),
    arkPassive: toJson(spec.arkPassive),
    engravings: toJson(spec.engravings),
    arkGrid: toJson(spec.arkGrid),
    // 빈 배열도 그대로 넣는다. null과 뜻이 다르다(schema.prisma 참조).
    skillSynergies: specSynergies(spec, role) as unknown as Prisma.InputJsonValue,
    syncedAt: new Date(),
    syncError: null,
  };

  // 이미 있는 캐릭터는 역할 수동 지정(roleLocked)과 기존 소속을 건드리지 않는다.
  // 소속은 이번에 값이 들어왔을 때만 덮어쓴다.
  const update: Prisma.CharacterUncheckedUpdateInput = memberId
    ? { ...spec_data, memberId }
    : spec_data;

  const create: Prisma.CharacterUncheckedCreateInput = {
    instanceId,
    name: canonicalName,
    memberId,
    role,
    ...spec_data,
  };

  const row = await prisma.character.upsert({
    where: { instanceId_name: { instanceId, name: canonicalName } },
    update,
    create,
    select: characterSelect,
  });

  // 역할을 수동으로 고정하지 않았다면 클래스 변동에 맞춰 다시 판정한다.
  if (!row.roleLocked && row.role !== role) {
    const updated = await prisma.character.update({
      where: { id: row.id },
      data: { role },
      select: characterSelect,
    });
    return toCharacterView(updated);
  }

  return toCharacterView(row);
}

/**
 * 이미 등록된 캐릭터를 다시 조회한다.
 *
 * 실패해도 **기존 스펙을 지우지 않는다.** `syncError`만 남긴다.
 * 시트의 `#REF!`처럼 값이 조용히 사라지는 상황을 만들지 않기 위해서다.
 */
export async function syncCharacter(
  instanceId: string,
  characterId: string,
  options: { force?: boolean } = {},
): Promise<CharacterView> {
  const existing = await prisma.character.findFirst({
    where: { id: characterId, instanceId },
    select: characterSelect,
  });
  if (!existing) throw new CharacterError("캐릭터를 찾을 수 없습니다");

  const fresh =
    existing.syncedAt && Date.now() - existing.syncedAt.getTime() < SYNC_TTL_MS;
  if (fresh && !options.force) return toCharacterView(existing);

  try {
    const spec = toCharacterSpec(await fetchArmory(existing.name));
    if (!spec) throw new LostArkError("캐릭터를 찾을 수 없습니다", 404, existing.name);

    const role = specRole(spec);
    const row = await prisma.character.update({
      where: { id: characterId },
      data: {
        className: spec.className,
        title: spec.title,
        itemLevel: spec.itemLevel,
        combatPower: spec.combatPower,
        serverName: spec.serverName,
        imageUrl: spec.imageUrl,
        classEngraving: resolveClassEngraving(spec),
        arkPassive: toJson(spec.arkPassive),
        engravings: toJson(spec.engravings),
        arkGrid: toJson(spec.arkGrid),
        skillSynergies: specSynergies(spec, role) as unknown as Prisma.InputJsonValue,
        syncedAt: new Date(),
        syncError: null,
        // 아크패시브로 판정하므로 동기화가 항상 최신 세팅을 따라간다.
        role,
      } satisfies Prisma.CharacterUncheckedUpdateInput,
      select: characterSelect,
    });
    return toCharacterView(row);
  } catch (error) {
    const message =
      error instanceof LostArkError
        ? error.isNotFound
          ? "조회 실패: 캐릭터를 찾을 수 없습니다 (삭제되었거나 닉네임이 바뀌었습니다)"
          : `조회 실패: ${error.message}`
        : "조회 실패: 알 수 없는 오류";

    const row = await prisma.character.update({
      where: { id: characterId },
      data: { syncError: message, syncedAt: new Date() },
      select: characterSelect,
    });
    return toCharacterView(row);
  }
}

/** 원정대 목록. DB를 건드리지 않고 보여주기만 한다. 요청 1회. */
export interface SiblingPreview {
  name: string;
  className: string;
  itemLevel: number | null;
  /** 이미 등록된 캐릭터인지 */
  registered: boolean;
  /**
   * 등록은 돼 있는데 **소속이 비어 있는지.**
   *
   * 편성 칸에 남이 대신 쳐 넣어 만들어진 캐릭터다(무소속으로 남긴다, board.ts).
   * 등록됐다는 이유로 불러오기에서 빼면 주인이 자기 원정대를 불러도 영영 소속이
   * 안 붙는다. 그래서 이것만 다시 고를 수 있게 열어 둔다.
   */
  unclaimed: boolean;
}

/**
 * 불러오기 한 번의 결과.
 *
 * 캐릭터 목록과 **이 원정대의 주인**이 함께 온다. 주인은 캐릭터 하나하나가 아니라
 * 목록 전체에 걸리는 값이라 따로 둔다.
 */
export interface SiblingsPreview {
  siblings: SiblingPreview[];
  /**
   * 이 원정대를 이미 클레임한 **다른 사람**의 이름. 내 것이거나 임자가 없으면 null이다.
   *
   * 로아 `siblings`는 **같은 계정의 캐릭터만** 준다. 그래서 목록에 남의 소속이 하나라도
   * 있으면 아직 등록 안 된 나머지도 전부 그 사람 것이다. 캐릭터 단위로만 잠그면 그 사람이
   * 등록하지 않은 부캐를 남이 가져갈 수 있고, 그러면 실제로는 한 계정인데 원정대가 둘로
   * 갈려 골드 6명이 양쪽에서 따로 계산된다(goldEarners.ts).
   */
  owner: string | null;
}

export async function previewSiblings(
  instanceId: string,
  rawName: string,
  myMemberId: string | null,
): Promise<SiblingsPreview> {
  const name = rawName.trim();
  if (!name) throw new CharacterError("캐릭터 닉네임을 입력해 주세요");

  let siblings;
  try {
    siblings = await fetchSiblings(name);
  } catch (error) {
    if (error instanceof LostArkError && error.isNotFound) {
      throw new CharacterError(`'${name}' 캐릭터를 찾을 수 없습니다. 닉네임을 확인해 주세요`);
    }
    throw error;
  }

  if (siblings.length === 0) {
    throw new CharacterError(`'${name}'의 원정대를 불러오지 못했습니다. 닉네임을 확인해 주세요`);
  }

  const existing = await prisma.character.findMany({
    where: { instanceId, name: { in: siblings.map((s) => s.CharacterName) } },
    select: { name: true, memberId: true, member: { select: { label: true } } },
  });
  const registered = new Map(existing.map((c) => [c.name, c.memberId]));

  // 소속이 있는 캐릭터 하나면 충분하다. 같은 계정이라 나머지도 같은 주인이다.
  const other = existing.find((c) => c.memberId && c.memberId !== myMemberId);

  return {
    owner: other?.member?.label ?? null,
    siblings: siblings
      .map((s) => ({
        name: s.CharacterName,
        className: s.CharacterClassName,
        itemLevel: Number(s.ItemAvgLevel.replace(/,/g, "")) || null,
        registered: registered.has(s.CharacterName),
        unclaimed: registered.get(s.CharacterName) === null,
      }))
      .sort((a, b) => (b.itemLevel ?? 0) - (a.itemLevel ?? 0)),
  };
}

export interface BulkResult {
  added: string[];
  failed: { name: string; reason: string }[];
}

/**
 * 여러 캐릭터를 한 번에 등록한다. 캐릭터당 요청 1회가 나가고 큐가 직렬화한다.
 * 하나가 실패해도 나머지는 계속 진행한다.
 */
export async function registerCharacters(
  instanceId: string,
  names: string[],
  memberLabel?: string | null,
): Promise<BulkResult> {
  const result: BulkResult = { added: [], failed: [] };

  for (const name of names) {
    try {
      const character = await registerCharacter(instanceId, name, memberLabel);
      result.added.push(character.name);
    } catch (error) {
      result.failed.push({
        name,
        reason: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  return result;
}

/**
 * 한 회차에 조회할 캐릭터 수.
 *
 * **진행률은 회차가 끝나야 움직인다.** 실행 시간만 보면 더 크게 잡아도 되지만, 크게
 * 잡으면 서른몇 개가 한 회차에 다 들어가 버튼이 `0/32`에 멎어 있다가 끝에 한 번에
 * 바뀐다. 도는 중인지 멎은 것인지 알 수 없어 다시 누르게 된다.
 *
 * 캐릭터 하나가 1초 안팎이라 5면 몇 초에 한 번씩 숫자가 오른다. 회차가 늘어난 만큼
 * 서버 왕복도 늘지만 조회에 걸리는 시간에 비하면 무시할 수 있다.
 */
const SYNC_ALL_BATCH = 5;

export interface BulkProgress extends BulkResult {
  /** 이 회차까지 하고도 남은 수. 0이면 끝이다. */
  remaining: number;
}

/**
 * 등록된 캐릭터를 전부 다시 조회한다. **한 회차씩 끊어서** 돈다.
 *
 * 스펙이 바뀐 것도 반영하지만, **정규화 형식이 바뀌었을 때 옛 데이터를 되살리는**
 * 용도가 더 크다. 캐릭터마다 요청 1회가 나가므로 200개면 분당 한도에 걸려 몇 분이 된다.
 * 한 번에 다 돌면 서버리스 실행 시간 제한에 잘리므로 화면이 회차를 이어 부른다.
 *
 * 어디까지 했는지는 `syncedAt`이 안다. 갱신하면 그 값이 `startedAt` 뒤로 밀리므로
 * 다음 회차는 자연히 아직 안 한 캐릭터만 집는다. 실패한 캐릭터도 `syncedAt`이 갱신되니
 * 같은 회차를 맴돌지 않는다.
 */
export async function syncAllBatch(
  instanceId: string,
  startedAt: Date,
  limit = SYNC_ALL_BATCH,
): Promise<BulkProgress> {
  const pending = {
    instanceId,
    OR: [{ syncedAt: null }, { syncedAt: { lt: startedAt } }],
  };

  const rows = await prisma.character.findMany({
    where: pending,
    select: { id: true, name: true },
    orderBy: { syncedAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });

  const result: BulkResult = { added: [], failed: [] };
  for (const row of rows) {
    const character = await syncCharacter(instanceId, row.id, { force: true });
    if (character.syncError) result.failed.push({ name: row.name, reason: character.syncError });
    else result.added.push(character.name);
  }

  return { ...result, remaining: await prisma.character.count({ where: pending }) };
}

/**
 * 같은 인스턴스에서 자동 갱신이 겹쳐 도는 것을 막는다.
 *
 * 길드원 여럿이 동시에 화면을 열면 같은 캐릭터를 두 번 조회하게 된다.
 * 프로세스 안에서만 도는 자물쇠라 완벽하지는 않지만, 흔한 겹침은 이걸로 걷힌다.
 */
const syncingInstances = new Set<string>();

/**
 * 오래된 캐릭터를 조용히 다시 조회한다. 화면이 열릴 때 자동으로 돈다.
 *
 * 사람이 `갱신`을 눌러야 최신이 되는 구조는 시트의 `#REF!`와 같은 문제를 만든다.
 * 아무도 누르지 않으면 낡은 숫자가 그대로 편성 근거가 된다.
 *
 * 한 번에 `limit`개까지만 본다. 오래 묵은 것부터 간다.
 *
 * 60인 이유는 분당 한도(95, lostark.ts)에서 손 입력과 수동 갱신 몫을 남긴 것이다.
 * 한도를 넘으면 큐가 알아서 다음 분까지 재우므로 한도 자체가 깨지지는 않지만,
 * 그러는 동안 칸에 닉네임을 친 사람이 기다리게 된다.
 *
 * 중간에 함수가 끊겨도 안전하다. 캐릭터마다 따로 저장하므로 거기까지는 남고
 * 나머지는 다음 조회에서 이어 간다.
 */
export async function syncStaleCharacters(instanceId: string, limit = 60): Promise<number> {
  if (syncingInstances.has(instanceId)) return 0;
  syncingInstances.add(instanceId);
  try {
    const cutoff = new Date(Date.now() - SYNC_TTL_MS);
    const rows = await prisma.character.findMany({
      where: { instanceId, OR: [{ syncedAt: null }, { syncedAt: { lt: cutoff } }] },
      select: { id: true },
      orderBy: { syncedAt: { sort: "asc", nulls: "first" } },
      take: limit,
    });

    let synced = 0;
    for (const row of rows) {
      // force를 주지 않는다. 그새 누가 갱신했으면 조회 없이 넘어간다.
      await syncCharacter(instanceId, row.id);
      synced += 1;
    }
    return synced;
  } finally {
    syncingInstances.delete(instanceId);
  }
}

/** 지운 캐릭터의 이름을 돌려준다. 기록에 남기려면 지우기 전에 알아야 한다. */
export async function deleteCharacter(
  instanceId: string,
  characterId: string,
): Promise<string | null> {
  const row = await prisma.character.findFirst({
    where: { id: characterId, instanceId },
    select: { name: true },
  });
  if (!row) return null;

  await prisma.character.deleteMany({ where: { id: characterId, instanceId } });
  return row.name;
}

/**
 * 한 사람에게 묶인 캐릭터를 통째로 지운다.
 *
 * 원정대를 골라 등록하면 부캐가 한 번에 여럿 들어온다. 잘못 등록했을 때 카드를
 * 하나씩 지우게 하지 않는다.
 *
 * `label`이 비어 있으면 **아직 사람에 묶이지 않은 캐릭터**가 대상이다. 칸에 닉네임을
 * 쳐서 만들어진 캐릭터가 여기 모인다(CLAUDE.md 4장).
 *
 * 편성 기록도 함께 사라진다. 되돌릴 수 없으므로 확인은 화면에서 받는다.
 */
export async function deleteMemberCharacters(
  instanceId: string,
  label: string | null,
): Promise<string[]> {
  const name = label?.trim();

  if (!name) {
    // 이름은 지우기 전에 읽는다. 기록에 무엇이 사라졌는지 남겨야 한다.
    const rows = await prisma.character.findMany({
      where: { instanceId, memberId: null },
      select: { name: true },
      orderBy: { itemLevel: "desc" },
    });
    await prisma.character.deleteMany({ where: { instanceId, memberId: null } });
    return rows.map((r) => r.name);
  }

  const member = await prisma.member.findFirst({
    where: { instanceId, label: name },
    select: { id: true },
  });
  if (!member) throw new CharacterError("원정대를 찾을 수 없습니다");

  return prisma.$transaction(async (tx) => {
    const rows = await tx.character.findMany({
      where: { instanceId, memberId: member.id },
      select: { name: true },
      orderBy: { itemLevel: "desc" },
    });
    await tx.character.deleteMany({ where: { instanceId, memberId: member.id } });
    // 빈 사람 행은 남겨두면 화면에 나오지도 않는 찌꺼기가 된다. 그룹은 캐릭터에서 나온다.
    await tx.member.delete({ where: { id: member.id } });
    return rows.map((r) => r.name);
  });
}
