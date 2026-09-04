import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/**
 * 로그아웃.
 *
 * GET이 아니라 POST다. 이미지 태그나 링크 미리보기만으로 남을 로그아웃시킬 수 있으면
 * 사소하지만 성가신 장난이 된다.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin), {
    // POST의 리다이렉트를 GET으로 바꿔 따라가게 한다. 303이 아니면 브라우저가
    // /login에도 POST를 보낸다.
    status: 303,
  });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
