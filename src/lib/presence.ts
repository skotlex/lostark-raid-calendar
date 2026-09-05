import "server-only";

import { prisma } from "./prisma";

/**
 * 같은 편성표를 보고 있는 사람들.
 *
 * 시트에서 여럿이 한 표를 고칠 때 남의 커서가 보이던 자리다. 이 앱은 서버 액션으로
 * 저장하고 누른 사람의 화면만 다시 그리므로, 그냥 두면 옆에서 칸을 채워도 내 화면은
 * 새로고침 전까지 그대로다. 같은 칸을 동시에 만지면 뒤에 누른 쪽이 앞의 것을 덮는다.
 *
 * **WebSocket을 쓰지 않는다.** Vercel 서버리스 함수는 연결을 업그레이드받지 못하고,
 * SSE는 연결이 열려 있는 내내 함수가 도는 데다 인스턴스가 여럿이라 브로드캐스트에
 * 공유 pub/sub이 따로 필요하다. Neon 풀러(PgBouncer)로는 LISTEN/NOTIFY도 못 쓴다.
 * 길드원 열 명 남짓한 규모에 그 장치를 들이는 대신 **폴링 한 갈래**로 둔다
 * (api/presence). 발자국을 남기고 남의 발자국과 편성표 버전을 함께 받아온다.
 */

/**
 * 이 초 안에 발자국을 남긴 사람만 화면에 세운다.
 *
 * **간격이 붐빌 때 3초, 혼자일 때 15초로 갈리므로**(Presence.tsx) 느린 쪽을 기준으로
 * 잡는다. 한 번 걸러도 사라지지 않을 만큼은 넉넉하고, 탭을 닫은 사람이 오래 남아
 * 있을 만큼 길지는 않다.
 */
export const PRESENCE_TTL_SEC = 35;

/** 한 화면에 세울 최대 인원. 이보다 많으면 최근 사람부터 자른다. */
const MAX_VIEWERS = 20;

export interface ViewerPresence {
  /** 디스코드 사용자 ID. 사람마다 색을 고르는 열쇠로도 쓴다. */
  id: string;
  label: string;
  avatarUrl: string | null;
  /** 보고 있는 주차(`toWeekParam` 형식)와 요일 탭. */
  week: string;
  day: number;
  /** 지금 손이 가 있는 칸. 없으면 보고만 있는 것이다. */
  slotId: string | null;
  position: string | null;
}

export interface PresenceInput {
  instanceId: string;
  discordUserId: string;
  label: string;
  avatarUrl: string | null;
  week: string;
  day: number;
  slotId: string | null;
  position: string | null;
}

export interface PresenceResult {
  /**
   * 편성표가 마지막으로 바뀐 지점. 값이 달라졌으면 화면을 다시 그린다.
   *
   * 배정·해제·이동·고정과 요일표 편집이 모두 ChangeLog를 남기므로(board.ts, slots.ts)
   * 그 최신 줄의 id가 곧 버전이다. 세느라 표를 훑을 필요가 없고 인덱스가 이미 있다.
   */
  version: string;
  /** 나를 뺀 나머지. */
  viewers: ViewerPresence[];
}

/**
 * 내 발자국을 남기고 남의 발자국과 편성표 버전을 받아온다.
 *
 * 세 쿼리를 한꺼번에 낸다. 순서에 의미가 없어서다 — 내 줄은 어차피 결과에서 빼고,
 * 버전은 발자국과 상관이 없다. 순차로 내면 싱가포르 왕복이 세 번이 된다(CLAUDE.md 5장).
 */
export async function touchPresence(input: PresenceInput): Promise<PresenceResult> {
  const now = new Date();
  const fresh = new Date(now.getTime() - PRESENCE_TTL_SEC * 1000);

  const seat = {
    label: input.label,
    avatarUrl: input.avatarUrl,
    week: input.week,
    day: input.day,
    slotId: input.slotId,
    position: input.position,
    seenAt: now,
  };

  const [, rows, latest] = await Promise.all([
    prisma.presence.upsert({
      where: {
        instanceId_discordUserId: {
          instanceId: input.instanceId,
          discordUserId: input.discordUserId,
        },
      },
      create: {
        instanceId: input.instanceId,
        discordUserId: input.discordUserId,
        ...seat,
      },
      update: seat,
    }),
    prisma.presence.findMany({
      where: {
        instanceId: input.instanceId,
        seenAt: { gte: fresh },
        discordUserId: { not: input.discordUserId },
      },
      orderBy: { seenAt: "desc" },
      take: MAX_VIEWERS,
      select: {
        discordUserId: true,
        label: true,
        avatarUrl: true,
        week: true,
        day: true,
        slotId: true,
        position: true,
      },
    }),
    prisma.changeLog.findFirst({
      where: { instanceId: input.instanceId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  return {
    // 이력이 하나도 없는 새 인스턴스면 빈 문자열이다. 첫 편집이 들어오면 값이 생기고
    // 그때 한 번 달라지므로, 없는 상태를 따로 다룰 필요가 없다.
    version: latest?.id ?? "",
    viewers: rows.map((row) => ({
      id: row.discordUserId,
      label: row.label,
      avatarUrl: row.avatarUrl,
      week: row.week,
      day: row.day,
      slotId: row.slotId,
      position: row.position,
    })),
  };
}
