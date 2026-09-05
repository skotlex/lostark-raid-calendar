import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { logEvent } from "./history";
import { DEFAULT_PARTY_SIZE, type PartySize, isPartySize } from "./positions";
import { prisma } from "./prisma";
import { raidLabel, sizeFor } from "./raids";

/** 고정 요일표의 한 칸. 주차 개념이 없고 영속적이다. */
export interface SlotView {
  id: string;
  dayOfWeek: number;
  startTime: string;
  raidName: string;
  difficulty: string | null;
  /** 4인이면 1파티만 쓴다. */
  partySize: PartySize;
  keepRoster: boolean;
  sortOrder: number;
}

/**
 * 요일표 변경을 기록에 남긴다.
 *
 * 누구나 남의 슬롯을 고치고 내릴 수 있으므로(하드 블로킹을 두지 않는다), 무엇이
 * 어떻게 바뀌었는지는 남아 있어야 한다. 편성 변경과 같은 표에 쌓아 한 줄로 읽는다.
 */
function log(
  instanceId: string,
  action: string,
  slotId: string | null,
  actorLabel: string | null | undefined,
  detail: Prisma.InputJsonObject,
): Promise<void> {
  return logEvent({ instanceId, action, slotId, actorLabel, detail });
}

export class SlotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotError";
  }
}

const slotSelect = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  raidName: true,
  difficulty: true,
  partySize: true,
  keepRoster: true,
  sortOrder: true,
} as const;

type SlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  raidName: string;
  difficulty: string | null;
  partySize: number;
  keepRoster: boolean;
  sortOrder: number;
};

/**
 * 화면에 넘길 필드만 골라 담는다.
 *
 * 스프레드(`{...row}`)를 쓰면 호출부가 관계를 함께 조회했을 때 그 원본까지 딸려 간다.
 * Prisma의 Decimal은 클라이언트 컴포넌트로 넘길 수 없어 그대로 터진다.
 */
export function toSlotView(row: SlotRow): SlotView {
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    raidName: row.raidName,
    difficulty: row.difficulty,
    // 옛 행이나 손으로 고친 값이 4도 8도 아닐 수 있다. 화면이 깨지지 않게 8인으로 읽는다.
    partySize: isPartySize(row.partySize) ? row.partySize : DEFAULT_PARTY_SIZE,
    keepRoster: row.keepRoster,
    sortOrder: row.sortOrder,
  };
}

/** 보관 처리한 슬롯은 뺀다. 과거 주차 기록은 남지만 요일표에는 나오지 않는다. */
export async function listSlots(instanceId: string): Promise<SlotView[]> {
  const rows = await prisma.raidSlot.findMany({
    where: { instanceId, archivedAt: null },
    select: slotSelect,
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map(toSlotView);
}

export interface SlotInput {
  dayOfWeek: number;
  startTime: string;
  raidName: string;
  difficulty?: string | null;
  /** 보통은 비워 둔다. 레이드 이름에서 끌어낸다. */
  partySize?: number;
  keepRoster?: boolean;
}

/** "20:00" 형식만 받는다. 자유 입력을 두면 정렬이 무너진다. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validate(input: SlotInput) {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new SlotError("요일을 골라 주세요");
  }
  if (!TIME_PATTERN.test(input.startTime)) {
    throw new SlotError("시간은 20:00 형식으로 입력해 주세요");
  }
  if (!input.raidName.trim()) {
    throw new SlotError("레이드 이름을 입력해 주세요");
  }
  if (input.partySize !== undefined && !isPartySize(input.partySize)) {
    throw new SlotError("인원은 4인 또는 8인입니다");
  }
}

function normalize(input: SlotInput) {
  const trim = (v: string | null | undefined) => {
    const t = v?.trim();
    return t ? t : null;
  };
  return {
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    raidName: input.raidName.trim(),
    difficulty: trim(input.difficulty),
    // 4인인지 8인인지는 레이드가 정하는 값이라 사람에게 묻지 않는다.
    // 프리셋에 없는 이름은 8인으로 둔다(sizeFor).
    partySize: isPartySize(input.partySize) ? input.partySize : sizeFor(input.raidName),
    keepRoster: input.keepRoster ?? false,
  };
}

export async function createSlot(
  instanceId: string,
  input: SlotInput,
  actorLabel?: string | null,
): Promise<SlotView> {
  validate(input);
  const last = await prisma.raidSlot.findFirst({
    where: { instanceId, dayOfWeek: input.dayOfWeek },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const row = await prisma.raidSlot.create({
    data: {
      instanceId,
      sortOrder: (last?.sortOrder ?? -1) + 1,
      ...normalize(input),
    },
    select: slotSelect,
  });

  await log(instanceId, "slot_create", row.id, actorLabel, {
    raid: raidLabel(row.raidName, row.difficulty),
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
  });

  return toSlotView(row);
}

export async function updateSlot(
  instanceId: string,
  slotId: string,
  input: SlotInput,
  actorLabel?: string | null,
): Promise<SlotView> {
  validate(input);
  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId },
    data: normalize(input),
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없습니다");

  const row = await prisma.raidSlot.findUniqueOrThrow({
    where: { id: slotId },
    select: slotSelect,
  });

  await log(instanceId, "slot_update", row.id, actorLabel, {
    raid: raidLabel(row.raidName, row.difficulty),
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
  });

  return toSlotView(row);
}

/**
 * 레이드 단위 리셋 제외 토글.
 *
 * 켜는 순간 이번 주 편성이 다음 주로 넘어가게 된다.
 *
 * **자리 고정도 함께 움직인다.** 켜면 그 주 인원 전체에 핀이 꽂히고, 끄면 모두 빠진다.
 * 그러지 않으면 "전원 고정"이라 해놓고 카드에는 아무 표시가 없어, 무엇이 넘어가는지
 * 칸을 보고는 알 수 없다. 한 명만 풀면 더 이상 "전원"이 아니므로 토글이 꺼진다
 * (board.ts의 setPinned).
 */
export async function setKeepRoster(
  instanceId: string,
  slotId: string,
  keepRoster: boolean,
  weekStart: Date,
  actorLabel?: string | null,
): Promise<void> {
  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId },
    data: { keepRoster },
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없습니다");

  await prisma.assignment.updateMany({
    where: { slotId, weekStart },
    data: { pinned: keepRoster },
  });

  await log(instanceId, "slot_keep", slotId, actorLabel, {
    raid: await slotLabel(slotId),
    keepRoster,
  });
}

/** 기록에 남길 이름. 슬롯이 그새 사라졌으면 빈 값으로 둔다. */
async function slotLabel(slotId: string): Promise<string> {
  const row = await prisma.raidSlot.findUnique({
    where: { id: slotId },
    select: { raidName: true, difficulty: true },
  });
  return row ? raidLabel(row.raidName, row.difficulty) : "";
}

/**
 * 삭제하지 않고 보관한다.
 *
 * 실제로 지우면 과거 주차의 편성 기록까지 함께 사라진다. 누가 언제 무엇을 갔는지가
 * 이 앱의 유일한 기록이므로 되돌릴 수 없는 삭제를 기본으로 두지 않는다.
 */
export async function archiveSlot(
  instanceId: string,
  slotId: string,
  actorLabel?: string | null,
): Promise<void> {
  // 이름은 지우기 전에 읽는다. 내린 뒤에는 목록에서 찾을 수 없다.
  const label = await slotLabel(slotId);

  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없습니다");

  await log(instanceId, "slot_archive", slotId, actorLabel, { raid: label });
}
