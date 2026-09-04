import "server-only";

import {
  type CharacterView,
  CharacterError,
  registerCharacter,
  toCharacterView,
} from "./characters";
import { prisma } from "./prisma";
import { ALL_POSITIONS, PARTIES, isValidPosition, partyIndexOf } from "./positions";
import { type SlotView, toSlotView } from "./slots";
import { type PartySynergy, partySynergies } from "./synergy";
import { getWeekStart, previousWeek } from "./week";

export class BoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BoardError";
  }
}

export interface CellView {
  position: string;
  assignmentId: string | null;
  /** 자리 단위 리셋 제외 */
  pinned: boolean;
  character: CharacterView | null;
  createdByLabel: string | null;
  /** 막지 않고 알리기만 하는 경고들 */
  warnings: string[];
}

export interface PartyView {
  /** 1파티 = 0 */
  index: number;
  cells: CellView[];
  /** 이 파티에 들어온 시너지. 시너지는 4인 파티 단위로 적용된다 */
  synergies: PartySynergy[];
}

export interface BoardSlotView extends SlotView {
  parties: PartyView[];
  /** 8자리 중 채워진 수 */
  filled: number;
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

const slotSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  raidName: true,
  difficulty: true,
  partyLabel: true,
  keepRoster: true,
  sortOrder: true,
} as const;

/**
 * 주간 인원 승계.
 *
 * 새 주차를 처음 열 때, 직전 주차 배정 중 **슬롯 전체가 고정(keepRoster)이거나
 * 자리가 고정(pinned)된 것**만 복사한다.
 *
 * `carriedWeek`로 슬롯마다 한 번만 수행한다. 이게 없으면 고정 인원을 지운 뒤
 * 새로고침할 때마다 되살아난다.
 *
 * 크론이 아니라 조회 시점에 처리하므로 별도 스케줄러가 필요 없고, 여러 요청이
 * 동시에 들어와도 (slotId, weekStart, position) 유니크 제약이 중복을 막는다.
 */
async function carryOver(instanceId: string, weekStart: Date): Promise<void> {
  // 지난 주차를 들여다볼 때는 승계하지 않는다. 과거는 읽기 전용이다.
  if (weekStart.getTime() !== getWeekStart().getTime()) return;

  const pending = await prisma.raidSlot.findMany({
    where: {
      instanceId,
      archivedAt: null,
      OR: [{ carriedWeek: null }, { carriedWeek: { not: weekStart } }],
    },
    select: { id: true, keepRoster: true },
  });
  if (pending.length === 0) return;

  const prev = previousWeek(weekStart);
  const source = await prisma.assignment.findMany({
    where: {
      weekStart: prev,
      slotId: { in: pending.map((s) => s.id) },
    },
    select: { slotId: true, position: true, characterId: true, pinned: true },
  });

  const keepAll = new Set(pending.filter((s) => s.keepRoster).map((s) => s.id));
  const rows = source
    .filter((a) => keepAll.has(a.slotId) || a.pinned)
    .map((a) => ({
      slotId: a.slotId,
      weekStart,
      position: a.position,
      characterId: a.characterId,
      // 핀은 한 번 꽂으면 계속 유지된다.
      pinned: a.pinned,
    }));

  if (rows.length > 0) {
    // 캐릭터가 그새 삭제됐으면 그 자리만 빠진다. 나머지는 그대로 들어간다.
    await prisma.assignment.createMany({ data: rows, skipDuplicates: true });
  }

  await prisma.raidSlot.updateMany({
    where: { id: { in: pending.map((s) => s.id) } },
    data: { carriedWeek: weekStart },
  });
}

