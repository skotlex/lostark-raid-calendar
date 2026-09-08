import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { findInstance } from "@/lib/instance";
import { touchPresence } from "@/lib/presence";
import { isStillGuildMember } from "@/lib/guildAccess";
import { readSession } from "@/lib/session";

/**
 * 발자국 하나를 남기고 남의 발자국과 편성표 버전을 돌려준다.
 *
 * **서버 액션이 아니라 라우트다.** 몇 초마다 도는 곁다리라 사용자가 누른 배정·삭제와
 * 같은 줄에 서면 안 된다(api/sync-stale과 같은 이유). 액션은 순서대로 처리돼서,
 * 하필 하트비트가 앞에 있으면 방금 누른 것이 그만큼 밀린다.
 *
 * 이름과 얼굴은 **폼이 아니라 세션에서 읽는다.** 받으면 아무 이름이나 적어 남의
 * 표식을 만들어 낼 수 있다(CLAUDE.md 4장).
 */

const bodySchema = z.object({
  slug: z.string().min(1),
  week: z.string().min(1),
  day: z.number().int().min(0).max(7),
  slotId: z.string().nullable(),
  position: z.string().nullable(),
});

/** 실패해도 화면은 지금 값 그대로 둔다. 곁다리가 본 일을 막지 않는다. */
const EMPTY = { version: null, viewers: [] };

export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json(EMPTY, { status: 401 });

  /*
   * 여기도 멤버십을 본다(§4). 페이지는 다음 이동에서 걸리지만, 열어둔 탭은 그대로
   * 몇 초마다 발자국을 남긴다. 길드를 나간 사람이 남의 화면에 "보고 있는 사람"으로
   * 계속 서 있을 이유가 없다. 캐시가 답하므로 이 왕복에 비용이 붙지 않는다.
   */
  if (!(await isStillGuildMember(session.discordUserId))) {
    return NextResponse.json(EMPTY, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(EMPTY, { status: 400 });

  const instance = await findInstance(parsed.data.slug);
  if (!instance) return NextResponse.json(EMPTY, { status: 404 });

  const result = await touchPresence({
    instanceId: instance.id,
    discordUserId: session.discordUserId,
    label: session.label,
    avatarUrl: session.avatarUrl,
    week: parsed.data.week,
    day: parsed.data.day,
    slotId: parsed.data.slotId,
    position: parsed.data.position,
  });

  return NextResponse.json(result);
}
