import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

// 요청을 받아야 판단이 서므로 프리렌더 대상이 아니다.
export const dynamic = "force-dynamic";

/**
 * DB를 하루에 한 번 깨워 일시정지를 막는다.
 *
 * Supabase 무료 프로젝트는 **7일간 DB 활동이 없으면 정지된다.** 정지되면 대시보드에서
 * 사람이 직접 `Resume project`를 눌러야 하고, 그때까지 사이트가 열리지 않는다. Neon의
 * 5분 잠들기가 요청이 오면 알아서 깨던 것과 다른 점이 여기다 — **자동으로 돌아오지
 * 않는다.**
 *
 * 매주 수요일 리셋에 맞춰 편성을 짜는 앱이라 현실적으로 7일이 비는 일은 드물지만,
 * 길드가 한 주 쉬면 그대로 걸린다. 그때 알아채는 방법이 "길드원이 안 열린다고 말하는
 * 것"뿐이라 하루 한 번 찌르는 편이 싸다.
 *
 * 무엇을 읽는지는 중요하지 않다. **컴퓨트가 깨어 쿼리를 처리했다는 사실만** 있으면 된다.
 * 그래서 가장 가벼운 것을 센다.
 *
 * Vercel Hobby 플랜의 크론은 하루 한 번이 상한이다. 그것으로 충분하다.
 */
export async function GET(request: NextRequest) {
  /*
   * Vercel은 CRON_SECRET이 설정돼 있으면 크론 요청에 Bearer로 실어 보낸다.
   * 없으면 검사하지 않는다 — 로컬과 아직 값을 안 넣은 배포에서도 돌아야 하고,
   * 막지 못해 새는 것이 고작 "행이 몇 개인지"라 가릴 값이 아니다.
   */
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.instance.count();

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
