import "server-only";

import { prisma } from "./prisma";

/** 고정 요일표의 한 칸. 주차 개념이 없고 영속적이다. */
export interface SlotView {
  id: string;
  dayOfWeek: number;
  startTime: string;
  raidName: string;
  difficulty: string | null;
  partyLabel: string | null;
  keepRoster: boolean;
  sortOrder: number;
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
  partyLabel: true,
  keepRoster: true,
  sortOrder: true,
} as const;

type SlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  raidName: string;
  difficulty: string | null;
  partyLabel: string | null;
  keepRoster: boolean;
  sortOrder: number;
};

export function toSlotView(row: SlotRow): SlotView {
  return { ...row };
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
  partyLabel?: string | null;
  keepRoster?: boolean;
}

/** "20:00" 형식만 받는다. 자유 입력을 두면 정렬이 무너진다. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validate(input: SlotInput) {
  if (!Number.isInteger(input.dayOfWeek) || input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    throw new SlotError("요일을 고른다");
  }
  if (!TIME_PATTERN.test(input.startTime)) {
    throw new SlotError("시간은 20:00 형식으로 입력한다");
  }
  if (!input.raidName.trim()) {
    throw new SlotError("레이드 이름을 입력한다");
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
    partyLabel: trim(input.partyLabel),
    keepRoster: input.keepRoster ?? false,
  };
}

export async function createSlot(instanceId: string, input: SlotInput): Promise<SlotView> {
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
  return toSlotView(row);
}

export async function updateSlot(
  instanceId: string,
  slotId: string,
  input: SlotInput,
): Promise<SlotView> {
  validate(input);
  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId },
    data: normalize(input),
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없다");

  const row = await prisma.raidSlot.findUniqueOrThrow({
    where: { id: slotId },
    select: slotSelect,
  });
  return toSlotView(row);
}

/**
 * 레이드 단위 리셋 제외 토글.
 *
 * 켜는 순간 이번 주 편성이 다음 주로 넘어가게 된다.
 */
export async function setKeepRoster(
  instanceId: string,
  slotId: string,
  keepRoster: boolean,
): Promise<void> {
  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId },
    data: { keepRoster },
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없다");
}

/**
 * 삭제하지 않고 보관한다.
 *
 * 실제로 지우면 과거 주차의 편성 기록까지 함께 사라진다. 누가 언제 무엇을 갔는지가
 * 이 앱의 유일한 기록이므로 되돌릴 수 없는 삭제를 기본으로 두지 않는다.
 */
export async function archiveSlot(instanceId: string, slotId: string): Promise<void> {
  const result = await prisma.raidSlot.updateMany({
    where: { id: slotId, instanceId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (result.count === 0) throw new SlotError("슬롯을 찾을 수 없다");
}