export async function getBoard(
  instanceId: string,
  weekStart: Date,
): Promise<BoardSlotView[]> {
  await carryOver(instanceId, weekStart);

  const slots = await prisma.raidSlot.findMany({
    where: { instanceId, archivedAt: null },
    select: {
      ...slotSelect,
      assignments: {
        where: { weekStart },
        select: {
          id: true,
          position: true,
          pinned: true,
          createdByLabel: true,
          character: { select: characterSelect },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { sortOrder: "asc" }],
  });

  // 같은 사람이 같은 레이드를 이 주에 두 번 이상 잡았는지 센다.
  // 로아는 캐릭터가 아니라 원정대 단위로 주간 클리어가 제한되는 레이드가 있어
  // 공대장이 가장 자주 놓치는 실수다.
  const memberRaidCount = new Map<string, number>();
  for (const slot of slots) {
    for (const a of slot.assignments) {
      const memberId = a.character.memberId;
      if (!memberId) continue;
      const key = `${memberId}::${slot.raidName}`;
      memberRaidCount.set(key, (memberRaidCount.get(key) ?? 0) + 1);
    }
  }

  const now = Date.now();

  return slots.map((slot) => {
    const view = toSlotView(slot);
    const byPosition = new Map(slot.assignments.map((a) => [a.position, a]));

    function toCell(position: string): CellView {
      const assignment = byPosition.get(position);
      if (!assignment) {
        return {
          position,
          assignmentId: null,
          pinned: false,
          character: null,
          createdByLabel: null,
          warnings: [],
        };
      }

      const character = toCharacterView(assignment.character, now);
      const warnings: string[] = [];

      // 서폿 자리와 딜러 자리가 어긋나면 알린다. 막지는 않는다.
      if (position.startsWith("SUP") && character.role !== "SUPPORT") {
        warnings.push("서폿 자리에 딜러 클래스");
      }
      if (position.startsWith("DPS") && character.role === "SUPPORT") {
        warnings.push("딜러 자리에 서폿 클래스");
      }

      if (character.memberId) {
        const key = `${character.memberId}::${view.raidName}`;
        if ((memberRaidCount.get(key) ?? 0) > 1) {
          warnings.push("같은 사람이 이번 주 같은 레이드에 중복");
        }
      }

      if (character.syncError) warnings.push(character.syncError);

      return {
        position,
        assignmentId: assignment.id,
        pinned: assignment.pinned,
        character,
        createdByLabel: assignment.createdByLabel,
        warnings,
      };
    }

    // 시너지는 4인 파티 단위로 적용된다. 8인을 한 덩어리로 계산하면 실제와 어긋난다.
    const parties: PartyView[] = PARTIES.map((positions, index) => {
      const cells = positions.map(toCell);
      return {
        index,
        cells,
        synergies: partySynergies(
          cells.map((c) => ({
            className: c.character?.className ?? null,
            role: c.character?.role,
          })),
        ),
      };
    });

    return {
      ...view,
      parties,
      filled: parties.reduce(
        (sum, party) => sum + party.cells.filter((c) => c.character).length,
        0,
      ),
    };
  });
}

async function requireSlot(instanceId: string, slotId: string) {
  const slot = await prisma.raidSlot.findFirst({
    where: { id: slotId, instanceId, archivedAt: null },
    select: { id: true, raidName: true },
  });
  if (!slot) throw new BoardError("슬롯을 찾을 수 없다");
  return slot;
}

function requireCurrentWeek(weekStart: Date) {
  if (weekStart.getTime() !== getWeekStart().getTime()) {
    throw new BoardError("지난 주 편성은 고칠 수 없다");
  }
}

/**
 * 칸에 캐릭터를 넣는다. **이 앱의 주 입력 경로다.**
 *
 * 닉네임만 받아서, 등록돼 있으면 그대로 쓰고 없으면 그 자리에서 로아 API로 조회해
 * 등록까지 한 번에 처리한다. 시트에서 칸에 닉네임을 치던 것과 같은 동작이라
 * "먼저 캐릭터를 등록하고 그다음 배치"라는 단계를 사용자가 겪지 않는다.
 */
export async function assignByName(params: {
  instanceId: string;
  slotId: string;
  weekStart: Date;
  position: string;
  characterName: string;
  actorLabel?: string | null;
}): Promise<{ character: CharacterView; created: boolean }> {
  const { instanceId, slotId, weekStart, position, actorLabel } = params;
  const name = params.characterName.trim();
  if (!name) throw new BoardError("캐릭터 닉네임을 입력한다");

  requireCurrentWeek(weekStart);
  const slot = await requireSlot(instanceId, slotId);
  if (!isValidPosition(position)) throw new BoardError("잘못된 자리다");

  // 이미 등록된 캐릭터면 API를 부르지 않는다. 분당 100회 한도를 아낀다.
  const existing = await prisma.character.findFirst({
    where: { instanceId, name: { equals: name, mode: "insensitive" } },
    select: characterSelect,
  });

  let character: CharacterView;
  let created = false;
  if (existing) {
    character = toCharacterView(existing);
  } else {
    try {
      character = await registerCharacter(instanceId, name);
      created = true;
    } catch (error) {
      if (error instanceof CharacterError) throw new BoardError(error.message);
      throw error;
    }
  }

  await prisma.assignment.upsert({
    where: { slotId_weekStart_position: { slotId, weekStart, position } },
    update: { characterId: character.id, createdByLabel: actorLabel ?? null },
    create: {
      slotId,
      weekStart,
      position,
      characterId: character.id,
      createdByLabel: actorLabel ?? null,
    },
  });

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart,
      slotId,
      actorLabel: actorLabel ?? null,
      action: "assign",
      detail: { position, character: character.name, raid: slot.raidName },
    },
  });

  return { character, created };
}

