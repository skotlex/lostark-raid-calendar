import "server-only";

import {
  type CharacterView,
  CharacterError,
  registerCharacter,
  toCharacterView,
} from "./characters";
import { SYSTEM_ACTOR, logEvent } from "./history";
import { prisma } from "./prisma";
import { raidLabel } from "./raids";
import { raidMinLevel } from "./raidRewards";
import {
  DEFAULT_PARTY_SIZE,
  type PartySize,
  isPartySize,
  isValidPosition,
  partiesFor,
  partyIndexOf,
  positionKind,
  positionLabel,
} from "./positions";
import { type SlotView, toSlotView } from "./slots";
import {
  MISSING_SYNERGY_WARNING,
  type PartySynergy,
  missingSynergy,
  partySynergies,
} from "./synergy";
import {
  TUESDAY,
  dayName,
  formatWeekLabel,
  getPlanningWeekStart,
  isUndecided,
  previousWeek,
  tuesdayWeekFor,
  weekStartForDay,
} from "./week";

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
  /**
   * 보고 있는 사람이 직접 넣은 자리인가.
   *
   * 남의 신청을 뺄 때만 한 번 확인하려고 쓴다. 판정을 클라이언트에 맡기면 "내 이름"을
   * 바꿔치기해 확인을 건너뛸 수 있으니 서버에서 정한다.
   */
  mine: boolean;
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
  /** 자리 수(4 또는 8) 중 채워진 수 */
  filled: number;
  /**
   * 이 레이드에 이번 주 이미 들어간 캐릭터 이름.
   *
   * 한 캐릭터는 같은 레이드를 난이도가 달라도 한 주에 한 번만 간다(CLAUDE.md 3.4-1).
   * 칸의 자동완성에서 미리 빼두면 경고가 뜰 편성을 애초에 만들지 않는다.
   */
  takenNames: string[];
}

/** 한 캐릭터가 이번 주 같은 레이드에 앉은 자리. 중복 경고에 위치를 적으려고 모은다. */
interface RaidSeat {
  assignmentId: string;
  slotId: string;
  dayOfWeek: number;
  startTime: string;
  difficulty: string | null;
  position: string;
}

/**
 * 중복이 어디에 있는지 한 조각으로 적는다. "목 20:50 하드", "이 공대 딜러 2".
 *
 * 같은 공대 안이면 요일·시각이 지금 보는 칸과 같아 그것만으로는 어느 자리인지 알 수
 * 없다. 그때만 자리 이름을 적는다.
 */
