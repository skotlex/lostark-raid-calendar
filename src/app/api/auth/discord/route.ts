import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { authorizeUrl } from "@/lib/discord";
import { sessionCookieOptions } from "@/lib/session";

import { OAUTH_COOKIE, packOAuthCookie, safeNext } from "./state";

/**
 * 로그인 시작. 디스코드 동의 화면으로 보낸다.
 *
 * `state`는 CSRF 방지용이다. 여기서 만든 값을 쿠키에 심어두고 콜백에서 대조한다.
 * 이게 없으면 남이 만든 콜백 URL을 물려 다른 계정으로 로그인시킬 수 있다.
 */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const state = randomBytes(16).toString("base64url");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const response = NextResponse.redirect(authorizeUrl(origin, state));
  // 동의 화면을 오래 붙들고 있을 수 있으니 10분은 준다.
  response.cookies.set(OAUTH_COOKIE, packOAuthCookie(state, next), sessionCookieOptions(600));
  return response;
}
