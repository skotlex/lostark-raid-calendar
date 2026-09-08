import { NextResponse, type NextRequest } from "next/server";

import { isStillGuildMember } from "@/lib/guildAccess";
import { SESSION_COOKIE, readSession } from "@/lib/session";

/**
 * 길드를 나간 사람의 세션을 지운다.
 *
 * `requireSession`이 재검사에서 걸린 사람을 여기로 보낸다. 페이지에서 곧장 지울 수
 * 없어 라우트 하나를 둔다 — 서버 컴포넌트는 쿠키를 쓸 수 없다(Next 제약).
 *
 * **로그아웃과 달리 GET이다.** 리다이렉트로 들어오는 자리라 POST일 수 없다. 대신
 * **여기서 멤버십을 한 번 더 확인하고, 정말 아닐 때만 지운다.** 그러지 않으면
 * 이미지 태그 하나로 남을 로그아웃시키는 장난이 된다(api/auth/logout과 같은 걱정).
 * 멀쩡한 길드원이 이 주소를 눌러도 세션은 그대로다.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const session = await readSession();

  if (!session) return NextResponse.redirect(new URL("/login", origin));

  if (await isStillGuildMember(session.discordUserId)) {
    // 길드원이 맞다. 지울 이유가 없으니 그냥 들여보낸다.
    return NextResponse.redirect(new URL("/", origin));
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "not_member");
  const res = NextResponse.redirect(url);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
