import { NextResponse, type NextRequest } from "next/server";

import { syncStaleCharacters } from "@/lib/characters";
import { findInstance } from "@/lib/instance";
import { readSession } from "@/lib/session";

/**
 * 오래된 캐릭터 스펙을 뒤에서 갱신한다.
 *
 * **서버 액션이 아니라 라우트다.** 액션으로 두면 React가 폼 동작과 같은 줄에 세워서,
 * 갱신이 도는 동안(캐릭터가 많으면 수십 초다) 사용자가 누른 삭제·등록이 그 뒤에 밀린다.
 * 화면은 멀쩡한데 아무 반응이 없는 것처럼 보인다.
 *
 * 갱신은 사용자가 시킨 일이 아니라 곁다리다. 곁다리가 본 일을 막으면 안 된다.
 */
export async function POST(request: NextRequest) {
  const session = await readSession();
  if (!session) return NextResponse.json({ synced: 0 }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const slug =
    typeof body === "object" && body !== null && typeof (body as { slug?: unknown }).slug === "string"
      ? (body as { slug: string }).slug
      : "";
  if (!slug) return NextResponse.json({ synced: 0 }, { status: 400 });

  const instance = await findInstance(slug);
  if (!instance) return NextResponse.json({ synced: 0 }, { status: 404 });

  const synced = await syncStaleCharacters(instance.id);
  return NextResponse.json({ synced });
}
