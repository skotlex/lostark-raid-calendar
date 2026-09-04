import "server-only";

import { Prisma } from "@/generated/prisma/client";

import type { ArkGridData, ArkPassiveData, EngravingData } from "./armory";
import { type CharacterSpec, enlightenmentNames, toCharacterSpec } from "./armory";
import { summarizeArkGrid } from "./arkGridCores";
import { pickClassEngraving } from "./classEngravings";
import { LostArkError, fetchArmory, fetchSiblings } from "./lostark";
import { prisma } from "./prisma";
import { resolveRole } from "./synergy";

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
  itemLevel: number | null;
  combatPower: number | null;
  serverName: string | null;
  imageUrl: string | null;
  classEngraving: string | null;
  arkGridSummary: string | null;
  arkPassive: ArkPassiveData | null;
  engravings: EngravingData | null;
  arkGrid: ArkGridData | null;
  role: "DPS" | "SUPPORT";
  roleLocked: boolean;
  memberId: string | null;
  memberLabel: string | null;
  syncedAt: string | null;
  syncError: string | null;
  /** 다시 조회할 때가 됐는지. 화면에서 "갱신 필요" 표시에 쓴다 */
  stale: boolean;
}

type CharacterRow = {
  id: string;
  name: string;
  className: string | null;
  itemLevel: unknown;
  combatPower: unknown;
  serverName: string | null;
  imageUrl: string | null;
  classEngraving: string | null;
  arkPassive: unknown;
  engravings: unknown;
  arkGrid: unknown;
  role: string;
  roleLocked: boolean;
  memberId: string | null;
  member: { label: string } | null;
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
    itemLevel: toNumber(row.itemLevel),
    combatPower: toNumber(row.combatPower),
    serverName: row.serverName,
    imageUrl: row.imageUrl,
    classEngraving: row.classEngraving,
    arkGridSummary: summarizeArkGrid(arkGrid),
    arkPassive: (row.arkPassive as ArkPassiveData | null) ?? null,
    engravings: (row.engravings as EngravingData | null) ?? null,
    arkGrid,
    role: row.role === "SUPPORT" ? "SUPPORT" : "DPS",
    roleLocked: row.roleLocked,
    memberId: row.memberId,
    memberLabel: row.member?.label ?? null,
    syncedAt: row.syncedAt?.toISOString() ?? null,
    syncError: row.syncError,
    stale: !row.syncedAt || now - row.syncedAt.getTime() > SYNC_TTL_MS,
  };
}

const characterSelect = {
  id: true,
  name: true,
  className: true,
  itemLevel: true,
  combatPower: true,
  serverName: true,
  imageUrl: true,
  classEngraving: true,
  arkPassive: true,
  engravings: true,
  arkGrid: true,
  role: true,
  roleLocked: true,
  memberId: true,
  member: { select: { label: true } },
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

  const memberId = await resolveMemberId(instanceId, memberLabel);
  // 로아가 돌려준 정식 표기를 쓴다. 사용자가 대소문자를 다르게 쳐도 한 행으로 모인다.
  const canonicalName = armory?.ArmoryProfile?.CharacterName ?? name;
  const role = specRole(spec);

  const spec_data = {
    className: spec.className,
    itemLevel: spec.itemLevel,
    combatPower: spec.combatPower,
    serverName: spec.serverName,
    imageUrl: spec.imageUrl,
    classEngraving: resolveClassEngraving(spec),
    arkPassive: toJson(spec.arkPassive),
    engravings: toJson(spec.engravings),
    arkGrid: toJson(spec.arkGrid),
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
        itemLevel: spec.itemLevel,
        combatPower: spec.combatPower,
        serverName: spec.serverName,
        imageUrl: spec.imageUrl,
        classEngraving: resolveClassEngraving(spec),
        arkPassive: toJson(spec.arkPassive),
        engravings: toJson(spec.engravings),
        arkGrid: toJson(spec.arkGrid),
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
}

export async function previewSiblings(
  instanceId: string,
  rawName: string,
): Promise<SiblingPreview[]> {
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
    select: { name: true },
  });
  const registered = new Set(existing.map((c) => c.name));

  return siblings
    .map((s) => ({
      name: s.CharacterName,
      className: s.CharacterClassName,
      itemLevel: Number(s.ItemAvgLevel.replace(/,/g, "")) || null,
      registered: registered.has(s.CharacterName),
    }))
    .sort((a, b) => (b.itemLevel ?? 0) - (a.itemLevel ?? 0));
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
 * 등록된 캐릭터를 전부 다시 조회한다.
 *
 * 스펙이 바뀐 것도 반영하지만, **정규화 형식이 바뀌었을 때 옛 데이터를 되살리는**
 * 용도가 더 크다. 캐릭터마다 요청 1회가 나가고 큐가 직렬화한다.
 */
export async function syncAllCharacters(instanceId: string): Promise<BulkResult> {
  const rows = await prisma.character.findMany({
    where: { instanceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const result: BulkResult = { added: [], failed: [] };
  for (const row of rows) {
    const character = await syncCharacter(instanceId, row.id, { force: true });
    if (character.syncError) result.failed.push({ name: row.name, reason: character.syncError });
    else result.added.push(character.name);
  }
  return result;
}

export async function deleteCharacter(instanceId: string, characterId: string): Promise<void> {
  await prisma.character.deleteMany({ where: { id: characterId, instanceId } });
}