function seatBrief(seat: RaidSeat, currentSlotId: string): string {
  if (seat.slotId === currentSlotId) return `이 공대 ${positionLabel(seat.position)}`;
  // 미정 칸은 시각이 없다. 저장된 00:00을 적으면 없는 약속 시간이 생긴다(week.ts).
  const time = isUndecided(seat.dayOfWeek) ? "" : ` ${seat.startTime}`;
  return `${dayName(seat.dayOfWeek)}${time}${seat.difficulty ? ` ${seat.difficulty}` : ""}`;
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

const slotSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  raidName: true,
  difficulty: true,
  partySize: true,
  keepRoster: true,
  dpsScoreCut: true,
  supScoreCut: true,
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
async function carryOver(instanceId: string, planningWeek: Date): Promise<void> {
  // 지난 주차를 들여다볼 때는 승계하지 않는다. 과거는 읽기 전용이다.
  if (planningWeek.getTime() !== getPlanningWeekStart().getTime()) return;

  // 화요일 슬롯은 주기가 달라 따로 돈다(week.ts). carriedWeek에는 그 슬롯이 쓰는
  // 주차가 들어가므로 두 무리가 서로의 값을 덮지 않는다.
  await carryOverGroup(instanceId, planningWeek, { not: TUESDAY }, "수~월·미정");
  await carryOverGroup(instanceId, tuesdayWeekFor(planningWeek), TUESDAY, "화");
}

async function carryOverGroup(
  instanceId: string,
  weekStart: Date,
  dayOfWeek: number | { not: number },
  /** 기록에 남길 무리 이름. 두 무리가 서로 다른 날 비워진다(week.ts) */
  group: string,
): Promise<void> {
  const pending = await prisma.raidSlot.findMany({
    where: {
      instanceId,
      archivedAt: null,
      dayOfWeek,
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

  /*
   * 표시를 남기는 것과 기록을 남기는 것이 한 묶음이다.
   *
   * where에 같은 조건을 한 번 더 건다. 새 주차 첫 조회가 동시에 둘 들어오면 둘 다
   * pending을 채워 여기까지 오는데, 뒤에 온 쪽은 앞선 갱신이 커밋된 뒤 조건을 다시
   * 재는 순간 0줄이 되어 기록을 남기지 않는다. 없으면 같은 초기화가 두 줄로 선다.
   */
  const marked = await prisma.raidSlot.updateMany({
    where: {
      id: { in: pending.map((s) => s.id) },
      OR: [{ carriedWeek: null }, { carriedWeek: { not: weekStart } }],
    },
    data: { carriedWeek: weekStart },
  });
  if (marked.count === 0) return;

  /*
   * 주간 초기화를 기록에 남긴다.
   *
   * 초기화는 크론도 배치 삭제도 아니라 "새 주차의 배정만 읽는다"는 조회 규칙이다
   * (CLAUDE.md 2). 그래서 화 00시·수 06시 그 시각에는 아무 일도 일어나지 않고,
   * **새 주차가 된 뒤 누군가 처음 편성표를 열 때** 승계가 돈다. 이 줄의 시각은 그
   * 시점이지 경계 시각이 아니다. 어느 주차가 열렸는지는 문장에 적어 둔다.
   */
  await logEvent({
    instanceId,
    action: "week_reset",
    actorLabel: SYSTEM_ACTOR,
    weekStart,
    detail: {
      group,
      week: formatWeekLabel(weekStart),
      slots: marked.count,
      carried: rows.length,
    },
  });
}

export async function getBoard(
  instanceId: string,
  weekStart: Date,
  /** 지금 보고 있는 사람. 자기가 넣은 자리를 가려내는 데만 쓴다. */
  viewerLabel: string | null = null,
): Promise<BoardSlotView[]> {
  await carryOver(instanceId, weekStart);

  // 화요일 슬롯은 주차가 다르다. 둘을 한 번에 읽고 슬롯마다 제 것만 고른다.
  const tuesdayWeek = tuesdayWeekFor(weekStart);

  const slots = await prisma.raidSlot.findMany({
    where: { instanceId, archivedAt: null },
    select: {
      ...slotSelect,
      assignments: {
        where: { weekStart: { in: [weekStart, tuesdayWeek] } },
        select: {
          id: true,
          weekStart: true,
          position: true,
          pinned: true,
          createdByLabel: true,
          character: { select: characterSelect },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { sortOrder: "asc" }],
  });

  // 주간 제한은 하나뿐이고 **캐릭터마다** 걸린다.
  // **같은 레이드는 난이도가 달라도 한 번이다.** 하드를 갔으면 노말은 못 간다.
  // 그래서 raidName만 보고 난이도는 빼고 센다.
  //
  // 서로 다른 레이드는 몇 개를 가든 상관없고, 부캐를 바꿔 같은 레이드를 또 가는 것도
  // 정상이다. 사람(원정대) 단위로 세면 그 정상 편성에 경고가 붙는다.
  const characterRaidSeats = new Map<string, RaidSeat[]>();
  /** 레이드 이름 → 이번 주 그 레이드에 들어간 캐릭터 이름들 */
  const raidRoster = new Map<string, Set<string>>();
  for (const slot of slots) {
    const raid = slot.raidName.trim();
    const mine = slot.dayOfWeek === TUESDAY ? tuesdayWeek : weekStart;
    for (const a of slot.assignments) {
      if (a.weekStart.getTime() !== mine.getTime()) continue;
      const key = `${a.character.id}::${raid}`;
      const seats = characterRaidSeats.get(key) ?? [];
      seats.push({
        assignmentId: a.id,
        slotId: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        difficulty: slot.difficulty,
        position: a.position,
      });
      characterRaidSeats.set(key, seats);

      const roster = raidRoster.get(raid) ?? new Set<string>();
      roster.add(a.character.name);
      raidRoster.set(raid, roster);
    }
  }

  const now = Date.now();

  return slots.map((slot) => {
    // 배정을 떼어내고 슬롯 필드만 넘긴다. 통째로 넘기면 원본 배정(Prisma Decimal이 든
    // 캐릭터 행)이 그대로 딸려 와 클라이언트 컴포넌트로 실려 간다.
    const { assignments, ...slotRow } = slot;
    const view = toSlotView(slotRow);

    // 화요일 슬롯이면 화요일 주차의 배정만 남는다.
    const mine = slot.dayOfWeek === TUESDAY ? tuesdayWeek : weekStart;
    const byPosition = new Map(
      assignments
        .filter((a) => a.weekStart.getTime() === mine.getTime())
        .map((a) => [a.position, a]),
    );

    function toCell(position: string): CellView {
      const assignment = byPosition.get(position);
      if (!assignment) {
        return {
          position,
          assignmentId: null,
          pinned: false,
          character: null,
          createdByLabel: null,
          mine: false,
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

      // 입장 템레벨 미달. **막지 않는다**(CLAUDE.md 3.4). 게임이 입장에서 다시 막으므로
      // 앱까지 막아 세울 이유가 없고, 그날까지 올려 오기로 하고 미리 자리를 잡아 두는
      // 일이 흔하다.
      //
      // 슬롯의 딜러컷·서폿컷(3.4-2)과 다른 값이다. 그쪽은 공대장이 적어 둔 글이라
      // 무엇을 재는 숫자인지도 앱이 모르지만, 이것은 게임이 정한 입장 조건이라
      // 표(raidRewards.ts)에 있고 템레벨과 곧바로 견줄 수 있다.
      //
      // 표에 없는 레이드·난이도와 스펙을 못 받아온 캐릭터는 그냥 지나간다.
      const minLevel = raidMinLevel(view.raidName, view.difficulty);
      if (minLevel !== null && character.itemLevel !== null && character.itemLevel < minLevel) {
        // 템레벨은 이 앱 어디서도 세 자리마다 끊지 않는다(칸의 1752.50). 여기만 끊으면
        // 같은 줄의 두 숫자가 다른 표기가 된다.
        warnings.push(`레벨컷 ${minLevel} 미달 (${character.itemLevel.toFixed(2)})`);
      }

      const raid = view.raidName.trim();
      // 난이도가 달라도 중복이다.
      //
      // **어디와 겹치는지를 함께 적는다.** 겹치는 자리는 대개 다른 요일에 있어 지금
      // 열린 탭에 보이지 않는다. "같은 레이드에 중복"만 띄우면 눈앞의 다른 캐릭터를
      // 빼 보다가 경고가 그대로 남는 것을 보고 화면이 갱신되지 않았다고 읽게 된다.
      const elsewhere = (characterRaidSeats.get(`${character.id}::${raid}`) ?? []).filter(
        (seat) => seat.assignmentId !== assignment.id,
      );
      if (elsewhere.length > 0) {
        const where = elsewhere.map((seat) => seatBrief(seat, slot.id)).join(", ");
        warnings.push(`이 캐릭터가 이번 주 같은 레이드에 중복 (${where})`);
      }

      // 시너지 트라이포드를 안 찍었다. 막지 않고 알리기만 한다(CLAUDE.md 3.4).
      if (missingSynergy(character.className, character.role, character.skillSynergies)) {
        warnings.push(MISSING_SYNERGY_WARNING);
      }

      if (character.syncError) warnings.push(character.syncError);

      return {
        position,
        assignmentId: assignment.id,
        pinned: assignment.pinned,
        character,
        createdByLabel: assignment.createdByLabel,
        mine: viewerLabel !== null && assignment.createdByLabel === viewerLabel,
        warnings,
      };
    }

    // 시너지는 4인 파티 단위로 적용된다. 8인을 한 덩어리로 계산하면 실제와 어긋난다.
    // 4인 레이드는 파티가 하나뿐이다.
    const parties: PartyView[] = partiesFor(view.partySize).map((positions, index) => {
      const cells = positions.map(toCell);
      return {
        index,
        cells,
        synergies: partySynergies(
          cells.map((c) => ({
            className: c.character?.className ?? null,
            classEngraving: c.character?.classEngraving,
            role: c.character?.role,
            detected: c.character?.skillSynergies,
          })),
        ),
      };
    });

    return {
      ...view,
      parties,
      takenNames: [...(raidRoster.get(view.raidName.trim()) ?? [])],
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
    select: {
      id: true,
      raidName: true,
      difficulty: true,
      partySize: true,
      keepRoster: true,
      dayOfWeek: true,
    },
  });
  if (!slot) throw new BoardError("슬롯을 찾을 수 없습니다");
  return {
    ...slot,
    // 기록에 남길 이름. 난이도까지 붙인다 — 같은 레이드의 노말과 하드가 요일표에
    // 나란히 서 있어, raidName만 남기면 이력에서 어느 쪽 얘기인지 갈리지 않는다.
    // 요일표 쪽(slots.ts)은 처음부터 이 이름으로 남기고 있었다.
    label: raidLabel(slot.raidName, slot.difficulty),
    partySize: (isPartySize(slot.partySize) ? slot.partySize : DEFAULT_PARTY_SIZE) as PartySize,
  };
}

function requireCurrentWeek(weekStart: Date) {
  if (weekStart.getTime() !== getPlanningWeekStart().getTime()) {
    throw new BoardError("지난 주 편성은 고칠 수 없습니다");
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
  if (!name) throw new BoardError("캐릭터 닉네임을 입력해 주세요");

  requireCurrentWeek(weekStart);
  const slot = await requireSlot(instanceId, slotId);
  // 화요일 슬롯은 저장되는 주차가 다르다(week.ts). 화면이 넘겨준 주차를 그대로 쓰면
  // 화요일 칸에 넣은 사람이 다음 주 칸에 들어간다.
  const week = weekStartForDay(weekStart, slot.dayOfWeek);
  // 4인 슬롯에 2파티 자리가 들어오면 화면에 나오지 않는 유령 배정이 된다.
  if (!isValidPosition(position, slot.partySize)) throw new BoardError("잘못된 자리입니다");

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

  // 서폿은 파티의 폿 자리로 보낸다. 딜 칸에 이름을 쳐 넣어도 자리를 다시 옮길 일이
  // 없게 하기 위한 것이고, 폿 자리가 이미 차 있으면 친 자리에 그대로 둔다(경고만 뜬다).
  let seat = position;
  if (character.role === "SUPPORT" && positionKind(position) === "DPS") {
    const supSeat = partiesFor(slot.partySize)[partyIndexOf(position)]?.find(
      (p) => positionKind(p) === "SUP",
    );
    if (supSeat) {
      const taken = await prisma.assignment.findUnique({
        where: { slotId_weekStart_position: { slotId, weekStart: week, position: supSeat } },
        select: { characterId: true },
      });
      if (!taken || taken.characterId === character.id) seat = supSeat;
    }
  }

  await prisma.assignment.upsert({
    where: { slotId_weekStart_position: { slotId, weekStart: week, position: seat } },
    update: { characterId: character.id, createdByLabel: actorLabel ?? null },
    create: {
      slotId,
      weekStart: week,
      position: seat,
      characterId: character.id,
      createdByLabel: actorLabel ?? null,
    },
  });

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart: week,
      slotId,
      actorLabel: actorLabel ?? null,
      action: "assign",
      detail: { position: seat, character: character.name, raid: slot.label },
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
  const week = weekStartForDay(weekStart, slot.dayOfWeek);

  const removed = await prisma.assignment.findUnique({
    where: { slotId_weekStart_position: { slotId, weekStart: week, position } },
    select: { character: { select: { name: true } } },
  });
  if (!removed) return;

  await prisma.assignment.delete({
    where: { slotId_weekStart_position: { slotId, weekStart: week, position } },
  });

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart: week,
      slotId,
      actorLabel: actorLabel ?? null,
      action: "unassign",
      detail: { position, character: removed.character.name, raid: slot.label },
    },
  });
}

/**
 * 카드를 다른 자리로 옮긴다. 드래그로 자리를 바꾸는 경로다.
 *
 * 받는 자리가 비어 있으면 그냥 옮기고, 차 있으면 **맞바꾼다.** 편성을 짤 때는
 * "이 둘의 자리를 바꾸고 싶다"가 대부분이라 밀어내고 지우는 것보다 낫다.
 *
 * (slotId, weekStart, position) 유니크 제약 때문에 맞바꾸는 중간에 두 행이 같은 자리를
 * 가리키는 순간이 생기면 안 된다. 한쪽을 임시 자리로 잠깐 비켜두고 트랜잭션으로 묶는다.
 */
export async function moveAssignment(params: {
  instanceId: string;
  weekStart: Date;
  from: { slotId: string; position: string };
  to: { slotId: string; position: string };
  actorLabel?: string | null;
}): Promise<void> {
  const { instanceId, weekStart, from, to, actorLabel } = params;
  requireCurrentWeek(weekStart);
  if (from.slotId === to.slotId && from.position === to.position) return;

  const fromSlot = await requireSlot(instanceId, from.slotId);
  const toSlot = await requireSlot(instanceId, to.slotId);
  // 자리 이름이 유효한지는 슬롯마다 다르다. 8인에서 4인으로 옮길 때 2파티 자리는 없다.
  if (
    !isValidPosition(from.position, fromSlot.partySize) ||
    !isValidPosition(to.position, toSlot.partySize)
  ) {
    throw new BoardError("잘못된 자리입니다");
  }

  // 화요일 슬롯은 주차가 다르므로, 화요일과 다른 요일 사이를 오갈 때는 주차도 함께 바뀐다.
  const fromWeek = weekStartForDay(weekStart, fromSlot.dayOfWeek);
  const toWeek = weekStartForDay(weekStart, toSlot.dayOfWeek);

  const moved = await prisma.$transaction(async (tx) => {
    const source = await tx.assignment.findUnique({
      where: {
        slotId_weekStart_position: {
          slotId: from.slotId,
          weekStart: fromWeek,
          position: from.position,
        },
      },
      select: { id: true, character: { select: { name: true } } },
    });
    if (!source) throw new BoardError("옮길 캐릭터가 없습니다");

    const target = await tx.assignment.findUnique({
      where: {
        slotId_weekStart_position: {
          slotId: to.slotId,
          weekStart: toWeek,
          position: to.position,
        },
      },
      select: { id: true },
    });

    if (target) {
      // 자리 이름은 자유 문자열이라 겹치지 않을 임시값을 쓸 수 있다.
      await tx.assignment.update({
        where: { id: source.id },
        data: { position: `MOVING:${source.id}` },
      });
      await tx.assignment.update({
        where: { id: target.id },
        data: { slotId: from.slotId, weekStart: fromWeek, position: from.position },
      });
    }

    await tx.assignment.update({
      where: { id: source.id },
      data: { slotId: to.slotId, weekStart: toWeek, position: to.position },
    });

    return { name: source.character.name, swapped: Boolean(target) };
  });

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart: toWeek,
      slotId: to.slotId,
      actorLabel: actorLabel ?? null,
      action: moved.swapped ? "swap" : "move",
      detail: {
        character: moved.name,
        from: { raid: fromSlot.label, position: from.position },
        to: { raid: toSlot.label, position: to.position },
      },
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
  actorLabel?: string | null;
}): Promise<void> {
  const { instanceId, slotId, weekStart, position, pinned, actorLabel } = params;
  requireCurrentWeek(weekStart);
  const slot = await requireSlot(instanceId, slotId);
  const week = weekStartForDay(weekStart, slot.dayOfWeek);

  await prisma.assignment.update({
    where: { slotId_weekStart_position: { slotId, weekStart: week, position } },
    data: { pinned },
  });

  /*
   * 한 자리라도 풀리면 "전원 고정"이 아니다.
   *
   * 토글만 켜져 있고 실제로는 일곱만 넘어가는 상태를 두면, 다음 주에 한 자리가 왜
   * 비었는지 아무도 설명하지 못한다. 나머지 핀은 그대로 둔다. 방금 한 일은 "한 명을
   * 뺀 것"이지 "고정을 전부 푼 것"이 아니다.
   */
  if (!pinned && slot.keepRoster) {
    await prisma.raidSlot.updateMany({
      where: { id: slotId, instanceId },
      data: { keepRoster: false },
    });
  }

  await prisma.changeLog.create({
    data: {
      instanceId,
      weekStart: week,
      slotId,
      actorLabel: actorLabel ?? null,
      action: "pin",
      detail: { position, pinned, raid: slot.label },
    },
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
  // 화요일 슬롯은 주차가 다르다(week.ts). 둘 다 읽고 슬롯마다 제 것만 센다.
  const tuesdayWeek = tuesdayWeekFor(weekStart);
  const weeks = [weekStart, tuesdayWeek];

  const slots = await prisma.raidSlot.findMany({
    where: {
      instanceId,
      archivedAt: null,
      OR: [
        { keepRoster: true },
        { assignments: { some: { weekStart: { in: weeks }, pinned: true } } },
      ],
    },
    select: {
      id: true,
      dayOfWeek: true,
      startTime: true,
      raidName: true,
      difficulty: true,
      keepRoster: true,
      assignments: {
        where: { weekStart: { in: weeks }, pinned: true },
        select: { weekStart: true, position: true, character: { select: { name: true } } },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const entries: PinnedEntry[] = [];
  for (const slot of slots) {
    const label = raidLabel(slot.raidName, slot.difficulty);
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
    const mine = slot.dayOfWeek === TUESDAY ? tuesdayWeek : weekStart;
    for (const a of slot.assignments) {
      if (a.weekStart.getTime() !== mine.getTime()) continue;
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