export async function unassign(params: {
  instanceId: string;
  slotId: string;
  weekStart: Date;
  position: string;
  actorLabel?: string | null;
}): Promise<void> {
  const { instanceId, slotId, weekStart, position, actorLabel } = params;
  requireCurrentWeek(weekStart);
  const slot = await requireSlot(instanceId, slotId);

  const removed = await prisma.assignment.findUnique({
    where: { slotId_weekStart_position: { slotId, weekStart, position } },
    select: { character: { select: { name: true } } },
  });
  if (!removed) return;

  await prisma.assignment.delete({
    where: { slotId_weekStart_position: { slotId, weekStart, position } },
  });

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart,
      slotId,
      actorLabel: actorLabel ?? null,
      action: "unassign",
      detail: { position, character: removed.character.name, raid: slot.raidName },
    },
  });
}

/** 자리 단위 고정. 이 자리만 다음 주로 넘어간다. */
export async function setPinned(params: {
  instanceId: string;
  slotId: string;
  weekStart: Date;
  position: string;
  pinned: boolean;
}): Promise<void> {
  const { instanceId, slotId, weekStart, position, pinned } = params;
  requireCurrentWeek(weekStart);
  await requireSlot(instanceId, slotId);

  await prisma.assignment.update({
    where: { slotId_weekStart_position: { slotId, weekStart, position } },
    data: { pinned },
  });
}

/** 고정 현황 화면에서 쓰는 목록. 핀이 방치되는 것을 막는 유일한 수단이다. */
export interface PinnedEntry {
  slotId: string;
  slotLabel: string;
  dayOfWeek: number;
  startTime: string;
  keepRoster: boolean;
  position: string | null;
  characterName: string | null;
}

export async function listPinned(
  instanceId: string,
  weekStart: Date,
): Promise<PinnedEntry[]> {
  const slots = await prisma.raidSlot.findMany({
    where: {
      instanceId,
      archivedAt: null,
      OR: [{ keepRoster: true }, { assignments: { some: { weekStart, pinned: true } } }],
    },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      raidName: true,
      difficulty: true,
      keepRoster: true,
      assignments: {
        where: { weekStart, pinned: true },
        select: { position: true, character: { select: { name: true } } },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const entries: PinnedEntry[] = [];
  for (const slot of slots) {
    const label = slot.difficulty ? `${slot.raidName} ${slot.difficulty}` : slot.raidName;
    if (slot.keepRoster) {
      entries.push({
        slotId: slot.id,
        slotLabel: label,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        keepRoster: true,
        position: null,
        characterName: null,
      });
    }
    for (const a of slot.assignments) {
      entries.push({
        slotId: slot.id,
        slotLabel: label,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        keepRoster: false,
        position: a.position,
        characterName: a.character.name,
      });
    }
  }
  return entries;
}
